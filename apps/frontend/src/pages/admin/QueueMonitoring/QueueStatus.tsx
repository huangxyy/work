import { Card, Progress } from 'antd';
import { useI18n } from '../../../i18n';

interface QueueStatusProps {
  metrics?: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
  };
}

export default function QueueStatus({ metrics }: QueueStatusProps) {
  const { t } = useI18n();

  const successRate =
    metrics?.completed && metrics?.failed
      ? Math.round((metrics.completed / (metrics.completed + metrics.failed)) * 100)
      : 0;

  return (
    <Card title={t('admin.queue.queueStatus')}>
      <p>{t('admin.queue.activeJobs')}: {metrics?.active || 0}</p>
      <p>{t('admin.queue.waitingJobs')}: {metrics?.waiting || 0}</p>
      <p>{t('admin.queue.successRate')}: {successRate}%</p>
      <Progress
        percent={successRate}
        status="active"
        strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
      />
    </Card>
  );
}
