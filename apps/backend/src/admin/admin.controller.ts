import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import { AdminUsageQueryDto } from './dto/admin-usage-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { LlmLogsClearDto } from './dto/llm-logs-clear.dto';
import { LlmLogsQueryDto } from './dto/llm-logs-query.dto';
import { LlmTestDto } from './dto/llm-test.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { QueueMetricsQueryDto } from './dto/queue-metrics-query.dto';
import { QueueCleanDto } from './dto/queue-clean.dto';
import { QueueRetryDto } from './dto/queue-retry.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

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

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  async createUser(@Body() body: CreateAdminUserDto) {
    return this.adminService.createUser(body);
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: UpdateAdminUserDto) {
    return this.adminService.updateUser(id, body);
  }

  @Post('users/:id/reset-password')
  async resetPassword(@Param('id') id: string, @Body() body: ResetUserPasswordDto) {
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
}
