import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { useQuery } from '@tanstack/react-query';
import { Descriptions, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { fetchAdminConfig, fetchAdminUsage } from '../../api';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';

const chartTextStyle = {
  fontFamily: 'IBM Plex Mono, Noto Sans SC, monospace',
  color: '#475569',
};
const axisLabel = { ...chartTextStyle, fontSize: 11 };
const axisLine = { lineStyle: { color: 'rgba(15, 23, 42, 0.18)' } };
const splitLine = { lineStyle: { color: 'rgba(15, 23, 42, 0.08)' } };
const tooltipTextStyle = { color: '#e2e8f0', fontFamily: chartTextStyle.fontFamily };

export const AdminSystemBudgetPage = () => {
  const { t } = useI18n();
  const { data: config } = useQuery({ queryKey: ['admin-config'], queryFn: fetchAdminConfig });
  const { data: usage } = useQuery({ queryKey: ['admin-usage', 7], queryFn: () => fetchAdminUsage(7) });
  const budget = config?.budget;
  const budgetModeLabel =
    budget?.mode === 'hard' ? t('admin.systemBudget.mode.hard') : t('admin.systemBudget.mode.soft');

  const trendOption = useMemo<EChartsOption>(() => {
    const daily = usage?.daily || [];
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
        data: [t('admin.usage.total'), t('status.failed')],
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
          barWidth: 16,
          itemStyle: { color: '#64748b' },
        },
        {
          name: t('status.failed'),
          type: 'bar',
          data: daily.map((item) => item.failed),
          barWidth: 16,
          itemStyle: { color: '#ef4444' },
        },
      ],
    };
  }, [t, usage]);

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
      <ProCard bordered>
        <Descriptions column={1} bordered>
          <Descriptions.Item label={t('admin.systemBudget.budgetMode')}>
            {budget?.enabled ? <Tag color="blue">{budgetModeLabel}</Tag> : <Tag>{t('common.disabled')}</Tag>}
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
      <ProCard bordered title={t('admin.systemBudget.usageTrends')} style={{ marginTop: 16 }}>
        {usage?.daily?.length ? (
          <ChartPanel option={trendOption} height={280} />
        ) : (
          <SoftEmpty description={t('admin.systemBudget.empty')} />
        )}
      </ProCard>
    </PageContainer>
  );
};
