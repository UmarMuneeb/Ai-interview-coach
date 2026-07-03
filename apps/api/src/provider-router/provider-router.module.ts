import { Module } from '@nestjs/common';
import { ProviderRouterService } from './provider-router.service';
import { ProviderHealthModule } from '../provider-health/provider-health.module';

@Module({
  imports: [ProviderHealthModule],
  providers: [ProviderRouterService],
  exports: [ProviderRouterService],
})
export class ProviderRouterModule {}
