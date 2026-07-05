import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { SkillProfileService } from '../skill-profile/skill-profile.service';
import { AssessmentService } from '../assessment/assessment.service';
import { QuestionsService } from '../questions/questions.service';
import { TutorService } from '../tutor/tutor.service';
import { ProviderRouterService } from '../provider-router/provider-router.service';
import { NotFoundException } from '@nestjs/common';

// ─── History tracking tests (submitAnswer) ────────────────────────────────────
describe('SessionsService - Question History Tracking', () => {
  let service: SessionsService;
  let prisma: any;
  let questionsService: any;
  let skillProfileService: any;
  let assessmentService: any;

  beforeEach(async () => {
    prisma = {
      session: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sessionAnswer: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      sessionReport: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      skillProfile: {
        findMany: jest.fn(),
      },
      question: {
        upsert: jest.fn(),
      },
    };

    questionsService = {
      getNextQuestion: jest.fn(),
      getMockQuestion: jest.fn(),
    };

    skillProfileService = {
      updateSkillProfile: jest.fn(),
      getWeakAreas: jest.fn(),
    };

    assessmentService = {
      classifyAnswer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SkillProfileService, useValue: skillProfileService },
        { provide: AssessmentService, useValue: assessmentService },
        { provide: QuestionsService, useValue: questionsService },
        { provide: TutorService, useValue: { getAttempts: jest.fn(), processTutorTurn: jest.fn() } },
        { provide: ProviderRouterService, useValue: { complete: jest.fn() } },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  describe('submitAnswer - cross-session history tracking', () => {
    const mockSession = {
      id: 'session-abc',
      user_id: 'user-xyz',
      phase: 'interview',
      status: 'active',
    };

    const mockQuestion = {
      id: 'q-current',
      topic: 'React',
      subtopic: 'hooks',
      difficulty: 2,
      prompt: 'Explain useEffect',
      rubric_points: ['Cleanup', 'Deps'],
      tags: ['react'],
      source_db: 'seed',
      last_refreshed_at: new Date(),
    };

    const mockClassification = {
      classification: 'correct',
      confidence: 0.9,
      reasoning: 'Good explanation',
    };

    const mockProfile = {
      id: 'profile-1',
      user_id: 'user-xyz',
      topic: 'React',
      subtopic: 'hooks',
      mastery_score: 7.5,
      current_difficulty: 3,
      correct_count: 5,
      incorrect_count: 1,
      misunderstood_count: 0,
      evasive_count: 0,
      last_seen_at: new Date(),
    };

    const mockNextQuestion = {
      id: 'q-next',
      topic: 'React',
      subtopic: 'hooks',
      difficulty: 3,
      prompt: 'Explain useMemo vs useCallback',
      rubric_points: ['Memoization', 'Use case'],
      tags: ['react'],
      source_db: 'seed',
      last_refreshed_at: new Date(),
    };

    it('should collect ALL answered question IDs across all user sessions and pass to getNextQuestion', async () => {
      prisma.session.findUnique.mockResolvedValue(mockSession);
      assessmentService.classifyAnswer.mockResolvedValue(mockClassification);
      prisma.question.upsert.mockResolvedValue(mockQuestion);
      prisma.sessionAnswer.create.mockResolvedValue({
        id: 'answer-1',
        session_id: 'session-abc',
        question_id: 'q-current',
        classification: 'correct',
        confidence: 0.9,
        reasoning: 'Good explanation',
        follow_up_asked: false,
        timestamp: new Date(),
      });
      skillProfileService.updateSkillProfile.mockResolvedValue(mockProfile);

      // Simulate cross-session history: 3 questions asked across 2 sessions
      prisma.sessionAnswer.findMany.mockResolvedValue([
        { question_id: 'q-old-1' },
        { question_id: 'q-old-2' },
        { question_id: 'q-current' }, // Just answered question also included
      ]);

      questionsService.getNextQuestion.mockResolvedValue(mockNextQuestion);

      await service.submitAnswer('session-abc', mockQuestion as any, 'useEffect runs after render...');

      // Key assertion: cross-session history query uses user_id via session relation
      expect(prisma.sessionAnswer.findMany).toHaveBeenCalledWith({
        where: {
          session: { user_id: 'user-xyz' },
        },
        select: { question_id: true },
      });

      // Key assertion: getNextQuestion called with deduped seenIds including all history
      expect(questionsService.getNextQuestion).toHaveBeenCalledWith(
        'user-xyz',
        'React',
        'hooks',
        3, // current_difficulty from updated profile
        expect.arrayContaining(['q-old-1', 'q-old-2', 'q-current']),
      );
    });

    it('should deduplicate question IDs before passing to getNextQuestion', async () => {
      prisma.session.findUnique.mockResolvedValue(mockSession);
      assessmentService.classifyAnswer.mockResolvedValue(mockClassification);
      prisma.question.upsert.mockResolvedValue(mockQuestion);
      prisma.sessionAnswer.create.mockResolvedValue({
        id: 'answer-2',
        session_id: 'session-abc',
        question_id: 'q-current',
        classification: 'correct',
        confidence: 0.9,
        reasoning: 'Good',
        follow_up_asked: false,
        timestamp: new Date(),
      });
      skillProfileService.updateSkillProfile.mockResolvedValue(mockProfile);

      // Same question answered multiple times (should be deduplicated)
      prisma.sessionAnswer.findMany.mockResolvedValue([
        { question_id: 'q-dup' },
        { question_id: 'q-dup' }, // Duplicate
        { question_id: 'q-dup' }, // Duplicate
        { question_id: 'q-other' },
      ]);

      questionsService.getNextQuestion.mockResolvedValue(mockNextQuestion);

      await service.submitAnswer('session-abc', mockQuestion as any, 'My answer...');

      const call = questionsService.getNextQuestion.mock.calls[0];
      const seenIds: string[] = call[4]; // 5th arg = excludeQuestionIds

      // Verify deduplication: q-dup should appear only once
      expect(seenIds.filter((id: string) => id === 'q-dup').length).toBe(1);
      expect(seenIds).toContain('q-other');
    });

    it('should return nextQuestion in response alongside answer', async () => {
      prisma.session.findUnique.mockResolvedValue(mockSession);
      assessmentService.classifyAnswer.mockResolvedValue(mockClassification);
      prisma.question.upsert.mockResolvedValue(mockQuestion);
      const mockAnswer = {
        id: 'answer-3',
        session_id: 'session-abc',
        question_id: 'q-current',
        classification: 'correct',
        confidence: 0.9,
        reasoning: 'Good',
        follow_up_asked: false,
        timestamp: new Date(),
      };
      prisma.sessionAnswer.create.mockResolvedValue(mockAnswer);
      skillProfileService.updateSkillProfile.mockResolvedValue(mockProfile);
      prisma.sessionAnswer.findMany.mockResolvedValue([]);
      questionsService.getNextQuestion.mockResolvedValue(mockNextQuestion);

      const result = await service.submitAnswer('session-abc', mockQuestion as any, 'Answer text');

      expect(result).toEqual({
        answer: mockAnswer,
        nextQuestion: mockNextQuestion,
      });
    });
  });
});

// ─── Original report generation tests (preserved) ──────────────────────────────
describe('SessionsService - Report Generation', () => {
  let service: SessionsService;
  let prisma: any;
  let providerRouter: any;
  let tutorService: any;

  beforeEach(async () => {
    prisma = {
      session: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      sessionAnswer: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      skillProfile: {
        findMany: jest.fn(),
      },
      sessionReport: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      question: {
        upsert: jest.fn(),
      },
    };

    tutorService = {
      getAttempts: jest.fn(),
      processTutorTurn: jest.fn(),
    };

    providerRouter = {
      complete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SkillProfileService, useValue: { updateSkillProfile: jest.fn(), getWeakAreas: jest.fn() } },
        { provide: AssessmentService, useValue: { classifyAnswer: jest.fn() } },
        { provide: QuestionsService, useValue: { getNextQuestion: jest.fn(), getMockQuestion: jest.fn() } },
        { provide: TutorService, useValue: tutorService },
        { provide: ProviderRouterService, useValue: providerRouter },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    providerRouter = module.get(ProviderRouterService);
    tutorService = module.get(TutorService);
  });

  describe('getSessionReport with persisted report', () => {
    it('should return persisted report when it exists', async () => {
      const mockReport = {
        id: 'report-123',
        session_id: 'session-123',
        summary: 'Great performance with strong understanding of React hooks.',
        strengths: ['React hooks', 'State management', 'Component lifecycle'],
        weaknesses: ['Performance optimization', 'Testing'],
        recommended_topics: ['React performance', 'Jest testing'],
        generated_at: new Date('2026-07-04'),
        session: {
          id: 'session-123',
          field: 'Full-stack',
          started_at: new Date('2026-07-04T10:00:00Z'),
          ended_at: new Date('2026-07-04T11:00:00Z'),
          target_duration_minutes: 60,
          status: 'completed',
        },
      };

      prisma.sessionReport.findFirst.mockResolvedValue(mockReport);

      const result = await service.getSessionReport('session-123');

      expect(prisma.sessionReport.findFirst).toHaveBeenCalledWith({
        where: { session_id: 'session-123' },
        include: {
          session: {
            select: {
              id: true,
              field: true,
              started_at: true,
              ended_at: true,
              target_duration_minutes: true,
              status: true,
            },
          },
        },
      });

      expect(result).toEqual({
        session: mockReport.session,
        summary: mockReport.summary,
        strengths: mockReport.strengths,
        weaknesses: mockReport.weaknesses,
        recommendedTopics: mockReport.recommended_topics,
        generatedAt: mockReport.generated_at,
      });
    });

    it('should compute report on-the-fly if no persisted report exists', async () => {
      prisma.sessionReport.findFirst.mockResolvedValue(null);

      const mockSession = {
        id: 'session-456',
        user_id: 'user-123',
        field: 'System Design',
        started_at: new Date('2026-07-04T10:00:00Z'),
        ended_at: new Date('2026-07-04T11:00:00Z'),
        target_duration_minutes: 60,
        status: 'completed',
        session_answers: [
          {
            classification: 'correct',
            question: { topic: 'Databases', subtopic: 'SQL' },
          },
          {
            classification: 'correct',
            question: { topic: 'Databases', subtopic: 'SQL' },
          },
          {
            classification: 'incorrect',
            question: { topic: 'Caching', subtopic: 'Redis' },
          },
        ],
      };

      prisma.session.findUnique.mockResolvedValue(mockSession);
      prisma.skillProfile.findMany.mockResolvedValue([
        {
          topic: 'Databases',
          subtopic: 'SQL',
          mastery_score: 8.0,
          correct_count: 10,
          incorrect_count: 2,
          current_difficulty: 3,
        },
      ]);

      const result = await service.getSessionReport('session-456');

      expect(result).toMatchObject({
        session: {
          id: 'session-456',
          field: 'System Design',
          status: 'completed',
        },
        summary: {
          total: 3,
          correct: 2,
          incorrect: 1,
        },
      });
    });

    it('should throw NotFoundException if session does not exist', async () => {
      prisma.sessionReport.findFirst.mockResolvedValue(null);
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.getSessionReport('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
