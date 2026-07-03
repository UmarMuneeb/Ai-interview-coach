import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('SessionsController', () => {
  let controller: SessionsController;
  let service: SessionsService;

  const mockSessionsService = {
    listUserSessions: jest.fn(),
    getSessionReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        {
          provide: SessionsService,
          useValue: mockSessionsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
    service = module.get<SessionsService>(SessionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listSessions', () => {
    it('should return an array of sessions for the authenticated user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          field: 'fullstack',
          phase: 'interview',
          status: 'active',
          started_at: new Date(),
          ended_at: null,
          target_duration_minutes: 30,
          questions_planned: 10,
        },
      ];

      mockSessionsService.listUserSessions.mockResolvedValue(mockSessions);

      const req = { user: { userId: 'user-123' } };
      const result = await controller.listSessions(req);

      expect(result).toEqual(mockSessions);
      expect(mockSessionsService.listUserSessions).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getSessionReport', () => {
    it('should return a detailed session report', async () => {
      const mockReport = {
        session: {
          id: 'session-1',
          field: 'fullstack',
          started_at: new Date(),
          ended_at: new Date(),
          duration_minutes: 30,
          status: 'completed',
        },
        summary: {
          total: 10,
          correct: 7,
          incorrect: 2,
          partial: 1,
          misunderstood: 0,
          evasive: 0,
        },
        strengths: ['React / Hooks'],
        weaknesses: ['Node.js / Express'],
        topicBreakdown: [
          { topic: 'React', subtopic: 'Hooks', correct: 5, total: 5 },
          { topic: 'Node.js', subtopic: 'Express', correct: 2, total: 5 },
        ],
        skillProfiles: [
          {
            topic: 'React',
            subtopic: 'Hooks',
            masteryScore: 85,
            correctCount: 5,
            incorrectCount: 0,
            currentDifficulty: 3,
          },
        ],
      };

      mockSessionsService.getSessionReport.mockResolvedValue(mockReport);

      const result = await controller.getSessionReport('session-1');

      expect(result).toEqual(mockReport);
      expect(mockSessionsService.getSessionReport).toHaveBeenCalledWith('session-1');
    });
  });
});
