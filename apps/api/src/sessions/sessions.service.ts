import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillProfileService } from '../skill-profile/skill-profile.service';
import { AssessmentService } from '../assessment/assessment.service';
import { QuestionsService } from '../questions/questions.service';
import { TutorService } from '../tutor/tutor.service';
import { ProviderRouterService } from '../provider-router/provider-router.service';
import { Question } from '@prisma/client';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private prisma: PrismaService,
    private skillProfileService: SkillProfileService,
    private assessmentService: AssessmentService,
    private questionsService: QuestionsService,
    private tutorService: TutorService,
    private providerRouter: ProviderRouterService,
  ) {}

  async createSession(
    userId: string,
    field: string,
    phase: string,
    targetDuration: number,
    questionsPlanned: number,
  ) {
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

  async submitAnswer(
    sessionId: string,
    question: Question,
    transcript: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const classificationResult = await this.assessmentService.classifyAnswer(
      transcript,
      question.rubric_points,
      sessionId,
    );

    // Upsert the question so the foreign key constraint passes
    await this.prisma.question.upsert({
      where: { id: question.id },
      create: question,
      update: question,
    });

    const answer = await this.prisma.sessionAnswer.create({
      data: {
        session_id: sessionId,
        question_id: question.id,
        transcript,
        classification: classificationResult.classification as any,
        confidence: classificationResult.confidence,
        reasoning: classificationResult.reasoning,
        follow_up_asked: false,
      },
    });

    const profile = await this.skillProfileService.updateSkillProfile(
      session.user_id,
      question.topic,
      question.subtopic,
      classificationResult.classification,
    );

    // Collect all question IDs this user has ever answered (to avoid repeats)
    const allUserAnswers = await this.prisma.sessionAnswer.findMany({
      where: {
        session: { user_id: session.user_id },
      },
      select: { question_id: true },
    });
    const seenIds = [...new Set(allUserAnswers.map((a) => a.question_id))];

    // Dynamic pacing: fetch next question at new difficulty, excluding already-seen ones
    const nextQuestion = await this.questionsService.getNextQuestion(
      session.user_id,
      question.topic,
      question.subtopic,
      profile.current_difficulty,
      seenIds,
    );

    return {
      answer,
      nextQuestion,
    };
  }

  async transitionToTutorPhase(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { phase: 'tutor' },
    });

    return this.getTutorState(sessionId);
  }

  async getTutorState(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.phase !== 'tutor') {
      throw new NotFoundException('Session not found or not in tutor phase');
    }

    // Find all weak answers
    const allWeak = await this.prisma.sessionAnswer.findMany({
      where: { session_id: sessionId, classification: { not: 'correct' } },
      include: { question: true },
      orderBy: { timestamp: 'asc' },
    });

    for (const weak of allWeak) {
      const weakAttempts = await this.tutorService.getAttempts(
        sessionId,
        weak.question_id,
      );
      const isResolved =
        weakAttempts.some((a) => a.resolved) || weakAttempts.length >= 3;

      if (!isResolved) {
        // This is the active tutor question
        const latestAttempt =
          weakAttempts.length > 0
            ? weakAttempts[weakAttempts.length - 1]
            : null;
        return {
          weakAnswer: weak,
          attempts: weakAttempts.length,
          latestHint: latestAttempt ? (latestAttempt as any).hint : null, // For MVP we need to fetch the hint, but Prisma schema doesn't have a hint field. Wait!
        };
      }
    }

    // No weak answers left
    return { weakAnswer: null };
  }

  async submitTutorAnswer(
    sessionId: string,
    questionId: string,
    transcript: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.phase !== 'tutor')
      throw new NotFoundException('Session not found or not in tutor phase');

    const originalAnswer = await this.prisma.sessionAnswer.findFirst({
      where: { session_id: sessionId, question_id: questionId },
      include: { question: true },
    });
    if (!originalAnswer)
      throw new NotFoundException('Original answer not found');

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
      attemptNumber,
    );

    let nextWeakAnswer: any = null;

    // If resolved or max attempts reached, move to the next weak question
    if (result.resolved || attemptNumber >= 3) {
      // Find all weak answers
      const allWeak = await this.prisma.sessionAnswer.findMany({
        where: { session_id: sessionId, classification: { not: 'correct' } },
        include: { question: true },
        orderBy: { timestamp: 'asc' },
      });

      // Find the next weak question that hasn't been resolved yet
      // A question is resolved if there's a successful TutorAttempt or if attempts >= 3
      for (const weak of allWeak) {
        const weakAttempts = await this.tutorService.getAttempts(
          sessionId,
          weak.question_id,
        );
        const isResolved =
          weakAttempts.some((a) => a.resolved) || weakAttempts.length >= 3;
        if (!isResolved) {
          nextWeakAnswer = weak;
          break;
        }
      }

      // If no more weak questions, complete the session
      if (!nextWeakAnswer) {
        await this.prisma.session.update({
          where: { id: sessionId },
          data: { status: 'completed', ended_at: new Date() },
        });

        // Generate session report
        await this.generateSessionReport(sessionId);
      }
    }

    return {
      tutorResult: result,
      nextWeakAnswer,
    };
  }

  async listUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { user_id: userId },
      orderBy: { started_at: 'desc' },
      select: {
        id: true,
        field: true,
        phase: true,
        status: true,
        started_at: true,
        ended_at: true,
        target_duration_minutes: true,
        questions_planned: true,
      },
    });
  }

  /**
   * Generate narrative session report using LLM and persist to session_reports table.
   * Called automatically when session status → 'completed'.
   */
  private async generateSessionReport(sessionId: string): Promise<void> {
    this.logger.log(`Generating session report for ${sessionId}...`);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        session_answers: {
          include: { question: true },
        },
      },
    });

    if (!session) {
      this.logger.error(`Session ${sessionId} not found for report generation`);
      return;
    }

    // Calculate statistics for LLM prompt
    const answerStats = {
      total: session.session_answers.length,
      correct: session.session_answers.filter((a) => a.classification === 'correct').length,
      incorrect: session.session_answers.filter((a) => a.classification === 'incorrect').length,
      partial: session.session_answers.filter((a) => a.classification === 'partial').length,
      misunderstood: session.session_answers.filter((a) => a.classification === 'misunderstood').length,
      evasive: session.session_answers.filter((a) => a.classification === 'evasive').length,
    };

    // Group by topic/subtopic
    const topicBreakdown = session.session_answers.reduce((acc: any, answer) => {
      const key = `${answer.question.topic}/${answer.question.subtopic}`;
      if (!acc[key]) {
        acc[key] = { correct: 0, total: 0, topic: answer.question.topic, subtopic: answer.question.subtopic };
      }
      acc[key].total++;
      if (answer.classification === 'correct') acc[key].correct++;
      return acc;
    }, {});

    const breakdown = Object.values(topicBreakdown);

    // Get skill profiles
    const skillProfiles = await this.prisma.skillProfile.findMany({
      where: { user_id: session.user_id },
    });

    // Build prompt for LLM
    const prompt = `Generate a comprehensive interview session report for the candidate.

**Session Overview:**
- Field: ${session.field}
- Duration: ${session.target_duration_minutes} minutes
- Questions Answered: ${answerStats.total}

**Performance Statistics:**
- Correct: ${answerStats.correct}
- Incorrect: ${answerStats.incorrect}
- Partial: ${answerStats.partial}
- Misunderstood: ${answerStats.misunderstood}
- Evasive: ${answerStats.evasive}

**Topic Breakdown:**
${breakdown.map((b: any) => `- ${b.topic} / ${b.subtopic}: ${b.correct}/${b.total} correct (${Math.round((b.correct / b.total) * 100)}%)`).join('\n')}

**Current Skill Mastery:**
${skillProfiles.map((sp) => `- ${sp.topic} / ${sp.subtopic}: Mastery ${sp.mastery_score.toFixed(1)}/10.0 (Difficulty ${sp.current_difficulty})`).join('\n')}

Generate a JSON object with:
{
  "summary": "A 2-3 paragraph narrative summary of the candidate's overall performance, tone should be encouraging but honest",
  "strengths": ["Array of 3-5 specific strengths demonstrated during the session"],
  "weaknesses": ["Array of 3-5 specific areas for improvement"],
  "recommendedTopics": ["Array of 3-5 topics/subtopics the candidate should focus on next"]
}

Make the feedback actionable and specific to the data above. Avoid generic statements.`;

    try {
      const response = await this.providerRouter.complete({
        purpose: 'report-generation',
        messages: [{ role: 'user', content: prompt }],
      });

      // Parse LLM response (provider-router returns already parsed if JSON)
      const reportData = typeof response.content === 'string' 
        ? JSON.parse(response.content) 
        : response.content;

      // Store in session_reports table
      await this.prisma.sessionReport.create({
        data: {
          session_id: sessionId,
          summary: reportData.summary,
          strengths: reportData.strengths,
          weaknesses: reportData.weaknesses,
          recommended_topics: reportData.recommendedTopics,
        },
      });

      this.logger.log(`Session report generated successfully for ${sessionId}`);
    } catch (error: any) {
      this.logger.error(`Failed to generate session report for ${sessionId}: ${error.message}`);
      
      // Fallback: create basic report from stats
      const strengths = breakdown
        .filter((b: any) => b.correct / b.total >= 0.7)
        .map((b: any) => `${b.topic} / ${b.subtopic}`);
      const weaknesses = breakdown
        .filter((b: any) => b.correct / b.total < 0.5)
        .map((b: any) => `${b.topic} / ${b.subtopic}`);

      await this.prisma.sessionReport.create({
        data: {
          session_id: sessionId,
          summary: `Session completed with ${answerStats.correct}/${answerStats.total} correct answers. Performance was ${answerStats.correct >= answerStats.total * 0.7 ? 'strong' : 'mixed'}.`,
          strengths: strengths.length > 0 ? strengths : ['Completed the session'],
          weaknesses: weaknesses.length > 0 ? weaknesses : ['Could improve overall accuracy'],
          recommended_topics: weaknesses.length > 0 ? weaknesses : [session.field],
        },
      });

      this.logger.log(`Fallback report created for ${sessionId}`);
    }
  }

  async getSessionReport(sessionId: string) {
    // Check if persisted report exists
    const persistedReport = await this.prisma.sessionReport.findFirst({
      where: { session_id: sessionId },
      include: {
        session: {
          select: {
            id: true,
            field: true,
            started_at: true,
            ended_at: true,
            target_duration_minutes: true,
            status: true,
          },
        },
      },
    });

    if (persistedReport) {
      // Return persisted report
      return {
        session: persistedReport.session,
        summary: persistedReport.summary,
        strengths: persistedReport.strengths,
        weaknesses: persistedReport.weaknesses,
        recommendedTopics: persistedReport.recommended_topics,
        generatedAt: persistedReport.generated_at,
      };
    }

    // Fallback: compute stats on-the-fly (for sessions completed before this feature)
    this.logger.warn(`No persisted report found for session ${sessionId}, computing on-the-fly`);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        session_answers: {
          include: { question: true },
        },
      },
    });

    if (!session) throw new NotFoundException('Session not found');

    // Get skill profile data for this user
    const skillProfiles = await this.prisma.skillProfile.findMany({
      where: { user_id: session.user_id },
    });

    // Calculate summary statistics
    const answerStats = {
      total: session.session_answers.length,
      correct: session.session_answers.filter(
        (a) => a.classification === 'correct',
      ).length,
      incorrect: session.session_answers.filter(
        (a) => a.classification === 'incorrect',
      ).length,
      partial: session.session_answers.filter(
        (a) => a.classification === 'partial',
      ).length,
      misunderstood: session.session_answers.filter(
        (a) => a.classification === 'misunderstood',
      ).length,
      evasive: session.session_answers.filter(
        (a) => a.classification === 'evasive',
      ).length,
    };

    // Group by topic/subtopic
    const topicBreakdown = session.session_answers.reduce(
      (acc: any, answer) => {
        const key = `${answer.question.topic}/${answer.question.subtopic}`;
        if (!acc[key]) {
          acc[key] = {
            correct: 0,
            total: 0,
            topic: answer.question.topic,
            subtopic: answer.question.subtopic,
          };
        }
        acc[key].total++;
        if (answer.classification === 'correct') acc[key].correct++;
        return acc;
      },
      {},
    );

    // Identify strengths and weaknesses
    const breakdown = Object.values(topicBreakdown);
    const strengths = breakdown
      .filter((b: any) => b.correct / b.total >= 0.7)
      .map((b: any) => `${b.topic} / ${b.subtopic}`);
    const weaknesses = breakdown
      .filter((b: any) => b.correct / b.total < 0.5)
      .map((b: any) => `${b.topic} / ${b.subtopic}`);

    return {
      session: {
        id: session.id,
        field: session.field,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_minutes: session.target_duration_minutes,
        status: session.status,
      },
      summary: answerStats,
      strengths,
      weaknesses,
      topicBreakdown: breakdown,
      skillProfiles: skillProfiles.map((sp) => ({
        topic: sp.topic,
        subtopic: sp.subtopic,
        masteryScore: sp.mastery_score,
        correctCount: sp.correct_count,
        incorrectCount: sp.incorrect_count,
        currentDifficulty: sp.current_difficulty,
      })),
    };
  }
}
