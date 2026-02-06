import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { ListHomeworksQueryDto } from './dto/list-homeworks-query.dto';
import { UpdateHomeworkLateSubmissionDto } from './dto/update-homework-late-submission.dto';
import { HomeworksService } from './homeworks.service';

@Controller('homeworks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HomeworksController {
  constructor(private readonly homeworksService: HomeworksService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(@Body() body: CreateHomeworkDto, @Req() req: { user: AuthUser }) {
    return this.homeworksService.createHomework(body, req.user);
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  async listByClass(
    @Query() query: ListHomeworksQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.homeworksService.listByClass(query.classId, req.user);
  }

  @Get('summary')
  @Roles(Role.TEACHER, Role.ADMIN)
  async listSummary(
    @Query() query: ListHomeworksQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.homeworksService.listByClassSummary(query.classId, req.user);
  }

  @Get('student')
  @Roles(Role.STUDENT)
  async listForStudent(@Req() req: { user: AuthUser }) {
    return this.homeworksService.listForStudent(req.user);
  }

  @Get(':id/delete-preview')
  @Roles(Role.TEACHER, Role.ADMIN)
  async deletePreview(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.homeworksService.getDeletePreview(id, req.user);
  }

  @Patch(':id/late-submission')
  @Roles(Role.TEACHER, Role.ADMIN)
  async updateLateSubmission(
    @Param('id') id: string,
    @Body() body: UpdateHomeworkLateSubmissionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.homeworksService.updateLateSubmission(id, body.allowLateSubmission, req.user);
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.homeworksService.deleteHomework(id, req.user);
  }
}
