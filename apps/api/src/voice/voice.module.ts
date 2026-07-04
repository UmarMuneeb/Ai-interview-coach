import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VoiceGateway } from './voice.gateway';

import { ProviderRouterModule } from '../provider-router/provider-router.module';

@Module({
  imports: [AuthModule, ProviderRouterModule],
  providers: [VoiceGateway],
})
export class VoiceModule {}
