import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RegradeSubmissionDto } from './dto/regrade-submission.dto';
import { StudentSubmissionsQueryDto } from './dto/student-submissions-query.dto';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Roles(Role.STUDENT)
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      storage: memoryStorage(),
      limits: { files: 3, fileSize: 10 * 1024 * 1024 }, // 10MB per file
      fileFilter: (_req, file, cb) => {
        // Validate image file types
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
    }),
  )
  async create(
    @Body() body: CreateSubmissionDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.createSubmission(body, files, req.user);
  }

  @Get()
  @Roles(Role.STUDENT)
  async listForStudent(
    @Query() query: StudentSubmissionsQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.listStudentSubmissionsWithQuery(req.user, query);
  }

  @Get('export')
  @Roles(Role.STUDENT)
  async exportForStudent(
    @Query() query: StudentSubmissionsQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.submissionsService.exportStudentSubmissionsCsv(req.user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="student-submissions.csv"');
    return csv;
  }

  @Get(':id')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async get(@Param('id', ParseCuidPipe) id: string, @Req() req: { user: AuthUser }) {
    const submission = await this.submissionsService.getSubmission(id, req.user);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return {
      id: submission.id,
      status: submission.status,
      images: submission.images.map((image) => ({ id: image.id })),
      student: submission.student
        ? {
            id: submission.student.id,
            name: submission.student.name,
            account: submission.student.account,
          }
        : null,
      homework: submission.homework
        ? { id: submission.homework.id, title: submission.homework.title }
        : null,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      ocrText: submission.ocrText,
      gradingJson: submission.gradingJson,
      totalScore: submission.totalScore,
      errorCode: submission.errorCode,
      errorMsg: submission.errorMsg,
    };
  }

  @Post(':id/regrade')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async regrade(
    @Param('id', ParseCuidPipe) id: string,
    @Body() body: RegradeSubmissionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.requestRegrade(id, body, req.user);
  }
}
