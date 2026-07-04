import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRouterService } from '../provider-router/provider-router.service';
import { NotFoundException } from '@nestjs/common';

describe('QuestionsService - LLM Generation', () => {
  let service: QuestionsService;
  let prisma: jest.Mocked<PrismaService>;
  let providerRouter: jest.Mocked<ProviderRouterService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        {
          provide: PrismaService,
          useValue: {
            question: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: ProviderRouterService,
          useValue: {
            complete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    providerRouter = module.get(ProviderRouterService) as jest.Mocked<ProviderRouterService>;
  });

  describe('getNextQuestion with seed bank exhausted', () => {
    it('should generate new question when no unseen questions exist', async () => {
      // Arrange: No questions in DB
      prisma.question.findMany.mockResolvedValue([]);

      const mockGeneratedQuestion = {
        id: 'gen-123',
        source_db: 'generated',
        topic: 'React',
        subtopic: 'hooks',
        difficulty: 2,
        prompt: 'Explain useEffect cleanup function',
        rubric_points: ['Mentions cleanup', 'Explains when it runs', 'Example provided'],
        tags: ['react', 'hooks', 'useEffect'],
        last_refreshed_at: new Date(),
      };

      providerRouter.complete.mockResolvedValue({
        content: {
          topic: 'React',
          subtopic: 'hooks',
          difficulty: 2,
          prompt: 'Explain useEffect cleanup function',
          rubricPoints: ['Mentions cleanup', 'Explains when it runs', 'Example provided'],
          tags: ['react', 'hooks', 'useEffect'],
        },
        tokensIn: 50,
        tokensOut: 100,
      });

      prisma.question.create.mockResolvedValue(mockGeneratedQuestion);

      // Act
      const result = await service.getNextQuestion(
        'user-123',
        'React',
        'hooks',
        2,
        []
      );

      // Assert: Provider-router was called
      expect(providerRouter.complete).toHaveBeenCalledWith({
        purpose: 'question-generation',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('React'),
          }),
        ]),
        responseSchema: expect.any(Object),
      });

      // Assert: Question inserted with source_db = 'generated'
      expect(prisma.question.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source_db: 'generated',
          topic: 'React',
          subtopic: 'hooks',
          difficulty: 2,
          prompt: 'Explain useEffect cleanup function',
          rubric_points: ['Mentions cleanup', 'Explains when it runs', 'Example provided'],
          tags: ['react', 'hooks', 'useEffect'],
        }),
      });

      expect(result).toEqual(mockGeneratedQuestion);
    });

    it('should return existing question if available (no generation)', async () => {
      // Arrange: Question exists in DB
      const existingQuestion = {
        id: 'seed-456',
        source_db: 'seed',
        topic: 'React',
        subtopic: 'hooks',
        difficulty: 2,
        prompt: 'Explain useState',
        rubric_points: ['State management', 'Setter function'],
        tags: ['react', 'hooks'],
        last_refreshed_at: new Date(),
      };

      prisma.question.findMany.mockResolvedValue([existingQuestion]);

      // Act
      const result = await service.getNextQuestion(
        'user-123',
        'React',
        'hooks',
        2,
        []
      );

      // Assert: No generation triggered
      expect(providerRouter.complete).not.toHaveBeenCalled();
      expect(prisma.question.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingQuestion);
    });

    it('should exclude already-asked questions via excludeQuestionIds', async () => {
      // Arrange
      prisma.question.findMany.mockResolvedValue([]);

      const mockGenerated = {
        id: 'gen-789',
        source_db: 'generated',
        topic: 'TypeScript',
        subtopic: 'generics',
        difficulty: 3,
        prompt: 'Explain generic constraints',
        rubric_points: ['Extends keyword', 'Use case'],
        tags: ['typescript'],
        last_refreshed_at: new Date(),
      };

      providerRouter.complete.mockResolvedValue({
        content: {
          topic: 'TypeScript',
          subtopic: 'generics',
          difficulty: 3,
          prompt: 'Explain generic constraints',
          rubricPoints: ['Extends keyword', 'Use case'],
          tags: ['typescript'],
        },
        tokensIn: 40,
        tokensOut: 90,
      });

      prisma.question.create.mockResolvedValue(mockGenerated);

      // Act
      await service.getNextQuestion(
        'user-123',
        'TypeScript',
        'generics',
        3,
        ['already-asked-1', 'already-asked-2']
      );

      // Assert: excludeQuestionIds passed to query
      expect(prisma.question.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { notIn: ['already-asked-1', 'already-asked-2'] },
        }),
        orderBy: expect.any(Array),
      });
    });
  });

  describe('Schema validation and retry logic', () => {
    it('should retry once on validation failure', async () => {
      // Arrange: No questions in DB
      prisma.question.findMany.mockResolvedValue([]);

      // First attempt fails, second succeeds
      providerRouter.complete
        .mockRejectedValueOnce(new Error('Schema validation failed'))
        .mockResolvedValueOnce({
          content: {
            topic: 'Node.js',
            subtopic: 'streams',
            difficulty: 2,
            prompt: 'Explain readable streams',
            rubricPoints: ['Data events', 'Backpressure'],
            tags: ['nodejs', 'streams'],
          },
          tokensIn: 45,
          tokensOut: 85,
        });

      prisma.question.create.mockResolvedValue({
        id: 'gen-retry',
        source_db: 'generated',
        topic: 'Node.js',
        subtopic: 'streams',
        difficulty: 2,
        prompt: 'Explain readable streams',
        rubric_points: ['Data events', 'Backpressure'],
        tags: ['nodejs', 'streams'],
        last_refreshed_at: new Date(),
      });

      // Act
      const result = await service.getNextQuestion('user-123', 'Node.js', 'streams', 2, []);

      // Assert: Called twice (retry logic)
      expect(providerRouter.complete).toHaveBeenCalledTimes(2);
      expect(result.prompt).toBe('Explain readable streams');
    });

    it('should throw NotFoundException after 2 failed attempts', async () => {
      // Arrange: No questions in DB
      prisma.question.findMany.mockResolvedValue([]);

      // Both attempts fail
      providerRouter.complete
        .mockRejectedValueOnce(new Error('Validation failed'))
        .mockRejectedValueOnce(new Error('Validation failed again'));

      // Act & Assert
      await expect(
        service.getNextQuestion('user-123', 'Database', 'sql', 3, [])
      ).rejects.toThrow(NotFoundException);

      expect(providerRouter.complete).toHaveBeenCalledTimes(2);
    });
  });

  describe('Priority: seed > generated > LLM generation', () => {
    it('should prefer seed questions over generated ones', async () => {
      const seedQuestion = {
        id: 'seed-1',
        source_db: 'seed',
        topic: 'Testing',
        subtopic: 'unit',
        difficulty: 1,
        prompt: 'What is unit testing?',
        rubric_points: ['Definition', 'Example'],
        tags: ['testing'],
        last_refreshed_at: new Date('2024-01-01'),
      };

      const generatedQuestion = {
        id: 'gen-1',
        source_db: 'generated',
        topic: 'Testing',
        subtopic: 'unit',
        difficulty: 1,
        prompt: 'Explain test doubles',
        rubric_points: ['Mocks', 'Stubs'],
        tags: ['testing'],
        last_refreshed_at: new Date('2024-01-02'),
      };

      // Prisma orderBy [source_db asc] should return seed first
      prisma.question.findMany.mockResolvedValue([seedQuestion, generatedQuestion]);

      const result = await service.getNextQuestion('user-123', 'Testing', 'unit', 1, []);

      // Should pick from seed (first in pool of 5)
      expect(result.source_db).toBe('seed');
    });
  });
});
