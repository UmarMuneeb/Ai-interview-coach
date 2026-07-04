import { Test, TestingModule } from '@nestjs/testing';
import { SkillProfileService } from './skill-profile.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SkillProfileService - getWeakAreas', () => {
  let service: SkillProfileService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillProfileService,
        {
          provide: PrismaService,
          useValue: {
            skillProfile: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SkillProfileService>(SkillProfileService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('getWeakAreas', () => {
    it('should return weak areas sorted by mastery score (lowest first)', async () => {
      const mockProfiles = [
        {
          id: '1',
          user_id: 'user-123',
          topic: 'React',
          subtopic: 'hooks',
          mastery_score: 3.5,
          current_difficulty: 1,
          correct_count: 2,
          incorrect_count: 8,
          misunderstood_count: 1,
          evasive_count: 0,
          last_seen_at: new Date(),
        },
        {
          id: '2',
          user_id: 'user-123',
          topic: 'TypeScript',
          subtopic: 'generics',
          mastery_score: 5.0,
          current_difficulty: 2,
          correct_count: 5,
          incorrect_count: 5,
          misunderstood_count: 0,
          evasive_count: 0,
          last_seen_at: new Date(),
        },
        {
          id: '3',
          user_id: 'user-123',
          topic: 'Node.js',
          subtopic: 'streams',
          mastery_score: 6.5,
          current_difficulty: 2,
          correct_count: 8,
          incorrect_count: 3,
          misunderstood_count: 0,
          evasive_count: 0,
          last_seen_at: new Date(),
        },
      ];

      prisma.skillProfile.findMany.mockResolvedValue(mockProfiles as any);

      const result = await service.getWeakAreas('user-123');

      expect(prisma.skillProfile.findMany).toHaveBeenCalledWith({
        where: {
          user_id: 'user-123',
          mastery_score: { lt: 7.0 }, // ✅ Filters < 7.0
        },
        orderBy: {
          mastery_score: 'asc', // ✅ Lowest first
        },
      });

      expect(result).toEqual([
        {
          topic: 'React',
          subtopic: 'hooks',
          masteryScore: 3.5, // Lowest
          currentDifficulty: 1,
          incorrectCount: 8,
        },
        {
          topic: 'TypeScript',
          subtopic: 'generics',
          masteryScore: 5.0, // Middle
          currentDifficulty: 2,
          incorrectCount: 5,
        },
        {
          topic: 'Node.js',
          subtopic: 'streams',
          masteryScore: 6.5, // Highest (but still < 7.0)
          currentDifficulty: 2,
          incorrectCount: 3,
        },
      ]);
    });

    it('should filter out profiles with mastery >= 7.0', async () => {
      const mockProfiles = [
        {
          id: '1',
          user_id: 'user-456',
          topic: 'JavaScript',
          subtopic: 'closures',
          mastery_score: 4.0,
          current_difficulty: 1,
          correct_count: 3,
          incorrect_count: 5,
          misunderstood_count: 0,
          evasive_count: 0,
          last_seen_at: new Date(),
        },
      ];

      // Prisma already filtered, only returns < 7.0
      prisma.skillProfile.findMany.mockResolvedValue(mockProfiles as any);

      const result = await service.getWeakAreas('user-456');

      expect(result).toHaveLength(1);
      expect(result[0].masteryScore).toBe(4.0);
      expect(result[0].topic).toBe('JavaScript');
    });

    it('should return empty array if no weak areas exist', async () => {
      prisma.skillProfile.findMany.mockResolvedValue([]);

      const result = await service.getWeakAreas('user-789');

      expect(result).toEqual([]);
      expect(prisma.skillProfile.findMany).toHaveBeenCalledWith({
        where: {
          user_id: 'user-789',
          mastery_score: { lt: 7.0 },
        },
        orderBy: {
          mastery_score: 'asc',
        },
      });
    });

    it('should map database fields to camelCase return shape', async () => {
      const mockProfile = {
        id: '1',
        user_id: 'user-123',
        topic: 'Testing',
        subtopic: 'Jest',
        mastery_score: 2.5,
        current_difficulty: 1,
        correct_count: 1,
        incorrect_count: 10,
        misunderstood_count: 2,
        evasive_count: 1,
        last_seen_at: new Date(),
      };

      prisma.skillProfile.findMany.mockResolvedValue([mockProfile] as any);

      const result = await service.getWeakAreas('user-123');

      expect(result[0]).toEqual({
        topic: 'Testing', // ✅ Same
        subtopic: 'Jest', // ✅ Same
        masteryScore: 2.5, // ✅ Converted from mastery_score
        currentDifficulty: 1, // ✅ Converted from current_difficulty
        incorrectCount: 10, // ✅ Converted from incorrect_count
      });

      // Verify excluded fields
      expect(result[0]).not.toHaveProperty('id');
      expect(result[0]).not.toHaveProperty('user_id');
      expect(result[0]).not.toHaveProperty('correct_count');
      expect(result[0]).not.toHaveProperty('misunderstood_count');
      expect(result[0]).not.toHaveProperty('evasive_count');
    });

    it('should handle multiple users independently', async () => {
      const user1Profile = {
        id: '1',
        user_id: 'user-1',
        topic: 'React',
        subtopic: 'hooks',
        mastery_score: 3.0,
        current_difficulty: 1,
        correct_count: 2,
        incorrect_count: 7,
        misunderstood_count: 0,
        evasive_count: 0,
        last_seen_at: new Date(),
      };

      prisma.skillProfile.findMany.mockResolvedValue([user1Profile] as any);

      await service.getWeakAreas('user-1');

      expect(prisma.skillProfile.findMany).toHaveBeenCalledWith({
        where: {
          user_id: 'user-1', // ✅ Filtered by specific user
          mastery_score: { lt: 7.0 },
        },
        orderBy: {
          mastery_score: 'asc',
        },
      });
    });
  });
});
