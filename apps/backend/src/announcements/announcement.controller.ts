import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements-query.dto';
import { AnnouncementService } from './announcement.service';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Body() body: CreateAnnouncementDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.service.create(body, req.user);
  }

  @Get()
  async list(@Req() req: { user: AuthUser }, @Query() query: ListAnnouncementsQueryDto) {
    if (req.user.role === Role.STUDENT) {
      return this.service.listForStudent(req.user.id);
    }
    if (req.user.role === Role.TEACHER) {
      return this.service.listForTeacher(req.user.id, query.classId);
    }
    if (req.user.role === Role.ADMIN) {
      return this.service.listForAdmin(query.classId);
    }
    return [];
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async delete(@Param('id', ParseCuidPipe) id: string, @Req() req: { user: AuthUser }) {
    return this.service.delete(id, req.user);
  }
}
