import { Card } from 'antd';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import { ChartPanel } from '../../../components/ChartPanel';
import { useI18n } from '../../../i18n';

interface QueueTrendsProps {
  trends?: {
    dates: string[];
    waiting: number[];
    completed: number[];
    failed: number[];
  };
}

export default function QueueTrends({ trends }: QueueTrendsProps) {
  const { t } = useI18n();

  const option = useMemo<EChartsOption>(() => ({
    title: { text: t('admin.queue.trendsTitle'), left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { data: [t('status.queued'), t('status.done'), t('status.failed')], bottom: 0 },
    grid: { top: 60, right: 40, bottom: 60, left: 50 },
    xAxis: {
      type: 'category',
      data: trends?.dates || [],
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: t('status.queued'),
        type: 'line',
        data: trends?.waiting || [],
        itemStyle: { color: '#faad14' },
        lineStyle: { color: '#faad14' },
      },
      {
        name: t('status.done'),
        type: 'line',
        data: trends?.completed || [],
        itemStyle: { color: '#52c41a' },
        lineStyle: { color: '#52c41a' },
      },
      {
        name: t('status.failed'),
        type: 'line',
        data: trends?.failed || [],
        itemStyle: { color: '#ff4d4f' },
        lineStyle: { color: '#ff4d4f' },
      },
    ],
  }), [t, trends]);

  return (
    <Card title={t('admin.queue.trendsTitle')}>
      <ChartPanel option={option} height={300} />
    </Card>
  );
}
