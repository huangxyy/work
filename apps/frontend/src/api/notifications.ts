import { api } from './client';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string;
  linkTo?: string;
  isRead: boolean;
  createdAt: string;
};

export async function fetchNotifications(unreadOnly = false): Promise<NotificationItem[]> {
  const res = await api.get('/notifications', { params: unreadOnly ? { unreadOnly: 'true' } : {} });
  return res.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get('/notifications/unread-count');
  return res.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
