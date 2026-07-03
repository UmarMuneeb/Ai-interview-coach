import { Module } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { ProviderRouterModule } from '../provider-router/provider-router.module';

@Module({
  imports: [ProviderRouterModule],
  providers: [AssessmentService],
  exports: [AssessmentService],
})
export class AssessmentModule {}
