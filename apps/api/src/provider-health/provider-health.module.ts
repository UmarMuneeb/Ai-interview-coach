import { Module } from '@nestjs/common';
import { ProviderHealthService } from './provider-health.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ProviderHealthService],
  exports: [ProviderHealthService],
})
export class ProviderHealthModule {}
