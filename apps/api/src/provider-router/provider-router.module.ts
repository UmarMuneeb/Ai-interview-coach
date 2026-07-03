import { Module } from '@nestjs/common';
import { ProviderRouterService } from './provider-router.service';

@Module({
  providers: [ProviderRouterService],
  exports: [ProviderRouterService],
})
export class ProviderRouterModule {}
