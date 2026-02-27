import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, List, Skeleton, Space, Typography, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { fetchAdminMetrics, fetchAdminErrorTrends } from '../../api/admin';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { SoftEmpty } from '../../components/SoftEmpty';

export const AdminDashboardPage = () => {
  const { t } = useI18n();
  const overviewQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: fetchAdminMetrics,
    staleTime: 2 * 60 * 1000,
  });

  const errorTrendsQuery = useQuery({
    queryKey: ['admin-error-trends'],
    queryFn: () => fetchAdminErrorTrends(7),
    staleTime: 2 * 60_000,
  });

  const healthQuery = useQuery({
    queryKey: ['admin-health'],
    queryFn: async () => {
      const res = await api.get('/health');
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const data = overviewQuery.data;

  return (
    <PageContainer
      title={t('nav.dashboard')}
      breadcrumb={{
        items: [
          { title: t('app.adminConsole'), path: '/admin/dashboard' },
          { title: t('nav.dashboard') },
        ],
      }}
    >
      {overviewQuery.isError ? (
        <Alert
          type="error"
          message={t('admin.dashboard.loadError') || 'Failed to load dashboard data'}
          description={overviewQuery.error instanceof Error ? overviewQuery.error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => overviewQuery.refetch()}>
              {t('common.retry')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {overviewQuery.isLoading && !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <ProCard
          bordered 
          title={t('admin.dashboard.systemOverview')} 
          headerBordered 
          className="chart-panel apple-soft-card"
        >
          <ProCard gutter={[24, 24]} wrap ghost>
            <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <AnimatedStatistic
                title={<span className="apple-muted-label">{t('admin.dashboard.totalUsers')}</span>}
                value={data?.users?.total || 0}
              />
            </ProCard>
            <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <AnimatedStatistic
                title={<span className="apple-muted-label">{t('admin.dashboard.students')}</span>}
                value={data?.users?.students || 0}
              />
            </ProCard>
            <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <AnimatedStatistic
                title={<span className="apple-muted-label">{t('admin.dashboard.totalClasses')}</span>}
                value={data?.classes?.total || 0}
              />
            </ProCard>
            <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <AnimatedStatistic
                title={<span className="apple-muted-label">{t('admin.dashboard.totalHomeworks')}</span>}
                value={data?.homeworks?.total || 0}
              />
            </ProCard>
          </ProCard>
        </ProCard>

        <ProCard gutter={[24, 24]} wrap ghost>
          <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
            <AnimatedStatistic
              title={<span className="apple-muted-label">{t('admin.dashboard.totalSubmissions')}</span>}
              value={data?.submissions?.total || 0}
            />
          </ProCard>
          <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
            <AnimatedStatistic
              title={<Space size={6} align="center"><span className="apple-muted-label">{t('admin.dashboard.todaySubmissions')}</span><span className="stat-chip">{t('common.today')}</span></Space>}
              value={data?.submissions?.today || 0}
            />
          </ProCard>
          <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
            <AnimatedStatistic
              title={<span className="apple-muted-label">{t('admin.dashboard.teachers')}</span>}
              value={data?.users?.teachers || 0}
            />
          </ProCard>
          <ProCard ghost colSpan={{ xs: 24, sm: 12, md: 6 }}>
            <AnimatedStatistic
              title={<span className="apple-muted-label">{t('admin.dashboard.admins')}</span>}
              value={data?.users?.admins || 0}
            />
          </ProCard>
        </ProCard>

        <ProCard gutter={[24, 24]} wrap ghost>
          <ProCard
            bordered
            colSpan={{ xs: 24, lg: 12 }}
            title={t('admin.dashboard.errorTrends')}
            headerBordered
            className="chart-panel apple-soft-card"
          >
            {errorTrendsQuery.data?.errorBreakdown?.length ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Tag color="green">{t('admin.dashboard.successRate')}: {errorTrendsQuery.data.successRate}%</Tag>
                  <Tag color="red">{t('status.failed')}: {errorTrendsQuery.data.failed}</Tag>
                  <Tag>{t('admin.dashboard.total')}: {errorTrendsQuery.data.total}</Tag>
                </Space>
                <List
                  size="small"
                  dataSource={errorTrendsQuery.data.errorBreakdown}
                  renderItem={(item: { errorCode: string; count: number }) => (
                    <List.Item>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color="error">{item.errorCode}</Tag>
                        <Typography.Text strong>{item.count}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Space>
            ) : (
              <SoftEmpty description={t('admin.dashboard.noErrors')} />
            )}
          </ProCard>
          
          <ProCard
            bordered 
            colSpan={{ xs: 24, lg: 12 }} 
            title={t('admin.dashboard.systemHealth')}
            headerBordered 
            className="chart-panel apple-soft-card"
          >
            <Space direction="vertical" style={{ width: '100%', padding: '12px 24px' }}>
              {[
                { label: t('admin.dashboard.apiStatus'), key: 'status', getValue: () => healthQuery.data?.status },
                { label: t('admin.dashboard.dbStatus'), key: 'database', getValue: () => healthQuery.data?.services?.database?.status },
                { label: t('admin.dashboard.redisStatus'), key: 'redis', getValue: () => healthQuery.data?.services?.redis?.status },
                { label: t('admin.dashboard.storageStatus'), key: 'storage', getValue: () => healthQuery.data?.services?.storage?.status },
              ].map(item => {
                const status = item.getValue();
                const color = status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : status ? 'error' : 'default';
                const label = status || (healthQuery.isLoading ? '...' : 'unknown');
                return (
                  <div key={item.key} className="apple-metric-row">
                    <Typography.Text className="apple-muted-label">{item.label}</Typography.Text>
                    <Tag color={color} className="apple-tag-pill">{label}</Tag>
                  </div>
                );
              })}
              {healthQuery.data?.uptime ? (
                <div className="apple-metric-row">
                  <Typography.Text className="apple-muted-label">{t('admin.dashboard.uptime')}</Typography.Text>
                  <Typography.Text type="secondary">{Math.floor(healthQuery.data.uptime / 60000)}m</Typography.Text>
                </div>
              ) : null}
            </Space>
          </ProCard>
        </ProCard>
      </Space>
      )}
    </PageContainer>
  );
};
