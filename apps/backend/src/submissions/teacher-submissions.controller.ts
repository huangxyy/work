import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
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
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateBatchSubmissionsDto } from './dto/create-batch-submissions.dto';
import { ExportHomeworkPrintQueryDto } from './dto/export-homework-print-query.dto';
import { ListHomeworkSubmissionsQueryDto } from './dto/list-homework-submissions-query.dto';
import { RegradeHomeworkSubmissionsDto } from './dto/regrade-homework-submissions.dto';
import { SubmissionsService } from './submissions.service';

const uploadDir = join(tmpdir(), 'homework-ai');
const MAX_ZIP_BYTES = Number.isFinite(Number(process.env.BATCH_ZIP_MAX_BYTES))
  ? Number(process.env.BATCH_ZIP_MAX_BYTES)
  : 104857600;

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

  @Get('batches')
  async listBatches(
    @Query() query: ListHomeworkSubmissionsQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.listBatchUploads(query.homeworkId, req.user);
  }

  @Get('batches/:batchId')
  async getBatch(@Param('batchId') batchId: string, @Req() req: { user: AuthUser }) {
    return this.submissionsService.getBatchUploadDetail(batchId, req.user);
  }

  @Post('batch')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 100 },
        { name: 'archive', maxCount: 1 },
      ],
      { storage: uploadStorage, limits: { files: 101, fileSize: MAX_ZIP_BYTES } },
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

  @Get('export')
  async exportCsv(
    @Query() query: ListHomeworkSubmissionsQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.submissionsService.exportHomeworkCsv(query.homeworkId, req.user, query.lang);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="homework-${query.homeworkId}-submissions.csv"`,
    );
    return csv;
  }

  @Get('images')
  async exportImages(
    @Query() query: ListHomeworkSubmissionsQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const zip = await this.submissionsService.exportHomeworkImagesZip(query.homeworkId, req.user);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="homework-${query.homeworkId}-images.zip"`,
    );
    return zip;
  }

  @Get('print')
  async exportPrintPacket(
    @Query() query: ExportHomeworkPrintQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const submissionIds = query.submissionIds
      ? query.submissionIds
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

    const exported = await this.submissionsService.exportHomeworkPrintPacket(
      query.homeworkId,
      req.user,
      {
        lang: query.lang,
        submissionIds,
      },
    );

    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.setHeader('Content-Length', exported.buffer.length);
    res.setHeader('X-Print-Packet-Files', String(exported.files));
    res.setHeader('X-Print-Packet-Students', String(exported.totalStudents));
    return new StreamableFile(exported.buffer);
  }

  @Get('reminders')
  async exportReminders(
    @Query() query: ListHomeworkSubmissionsQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.submissionsService.exportHomeworkRemindersCsv(query.homeworkId, req.user, query.lang);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="homework-${query.homeworkId}-reminders.csv"`,
    );
    return csv;
  }

  @Post('regrade')
  async regradeHomework(
    @Body() body: RegradeHomeworkSubmissionsDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.regradeHomeworkSubmissions(body, req.user);
  }

  @Post('batches/:batchId/retry')
  async retryBatch(@Param('batchId') batchId: string, @Req() req: { user: AuthUser }) {
    return this.submissionsService.regradeBatchSubmissions(batchId, req.user);
  }
}
