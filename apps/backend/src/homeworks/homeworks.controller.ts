import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { ListHomeworksQueryDto } from './dto/list-homeworks-query.dto';
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
}
