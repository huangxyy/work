import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { ImportStudentsDto } from './dto/import-students.dto';
import { UpdateClassTeachersDto } from './dto/update-class-teachers.dto';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(@Body() body: CreateClassDto, @Req() req: { user: AuthUser }) {
    return this.classesService.createClass(body, req.user);
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  async list(@Req() req: { user: AuthUser }) {
    return this.classesService.listClasses(req.user);
  }

  @Post(':id/students/import')
  @Roles(Role.TEACHER, Role.ADMIN)
  async importStudents(
    @Param('id') classId: string,
    @Body() body: ImportStudentsDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.classesService.importStudents(classId, body, req.user);
  }

  @Patch(':id/teachers')
  @Roles(Role.ADMIN)
  async updateTeachers(
    @Param('id') classId: string,
    @Body() body: UpdateClassTeachersDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.classesService.updateTeachers(classId, body.teacherIds, req.user);
  }

  @Get(':id/students')
  @Roles(Role.TEACHER, Role.ADMIN)
  async listStudents(@Param('id') classId: string, @Req() req: { user: AuthUser }) {
    return this.classesService.listStudents(classId, req.user);
  }

  @Delete(':id/students/:studentId')
  @Roles(Role.TEACHER, Role.ADMIN)
  async removeStudent(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.classesService.removeStudent(classId, studentId, req.user);
  }
}
