import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { tmpdir } from 'os';
import type { Express } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateBatchSubmissionsDto } from './dto/create-batch-submissions.dto';
import { ListHomeworkSubmissionsQueryDto } from './dto/list-homework-submissions-query.dto';
import { RegradeHomeworkSubmissionsDto } from './dto/regrade-homework-submissions.dto';
import { SubmissionsService } from './submissions.service';

const uploadDir = join(tmpdir(), 'homework-ai');

const ensureUploadDir = () => {
  mkdirSync(uploadDir, { recursive: true });
};

const uploadStorage = diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname || '') || '';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

@Controller('teacher/submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
export class TeacherSubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  async list(@Query() query: ListHomeworkSubmissionsQueryDto, @Req() req: { user: AuthUser }) {
    return this.submissionsService.listHomeworkSubmissions(query.homeworkId, req.user);
  }

  @Post('batch')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 100 },
        { name: 'archive', maxCount: 1 },
      ],
      { storage: uploadStorage, limits: { files: 101 } },
    ),
  )
  async createBatch(
    @Body() body: CreateBatchSubmissionsDto,
    @UploadedFiles()
    files: { images?: Express.Multer.File[]; archive?: Express.Multer.File[] },
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.createBatchSubmissions(body, files, req.user);
  }

  @Post('regrade')
  async regradeHomework(
    @Body() body: RegradeHomeworkSubmissionsDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.regradeHomeworkSubmissions(body, req.user);
  }
}
