import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillProfileService } from '../skill-profile/skill-profile.service';
import { AssessmentService } from '../assessment/assessment.service';
import { QuestionsService } from '../questions/questions.service';
import { Question } from '@prisma/client';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private skillProfileService: SkillProfileService,
    private assessmentService: AssessmentService,
    private questionsService: QuestionsService,
  ) {}

  async createSession(userId: string, field: string, phase: string, targetDuration: number, questionsPlanned: number) {
    return this.prisma.session.create({
      data: {
        user_id: userId,
        field,
        phase,
        status: 'active',
        target_duration_minutes: targetDuration,
        questions_planned: questionsPlanned,
      },
    });
  }

  async submitAnswer(sessionId: string, question: Question, transcript: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    const classificationResult = await this.assessmentService.classifyAnswer(transcript, question.rubric_points, sessionId);

    const answer = await this.prisma.sessionAnswer.create({
      data: {
        session_id: sessionId,
        question_id: question.id,
        transcript,
        classification: classificationResult.classification as any,
        confidence: classificationResult.confidence,
        reasoning: classificationResult.reasoning,
        follow_up_asked: false,
      }
    });

    const profile = await this.skillProfileService.updateSkillProfile(
      session.user_id,
      question.topic,
      question.subtopic,
      classificationResult.classification
    );

    // Dynamic pacing: fetch the next question matching the new difficulty!
    const nextQuestion = await this.questionsService.getMockQuestion(question.topic, profile.current_difficulty);

    return {
      answer,
      nextQuestion,
    };
  }
}
