import { Card, Badge, List } from 'antd';
import { useI18n } from '../../../i18n';

interface Worker {
  id: string;
  status: string;
  lastSeen: string;
}

interface WorkerHealthProps {
  health?: {
    healthy: boolean;
    workers: Worker[];
  };
}

export default function WorkerHealth({ health }: WorkerHealthProps) {
  const { t } = useI18n();
  const isHealthy = health?.healthy ?? false;

  return (
    <Card
      title={t('admin.queue.workerHealth')}
      extra={
        <Badge
          status={isHealthy ? 'success' : 'error'}
          text={isHealthy ? t('admin.queue.healthy') : t('admin.queue.unhealthy')}
        />
      }
    >
      <List
        dataSource={health?.workers || []}
        renderItem={(worker: Worker) => (
          <List.Item>
            <List.Item.Meta
              title={`Worker ${worker.id?.slice(0, 8)}`}
              description={`${t('common.status')}: ${worker.status} | ${t('admin.queue.lastSeen')}: ${new Date(worker.lastSeen).toLocaleString()}`}
            />
          </List.Item>
        )}
        locale={{ emptyText: t('admin.queue.noWorkers') }}
      />
    </Card>
  );
}
