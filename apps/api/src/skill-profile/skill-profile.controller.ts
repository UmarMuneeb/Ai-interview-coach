import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkillProfileService } from './skill-profile.service';

@Controller('skill-profile')
@UseGuards(JwtAuthGuard)
export class SkillProfileController {
  constructor(private readonly skillProfileService: SkillProfileService) {}

  @Get()
  async getUserSkillProfile(@Request() req) {
    const userId = req.user.userId;
    return this.skillProfileService.getUserSkillProfile(userId);
  }
}
