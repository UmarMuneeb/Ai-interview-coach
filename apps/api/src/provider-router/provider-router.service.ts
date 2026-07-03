import { Injectable } from '@nestjs/common';
import { z } from 'zod';

export interface CompleteRequest {
  purpose: string;
  sessionId?: string;
  messages: any[];
  responseSchema?: z.ZodTypeAny;
}

@Injectable()
export class ProviderRouterService {
  async complete(request: CompleteRequest): Promise<{ content: any }> {
    // Phase 2 MVP Mock implementation
    // In Phase 3, this will fall back across OpenAI/Gemini/OpenRouter and track cost.
    
    // For now, if we have a schema, we just return a mocked valid object
    if (request.responseSchema) {
      return {
        content: {
          classification: 'correct',
          confidence: 0.9,
          reasoning: 'Mocked reasoning for Phase 2 MVP.'
        }
      };
    }
    
    return { content: 'Mocked completion' };
  }
}
