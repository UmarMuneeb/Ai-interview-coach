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

@WebSocketGateway({ cors: true })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!token) {
        throw new Error('No token provided');
      }
      if (token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'fallback_secret',
      });
      
      // Attach user to the socket
      client.data.user = payload;
      console.log(`[VoiceGateway] Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (e: any) {
      console.log(`[VoiceGateway] Unauthorized connection attempt: ${e.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[VoiceGateway] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('audio_chunk')
  handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    console.log(`[VoiceGateway] Received audio_chunk from ${client.id}`);
    
    // In later steps, this will pipe to ProviderRouter
    // For now, just acknowledge receipt
    client.emit('audio_ack', { received: true });
  }
}
