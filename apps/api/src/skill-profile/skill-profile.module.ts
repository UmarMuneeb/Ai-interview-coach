import { Module } from '@nestjs/common';
import { SkillProfileService } from './skill-profile.service';

@Module({
  providers: [SkillProfileService],
  exports: [SkillProfileService],
})
export class SkillProfileModule {}
