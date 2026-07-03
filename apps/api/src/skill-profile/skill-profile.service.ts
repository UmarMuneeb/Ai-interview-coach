import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillProfileService {
  constructor(private prisma: PrismaService) {}

  async updateSkillProfile(userId: string, topic: string, subtopic: string, classification: string) {
    let profile = await this.prisma.skillProfile.findUnique({
      where: {
        user_id_topic_subtopic: {
          user_id: userId,
          topic,
          subtopic,
        }
      }
    });

    if (!profile) {
      profile = await this.prisma.skillProfile.create({
        data: {
          user_id: userId,
          topic,
          subtopic,
        }
      });
    }

    const updates: any = {};
    if (classification === 'correct') updates.correct_count = { increment: 1 };
    else if (classification === 'incorrect' || classification === 'partial') updates.incorrect_count = { increment: 1 };
    else if (classification === 'misunderstood') updates.misunderstood_count = { increment: 1 };
    else if (classification === 'evasive') updates.evasive_count = { increment: 1 };

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
