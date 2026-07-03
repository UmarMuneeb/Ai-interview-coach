import { Injectable } from '@nestjs/common';
import { Question } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class QuestionsService {
  async getMockQuestion(): Promise<Question> {
    return {
      id: crypto.randomUUID(),
      source_db: 'mock_db',
      topic: 'JavaScript',
      subtopic: 'Closures',
      difficulty: 1,
      prompt: 'What is a closure in JavaScript and how does it work?',
      rubric_points: [
        'Mention that a closure gives access to an outer function scope from an inner function.',
        'Mention that closures are created every time a function is created.',
        'Give a brief example or mention variables being preserved.'
      ],
      tags: ['javascript', 'closures', 'fundamentals'],
      last_refreshed_at: new Date(),
    };
  }
}
