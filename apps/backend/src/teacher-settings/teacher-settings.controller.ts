import { Body, Controller, Delete, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GradingPolicyQueryDto } from './dto/grading-policy-query.dto';
import { GradingPolicyUpdateDto } from './dto/grading-policy-update.dto';
import { TeacherSettingsService } from './teacher-settings.service';

@Controller('teacher/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherSettingsController {
  constructor(private readonly teacherSettingsService: TeacherSettingsService) {}

  @Get('grading')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getGradingSettings() {
    return this.teacherSettingsService.getGradingSettings();
  }

  @Get('grading/policies')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getGradingPolicies(
    @Query() query: GradingPolicyQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.teacherSettingsService.getPolicySummary(query, req.user);
  }

  @Get('grading/policies/preview')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getPolicyPreview(
    @Query() query: GradingPolicyQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.teacherSettingsService.getPolicyPreview(query, req.user);
  }

  @Put('grading/policies/class/:classId')
  @Roles(Role.TEACHER, Role.ADMIN)
  async upsertClassPolicy(
    @Param('classId') classId: string,
    @Body() body: GradingPolicyUpdateDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.teacherSettingsService.upsertClassPolicy(classId, body, req.user);
  }

  @Put('grading/policies/homework/:homeworkId')
  @Roles(Role.TEACHER, Role.ADMIN)
  async upsertHomeworkPolicy(
    @Param('homeworkId') homeworkId: string,
    @Body() body: GradingPolicyUpdateDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.teacherSettingsService.upsertHomeworkPolicy(homeworkId, body, req.user);
  }

  @Delete('grading/policies/class/:classId')
  @Roles(Role.TEACHER, Role.ADMIN)
  async clearClassPolicy(@Param('classId') classId: string, @Req() req: { user: AuthUser }) {
    return this.teacherSettingsService.clearClassPolicy(classId, req.user);
  }

  @Delete('grading/policies/homework/:homeworkId')
  @Roles(Role.TEACHER, Role.ADMIN)
  async clearHomeworkPolicy(
    @Param('homeworkId') homeworkId: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.teacherSettingsService.clearHomeworkPolicy(homeworkId, req.user);
  }
}
