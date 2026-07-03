import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillProfileService } from '../skill-profile/skill-profile.service';
import { AssessmentService } from '../assessment/assessment.service';
import { QuestionsService } from '../questions/questions.service';
import { TutorService } from '../tutor/tutor.service';
import { Question } from '@prisma/client';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private skillProfileService: SkillProfileService,
    private assessmentService: AssessmentService,
    private questionsService: QuestionsService,
    private tutorService: TutorService,
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

  async getSession(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
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

  async transitionToTutorPhase(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { phase: 'tutor' },
    });

    // Find the first weak answer (not 'correct')
    const weakAnswer = await this.prisma.sessionAnswer.findFirst({
      where: {
        session_id: sessionId,
        classification: {
          not: 'correct'
        }
      },
      include: {
        question: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return { weakAnswer };
  }

  async submitTutorAnswer(sessionId: string, questionId: string, transcript: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.phase !== 'tutor') throw new NotFoundException('Session not found or not in tutor phase');

    const originalAnswer = await this.prisma.sessionAnswer.findFirst({
      where: { session_id: sessionId, question_id: questionId },
      include: { question: true }
    });
    if (!originalAnswer) throw new NotFoundException('Original answer not found');

    const attempts = await this.tutorService.getAttempts(sessionId, questionId);
    const attemptNumber = attempts.length + 1;

    // missingPoints normally would be provided by assessment, but we'll mock it or extract it
    // For MVP, we will pass the whole rubric array since the user didn't get it fully correct.
    const missingPoints = originalAnswer.question.rubric_points;

    const result = await this.tutorService.processTutorTurn(
      sessionId,
      questionId,
      originalAnswer.question.prompt,
      missingPoints,
      transcript,
      attemptNumber
    );

    let nextWeakAnswer: any = null;

    // If resolved or max attempts reached, move to the next weak question
    if (result.resolved || attemptNumber >= 3) {
      // Find all weak answers
      const allWeak = await this.prisma.sessionAnswer.findMany({
        where: { session_id: sessionId, classification: { not: 'correct' } },
        include: { question: true },
        orderBy: { timestamp: 'asc' }
      });

      // Find the next weak question that hasn't been resolved yet
      // A question is resolved if there's a successful TutorAttempt or if attempts >= 3
      for (const weak of allWeak) {
        const weakAttempts = await this.tutorService.getAttempts(sessionId, weak.question_id);
        const isResolved = weakAttempts.some(a => a.resolved) || weakAttempts.length >= 3;
        if (!isResolved) {
          nextWeakAnswer = weak;
          break;
        }
      }

      // If no more weak questions, complete the session
      if (!nextWeakAnswer) {
        await this.prisma.session.update({
          where: { id: sessionId },
          data: { status: 'completed', ended_at: new Date() }
        });
      }
    }

    return {
      tutorResult: result,
      nextWeakAnswer
    };
  }
}
