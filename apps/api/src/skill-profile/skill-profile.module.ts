import { Module } from '@nestjs/common';
import { SkillProfileService } from './skill-profile.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SkillProfileController } from './skill-profile.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SkillProfileController],
  providers: [SkillProfileService],
  exports: [SkillProfileService],
})
export class SkillProfileModule {}
