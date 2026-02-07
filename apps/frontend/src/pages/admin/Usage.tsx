import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, InputNumber, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchAdminUsage } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

const chartTextStyle = {
  fontFamily: 'IBM Plex Mono, Noto Sans SC, monospace',
  color: '#475569',
};
const axisLabel = { ...chartTextStyle, fontSize: 11 };
const axisLine = { lineStyle: { color: 'rgba(15, 23, 42, 0.18)' } };
const splitLine = { lineStyle: { color: 'rgba(15, 23, 42, 0.08)' } };
const tooltipTextStyle = { color: '#e2e8f0', fontFamily: chartTextStyle.fontFamily };

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
      textStyle: chartTextStyle,
      grid: { left: 24, right: 24, top: 36, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'rgba(148, 163, 184, 0.4)',
        textStyle: tooltipTextStyle,
      },
      legend: {
        data: [t('admin.usage.total'), t('status.done'), t('status.failed')],
        textStyle: chartTextStyle,
      },
      xAxis: {
        type: 'category',
        data: daily.map((item) => item.date),
        axisLabel: { ...axisLabel, rotate: 30, width: 80, overflow: 'truncate' },
        axisLine,
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel,
        axisLine,
        splitLine,
      },
      animationDuration: 600,
      animationEasing: 'cubicOut',
      series: [
        {
          name: t('admin.usage.total'),
          type: 'bar',
          data: daily.map((item) => item.total),
          barWidth: 14,
          itemStyle: { color: '#64748b' },
        },
        {
          name: t('status.done'),
          type: 'bar',
          data: daily.map((item) => item.done),
          barWidth: 14,
          itemStyle: { color: '#22c55e' },
        },
        {
          name: t('status.failed'),
          type: 'bar',
          data: daily.map((item) => item.failed),
          barWidth: 14,
          itemStyle: { color: '#ef4444' },
        },
      ],
    };
  }, [data, t]);

  const errorOption = useMemo<EChartsOption>(() => {
    const errors = data?.errors || [];
    return {
      textStyle: chartTextStyle,
      grid: { left: 24, right: 24, top: 36, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'rgba(148, 163, 184, 0.4)',
        textStyle: tooltipTextStyle,
      },
      xAxis: {
        type: 'category',
        data: errors.map((item) => item.code),
        axisLabel: { ...axisLabel, interval: 0, rotate: 20, width: 120, overflow: 'truncate' },
        axisLine,
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel,
        axisLine,
        splitLine,
      },
      animationDuration: 600,
      animationEasing: 'cubicOut',
      series: [
        {
          type: 'bar',
          data: errors.map((item) => item.count),
          barWidth: 18,
          itemStyle: { color: '#f97316' },
          emphasis: { itemStyle: { color: '#f97316' } },
        },
      ],
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
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <ProCard bordered style={{ marginBottom: 16 }}>
        <Space wrap>
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
          <ProCard bordered title={t('admin.usage.summary')}>
            <ProCard gutter={16} wrap>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
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
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
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
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
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
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <AnimatedStatistic
                  title={
                    <Space size={6} align="center">
                      <span>{t('status.processing')}</span>
                      <span className="stat-chip">{t('common.realtime')}</span>
                    </Space>
                  }
                  value={data.summary.processing}
                />
              </ProCard>
            </ProCard>
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('admin.usage.dailyTrend')}>
              {data.daily.length ? (
                <ChartPanel option={dailyOption} height={280} />
              ) : (
                <SoftEmpty description={t('admin.usage.empty')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('admin.usage.errorBreakdown')}>
              {data.errors.length ? (
                <ChartPanel option={errorOption} />
              ) : (
                <SoftEmpty description={t('admin.usage.noErrors')} />
              )}
            </ProCard>
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
