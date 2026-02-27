import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Progress, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';

export const AdminSystemInfoPage = () => {
  const { t } = useI18n();

  const infoQuery = useQuery({
    queryKey: ['admin-system-info'],
    queryFn: async () => { const res = await api.get('/admin/system-info'); return res.data; },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const data = infoQuery.data;

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  return (
    <PageContainer title={t('admin.systemInfo.title')}>
      {infoQuery.isError ? (
        <Alert type="error" message={t('common.loadError')} action={<Button size="small" onClick={() => infoQuery.refetch()}>{t('common.retry')}</Button>} className="apple-inline-alert" />
      ) : null}
      {infoQuery.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : data ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title={t('admin.systemInfo.runtime')} className="apple-soft-card">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Node.js">{data.node}</Descriptions.Item>
              <Descriptions.Item label={t('admin.systemInfo.environment')}>
                <Tag color={data.env === 'production' ? 'green' : 'orange'} className="apple-tag-pill">{data.env}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.systemInfo.platform')}>{data.platform} ({data.arch})</Descriptions.Item>
              <Descriptions.Item label={t('admin.systemInfo.uptime')}>{formatUptime(data.uptime)}</Descriptions.Item>
            </Descriptions>
          </ProCard>

          <ProCard bordered title={t('admin.systemInfo.memory')} className="apple-soft-card">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Typography.Text>{t('admin.systemInfo.heapUsed')}: {data.memoryUsage.heapUsed}MB / {data.memoryUsage.heapTotal}MB</Typography.Text>
                <Progress percent={Math.round((data.memoryUsage.heapUsed / data.memoryUsage.heapTotal) * 100)} status={data.memoryUsage.heapUsed / data.memoryUsage.heapTotal > 0.85 ? 'exception' : 'active'} />
              </div>
              <Typography.Text type="secondary">RSS: {data.memoryUsage.rss}MB</Typography.Text>
            </Space>
          </ProCard>

          <ProCard bordered title={t('admin.systemInfo.database')} className="apple-soft-card">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t('admin.systemInfo.dbSize')}>{data.dbSizeMb} MB</Descriptions.Item>
              <Descriptions.Item label={t('admin.dashboard.totalUsers')}>{data.counts.users}</Descriptions.Item>
              <Descriptions.Item label={t('admin.dashboard.totalClasses')}>{data.counts.classes}</Descriptions.Item>
              <Descriptions.Item label={t('admin.dashboard.totalHomeworks')}>{data.counts.homeworks}</Descriptions.Item>
              <Descriptions.Item label={t('admin.systemInfo.totalSubmissions')}>{data.counts.submissions}</Descriptions.Item>
            </Descriptions>
          </ProCard>
        </Space>
      ) : null}
    </PageContainer>
  );
};
