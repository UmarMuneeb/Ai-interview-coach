import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionsService } from './sessions.service';

class CreateSessionDto {
  field: string;
  target_duration_minutes: number;
  questions_planned: number;
  difficulty?: string;
}

class SubmitAnswerDto {
  // Full question object echoed back from the frontend (from GET /questions/mock)
  question: {
    id: string;
    topic: string;
    subtopic: string;
    difficulty: number;
    prompt: string;
    rubric_points: string[];
    tags: string[];
    source_db: string;
    last_refreshed_at: string;
  };
  transcript: string;
}

class SubmitTutorAnswerDto {
  questionId: string;
  transcript: string;
}

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  async createSession(@Request() req: any, @Body() body: CreateSessionDto) {
    return this.sessionsService.createSession(
      req.user.userId,
      body.field,
      'interview',
      body.target_duration_minutes ?? 30,
      body.questions_planned ?? 10,
    );
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.sessionsService.getSession(id);
  }

  @Post(':id/answer')
  async submitAnswer(
    @Param('id') sessionId: string,
    @Body() body: SubmitAnswerDto,
  ) {
    if (!body.question || !body.transcript) {
      throw new BadRequestException('question and transcript are required');
    }
    const question = {
      ...body.question,
      last_refreshed_at: new Date(body.question.last_refreshed_at),
    } as any;
    return this.sessionsService.submitAnswer(
      sessionId,
      question,
      body.transcript,
    );
  }

  @Get(':id/tutor-state')
  async getTutorState(@Param('id') sessionId: string) {
    return this.sessionsService.getTutorState(sessionId);
  }

  @Post(':id/transition')
  async transitionToTutor(@Param('id') sessionId: string) {
    return this.sessionsService.transitionToTutorPhase(sessionId);
  }

  @Post(':id/tutor-answer')
  async submitTutorAnswer(
    @Param('id') sessionId: string,
    @Body() body: SubmitTutorAnswerDto,
  ) {
    if (!body.questionId || !body.transcript) {
      throw new BadRequestException('questionId and transcript are required');
    }
    return this.sessionsService.submitTutorAnswer(
      sessionId,
      body.questionId,
      body.transcript,
    );
  }

  @Get()
  async listSessions(@Request() req: any) {
    return this.sessionsService.listUserSessions(req.user.userId);
  }

  @Get(':id/report')
  async getSessionReport(@Param('id') sessionId: string) {
    return this.sessionsService.getSessionReport(sessionId);
  }
}
