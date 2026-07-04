import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { SkillProfileService } from '../skill-profile/skill-profile.service';
import { AssessmentService } from '../assessment/assessment.service';
import { QuestionsService } from '../questions/questions.service';
import { TutorService } from '../tutor/tutor.service';
import { NotFoundException } from '@nestjs/common';

describe('SessionsService - New Methods', () => {
  let service: SessionsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    session: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    skillProfile: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SkillProfileService,
          useValue: {},
        },
        {
          provide: AssessmentService,
          useValue: {},
        },
        {
          provide: QuestionsService,
          useValue: {},
        },
        {
          provide: TutorService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('listUserSessions', () => {
    it('should return all sessions for a user ordered by started_at desc', async () => {
      const mockSessions = [
        {
          id: 'session-2',
          field: 'system-design',
          phase: 'completed',
          status: 'completed',
          started_at: new Date('2024-01-02'),
          ended_at: new Date('2024-01-02'),
          target_duration_minutes: 30,
          questions_planned: 10,
        },
        {
          id: 'session-1',
          field: 'fullstack',
          phase: 'interview',
          status: 'active',
          started_at: new Date('2024-01-01'),
          ended_at: null,
          target_duration_minutes: 45,
          questions_planned: 15,
        },
      ];

      mockPrismaService.session.findMany.mockResolvedValue(mockSessions);

      const result = await service.listUserSessions('user-123');

      expect(result).toEqual(mockSessions);
      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        orderBy: { started_at: 'desc' },
        select: {
          id: true,
          field: true,
          phase: true,
          status: true,
          started_at: true,
          ended_at: true,
          target_duration_minutes: true,
          questions_planned: true,
        },
      });
    });
  });

  describe('getSessionReport', () => {
    it('should throw NotFoundException if session does not exist', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.getSessionReport('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return a comprehensive session report with statistics', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-123',
        field: 'fullstack',
        started_at: new Date('2024-01-01'),
        ended_at: new Date('2024-01-01'),
        target_duration_minutes: 30,
        status: 'completed',
        session_answers: [
          {
            classification: 'correct',
            question: { topic: 'React', subtopic: 'Hooks' },
          },
          {
            classification: 'correct',
            question: { topic: 'React', subtopic: 'Hooks' },
          },
          {
            classification: 'incorrect',
            question: { topic: 'Node.js', subtopic: 'Express' },
          },
          {
            classification: 'partial',
            question: { topic: 'Node.js', subtopic: 'Express' },
          },
          {
            classification: 'misunderstood',
            question: { topic: 'Node.js', subtopic: 'Express' },
          },
        ],
      };

      const mockSkillProfiles = [
        {
          topic: 'React',
          subtopic: 'Hooks',
          mastery_score: 85,
          correct_count: 10,
          incorrect_count: 2,
          current_difficulty: 3,
        },
      ];

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.skillProfile.findMany.mockResolvedValue(
        mockSkillProfiles,
      );

      const result = await service.getSessionReport('session-1');

      expect(result.session.id).toBe('session-1');
      expect(result.summary.total).toBe(5);
      expect(result.summary.correct).toBe(2);
      expect(result.summary.incorrect).toBe(1);
      expect(result.summary.partial).toBe(1);
      expect(result.summary.misunderstood).toBe(1);

      // Strengths: React/Hooks is 2/2 = 100% ≥ 70%
      expect(result.strengths).toContain('React / Hooks');

      // Weaknesses: Node.js/Express is 0/3 = 0% < 50%
      expect(result.weaknesses).toContain('Node.js / Express');

      // Topic breakdown
      expect(result.topicBreakdown).toHaveLength(2);
      const reactBreakdown = result.topicBreakdown.find(
        (b: any) => b.topic === 'React' && b.subtopic === 'Hooks',
      );
      expect(reactBreakdown).toEqual({
        topic: 'React',
        subtopic: 'Hooks',
        correct: 2,
        total: 2,
      });

      // Skill profiles
      expect(result.skillProfiles).toHaveLength(1);
      expect(result.skillProfiles[0]).toEqual({
        topic: 'React',
        subtopic: 'Hooks',
        masteryScore: 85,
        correctCount: 10,
        incorrectCount: 2,
        currentDifficulty: 3,
      });
    });

    it('should handle empty session (no answers)', async () => {
      const mockSession = {
        id: 'session-empty',
        user_id: 'user-123',
        field: 'fullstack',
        started_at: new Date(),
        ended_at: null,
        target_duration_minutes: 30,
        status: 'active',
        session_answers: [],
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.skillProfile.findMany.mockResolvedValue([]);

      const result = await service.getSessionReport('session-empty');

      expect(result.summary.total).toBe(0);
      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
      expect(result.topicBreakdown).toEqual([]);
    });
  });
});
