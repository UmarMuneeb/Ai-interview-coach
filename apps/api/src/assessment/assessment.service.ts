import { Injectable } from '@nestjs/common';
import { ProviderRouterService } from '../provider-router/provider-router.service';
import { z } from 'zod';

export const ClassificationSchema = z.object({
  classification: z.enum(['correct', 'incorrect', 'partial', 'misunderstood', 'evasive']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  missingPoints: z.array(z.string()).optional(),
});

@Injectable()
export class AssessmentService {
  constructor(private readonly providerRouter: ProviderRouterService) {}

  async classifyAnswer(answer: string, rubricPoints: string[], sessionId?: string) {
    const prompt = `Classify this answer based on the rubric points.\nAnswer: ${answer}\nRubric: ${rubricPoints.join(', ')}`;
    
    const result = await this.providerRouter.complete({
      purpose: 'assessment',
      sessionId: sessionId,
      responseSchema: ClassificationSchema,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = ClassificationSchema.safeParse(result.content);
    if (!parsed.success) {
      // Retry once with an explicit correction prompt
      const retryResult = await this.providerRouter.complete({
        purpose: 'assessment',
        sessionId: sessionId,
        responseSchema: ClassificationSchema,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: JSON.stringify(result.content) },
          { role: 'user', content: `Your previous response failed validation: ${parsed.error.message}. Please strictly follow the schema.` }
        ],
      });
      
      const retryParsed = ClassificationSchema.safeParse(retryResult.content);
      if (!retryParsed.success) {
        throw new Error(`AssessmentValidationError: ${retryParsed.error.message}`);
      }
      return retryParsed.data;
    }

    return parsed.data;
  }
}
