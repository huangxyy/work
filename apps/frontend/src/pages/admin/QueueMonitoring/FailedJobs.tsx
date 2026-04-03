import { Card, Table, Button } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { listFailedQueueJobs } from '../../../api/admin';
import { useI18n } from '../../../i18n';

export default function FailedJobs() {
  const { t } = useI18n();

  const { data: failedJobs, refetch } = useQuery({
    queryKey: ['failed-jobs'],
    queryFn: () => listFailedQueueJobs({ queue: 'grading', limit: 20 }),
    refetchInterval: 10000,
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
      render: (id: string) => <code>{id?.slice(0, 12)}...</code>,
    },
    {
      title: t('admin.queue.jobType'),
      dataIndex: 'name',
      width: 120,
    },
    {
      title: t('admin.queue.failReason'),
      dataIndex: 'failedReason',
      ellipsis: true,
      render: (reason: string) => reason || '--',
    },
    {
      title: t('admin.queue.attempts'),
      dataIndex: 'attemptsMade',
      width: 100,
    },
    {
      title: t('admin.queue.failedAt'),
      dataIndex: 'failedAt',
      width: 170,
      render: (d: string) => (d ? new Date(d).toLocaleString() : '--'),
    },
  ];

  return (
    <Card
      title={t('admin.queue.failedJobs')}
      extra={<Button onClick={() => refetch()}>{t('common.refresh')}</Button>}
    >
      <Table
        dataSource={failedJobs?.jobs || []}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        columns={columns}
        size="small"
      />
    </Card>
  );
}
