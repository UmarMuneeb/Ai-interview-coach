import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

import { ProviderRouterService } from '../provider-router/provider-router.service';
import { ConversationService } from './conversation.service';

@WebSocketGateway({ cors: true })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly providerRouter: ProviderRouterService,
    private readonly conversationService: ConversationService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      let token =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!token) throw new Error('No token provided');
      if (token.startsWith('Bearer ')) token = token.split(' ')[1];

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'fallback_secret',
      });
      client.data.user = payload;
      console.log(`[VoiceGateway] Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (e: any) {
      console.log(`[VoiceGateway] Unauthorized: ${e.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[VoiceGateway] Client disconnected: ${client.id}`);
    this.conversationService.cleanup(client.id);
  }

  /**
   * Start a new voice interview session.
   * AI greets the candidate and speaks the intro question via TTS.
   */
  @SubscribeMessage('start_voice_session')
  async handleStartVoiceSession(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      sessionId: string;
      field?: string;
      role?: string;
      difficulty?: number;
      questions?: Array<{ prompt: string; topic: string; difficulty: number }>;
      firstQuestion?: string;
    },
  ) {
    console.log(`[VoiceGateway] Starting voice session for ${client.id}`);
    try {
      const field = payload.field || 'Full-stack Engineering';
      const role = payload.role || field;
      const difficulty = payload.difficulty || 1;
      const questions = payload.questions || [];
      const firstQuestion = payload.firstQuestion || questions[0]?.prompt || 'Tell me about a recent technical challenge you faced.';

      // Initialize conversation — get AI greeting text
      const greetingText = await this.conversationService.startConversation(
        client.id,
        payload.sessionId,
        field,
        role,
        difficulty,
        questions,
        firstQuestion,
      );

      // Convert greeting to speech (preserving actual mimeType from provider)
      const { audio, mimeType } = await this.providerRouter.synthesizeSpeech(
        greetingText,
        payload.sessionId,
      );

      client.emit('voice_session_started', { success: true });
      client.emit('ai_text', { text: greetingText });
      client.emit('audio_response', { delta: audio, mimeType });
      console.log(`[VoiceGateway] Sent opening greeting for session ${payload.sessionId}`);
    } catch (err: any) {
      console.error(`[VoiceGateway] Error starting voice session: ${err.message}`);
      client.emit('voice_error', { message: `Failed to start voice session: ${err.message}` });
    }
  }

  /**
   * Process a user's voice turn: transcript → LLM → TTS → emit audio back.
   */
  @SubscribeMessage('voice_turn')
  async handleVoiceTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      transcript: string;
      sessionId: string;
      currentQuestion?: string;
      wasCorrect?: boolean;
    },
  ) {
    if (!payload.transcript?.trim()) return;
    console.log(`[VoiceGateway] voice_turn from ${client.id}: "${payload.transcript.slice(0, 80)}..."`);

    try {
      // Get conversational AI response
      const aiText = await this.conversationService.processTurn(
        client.id,
        payload.transcript,
        payload.currentQuestion,
        payload.wasCorrect,
      );

      // Convert to speech
      const { audio, mimeType } = await this.providerRouter.synthesizeSpeech(
        aiText,
        payload.sessionId,
      );

      client.emit('ai_text', { text: aiText });
      client.emit('audio_response', { delta: audio, mimeType });
      console.log(`[VoiceGateway] Sent AI response for turn in session ${payload.sessionId}`);
    } catch (err: any) {
      console.error(`[VoiceGateway] Error processing voice turn: ${err.message}`);
      client.emit('voice_error', { message: `Voice processing failed: ${err.message}` });
    }
  }

  /**
   * Gracefully end the conversation — AI gives a warm closing.
   */
  @SubscribeMessage('end_voice_session')
  async handleEndVoiceSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    try {
      const closingText = await this.conversationService.endConversation(client.id);
      const { audio, mimeType } = await this.providerRouter.synthesizeSpeech(
        closingText,
        payload.sessionId,
      );
      client.emit('ai_text', { text: closingText });
      client.emit('audio_response', { delta: audio, mimeType });
    } catch (err: any) {
      console.error(`[VoiceGateway] Error ending voice session: ${err.message}`);
    }
  }
}
