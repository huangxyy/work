import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Dropdown, Empty, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { useI18n } from '../i18n';

export const NotificationBell = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-recent'],
    queryFn: () => fetchNotifications(),
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
    },
  });

  const handleClick = (item: { id: string; linkTo?: string; isRead: boolean }) => {
    if (!item.isRead) markReadMutation.mutate(item.id);
    if (item.linkTo) navigate(item.linkTo);
  };

  const menu = {
    items: [
      {
        key: 'header',
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <Typography.Text strong>{t('notifications.title')}</Typography.Text>
            {unreadCount > 0 && (
              <Button type="link" size="small" onClick={() => markAllMutation.mutate()}>
                {t('notifications.markAllRead')}
              </Button>
            )}
          </div>
        ),
        disabled: true,
      },
      ...(!notifications.length
        ? [{ key: 'empty', label: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('notifications.empty')} />, disabled: true }]
        : notifications.slice(0, 8).map((n) => ({
            key: n.id,
            label: (
              <div
                style={{ maxWidth: 300, padding: '4px 0', opacity: n.isRead ? 0.6 : 1 }}
                onClick={() => handleClick(n)}
              >
                <Typography.Text strong={!n.isRead} style={{ display: 'block' }}>{n.title}</Typography.Text>
                {n.body && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{n.body}</Typography.Text>}
              </div>
            ),
          }))),
    ],
  };

  return (
    <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button type="text" className="apple-icon-btn" icon={<BellOutlined style={{ fontSize: 18 }} />} />
      </Badge>
    </Dropdown>
  );
};
