import {
  BadRequestException,
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
import { RetrySkippedDto } from './dto/retry-skipped.dto';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { tmpdir } from 'os';
import * as iconv from 'iconv-lite';
import type { Express } from 'express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { StorageService } from '../storage/storage.service';
import { CreateBatchSubmissionsDto } from './dto/create-batch-submissions.dto';
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
    // 解码文件名编码（修复中文文件名乱码问题）
    const decodedName = decodeFileName(file.originalname || '');
    const ext = extname(decodedName) || '';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

/**
 * 解码文件名编码，修复中文文件名乱码问题
 * 浏览器上传时中文文件名可能以 Latin-1 编码传输
 */
function decodeFileName(fileName: string): string {
  if (!fileName) {
    return fileName;
  }
  try {
    // 检测是否是 Latin-1 编码（浏览器默认）
    const buffer = Buffer.from(fileName, 'latin1');
    // 尝试用 UTF-8 解码
    const utf8Decoded = iconv.decode(buffer, 'utf-8');
    // 如果解码后包含有效中文字符，说明原编码是 Latin-1
    if (/[\u4e00-\u9fa5]/.test(utf8Decoded)) {
      return utf8Decoded;
    }
    return fileName;
  } catch {
    return fileName;
  }
}

@Controller('teacher/submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
export class TeacherSubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly storage: StorageService,
  ) {}

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
    // 修正上传文件的文件名编码
    if (files?.images) {
      files.images.forEach((f) => {
        if (f.originalname) {
          f.originalname = decodeFileName(f.originalname);
        }
      });
    }
    if (files?.archive) {
      files.archive.forEach((f) => {
        if (f.originalname) {
          f.originalname = decodeFileName(f.originalname);
        }
      });
    }
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
    res.setHeader('Content-Length', zip.length);
    return new StreamableFile(zip);
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

  @Get('pdf')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportPdf(
    @Query('homeworkId') homeworkId: string,
    @Query('submissionIds') submissionIds: string,
    @Query('lang') lang: string | undefined,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const ids = (submissionIds || '').split(',').filter((id) => id).slice(0, 200);
    if (ids.length === 0) {
      throw new BadRequestException('At least one submissionId is required');
    }
    const buffer = await this.submissionsService.exportHomeworkSubmissionsPdf(
      homeworkId,
      ids,
      lang,
      req.user,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="homework-${homeworkId}-grading-sheets.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length);
    return new StreamableFile(buffer);
  }

  @Post('retry-skipped')
  async retrySkipped(
    @Body() body: RetrySkippedDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.submissionsService.retrySkippedSubmission(body, req.user);
  }

  @Get('thumbnail/:fileKey')
  async getThumbnail(
    @Param('fileKey') fileKey: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // fileKey 已经被 normalize 过，直接用于构建 objectKey
    const objectKey = `thumbnails/${fileKey}.jpg`;
    try {
      const buffer = await this.storage.getObject(objectKey);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      return new StreamableFile(buffer);
    } catch (error) {
      // 缩略图不存在时返回 404
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(404).send(`Thumbnail not found: ${message}`);
    }
  }
}
