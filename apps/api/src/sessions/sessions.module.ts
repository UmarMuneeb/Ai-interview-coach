import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SkillProfileModule } from '../skill-profile/skill-profile.module';
import { AssessmentModule } from '../assessment/assessment.module';

@Module({
  imports: [SkillProfileModule, AssessmentModule],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
