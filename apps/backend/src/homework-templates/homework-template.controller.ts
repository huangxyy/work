import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { HomeworkTemplateService } from './homework-template.service';

@ApiTags('Homework Templates')
@Controller('homework-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
export class HomeworkTemplateController {
  constructor(private readonly service: HomeworkTemplateService) {}

  @Post()
  async create(@Body() body: { title: string; desc?: string }, @Req() req: { user: AuthUser }) {
    return this.service.create(body, req.user);
  }

  @Get()
  async list(@Req() req: { user: AuthUser }) {
    return this.service.list(req.user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { title?: string; desc?: string }, @Req() req: { user: AuthUser }) {
    return this.service.update(id, body, req.user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.service.delete(id, req.user);
  }
}
