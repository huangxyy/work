import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { AdminService } from './admin.service';
import { AdminUsageQueryDto } from './dto/admin-usage-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { BulkDisableUsersDto } from './dto/bulk-disable-users.dto';
import { BulkImportUsersDto } from './dto/bulk-import-users.dto';
import { BulkResetPasswordDto } from './dto/bulk-reset-password.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { DaysRangeQueryDto } from './dto/days-range-query.dto';
import { LlmLogsClearDto } from './dto/llm-logs-clear.dto';
import { LlmLogsQueryDto } from './dto/llm-logs-query.dto';
import { LlmTestDto } from './dto/llm-test.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { QueueMetricsQueryDto } from './dto/queue-metrics-query.dto';
import { QueueCleanDto } from './dto/queue-clean.dto';
import { QueueRetryDto } from './dto/queue-retry.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  async metrics() {
    return this.adminService.getMetrics();
  }

  @Get('usage')
  async usage(@Query() query: AdminUsageQueryDto) {
    return this.adminService.getUsage(query);
  }

  @Get('health/llm')
  async llmHealth() {
    return this.adminService.testLlmConnection();
  }

  @Get('health/ocr')
  async ocrHealth() {
    return this.adminService.testOcrConnection();
  }

  @Get('health/storage')
  async storageHealth() {
    return this.adminService.testStorageConnection();
  }

  @Get('health/email')
  async emailHealth() {
    return this.adminService.testEmailConnection();
  }

  @Get('health/redis')
  async redisHealth() {
    return this.adminService.testRedisConnection();
  }

  @Get('users/export')
  async exportUsers(@Res({ passthrough: true }) res: Response) {
    const csv = await this.adminService.exportUsersCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    return csv;
  }

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  async createUser(@Body() body: CreateAdminUserDto) {
    return this.adminService.createUser(body);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id', ParseCuidPipe) id: string, @Req() req: { user: AuthUser }) {
    return this.adminService.deleteUser(id, req.user);
  }

  @Patch('users/:id')
  async updateUser(@Param('id', ParseCuidPipe) id: string, @Body() body: UpdateAdminUserDto) {
    return this.adminService.updateUser(id, body);
  }

  @Post('users/:id/reset-password')
  async resetPassword(@Param('id', ParseCuidPipe) id: string, @Body() body: ResetUserPasswordDto) {
    return this.adminService.resetUserPassword(id, body);
  }

  @Get('classes/summary')
  async listClassSummaries() {
    return this.adminService.listClassSummaries();
  }

  @Get('config')
  async getConfig() {
    return this.adminService.getSystemConfig();
  }

  @Put('config')
  async updateConfig(@Body() body: UpdateSystemConfigDto) {
    return this.adminService.updateSystemConfig(body);
  }
  @Post('llm/test')
  async testLlm(@Body() body: LlmTestDto, @Req() req: { user: AuthUser }) {
    return this.adminService.testLlmCall(body, req.user);
  }

  @Get('llm/logs')
  async listLlmLogs(@Query() query: LlmLogsQueryDto) {
    return this.adminService.listLlmLogs(query);
  }

  @Delete('llm/logs')
  async clearLlmLogs(@Body() body: LlmLogsClearDto) {
    return this.adminService.clearLlmLogs(body);
  }

  @Get('queue/metrics')
  async getQueueMetrics(@Query() query: QueueMetricsQueryDto) {
    return this.adminService.getQueueMetrics(query);
  }

  @Post('queue/retry-failed')
  async retryFailedJobs(@Body() body: QueueRetryDto) {
    return this.adminService.retryFailedQueueJobs(body.limit);
  }

  @Post('queue/clean')
  async cleanQueue(@Body() body: QueueCleanDto) {
    return this.adminService.cleanQueue(body);
  }

  @Post('queue/pause')
  async pauseQueue() {
    return this.adminService.pauseQueue();
  }

  @Post('queue/resume')
  async resumeQueue() {
    return this.adminService.resumeQueue();
  }

  @Get('feature-flags')
  async getFeatureFlags() {
    return this.adminService.getFeatureFlags();
  }

  @Patch('feature-flags')
  async updateFeatureFlag(@Body() body: UpdateFeatureFlagDto) {
    return this.adminService.updateFeatureFlag(body.flag, body.enabled);
  }

  @Get('submissions/:id/diagnosis')
  async getSubmissionDiagnosis(@Param('id', ParseCuidPipe) id: string) {
    return this.adminService.getSubmissionDiagnosis(id);
  }

  @Post('ocr/test')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async testOcr(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    return this.adminService.testOcrWithImage(file.buffer);
  }

  @Get('error-trends')
  async getErrorTrends(@Query() query: DaysRangeQueryDto) {
    return this.adminService.getErrorTrends(query.days ?? 7);
  }

  @Get('system-info')
  async getSystemInfo() {
    return this.adminService.getSystemInfo();
  }

  @Post('users/bulk-import')
  async bulkImportUsers(@Body() body: BulkImportUsersDto) {
    return this.adminService.bulkImportUsers(body);
  }

  @Post('users/bulk-disable')
  async bulkDisableUsers(@Body() body: BulkDisableUsersDto) {
    return this.adminService.bulkDisableUsers(body.userIds);
  }

  @Post('users/bulk-reset-password')
  async bulkResetPassword(@Body() body: BulkResetPasswordDto) {
    return this.adminService.bulkResetPassword(body.userIds, body.newPassword);
  }

  @Get('llm/cost-summary')
  async getLlmCostSummary(@Query() query: DaysRangeQueryDto) {
    return this.adminService.getLlmCostSummary(query.days ?? 7);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() query: AuditLogsQueryDto) {
    return this.adminService.getAuditLogs(query);
  }
}
