import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VoiceGateway } from './voice.gateway';

@Module({
  imports: [AuthModule],
  providers: [VoiceGateway],
})
export class VoiceModule {}
