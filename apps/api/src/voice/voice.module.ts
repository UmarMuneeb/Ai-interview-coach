import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VoiceGateway } from './voice.gateway';
import { ConversationService } from './conversation.service';
import { ProviderRouterModule } from '../provider-router/provider-router.module';

@Module({
  imports: [AuthModule, ProviderRouterModule],
  providers: [VoiceGateway, ConversationService],
})
export class VoiceModule {}
