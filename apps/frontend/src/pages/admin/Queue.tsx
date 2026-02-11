import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cleanAdminQueue,
  fetchAdminQueueMetrics,
  pauseAdminQueue,
  resumeAdminQueue,
  retryAdminFailedJobs,
} from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { formatDate } from '../../utils/dateFormat';

const statusColorMap: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  active: 'blue',
  waiting: 'gold',
  delayed: 'orange',
  paused: 'default',
};

export const AdminQueuePage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [limit, setLimit] = useState<number>(30);
  const [cleanScope, setCleanScope] = useState<string>('completed');

  const metricsQuery = useQuery({
    queryKey: ['admin-queue-metrics', status, limit],
    queryFn: () => fetchAdminQueueMetrics({ status: status === 'all' ? undefined : status, limit }),
  });

  const metrics = metricsQuery.data;

  const retryMutation = useMutation({
    mutationFn: () => retryAdminFailedJobs(limit),
    onSuccess: (data) => {
      message.success(`${t('admin.queue.retrySuccess')} ${data.retried}`);
      queryClient.invalidateQueries({ queryKey: ['admin-queue-metrics'] });
    },
  });

  const cleanMutation = useMutation({
    mutationFn: () => cleanAdminQueue({ status: cleanScope, limit }),
    onSuccess: (data) => {
      message.success(`${t('admin.queue.cleanSuccess')} ${data.total}`);
      queryClient.invalidateQueries({ queryKey: ['admin-queue-metrics'] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseAdminQueue(),
    onSuccess: () => {
      message.success(t('admin.queue.paused'));
      queryClient.invalidateQueries({ queryKey: ['admin-queue-metrics'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeAdminQueue(),
    onSuccess: () => {
      message.success(t('admin.queue.resumed'));
      queryClient.invalidateQueries({ queryKey: ['admin-queue-metrics'] });
    },
  });

  const statusOptions = useMemo(
    () => [
      { label: t('admin.queue.statusAll'), value: 'all' },
      { label: t('status.processing'), value: 'active' },
      { label: t('status.queued'), value: 'waiting' },
      { label: t('status.delayed'), value: 'delayed' },
      { label: t('status.failed'), value: 'failed' },
      { label: t('status.done'), value: 'completed' },
      { label: t('status.paused'), value: 'paused' },
    ],
    [t],
  );

  const cleanOptions = useMemo(
    () => [
      { label: t('admin.queue.cleanCompleted'), value: 'completed' },
      { label: t('admin.queue.cleanFailed'), value: 'failed' },
      { label: t('admin.queue.cleanDelayed'), value: 'delayed' },
      { label: t('admin.queue.cleanWaiting'), value: 'waiting' },
      { label: t('admin.queue.cleanAll'), value: 'all' },
    ],
    [t],
  );

  const formatStatus = useCallback(
    (value: string) => {
      switch (value) {
        case 'completed':
          return t('status.done');
        case 'failed':
          return t('status.failed');
        case 'active':
          return t('status.processing');
        case 'waiting':
          return t('status.queued');
        case 'delayed':
          return t('status.delayed');
        case 'paused':
          return t('status.paused');
        default:
          return value || '--';
      }
    },
    [t],
  );

  const columns = useMemo(
    () => [
      {
        title: t('admin.queue.jobId'),
        dataIndex: 'id',
        width: 120,
        render: (value: string | number) => <Typography.Text>{value}</Typography.Text>,
      },
      {
        title: t('admin.queue.jobType'),
        dataIndex: 'name',
        width: 120,
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 120,
        render: (value: string) => (
          <Tag color={statusColorMap[value] || 'default'}>{formatStatus(value)}</Tag>
        ),
      },
      {
        title: t('admin.queue.submissionId'),
        dataIndex: 'data',
        render: (data: Record<string, unknown> | undefined) => {
          if (!data) {
            return '--';
          }
          const submissionId = data.submissionId as string | undefined;
          const mode = data.mode as string | undefined;
          const needRewrite = data.needRewrite as boolean | undefined;
          return (
            <Space direction="vertical" size={0}>
              <Typography.Text>{submissionId || '--'}</Typography.Text>
              <Typography.Text type="secondary">
                {mode || '--'}{needRewrite !== undefined ? ` / ${needRewrite ? t('common.enabled') : t('common.disabled')}` : ''}
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        title: t('admin.queue.attempts'),
        dataIndex: 'attemptsMade',
        width: 90,
      },
      {
        title: t('admin.queue.createdAt'),
        dataIndex: 'timestamp',
        width: 170,
        render: (value: number) => (value ? formatDate(new Date(value)) : '--'),
      },
      {
        title: t('admin.queue.lastUpdatedAt'),
        dataIndex: 'finishedOn',
        width: 170,
        render: (_: unknown, row: { finishedOn?: number | null; processedOn?: number | null }) => {
          const time = row.finishedOn || row.processedOn;
          return time ? formatDate(new Date(time)) : '--';
        },
      },
      {
        title: t('admin.queue.error'),
        dataIndex: 'failedReason',
        ellipsis: true,
        render: (value: string | null) => (value ? <Typography.Text type="danger">{value}</Typography.Text> : '--'),
      },
    ],
    [formatStatus, t],
  );

  // Auto-refresh queue metrics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['admin-queue-metrics'] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <PageContainer
      title={t('admin.queue.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.system') },
          { title: t('admin.queue.title') },
        ],
      }}
    >
      {metricsQuery.isError ? (
        <Alert
          type="error"
          message={t('admin.queue.loadFailed')}
          description={
            metricsQuery.error instanceof Error ? metricsQuery.error.message : t('common.tryAgain')
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <ProCard bordered style={{ marginBottom: 16 }}>
        <Space wrap>
          <Typography.Text>{t('admin.queue.statusFilter')}</Typography.Text>
          <Select style={{ minWidth: 180 }} options={statusOptions} value={status} onChange={setStatus} />
          <Typography.Text>{t('admin.queue.limit')}</Typography.Text>
          <InputNumber min={5} max={100} value={limit} onChange={(value) => setLimit(value || 30)} />
          <Button
            type={metrics?.isPaused ? 'default' : 'primary'}
            loading={pauseMutation.isPending || resumeMutation.isPending}
            onClick={() => {
              if (metrics?.isPaused) {
                resumeMutation.mutate();
              } else {
                pauseMutation.mutate();
              }
            }}
          >
            {metrics?.isPaused ? t('admin.queue.resume') : t('admin.queue.pause')}
          </Button>
          <Button
            loading={retryMutation.isPending}
            onClick={() => retryMutation.mutate()}
          >
            {t('admin.queue.retryFailed')}
          </Button>
          <Select
            style={{ minWidth: 160 }}
            options={cleanOptions}
            value={cleanScope}
            onChange={setCleanScope}
          />
          <Popconfirm
            title={t('admin.queue.confirmClean')}
            description={t('admin.queue.confirmCleanDesc')}
            onConfirm={() => cleanMutation.mutate()}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button danger loading={cleanMutation.isPending}>
              {t('admin.queue.clean')}
            </Button>
          </Popconfirm>
          <Typography.Text type="secondary">
            {metrics?.updatedAt ? `${t('admin.queue.updatedAt')} ${formatDate(metrics.updatedAt)}` : ''}
          </Typography.Text>
        </Space>
      </ProCard>

      {!metrics ? (
        <SoftEmpty description={t('admin.queue.empty')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title={t('admin.queue.summary')}>
            <ProCard gutter={16} wrap>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <AnimatedStatistic title={t('status.queued')} value={metrics.counts.waiting} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <AnimatedStatistic title={t('status.processing')} value={metrics.counts.active} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <AnimatedStatistic title={t('status.done')} value={metrics.counts.completed} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <AnimatedStatistic title={t('status.failed')} value={metrics.counts.failed} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <AnimatedStatistic title={t('status.delayed')} value={metrics.counts.delayed} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <AnimatedStatistic title={t('status.paused')} value={metrics.counts.paused} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <Space direction="vertical" size={8}>
                  <Typography.Text type="secondary">{t('admin.queue.runningState')}</Typography.Text>
                  <Tag color={metrics.isPaused ? 'red' : 'green'}>
                    {metrics.isPaused ? t('admin.queue.statePaused') : t('admin.queue.stateRunning')}
                  </Tag>
                </Space>
              </ProCard>
            </ProCard>
          </ProCard>

          <ProCard bordered title={t('admin.queue.recentJobs')}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={metrics.jobs}
              loading={metricsQuery.isLoading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
