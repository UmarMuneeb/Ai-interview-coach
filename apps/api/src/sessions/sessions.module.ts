import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SkillProfileModule } from '../skill-profile/skill-profile.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { QuestionsModule } from '../questions/questions.module';
import { TutorModule } from '../tutor/tutor.module';
import { ProviderRouterModule } from '../provider-router/provider-router.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    SkillProfileModule,
    AssessmentModule,
    QuestionsModule,
    TutorModule,
    ProviderRouterModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
