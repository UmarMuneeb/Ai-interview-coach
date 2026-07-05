import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('mock')
  getMockQuestion() {
    return this.questionsService.getMockQuestion();
  }

  /**
   * Get the next question for a session, with history tracking and LLM fallback.
   * Query params: topic, subtopic, difficulty, sessionId (all optional)
   */
  @Get('next')
  async getNextQuestion(
    @Request() req: any,
    @Query('topic') topic: string,
    @Query('subtopic') subtopic: string,
    @Query('difficulty') difficulty: string,
    @Query('sessionId') sessionId: string,
    @Query('weakTopics') weakTopicsJson: string,
  ) {
    const userId: string = req.user.userId;

    // Parse weak topics from JSON query param (passed from POST /sessions response)
    let preferredTopics: Array<{ topic: string; subtopic: string; currentDifficulty?: number }> = [];
    if (weakTopicsJson) {
      try {
        preferredTopics = JSON.parse(weakTopicsJson);
      } catch { /* ignore malformed JSON */ }
    }

    // Collect all question IDs this user has answered (across all sessions)
    const allUserAnswers = await this.prisma.sessionAnswer.findMany({
      where: { session: { user_id: userId } },
      select: { question_id: true },
    });
    const seenIds = [...new Set(allUserAnswers.map((a) => a.question_id))];

    return this.questionsService.getNextQuestion(
      userId,
      topic || 'fullstack',
      subtopic,
      difficulty ? parseInt(difficulty, 10) : undefined,
      seenIds,
      preferredTopics,
    );
  }
}
