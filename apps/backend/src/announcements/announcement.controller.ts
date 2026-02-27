import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { AnnouncementService } from './announcement.service';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Body() body: { classId?: string; title: string; content: string; pinned?: boolean },
    @Req() req: { user: AuthUser },
  ) {
    return this.service.create(body, req.user);
  }

  @Get()
  async list(@Req() req: { user: AuthUser }, @Query('classId') classId?: string) {
    if (req.user.role === 'STUDENT') {
      return this.service.listForStudent(req.user.id);
    }
    if (req.user.role === 'TEACHER') {
      return this.service.listForTeacher(req.user.id, classId);
    }
    if (req.user.role === 'ADMIN') {
      return this.service.listForAdmin(classId);
    }
    return [];
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async delete(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.service.delete(id, req.user);
  }
}
