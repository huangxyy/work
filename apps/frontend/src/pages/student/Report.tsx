import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import {
  Alert,
  Button,
  Empty,
  InputNumber,
  List,
  Space,
  Statistic,
  Typography,
  message,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadStudentReportPdf, fetchStudentReportOverview } from '../../api';
import { useI18n } from '../../i18n';

type StudentReport = {
  studentId: string;
  studentName: string;
  rangeDays: number;
  summary: { avg: number; min: number; max: number; count: number };
  trend: Array<{ date: string; avg: number; count: number }>;
  errorTypes: Array<{ type: string; count: number; ratio: number }>;
  nextSteps: Array<{ text: string; count: number }>;
};

const ChartPanel = ({ option, height = 260 }: { option: EChartsOption; height?: number }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }
    const instance = echarts.init(containerRef.current);
    instanceRef.current = instance;
    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!instanceRef.current) {
      return;
    }
    instanceRef.current.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
};

export const StudentReportPage = () => {
  const { t } = useI18n();
  const [rangeDays, setRangeDays] = useState(7);

  const reportQuery = useQuery({
    queryKey: ['student-report', rangeDays],
    queryFn: () => fetchStudentReportOverview(rangeDays),
  });

  const report = reportQuery.data as StudentReport | undefined;
  const hasSummary = report?.summary?.count && report.summary.count > 0;

  const trendOption = useMemo<EChartsOption>(() => {
    const data = report?.trend || [];
    return {
      grid: { left: 24, right: 36, top: 30, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { data: [t('common.avgShort'), t('student.report.submissions')] },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.date),
        axisLabel: { rotate: 30 },
      },
      yAxis: [
        { type: 'value', name: t('common.avgShort') },
        { type: 'value', name: t('student.report.submissions'), minInterval: 1 },
      ],
      series: [
        {
          name: t('common.avgShort'),
          type: 'line',
          data: data.map((item) => item.avg),
          smooth: true,
          lineStyle: { width: 2, color: '#22c55e' },
          itemStyle: { color: '#22c55e' },
        },
        {
          name: t('student.report.submissions'),
          type: 'bar',
          yAxisIndex: 1,
          data: data.map((item) => item.count),
          itemStyle: { color: '#94a3b8' },
        },
      ],
    };
  }, [report?.trend, t]);

  const errorOption = useMemo<EChartsOption>(() => {
    const data = report?.errorTypes || [];
    return {
      grid: { left: 24, right: 24, top: 30, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.type),
        axisLabel: { interval: 0, rotate: 20 },
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: data.map((item) => item.count),
          itemStyle: { color: '#f97316' },
        },
      ],
    };
  }, [report?.errorTypes]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    try {
      const blob = await downloadStudentReportPdf(rangeDays);
      downloadBlob(blob, `student-report-${rangeDays}d.pdf`);
    } catch {
      message.error(t('student.report.exportFailed'));
    }
  };

  return (
    <PageContainer
      title={t('student.report.title')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/dashboard' },
          { title: t('nav.report') },
        ],
      }}
    >
      {reportQuery.isError ? (
        <Alert
          type="error"
          message={t('student.report.loadError')}
          description={
            reportQuery.error instanceof Error ? reportQuery.error.message : t('common.tryAgain')
          }
          action={
            <Button size="small" onClick={() => reportQuery.refetch()}>
              {t('common.retry')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <ProCard bordered style={{ marginBottom: 16 }}>
        <Space wrap>
          <Space>
            <Typography.Text>{t('student.report.rangeDays')}</Typography.Text>
            <InputNumber min={1} max={30} value={rangeDays} onChange={(value) => setRangeDays(value || 7)} />
          </Space>
          <Button onClick={handleExportPdf}>{t('student.report.exportPdf')}</Button>
        </Space>
      </ProCard>

      {reportQuery.isLoading && !report ? (
        <ProCard bordered loading />
      ) : !report ? (
        <Empty description={t('student.report.empty')}>
          <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
            {t('student.report.emptyHint')}
          </Typography.Paragraph>
        </Empty>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title={t('student.report.summary')}>
            {hasSummary ? (
              <ProCard gutter={16} wrap>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('student.report.avgScore')} value={report.summary.avg} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('student.report.highestScore')} value={report.summary.max} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('student.report.lowestScore')} value={report.summary.min} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('student.report.submissions')} value={report.summary.count} />
                </ProCard>
              </ProCard>
            ) : (
              <Empty description={t('student.report.noCompleted')} />
            )}
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.trend')}>
              {report.trend?.length ? (
                <ChartPanel option={trendOption} height={280} />
              ) : (
                <Empty description={t('student.report.noTrend')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.errorTypes')}>
              {report.errorTypes?.length ? (
                <ChartPanel option={errorOption} />
              ) : (
                <Empty description={t('student.report.noErrorStats')} />
              )}
            </ProCard>
          </ProCard>

          <ProCard bordered title={t('student.report.nextSteps')}>
            {report.nextSteps?.length ? (
              <List
                dataSource={report.nextSteps}
                renderItem={(item) => (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text>{item.text}</Typography.Text>
                      <Typography.Text type="secondary">{item.count}</Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description={t('student.report.noNextSteps')} />
            )}
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
