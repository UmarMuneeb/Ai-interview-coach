import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Question } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRouterService } from '../provider-router/provider-router.service';
import { z } from 'zod';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Validation schema for LLM-generated questions
const GeneratedQuestionSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  subtopic: z.string().min(1, 'Subtopic is required'),
  difficulty: z.number().int().min(1).max(5),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  rubricPoints: z.array(z.string()).min(1, 'At least one rubric point required'),
  tags: z.array(z.string()).default([]),
});

type GeneratedQuestionInput = z.infer<typeof GeneratedQuestionSchema>;

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private mockDb: any[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRouter: ProviderRouterService,
  ) {}

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

  /**
   * Get next question for a session, with LLM-generation fallback.
   * Priority:
   * 1. Seed questions from Prisma DB (source_db = 'seed')
   * 2. Previously generated questions (source_db = 'generated')
   * 3. Generate new question via LLM if none available
   */
  async getNextQuestion(
    userId: string,
    topic: string,
    subtopic?: string,
    difficulty?: number,
    excludeQuestionIds: string[] = [],
    preferredTopics: Array<{ topic: string; subtopic: string; currentDifficulty?: number }> = [],
  ): Promise<Question> {
    // Build base where clause for the requested topic
    const whereClause: any = {
      topic,
      id: { notIn: excludeQuestionIds },
    };
    if (subtopic) whereClause.subtopic = subtopic;
    if (difficulty) whereClause.difficulty = difficulty;

    const availableQuestions = await this.prisma.question.findMany({
      where: whereClause,
      orderBy: [
        { source_db: 'asc' }, // Prefer 'seed' over 'generated'
        { last_refreshed_at: 'asc' }, // Least recently used
      ],
    });

    if (availableQuestions.length > 0) {
      // Strictly prefer seed questions — only fall back to generated if no seeds available
      const seedQuestions = availableQuestions.filter((q) => q.source_db === 'seed');
      let pool = seedQuestions.length > 0 ? seedQuestions.slice(0, 5) : availableQuestions.slice(0, 5);

      // 70/30 weak-area weighting: if preferred (weak) subtopics provided,
      // bias toward them 70% of the time
      if (preferredTopics.length > 0) {
        const weakSubtopics = preferredTopics.map((p) => p.subtopic);
        let weakPool = pool.filter((q) => weakSubtopics.includes(q.subtopic));

        if (weakPool.length > 0) {
          // Difficulty-aware selection: within weak subtopics, prefer questions
          // at the skill profile's currentDifficulty level (mastery is improving
          // → currentDifficulty is already raised by updateSkillProfile).
          // Build a lookup: subtopic → currentDifficulty
          const difficultyBySubtopic = new Map<string, number>();
          for (const pt of preferredTopics) {
            if (pt.currentDifficulty !== undefined) {
              difficultyBySubtopic.set(pt.subtopic, pt.currentDifficulty);
            }
          }

          // Try to narrow the weak pool to questions at the right difficulty
          const difficultyFilteredPool = weakPool.filter((q) => {
            const targetDiff = difficultyBySubtopic.get(q.subtopic);
            return targetDiff === undefined || q.difficulty === targetDiff;
          });

          // Use the difficulty-filtered pool if it has items, else fall back to full weak pool
          if (difficultyFilteredPool.length > 0) {
            weakPool = difficultyFilteredPool;
          }

          // Roll: 70% chance to pick from weak pool
          if (Math.random() < 0.7) {
            pool = weakPool;
          }
        }
      }

      return pool[Math.floor(Math.random() * pool.length)];
    }

    // No unseen questions found — generate a new one
    // Use top weak topic for generation if available
    const genSubtopic = preferredTopics.length > 0 ? preferredTopics[0].subtopic : (subtopic || topic);
    this.logger.log(
      `No unseen questions for topic=${topic}, subtopic=${genSubtopic}, difficulty=${difficulty}. Generating...`,
    );

    return this.generateQuestion(topic, genSubtopic, difficulty || 2);
  }

  /**
   * Generate a new question using LLM and insert into database.
   * Retries once on schema validation failure.
   */
  private async generateQuestion(
    topic: string,
    subtopic: string,
    difficulty: number,
    retryCount: number = 0,
  ): Promise<Question> {
    const difficultyLabel = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Very Hard', 5: 'Expert' }[difficulty] || 'Medium';

    const prompt = `Generate a technical interview question for the following criteria:

Topic: ${topic}
Subtopic: ${subtopic}
Difficulty: ${difficulty}/5 (${difficultyLabel})

Requirements:
- The question should test deep understanding of ${subtopic} in the context of ${topic}
- Include 3-5 rubric points that define a correct answer
- Add relevant tags for categorization
- The prompt should be clear and specific

Return a JSON object with this exact structure:
{
  "topic": "${topic}",
  "subtopic": "${subtopic}",
  "difficulty": ${difficulty},
  "prompt": "The question text here",
  "rubricPoints": ["point 1", "point 2", "point 3"],
  "tags": ["tag1", "tag2"]
}`;

    try {
      const response = await this.providerRouter.complete({
        purpose: 'question-generation',
        messages: [{ role: 'user', content: prompt }],
        responseSchema: GeneratedQuestionSchema,
      });

      // Response content is already validated and parsed by provider-router
      const generated = response.content as GeneratedQuestionInput;

      // Insert into database
      const question = await this.prisma.question.create({
        data: {
          id: crypto.randomUUID(),
          source_db: 'generated',
          topic: generated.topic,
          subtopic: generated.subtopic,
          difficulty: generated.difficulty,
          prompt: generated.prompt,
          rubric_points: generated.rubricPoints,
          tags: generated.tags,
          last_refreshed_at: new Date(),
        },
      });

      this.logger.log(`Generated new question: ${question.id} for ${topic}/${subtopic}`);
      return question;
    } catch (error: any) {
      // Retry once on validation failure
      if (retryCount === 0) {
        this.logger.warn(
          `Question generation failed (attempt 1): ${error.message}. Retrying...`,
        );
        return this.generateQuestion(topic, subtopic, difficulty, 1);
      }

      // Both attempts failed
      this.logger.error(
        `Question generation failed after 2 attempts for ${topic}/${subtopic}: ${error.message}`,
      );
      throw new NotFoundException(
        `Unable to generate question for ${topic}/${subtopic}. Please try again.`,
      );
    }
  }

  /**
   * Legacy method for backward compatibility with existing code.
   * Loads from mock JSON file and returns a random question.
   */
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
