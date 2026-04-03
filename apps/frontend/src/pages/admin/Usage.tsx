import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, InputNumber, Progress, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchAdminUsage, fetchLlmCostSummary } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';
import { CHART_PALETTE, getDefaultGrid, getDefaultTooltip, createPieSeries } from '../../theme/charts';

export const AdminUsagePage = () => {
  const { t } = useI18n();
  const [days, setDays] = useState(7);

  const usageQuery = useQuery({
    queryKey: ['admin-usage', days],
    queryFn: () => fetchAdminUsage(days),
  });

  const data = usageQuery.data;

  const dailyOption = useMemo<EChartsOption>(() => {
    const daily = data?.daily || [];
    return {
      grid: getDefaultGrid(),
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'axis',
      },
      legend: {
        data: [t('admin.usage.total'), t('status.done'), t('status.failed')],
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
          barWidth: 16,
          itemStyle: { 
            color: CHART_PALETTE[5],
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: t('status.done'),
          type: 'bar',
          data: daily.map((item) => item.done),
          barWidth: 16,
          itemStyle: { 
            color: CHART_PALETTE[1],
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: t('status.failed'),
          type: 'bar',
          data: daily.map((item) => item.failed),
          barWidth: 16,
          itemStyle: { 
            color: CHART_PALETTE[2],
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [data, t]);

  const errorOption = useMemo<EChartsOption>(() => {
    const errors = data?.errors || [];
    const pieData = errors.map((item) => ({
      name: item.code,
      value: item.count,
    }));
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#1f2937' },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 8px;',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
      },
      series: [createPieSeries(pieData)],
    };
  }, [data]);

  return (
    <PageContainer
      title={t('admin.usage.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('admin.usage.title') },
        ],
      }}
    >
      {usageQuery.isError ? (
        <Alert
          type="error"
          message={t('admin.usage.loadFailed')}
          description={
            usageQuery.error instanceof Error ? usageQuery.error.message : t('common.tryAgain')
          }
          className="apple-inline-alert"
        />
      ) : null}

      <ProCard bordered className="apple-soft-card" style={{ marginBottom: 16 }}>
        <Space wrap className="apple-toolbar">
          <Typography.Text>{t('admin.usage.rangeDays')}</Typography.Text>
          <InputNumber min={1} max={30} value={days} onChange={(value) => setDays(value || 7)} />
          <Typography.Text type="secondary">
            {data?.updatedAt ? `${t('admin.usage.updatedAt')} ${formatDate(data.updatedAt)}` : ''}
          </Typography.Text>
        </Space>
      </ProCard>

      {!data ? (
        <SoftEmpty description={t('admin.usage.empty')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title={t('admin.usage.summary')} className="apple-soft-card">
            <ProCard gutter={16} wrap>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
                <AnimatedStatistic
                  title={
                    <Space size={6} align="center">
                      <span>{t('admin.usage.total')}</span>
                      <span className="stat-chip">{days === 7 ? t('common.last7Days') : t('common.recent')}</span>
                    </Space>
                  }
                  value={data.summary.total}
                />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
                <AnimatedStatistic
                  title={
                    <Space size={6} align="center">
                      <span>{t('status.done')}</span>
                      <span className="stat-chip">{days === 7 ? t('common.last7Days') : t('common.recent')}</span>
                    </Space>
                  }
                  value={data.summary.done}
                />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
                <AnimatedStatistic
                  title={
                    <Space size={6} align="center">
                      <span>{t('status.failed')}</span>
                      <span className="stat-chip">{days === 7 ? t('common.last7Days') : t('common.recent')}</span>
                    </Space>
                  }
                  value={data.summary.failed}
                />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
                <div style={{ textAlign: 'center' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    <Space size={6} align="center">
                      <span>{t('admin.usage.successRate')}</span>
                      <span className="stat-chip">{days === 7 ? t('common.last7Days') : t('common.recent')}</span>
                    </Space>
                  </Typography.Text>
                  <Progress 
                    type="dashboard" 
                    percent={data.summary.total > 0 ? Math.round((data.summary.done / data.summary.total) * 100) : 0} 
                    size={80}
                    strokeColor={data.summary.total > 0 && (data.summary.done / data.summary.total) >= 0.9 ? '#10b981' : data.summary.total > 0 && (data.summary.done / data.summary.total) >= 0.7 ? '#f59e0b' : '#ef4444'}
                    format={(percent) => (
                      <span style={{ fontSize: 18, fontWeight: 600 }}>{percent}%</span>
                    )}
                  />
                </div>
              </ProCard>
            </ProCard>
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('admin.usage.dailyTrend')} className="apple-soft-card">
              {data.daily.length ? (
                <ChartPanel option={dailyOption} height={280} />
              ) : (
                <SoftEmpty description={t('admin.usage.empty')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('admin.usage.errorBreakdown')} className="apple-soft-card">
              {data.errors.length ? (
                <ChartPanel option={errorOption} />
              ) : (
                <SoftEmpty description={t('admin.usage.noErrors')} />
              )}
            </ProCard>
          </ProCard>

          <CostSummarySection days={days} t={t} />
        </Space>
      )}
    </PageContainer>
  );
};

function CostSummarySection({ days, t }: { days: number; t: (k: string) => string }) {
  const costQuery = useQuery({
    queryKey: ['admin-llm-cost', days],
    queryFn: () => fetchLlmCostSummary(days),
    staleTime: 60_000,
  });

  const costData = costQuery.data;

  const costChartOption = useMemo<EChartsOption>(() => {
    const daily = costData?.daily || [];
    return {
      grid: getDefaultGrid(),
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'axis',
      },
      legend: { 
        data: [t('admin.usage.totalCost'), t('admin.usage.totalCalls')], 
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: daily.map((d) => d.date),
        axisLabel: { rotate: 30, width: 80, overflow: 'truncate' },
      },
      yAxis: [
        { type: 'value', name: t('admin.usage.costUnit') },
        { type: 'value', name: t('admin.usage.totalCalls'), minInterval: 1 },
      ],
      series: [
        {
          name: t('admin.usage.totalCost'),
          type: 'bar',
          data: daily.map((d) => d.cost),
          barWidth: 16,
          itemStyle: { 
            color: CHART_PALETTE[0],
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: t('admin.usage.totalCalls'),
          type: 'line',
          yAxisIndex: 1,
          data: daily.map((d) => d.calls),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: CHART_PALETTE[1] },
          itemStyle: { color: CHART_PALETTE[1] },
        },
      ],
    };
  }, [costData, t]);

  if (!costData) return null;

  return (
    <>
      <ProCard bordered title={t('admin.usage.costTitle')} className="apple-soft-card">
        <ProCard gutter={16} wrap>
          <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
            <AnimatedStatistic title={<span className="apple-muted-label">{t('admin.usage.totalCalls')}</span>} value={costData.totalCalls} />
          </ProCard>
          <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
            <AnimatedStatistic title={<span className="apple-muted-label">{t('admin.usage.totalTokens')}</span>} value={costData.totalTokens} />
          </ProCard>
          <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
            <AnimatedStatistic title={<span className="apple-muted-label">{t('admin.usage.totalCost')}</span>} value={costData.totalCost} suffix={` ${t('admin.usage.costUnit')}`} decimals={4} />
          </ProCard>
          <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
            <AnimatedStatistic title={<span className="apple-muted-label">{t('admin.usage.avgCostPerCall')}</span>} value={costData.avgCostPerCall} suffix={` ${t('admin.usage.costUnit')}`} decimals={6} />
          </ProCard>
        </ProCard>
      </ProCard>

      <ProCard gutter={16} wrap>
        <ProCard bordered colSpan={{ xs: 24, sm: 12 }} className="apple-soft-card">
          <AnimatedStatistic title={<span className="apple-muted-label">{t('admin.usage.promptTokens')}</span>} value={costData.totalPromptTokens} />
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, sm: 12 }} className="apple-soft-card">
          <AnimatedStatistic title={<span className="apple-muted-label">{t('admin.usage.completionTokens')}</span>} value={costData.totalCompletionTokens} />
        </ProCard>
      </ProCard>

      <ProCard bordered title={t('admin.usage.dailyCost')} className="apple-soft-card">
        {costData.daily.length ? (
          <ChartPanel option={costChartOption} height={280} />
        ) : (
          <SoftEmpty description={t('admin.usage.empty')} />
        )}
      </ProCard>
    </>
  );
}
