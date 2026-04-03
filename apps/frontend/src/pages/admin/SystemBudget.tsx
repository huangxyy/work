import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Progress, Skeleton, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { fetchAdminConfig, fetchAdminUsage } from '../../api';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { CHART_PALETTE, getDefaultGrid, getDefaultTooltip } from '../../theme/charts';

export const AdminSystemBudgetPage = () => {
  const { t } = useI18n();
  const configQuery = useQuery({ queryKey: ['admin-config'], queryFn: fetchAdminConfig, staleTime: 5 * 60 * 1000 });
  const usageQuery = useQuery({ queryKey: ['admin-usage', 7], queryFn: () => fetchAdminUsage(7), staleTime: 2 * 60 * 1000 });
  const config = configQuery.data;
  const usage = usageQuery.data;
  const budget = config?.budget;
  const budgetModeLabel =
    budget?.mode === 'hard' ? t('admin.systemBudget.mode.hard') : t('admin.systemBudget.mode.soft');

  const trendOption = useMemo<EChartsOption>(() => {
    const daily = usage?.daily || [];
    return {
      grid: getDefaultGrid(),
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'axis',
      },
      legend: {
        data: [t('admin.usage.total'), t('status.failed')],
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: daily.map((item) => item.date),
        axisLabel: { rotate: 30, width: 80, overflow: 'truncate' },
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: t('admin.usage.total'),
          type: 'bar',
          data: daily.map((item) => item.total),
          barWidth: 20,
          itemStyle: { 
            color: CHART_PALETTE[0],
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: t('status.failed'),
          type: 'bar',
          data: daily.map((item) => item.failed),
          barWidth: 20,
          itemStyle: { 
            color: CHART_PALETTE[2],
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [t, usage]);

  const todayUsage = usage?.summary?.total || 0;
  const dailyLimit = budget?.dailyCallLimit || 0;
  const usagePercent = dailyLimit > 0 ? Math.min((todayUsage / dailyLimit) * 100, 100) : 0;
  const usageColor = usagePercent >= 90 ? '#ef4444' : usagePercent >= 70 ? '#f59e0b' : '#10b981';

  return (
    <PageContainer
      title={t('admin.systemBudget.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.system') },
          { title: t('nav.budget') },
        ],
      }}
    >
      {(configQuery.isError || usageQuery.isError) ? (
        <Alert
          type="error"
          message={t('admin.systemBudget.loadError') || 'Failed to load budget data'}
          action={
            <Button size="small" onClick={() => { configQuery.refetch(); usageQuery.refetch(); }}>
              {t('common.retry')}
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : null}
      {(configQuery.isLoading || usageQuery.isLoading) && !config && !usage ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
      <>
      {budget?.enabled && dailyLimit > 0 && (
        <ProCard bordered className="apple-soft-card" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Typography.Text strong>{t('admin.systemBudget.todayUsage')}</Typography.Text>
              <Space>
                <Typography.Text style={{ fontSize: 18, fontWeight: 600, color: usageColor }}>
                  {todayUsage}
                </Typography.Text>
                <Typography.Text type="secondary">/ {dailyLimit}</Typography.Text>
              </Space>
            </Space>
            <Progress 
              percent={usagePercent} 
              strokeColor={usageColor}
              trailColor="#f3f4f6"
              strokeWidth={12}
              showInfo={false}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {usagePercent >= 90 
                ? t('admin.systemBudget.quotaWarning')
                : usagePercent >= 70 
                  ? t('admin.systemBudget.quotaCaution')
                  : t('admin.systemBudget.quotaNormal')
              }
            </Typography.Text>
          </Space>
        </ProCard>
      )}
      <ProCard bordered className="apple-soft-card">
        <Descriptions column={1} bordered>
          <Descriptions.Item label={t('admin.systemBudget.budgetMode')}>
            {budget?.enabled ? <Tag color="orange" className="apple-tag-pill">{budgetModeLabel}</Tag> : <Tag className="apple-tag-pill">{t('common.disabled')}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.systemBudget.dailyCallLimit')}>
            <Typography.Text type="secondary">
              {budget?.enabled && budget?.dailyCallLimit ? budget.dailyCallLimit : '--'}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.systemBudget.tokenLimit')}>
            <Typography.Text type="secondary">--</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>
      <ProCard bordered title={t('admin.systemBudget.usageTrends')} className="apple-soft-card" style={{ marginTop: 16 }}>
        {usage?.daily?.length ? (
          <ChartPanel option={trendOption} height={280} />
        ) : (
          <SoftEmpty description={t('admin.systemBudget.empty')} />
        )}
      </ProCard>
      </>
      )}
    </PageContainer>
  );
};
