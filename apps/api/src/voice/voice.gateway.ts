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

import {
  ProviderRouterService,
  LiveStreamAdapter,
} from '../provider-router/provider-router.service';

@WebSocketGateway({ cors: true })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeStreams = new Map<string, LiveStreamAdapter>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly providerRouter: ProviderRouterService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      let token =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!token) {
        throw new Error('No token provided');
      }
      if (token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'fallback_secret',
      });

      client.data.user = payload;
      console.log(
        `[VoiceGateway] Client connected: ${client.id} (User: ${payload.sub})`,
      );
    } catch (e: any) {
      console.log(
        `[VoiceGateway] Unauthorized connection attempt: ${e.message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[VoiceGateway] Client disconnected: ${client.id}`);
    const adapter = this.activeStreams.get(client.id);
    if (adapter) {
      adapter.close();
      this.activeStreams.delete(client.id);
    }
  }

  @SubscribeMessage('start_voice_session')
  async handleStartVoiceSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; initialPrompt?: string },
  ) {
    console.log(`[VoiceGateway] Starting voice session for ${client.id}`);
    try {
      // Disconnect existing if any
      const existing = this.activeStreams.get(client.id);
      if (existing) {
        existing.close();
      }

      const adapter = await this.providerRouter.connectLiveStream(
        payload.sessionId,
        payload.initialPrompt,
      );

      adapter.onAudioReceived((base64Audio) => {
        client.emit('audio_response', { delta: base64Audio });
      });

      adapter.onTextReceived((text) => {
        client.emit('text_transcript', { text });
      });

      this.activeStreams.set(client.id, adapter);
      client.emit('voice_session_started', { success: true });
    } catch (err: any) {
      client.emit('voice_error', { message: err.message });
    }
  }

  @SubscribeMessage('update_voice_prompt')
  handleUpdateVoicePrompt(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { prompt: string },
  ) {
    const adapter = this.activeStreams.get(client.id);
    if (adapter && payload.prompt) {
      adapter.updatePrompt?.(payload.prompt);
    }
  }

  @SubscribeMessage('audio_chunk')
  handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { audio: string },
  ) {
    const adapter = this.activeStreams.get(client.id);
    if (adapter && payload.audio) {
      adapter.sendAudioChunk(payload.audio);
    }
  }

  @SubscribeMessage('commit_audio')
  handleCommitAudio(@ConnectedSocket() client: Socket) {
    const adapter = this.activeStreams.get(client.id);
    if (adapter) {
      adapter.commitAudio();
    }
  }
}
