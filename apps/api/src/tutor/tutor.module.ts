import { Module } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProviderRouterModule } from '../provider-router/provider-router.module';

@Module({
  imports: [PrismaModule, ProviderRouterModule],
  providers: [TutorService],
  exports: [TutorService],
})
export class TutorModule {}
