import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ProviderHealthService } from '../provider-health/provider-health.service';
import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';

export interface CompleteRequest {
  purpose: string;
  sessionId?: string;
  messages: any[];
  responseSchema?: z.ZodTypeAny;
}

export interface LiveStreamAdapter {
  sendAudioChunk: (base64Audio: string) => void;
  commitAudio: () => void;
  updatePrompt?: (prompt: string) => void;
  onAudioReceived: (handler: (base64Audio: string) => void) => void;
  onTextReceived: (handler: (text: string) => void) => void;
  onClose: (handler: () => void) => void;
  close: () => void;
}

@Injectable()
export class ProviderRouterService {
  private geminiClient: GoogleGenAI;
  private openAiClient: OpenAI;

  constructor(private readonly healthService: ProviderHealthService) {
    this.geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async complete(request: CompleteRequest): Promise<{ content: any }> {
    // 1. Try Gemini (Primary)
    const geminiHealth = await this.healthService.checkHealth('gemini');
    if (geminiHealth) {
      try {
        const result = await this.callGemini(request);
        await this.healthService.recordSuccess('gemini');
        if (request.sessionId) {
          await this.healthService.logUsage(
            'gemini',
            'gemini-2.5-flash',
            request.sessionId,
            result.tokensIn,
            result.tokensOut,
            result.tokensIn * 0.00000015 + result.tokensOut * 0.0000006,
          );
        }
        return { content: result.content };
      } catch (e: any) {
        await this.healthService.recordFailure('gemini', e.message);
        console.warn(
          `[ProviderRouter] Gemini failed, falling back. Error: ${e.message}`,
        );
      }
    }

    // 2. Try OpenAI (Secondary Fallback)
    const openAiHealth = await this.healthService.checkHealth('openai');
    if (openAiHealth) {
      try {
        const result = await this.callOpenAI(request);
        await this.healthService.recordSuccess('openai');
        if (request.sessionId) {
          await this.healthService.logUsage(
            'openai',
            'gpt-4o-mini',
            request.sessionId,
            result.tokensIn,
            result.tokensOut,
            result.tokensIn * 0.00000015 + result.tokensOut * 0.0000006,
          );
        }
        return { content: result.content };
      } catch (e: any) {
        await this.healthService.recordFailure('openai', e.message);
        console.warn(`[ProviderRouter] OpenAI failed. Error: ${e.message}`);
      }
    }

    throw new InternalServerErrorException(
      'All LLM providers failed or are degraded.',
    );
  }

  private async callGemini(request: CompleteRequest) {
    const prompt = request.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const config: any = {};
    if (request.responseSchema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = zodToJsonSchema(
        request.responseSchema as any,
      ) as any;
    }

    const res = await this.geminiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config,
    });

    let content = res.text;
    if (request.responseSchema && res.text) {
      // Strip markdown JSON fences if present
      const cleanText = res.text
        .replace(/^```json\n/, '')
        .replace(/\n```$/, '')
        .trim();
      content = JSON.parse(cleanText);
    }
    return {
      content,
      tokensIn: res.usageMetadata?.promptTokenCount || 0,
      tokensOut: res.usageMetadata?.candidatesTokenCount || 0,
    };
  }

  private async callOpenAI(request: CompleteRequest) {
    const config: any = {
      model: 'gpt-4o-mini',
      messages: request.messages,
    };
    if (request.responseSchema) {
      config.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: zodToJsonSchema(request.responseSchema as any),
          strict: true,
        },
      };
    }

    const res = await this.openAiClient.chat.completions.create(config);

    let content: any = res.choices[0].message.content;
    if (request.responseSchema) {
      content = JSON.parse(content || '{}');
    }
    return {
      content,
      tokensIn: res.usage?.prompt_tokens || 0,
      tokensOut: res.usage?.completion_tokens || 0,
    };
  }

  async connectLiveStream(
    sessionId: string,
    initialPrompt?: string,
  ): Promise<LiveStreamAdapter> {
    const geminiHealth = await this.healthService.checkHealth('gemini');
    if (!geminiHealth) {
      throw new InternalServerErrorException(
        'Gemini provider is unhealthy. Realtime API requires Gemini currently.',
      );
    }

    let audioHandler: ((audio: string) => void) | null = null;
    let textHandler: ((text: string) => void) | null = null;
    let closeHandler: (() => void) | null = null;

    try {
      const config: any = {
        systemInstruction: initialPrompt ? { parts: [{ text: initialPrompt }] } : undefined,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck' // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'
              }
            }
          }
        }
      };

      // Connect to Gemini Live API
      const session = await this.geminiClient.live.connect({
        model: 'models/gemini-2.0-flash-exp',
        config,
        callbacks: {
          onmessage: (data: any) => {
            const sc = data.serverContent || data;
            if (sc?.modelTurn) {
              const parts = sc.modelTurn.parts || [];
              for (const part of parts) {
                if (part.inlineData && part.inlineData.data && audioHandler) {
                  audioHandler(part.inlineData.data);
                }
                if (part.text && textHandler) {
                  textHandler(part.text);
                }
              }
            }
          },
          onclose: () => {
            if (closeHandler) closeHandler();
          },
          onerror: (err: any) => {
            console.error('[ProviderRouter LiveStream] WebSocket error:', err);
            this.healthService.recordFailure('gemini', err?.message || 'WebSocket Error');
          }
        }
      });

      if (initialPrompt) {
        // Nudge the model to ask the question
        (session as any).send({
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [{ text: 'I am ready. Please ask the question.' }]
              }
            ],
            turnComplete: true
          }
        });
      }

      const adapter: LiveStreamAdapter = {
        sendAudioChunk: (base64Audio: string) => {
          (session as any).send({
            realtimeInput: {
              mediaChunks: [{
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio
              }]
            }
          });
        },
        commitAudio: () => {
          // Tell Gemini the user has finished speaking for this turn
          (session as any).send({
            clientContent: {
              turns: [],
              turnComplete: true
            }
          });
        },
        updatePrompt: (prompt: string) => {
          // Send a nudge as text to simulate updating the instructions
          (session as any).send({
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: `System Note: ${prompt}. I am ready for the next question. Please ask it.` }]
                }
              ],
              turnComplete: true
            }
          });
        },
        onAudioReceived: (handler) => {
          audioHandler = handler;
        },
        onTextReceived: (handler) => {
          textHandler = handler;
        },
        onClose: (handler) => {
          closeHandler = handler;
        },
        close: () => {
          try {
             // In the new SDK, disconnect or close is used?
             // Since we don't have exactly the typescript def for close, let's just emit close on our end or call disconnect
             // The GoogleGenAI Live object might have disconnect()
             if ((session as any).disconnect) {
               (session as any).disconnect();
             } else if ((session as any).close) {
               (session as any).close();
             }
          } catch(e) {}
        },
      };

      return adapter;
    } catch (err: any) {
      console.error('[ProviderRouter LiveStream] Connection error:', err);
      this.healthService.recordFailure('gemini', err.message);
      throw err;
    }
  }
}
