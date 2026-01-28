import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import {
  Alert,
  Button,
  Empty,
  InputNumber,
  List,
  Select,
  Space,
  Statistic,
  Typography,
  message,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadTeacherClassReportCsv,
  downloadTeacherClassReportPdf,
  fetchClasses,
  fetchTeacherClassReportOverview,
} from '../../api';
import { useI18n } from '../../i18n';

type ReportSummary = {
  avg: number;
  min: number;
  max: number;
  count: number;
};

type DistributionBucket = {
  bucket: string;
  count: number;
};

type TrendPoint = {
  date: string;
  avg: number;
  count: number;
};

type ErrorTypeStat = {
  type: string;
  count: number;
  ratio: number;
};

type TopRankItem = {
  studentId: string;
  name: string;
  avgScore: number;
  count: number;
};

type ClassReport = {
  classId: string;
  className: string;
  rangeDays: number;
  totalStudents: number;
  submittedStudents: number;
  pendingStudents: number;
  submissionRate: number;
  summary: ReportSummary;
  distribution: DistributionBucket[];
  topRank: TopRankItem[];
  trend: TrendPoint[];
  errorTypes: ErrorTypeStat[];
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

export const TeacherReportPage = () => {
  const { t } = useI18n();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [rangeDays, setRangeDays] = useState<number>(7);

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  useEffect(() => {
    if (!selectedClassId && classesQuery.data && classesQuery.data.length) {
      setSelectedClassId(classesQuery.data[0].id);
    }
  }, [classesQuery.data, selectedClassId]);

  const reportQuery = useQuery({
    queryKey: ['teacher-report', selectedClassId, rangeDays],
    queryFn: () => fetchTeacherClassReportOverview(selectedClassId, rangeDays),
    enabled: !!selectedClassId,
  });

  const classOptions = useMemo(
    () =>
      (classesQuery.data || []).map((klass) => ({
        label: klass.name,
        value: klass.id,
      })),
    [classesQuery.data],
  );

  const report = reportQuery.data as ClassReport | undefined;
  const hasSummary = report?.summary?.count && report.summary.count > 0;
  const submissionRate = report?.submissionRate ? Number((report.submissionRate * 100).toFixed(1)) : 0;
  const distributionOption = useMemo<EChartsOption>(() => {
    const data = report?.distribution || [];
    return {
      grid: { left: 24, right: 24, top: 30, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.bucket),
        axisTick: { alignWithLabel: true },
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: data.map((item) => item.count),
          itemStyle: { color: '#3b82f6' },
        },
      ],
    };
  }, [report?.distribution]);

  const trendOption = useMemo<EChartsOption>(() => {
    const data = report?.trend || [];
    return {
      grid: { left: 24, right: 36, top: 30, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { data: [t('common.avgShort'), t('teacher.reports.submissions')] },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.date),
        axisLabel: { rotate: 30 },
      },
      yAxis: [
        { type: 'value', name: t('common.avgShort') },
        { type: 'value', name: t('teacher.reports.submissions'), minInterval: 1 },
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
          name: t('teacher.reports.submissions'),
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
    if (!selectedClassId) {
      message.warning(t('teacher.reports.selectClassHint'));
      return;
    }
    try {
      const blob = await downloadTeacherClassReportPdf(selectedClassId, rangeDays);
      downloadBlob(blob, `class-${selectedClassId}-report.pdf`);
    } catch {
      message.error(t('teacher.reports.exportFailed'));
    }
  };

  const handleExportCsv = async () => {
    if (!selectedClassId) {
      message.warning(t('teacher.reports.selectClassHint'));
      return;
    }
    try {
      const blob = await downloadTeacherClassReportCsv(selectedClassId, rangeDays);
      downloadBlob(blob, `class-${selectedClassId}-report.csv`);
    } catch {
      message.error(t('teacher.reports.exportFailed'));
    }
  };

  return (
    <PageContainer
      title={t('teacher.reports.title')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.reports') },
        ],
      }}
    >
      {reportQuery.isError ? (
        <Alert
          type="error"
          message={t('teacher.reports.loadError')}
          description={reportQuery.error instanceof Error ? reportQuery.error.message : t('common.tryAgain')}
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
          <Select
            placeholder={t('teacher.reports.selectClass')}
            style={{ minWidth: 220 }}
            options={classOptions}
            loading={classesQuery.isLoading}
            value={selectedClassId || undefined}
            onChange={(value) => setSelectedClassId(value)}
          />
          <Space>
            <Typography.Text>{t('teacher.reports.rangeDays')}</Typography.Text>
            <InputNumber min={1} max={30} value={rangeDays} onChange={(value) => setRangeDays(value || 7)} />
          </Space>
          <Button onClick={handleExportPdf}>{t('teacher.reports.exportPdf')}</Button>
          <Button onClick={handleExportCsv}>{t('teacher.reports.exportCsv')}</Button>
        </Space>
      </ProCard>

      {!selectedClassId ? (
        <Empty description={t('teacher.reports.selectClassHint')} />
      ) : reportQuery.isLoading && !report ? (
        <ProCard bordered loading />
      ) : !report ? (
        <Empty description={t('teacher.reports.noData')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title={t('teacher.reports.insightsTitle')}>
            <ProCard gutter={16} wrap>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <Statistic title={t('teacher.reports.totalStudents')} value={report.totalStudents} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <Statistic title={t('teacher.reports.submittedStudents')} value={report.submittedStudents} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <Statistic title={t('teacher.reports.pendingStudents')} value={report.pendingStudents} />
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                <Statistic title={t('teacher.reports.submissionRate')} value={submissionRate} suffix="%" />
              </ProCard>
            </ProCard>
          </ProCard>
          <ProCard bordered title={t('teacher.reports.summary')}>
            {hasSummary ? (
              <ProCard gutter={16} wrap>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('teacher.reports.avgScore')} value={report.summary.avg} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('teacher.reports.highestScore')} value={report.summary.max} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('teacher.reports.lowestScore')} value={report.summary.min} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title={t('teacher.reports.submissions')} value={report.summary.count} />
                </ProCard>
              </ProCard>
            ) : (
              <Empty description={t('teacher.reports.noCompleted')} />
            )}
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.reports.scoreDistribution')}>
              {report.distribution?.length ? (
                <ChartPanel option={distributionOption} />
              ) : (
                <Empty description={t('teacher.reports.noDistribution')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.reports.trend')}>
              {report.trend?.length ? (
                <ChartPanel option={trendOption} height={280} />
              ) : (
                <Empty description={t('teacher.reports.noTrend')} />
              )}
            </ProCard>
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.reports.topStudents')}>
              {report.topRank?.length ? (
                <List
                  dataSource={report.topRank}
                  renderItem={(item) => (
                    <List.Item>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text>{item.name}</Typography.Text>
                        <Typography.Text>
                          {t('common.avgShort')} {item.avgScore}
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description={t('teacher.reports.noRanking')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.reports.topErrorTypes')}>
              {report.errorTypes?.length ? (
                <ChartPanel option={errorOption} />
              ) : (
                <Empty description={t('teacher.reports.noErrorStats')} />
              )}
            </ProCard>
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
