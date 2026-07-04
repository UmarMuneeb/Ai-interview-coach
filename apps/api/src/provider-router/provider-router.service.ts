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

@Injectable()
export class ProviderRouterService {
  private geminiClient: GoogleGenAI;
  private openAiClient: OpenAI;

  constructor(private readonly healthService: ProviderHealthService) {
    this.geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Text / LLM completion — Gemini primary, OpenAI fallback
  // ─────────────────────────────────────────────────────────────────────

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
        console.warn(`[ProviderRouter] Gemini failed, falling back. Error: ${e.message}`);
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

    throw new InternalServerErrorException('All LLM providers failed or are degraded.');
  }

  // ─────────────────────────────────────────────────────────────────────
  // TTS — Inworld primary, Gemini fallback
  // Returns base64-encoded audio string
  // ─────────────────────────────────────────────────────────────────────

  async synthesizeSpeech(text: string, sessionId?: string): Promise<string> {
    const inworldKey = process.env.INWORLD_API_KEY;
    const voice = process.env.INWORLD_TTS_VOICE || 'Alex';

    // Primary: Inworld TTS REST API
    if (inworldKey) {
      try {
        const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${inworldKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voiceId: voice,
            modelId: 'inworld-tts-1.5-max',
            text,
            audioConfig: {
              audioEncoding: 'MP3',
              sampleRateHertz: 24000,
            },
          }),
        });

        if (res.ok) {
          const data: any = await res.json();
          if (data.audioContent) {
            console.log('[ProviderRouter TTS] Inworld TTS success');
            if (sessionId) {
              await this.healthService.logUsage('inworld', 'inworld-tts-1.5-max', sessionId, 0, 0, 0);
            }
            return data.audioContent; // base64 MP3
          }
        } else {
          const errText = await res.text();
          console.warn(`[ProviderRouter TTS] Inworld returned ${res.status}: ${errText}`);
        }
      } catch (e: any) {
        console.warn(`[ProviderRouter TTS] Inworld TTS failed: ${e.message}`);
      }
    } else {
      console.warn('[ProviderRouter TTS] No INWORLD_API_KEY set, trying Gemini TTS fallback');
    }

    // Fallback: Gemini generateContent with AUDIO modality
    try {
      console.log('[ProviderRouter TTS] Falling back to Gemini TTS...');
      const res = await this.geminiClient.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: text,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        } as any,
      });

      const parts = res.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).inlineData?.data) {
          console.log('[ProviderRouter TTS] Gemini TTS fallback success');
          return (part as any).inlineData.data; // base64 PCM/WAV
        }
      }
      throw new Error('Gemini TTS returned no audio data');
    } catch (e: any) {
      console.error('[ProviderRouter TTS] Gemini TTS fallback also failed:', e.message);
      throw new InternalServerErrorException('All TTS providers failed.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────

  private async callGemini(request: CompleteRequest) {
    const prompt = request.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const config: any = {};
    if (request.responseSchema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = zodToJsonSchema(request.responseSchema as any) as any;
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
}
