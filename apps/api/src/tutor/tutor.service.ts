import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResolvedVia } from '@prisma/client';
import { ProviderRouterService } from '../provider-router/provider-router.service';
import { z } from 'zod';

export const TutorEvaluationSchema = z.object({
  resolved: z.boolean(),
  reasoning: z.string(),
  missingPoints: z.array(z.string()),
});

@Injectable()
export class TutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRouter: ProviderRouterService
  ) {}

  async createAttempt(
    sessionId: string,
    questionId: string,
    attemptNumber: number,
    hintLevel: number,
    transcript: string,
    missingPoints: string[],
    resolved: boolean,
    resolvedVia?: ResolvedVia
  ) {
    return this.prisma.tutorAttempt.create({
      data: {
        session_id: sessionId,
        question_id: questionId,
        attempt_number: attemptNumber,
        hint_level: hintLevel,
        transcript: transcript,
        missing_points: missingPoints,
        resolved: resolved,
        resolved_via: resolvedVia,
      },
    });
  }

  async getAttempts(sessionId: string, questionId: string) {
    return this.prisma.tutorAttempt.findMany({
      where: {
        session_id: sessionId,
        question_id: questionId,
      },
      orderBy: {
        attempt_number: 'asc',
      },
    });
  }

  async generateHint(sessionId: string, questionPrompt: string, missingPoints: string[], attemptNumber: number, previousAnswer: string) {
    const hintLevelStr = attemptNumber === 1 ? 'Subtle hint' : attemptNumber === 2 ? 'Direct hint' : 'Give away the answer';
    
    const prompt = `You are a strict but helpful Socratic tutor. The user is practicing an interview question.
Question: ${questionPrompt}
User's previous answer: ${previousAnswer}
Points they missed: ${missingPoints.join(', ')}

Your goal is to guide them to the correct answer.
Current hint level: ${hintLevelStr}.
Respond directly with what the tutor should say to the user. Keep it conversational. Do not output anything else.`;

    const result = await this.providerRouter.complete({
      purpose: 'tutor',
      sessionId,
      messages: [{ role: 'user', content: prompt }]
    });

    return result.content;
  }

  async evaluateTutorAnswer(sessionId: string, questionPrompt: string, missingPoints: string[], answer: string) {
    const prompt = `The user was asked an interview question and missed some points. They have provided a new answer after receiving a hint.
Question: ${questionPrompt}
Missing points: ${missingPoints.join(', ')}
User's new answer: ${answer}

Evaluate if the user's new answer successfully addresses the missing points. Return your evaluation strictly following the schema.`;

    const result = await this.providerRouter.complete({
      purpose: 'tutor',
      sessionId,
      responseSchema: TutorEvaluationSchema,
      messages: [{ role: 'user', content: prompt }]
    });

    const parsed = TutorEvaluationSchema.safeParse(result.content);
    if (!parsed.success) {
      console.log('DEBUG [TutorService] LLM returned invalid JSON:', result.content);
      const retryResult = await this.providerRouter.complete({
        purpose: 'tutor',
        sessionId,
        responseSchema: TutorEvaluationSchema,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: JSON.stringify(result.content) },
          { role: 'user', content: `Your previous response failed validation: ${parsed.error.message}. Please strictly follow the schema.` }
        ]
      });
      const retryParsed = TutorEvaluationSchema.safeParse(retryResult.content);
      if (!retryParsed.success) throw new Error(`TutorEvaluationValidationError: ${retryParsed.error.message}`);
      return retryParsed.data;
    }
    return parsed.data;
  }

  async processTutorTurn(sessionId: string, questionId: string, questionPrompt: string, missingPoints: string[], answer: string, attemptNumber: number) {
    const evaluation = await this.evaluateTutorAnswer(sessionId, questionPrompt, missingPoints, answer);
    
    if (evaluation.resolved || attemptNumber >= 3) {
      await this.createAttempt(sessionId, questionId, attemptNumber, attemptNumber, answer, evaluation.missingPoints, evaluation.resolved, evaluation.resolved ? 'explained' : undefined);
      return {
        resolved: evaluation.resolved,
        reasoning: evaluation.reasoning,
        hint: null,
      };
    }

    const nextHint = await this.generateHint(sessionId, questionPrompt, evaluation.missingPoints, attemptNumber + 1, answer);

    await this.createAttempt(sessionId, questionId, attemptNumber, attemptNumber, answer, evaluation.missingPoints, false);

    return {
      resolved: false,
      reasoning: evaluation.reasoning,
      hint: nextHint,
      remainingMissingPoints: evaluation.missingPoints,
    };
  }
}
