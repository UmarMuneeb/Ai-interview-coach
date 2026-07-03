import { Controller, Post, Get, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionsService } from './sessions.service';

class CreateSessionDto {
  field: string;
  target_duration_minutes: number;
  questions_planned: number;
  difficulty?: string;
}

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  async createSession(@Request() req: any, @Body() body: CreateSessionDto) {
    const session = await this.sessionsService.createSession(
      req.user.userId,
      body.field,
      'interview',
      body.target_duration_minutes ?? 30,
      body.questions_planned ?? 10,
    );
    return session;
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.sessionsService.getSession(id);
  }
}
