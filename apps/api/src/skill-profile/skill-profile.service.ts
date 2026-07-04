import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WeakArea {
  topic: string;
  subtopic: string;
  masteryScore: number;
  currentDifficulty: number;
  incorrectCount: number;
}

@Injectable()
export class SkillProfileService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get weak areas for a user, sorted by mastery score (lowest first).
   * Used by sessions module for adaptive question targeting.
   */
  async getWeakAreas(userId: string): Promise<WeakArea[]> {
    const profiles = await this.prisma.skillProfile.findMany({
      where: {
        user_id: userId,
        mastery_score: { lt: 7.0 },
      },
      orderBy: {
        mastery_score: 'asc', // Lowest mastery first
      },
    });

    return profiles.map((profile) => ({
      topic: profile.topic,
      subtopic: profile.subtopic,
      masteryScore: profile.mastery_score,
      currentDifficulty: profile.current_difficulty,
      incorrectCount: profile.incorrect_count,
    }));
  }

  async updateSkillProfile(
    userId: string,
    topic: string,
    subtopic: string,
    classification: string,
  ) {
    let profile = await this.prisma.skillProfile.findUnique({
      where: {
        user_id_topic_subtopic: {
          user_id: userId,
          topic,
          subtopic,
        },
      },
    });

    if (!profile) {
      profile = await this.prisma.skillProfile.create({
        data: {
          user_id: userId,
          topic,
          subtopic,
        },
      });
    }

    const updates: any = {};
    if (classification === 'correct') updates.correct_count = { increment: 1 };
    else if (classification === 'incorrect' || classification === 'partial')
      updates.incorrect_count = { increment: 1 };
    else if (classification === 'misunderstood')
      updates.misunderstood_count = { increment: 1 };
    else if (classification === 'evasive')
      updates.evasive_count = { increment: 1 };

    updates.mastery_score = profile.mastery_score;
    if (classification === 'correct') {
      updates.mastery_score = Math.min(10.0, profile.mastery_score + 0.5);
    } else {
      updates.mastery_score = Math.max(0.0, profile.mastery_score - 0.5);
    }

    if (updates.mastery_score < 4.0) updates.current_difficulty = 1;
    else if (updates.mastery_score < 7.0) updates.current_difficulty = 2;
    else updates.current_difficulty = 3;

    updates.last_seen_at = new Date();

    return this.prisma.skillProfile.update({
      where: { id: profile.id },
      data: updates,
    });
  }
}
