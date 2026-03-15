import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, Button, InputNumber, List, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadStudentReportPdf, fetchClassComparison, fetchStudentReportOverview } from '../../api';
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
  const revokeUrlTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rangeTag = rangeDays === 7 ? t('common.last7Days') : t('common.recent');

  useEffect(() => {
    return () => {
      if (revokeUrlTimerRef.current) {
        clearTimeout(revokeUrlTimerRef.current);
      }
    };
  }, []);

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

  const comparisonQuery = useQuery({
    queryKey: ['student-class-comparison', rangeDays],
    queryFn: () => fetchClassComparison(rangeDays),
    staleTime: 2 * 60 * 1000,
  });

  const comparisonOption = useMemo<EChartsOption>(() => {
    const data = comparisonQuery.data || [];
    return {
      grid: { left: 24, right: 24, top: 30, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { data: [t('student.report.myScore'), t('student.report.classAvg')] },
      xAxis: {
        type: 'category',
        data: data.map((d: { className: string }) => d.className),
      },
      yAxis: { type: 'value', max: 100 },
      series: [
        {
          name: t('student.report.myScore'),
          type: 'bar',
          data: data.map((d: { studentAvg: number | null }) => d.studentAvg ?? 0),
          itemStyle: { color: '#22c55e' },
        },
        {
          name: t('student.report.classAvg'),
          type: 'bar',
          data: data.map((d: { classAvg: number | null }) => d.classAvg ?? 0),
          itemStyle: { color: '#94a3b8' },
        },
      ],
    };
  }, [comparisonQuery.data, t]);

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      const blob = await downloadStudentReportPdf(rangeDays, language);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student-report-${rangeDays}d.pdf`;
      link.click();
      revokeUrlTimerRef.current = setTimeout(() => window.URL.revokeObjectURL(url), 200);
    } catch (error) {
      console.error('导出PDF失败:', error);
      if (!reportRef.current) {
        message.error(t('student.report.exportFailed'));
        return;
      }
      try {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);
        const canvas = await html2canvas(reportRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let position = 0;
        let heightLeft = imgHeight;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        pdf.save(`student-report-${rangeDays}d.pdf`);
      } catch (fallbackError) {
        console.error('PDF备用导出失败:', fallbackError);
        message.error(t('student.report.exportFailed'));
      }
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
          className="apple-inline-alert"
        />
      ) : null}

      <ProCard bordered className="apple-soft-card" style={{ marginBottom: 16 }}>
        <Space wrap className="apple-toolbar">
          <Space className="apple-toolbar-score-range">
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
            <Typography.Paragraph type="secondary" className="apple-empty-hint">
              {t('student.report.emptyHint')}
            </Typography.Paragraph>
          </SoftEmpty>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ProCard bordered title={t('student.report.summary')} className="apple-soft-card">
              {hasSummary ? (
                <ProCard gutter={16} wrap>
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
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
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
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
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
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
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }} className="apple-soft-card">
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
              <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.trend')} className="apple-soft-card">
              {report.trend?.length ? (
                <ChartPanel option={trendOption} height={280} />
              ) : (
                <SoftEmpty description={t('student.report.noTrend')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.errorTypes')} className="apple-soft-card">
              {report.errorTypes?.length ? (
                <ChartPanel option={errorOption} />
              ) : (
                <SoftEmpty description={t('student.report.noErrorStats')} />
              )}
            </ProCard>
          </ProCard>

            <ProCard bordered colSpan={{ xs: 24 }} title={t('student.report.classComparison')} className="apple-soft-card">
              {comparisonQuery.data?.length ? (
                <ChartPanel option={comparisonOption} height={280} />
              ) : (
                <SoftEmpty description={t('student.report.noClassData')} />
              )}
            </ProCard>

            <ProCard bordered title={t('student.report.nextSteps')} className="apple-soft-card">
              {report.nextSteps?.length ? (
                <List
                  dataSource={report.nextSteps}
                  renderItem={(item) => (
                    <List.Item className="apple-list-row">
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
