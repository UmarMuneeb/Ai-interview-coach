import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { QuestionsModule } from './questions/questions.module';
import { SessionsModule } from './sessions/sessions.module';
import { AssessmentModule } from './assessment/assessment.module';
import { TutorModule } from './tutor/tutor.module';
import { ProviderRouterModule } from './provider-router/provider-router.module';
import { ProviderHealthModule } from './provider-health/provider-health.module';
import { VoiceModule } from './voice/voice.module';
import { SkillProfileModule } from './skill-profile/skill-profile.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AuthModule,
    QuestionsModule,
    SessionsModule,
    AssessmentModule,
    TutorModule,
    ProviderRouterModule,
    ProviderHealthModule,
    VoiceModule,
    SkillProfileModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
