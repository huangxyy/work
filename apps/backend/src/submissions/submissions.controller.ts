import {
  BadRequestException,
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
import { ApiTags } from '@nestjs/swagger';
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
import { isValidImageBuffer } from '../common/security';
import { StorageService } from '../storage/storage.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RegradeSubmissionDto } from './dto/regrade-submission.dto';
import { StudentSubmissionsQueryDto } from './dto/student-submissions-query.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @Roles(Role.STUDENT)
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      storage: memoryStorage(),
      limits: { files: 3, fileSize: 10 * 1024 * 1024 }, // 10MB per file
      fileFilter: (_req, file, cb) => {
        // Validate image file types
        console.log('[FilesInterceptor] File received:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype) {
          cb(null, true);
        } else {
          console.warn('[FilesInterceptor] Invalid mimetype:', file.mimetype);
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
    console.log('[SubmissionsController] Create submission request:', {
      body,
      filesCount: files?.length || 0,
      user: req.user?.account,
    });

    if (!files?.length) {
      console.error('[SubmissionsController] No files uploaded');
      throw new BadRequestException('请至少上传一张图片');
    }

    for (const file of files) {
      console.log('[SubmissionsController] File info:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.buffer?.length,
      });
      if (!isValidImageBuffer(file.buffer)) {
        console.error('[SubmissionsController] Invalid image buffer for:', file.originalname);
        throw new BadRequestException(
          `文件 "${file.originalname}" 不是有效的图片格式`,
        );
      }
    }
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
      throw new NotFoundException('提交记录不存在');
    }

    return {
      id: submission.id,
      status: submission.status,
      images: await Promise.all(
        submission.images.map(async (image) => ({
          id: image.id,
          url: await this.storageService.getPresignedUrl(image.objectKey),
        })),
      ),
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
      teacherComment: submission.teacherComment,
      manualScore: submission.manualScore,
      reviewedBy: submission.reviewedBy,
      reviewedAt: submission.reviewedAt,
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
