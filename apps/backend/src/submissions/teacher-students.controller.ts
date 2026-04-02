import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { TeacherStudentSubmissionsQueryDto } from './dto/teacher-student-submissions-query.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('Teacher Students')
@Controller('teacher/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
export class TeacherStudentsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get(':studentId/submissions')
  async getStudentSubmissions(
    @Param('studentId', ParseCuidPipe) studentId: string,
    @Query() query: TeacherStudentSubmissionsQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.getStudentSubmissionsByClass(studentId, query.classId, req.user);
  }
}
