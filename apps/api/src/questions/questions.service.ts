import { Injectable, NotFoundException } from '@nestjs/common';
import { Question } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class QuestionsService {
  private mockDb: any[] = [];

  constructor() {}

  private loadMockDb() {
    if (this.mockDb.length > 0) return;
    const dataPath = path.join(
      process.cwd(),
      'src',
      'questions',
      'data',
      'mock-questions.json',
    );
    if (fs.existsSync(dataPath)) {
      this.mockDb = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }
  }

  async getMockQuestion(
    topic?: string,
    difficulty?: number,
  ): Promise<Question> {
    this.loadMockDb();
    let filtered = this.mockDb;

    if (topic) {
      filtered = filtered.filter(
        (q) => q.topic.toLowerCase() === topic.toLowerCase(),
      );
    }
    if (difficulty) {
      filtered = filtered.filter((q) => q.difficulty === difficulty);
    }

    if (filtered.length === 0) {
      // Fallback if none match
      if (this.mockDb.length > 0) {
        filtered = this.mockDb;
      } else {
        throw new NotFoundException(
          'No questions available in the aggregator database.',
        );
      }
    }

    // Pick a random one from the filtered set
    const selected = filtered[Math.floor(Math.random() * filtered.length)];

    return {
      id: crypto.randomUUID(),
      source_db: 'mock_json_db',
      topic: selected.topic,
      subtopic: selected.subtopic,
      difficulty: selected.difficulty,
      prompt: selected.prompt,
      rubric_points: selected.rubric_points,
      tags: selected.tags,
      last_refreshed_at: new Date(),
    };
  }
}
