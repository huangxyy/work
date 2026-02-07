import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, Button, InputNumber, List, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { downloadStudentReportPdf, fetchStudentReportOverview } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

type StudentReport = {
  studentId: string;
  studentName: string;
  rangeDays: number;
  summary: { avg: number; min: number; max: number; count: number };
  trend: Array<{ date: string; avg: number; count: number }>;
  errorTypes: Array<{ type: string; count: number; ratio: number }>;
  nextSteps: Array<{ text: string; count: number }>;
};

export const StudentReportPage = () => {
  const { t, language } = useI18n();
  const message = useMessage();
  const [rangeDays, setRangeDays] = useState(7);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const rangeTag = rangeDays === 7 ? t('common.last7Days') : t('common.recent');

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
        axisLabel: { rotate: 30, width: 80, overflow: 'truncate' },
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
        data: data.map((item) => localizeErrorType(item.type)),
        axisLabel: { interval: 0, rotate: 20, width: 80, overflow: 'truncate' },
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

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      const blob = await downloadStudentReportPdf(rangeDays, language);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student-report-${rangeDays}d.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('student.report.exportFailed'));
    } finally {
      setExporting(false);
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
          <Button onClick={handleExportPdf} loading={exporting}>
            {t('student.report.exportPdf')}
          </Button>
        </Space>
      </ProCard>

      <div ref={reportRef}>
        {reportQuery.isLoading && !report ? (
          <ProCard bordered loading />
        ) : !report ? (
          <SoftEmpty description={t('student.report.empty')}>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
              {t('student.report.emptyHint')}
            </Typography.Paragraph>
          </SoftEmpty>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ProCard bordered title={t('student.report.summary')}>
              {hasSummary ? (
                <ProCard gutter={16} wrap>
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span>{t('student.report.avgScore')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.avg}
                    />
                  </ProCard>
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span>{t('student.report.highestScore')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.max}
                    />
                  </ProCard>
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span>{t('student.report.lowestScore')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.min}
                    />
                  </ProCard>
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span>{t('student.report.submissions')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.count}
                    />
                  </ProCard>
                </ProCard>
              ) : (
                <SoftEmpty description={t('student.report.noCompleted')} />
              )}
            </ProCard>

            <ProCard gutter={16} wrap>
              <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.trend')}>
              {report.trend?.length ? (
                <ChartPanel option={trendOption} height={280} />
              ) : (
                <SoftEmpty description={t('student.report.noTrend')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.errorTypes')}>
              {report.errorTypes?.length ? (
                <ChartPanel option={errorOption} />
              ) : (
                <SoftEmpty description={t('student.report.noErrorStats')} />
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
                <SoftEmpty description={t('student.report.noNextSteps')} />
              )}
            </ProCard>
          </Space>
        )}
      </div>
    </PageContainer>
  );
};
