import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
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
}
