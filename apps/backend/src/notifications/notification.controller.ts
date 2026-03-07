import { Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(
    @Req() req: { user: AuthUser },
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationService.listForUser(
      req.user.id,
      30,
      query.unreadOnly ?? false,
    );
  }

  @Get('unread-count')
  async unreadCount(@Req() req: { user: AuthUser }) {
    const count = await this.notificationService.countUnread(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @Req() req: { user: AuthUser },
  ) {
    await this.notificationService.markAsRead(id, req.user.id);
    return { ok: true };
  }

  @Post('read-all')
  async markAllRead(@Req() req: { user: AuthUser }) {
    await this.notificationService.markAllRead(req.user.id);
    return { ok: true };
  }
}
