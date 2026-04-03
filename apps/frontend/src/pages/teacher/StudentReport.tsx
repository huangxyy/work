import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, Button, InputNumber, List, Progress, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchTeacherStudentReportOverview } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { CHART_PALETTE, getDefaultGrid, getDefaultTooltip, createPieSeries } from '../../theme/charts';

type StudentReport = {
  studentId: string;
  studentName: string;
  rangeDays: number;
  summary: { avg: number; min: number; max: number; count: number };
  trend: Array<{ date: string; avg: number; count: number }>;
  errorTypes: Array<{ type: string; count: number; ratio: number }>;
  nextSteps: Array<{ text: string; count: number }>;
};

export const TeacherStudentReportPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const [rangeDays, setRangeDays] = useState(7);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const reportQuery = useQuery({
    queryKey: ['teacher-student-report', studentId, rangeDays],
    queryFn: () => fetchTeacherStudentReportOverview(studentId || '', rangeDays),
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
  });

  const report = reportQuery.data as StudentReport | undefined;
  const hasSummary = report?.summary?.count && report.summary.count > 0;
  const rangeTag = rangeDays === 7 ? t('common.last7Days') : t('common.recent');

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const trendOption = useMemo<EChartsOption>(() => {
    const data = report?.trend || [];
    return {
      grid: getDefaultGrid(),
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'axis',
      },
      legend: { 
        data: [t('common.avgShort'), t('student.report.submissions')],
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.date),
        axisLabel: { rotate: 30, width: 80, overflow: 'truncate' },
      },
      yAxis: [
        { type: 'value', name: t('common.avgShort'), min: 0, max: 100 },
        { type: 'value', name: t('student.report.submissions'), minInterval: 1 },
      ],
      series: [
        {
          name: t('common.avgShort'),
          type: 'line',
          data: data.map((item) => item.avg),
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: CHART_PALETTE[1] },
          itemStyle: { color: CHART_PALETTE[1], borderWidth: 2, borderColor: '#fff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${CHART_PALETTE[1]}30` },
                { offset: 1, color: `${CHART_PALETTE[1]}05` },
              ],
            },
          },
        },
        {
          name: t('student.report.submissions'),
          type: 'bar',
          yAxisIndex: 1,
          data: data.map((item) => item.count),
          itemStyle: { 
            color: CHART_PALETTE[4],
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: 16,
        },
      ],
    };
  }, [report?.trend, t]);

  const errorOption = useMemo<EChartsOption>(() => {
    const data = report?.errorTypes || [];
    const pieData = data.map((item) => ({
      name: localizeErrorType(item.type),
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
  }, [report?.errorTypes]);

  const handleExportPdf = useCallback(async () => {
    if (!studentId) {
      message.error(t('teacher.reports.exportFailed'));
      return;
    }
    if (!reportRef.current) {
      message.error(t('teacher.reports.exportFailed'));
      return;
    }
    try {
      setExporting(true);
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
      pdf.save(`student-${studentId}-${rangeDays}d.pdf`);
    } catch (error) {
      console.error('导出PDF失败:', error);
      message.error(t('teacher.reports.exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [message, rangeDays, studentId, t]);

  useEffect(() => {
    if (!report) {
      return;
    }
    if (searchParams.get('export') === '1') {
      const timeout = window.setTimeout(() => {
        handleExportPdf().then(() => {
          if (window.opener) {
            window.close();
          }
        });
      }, 400);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [handleExportPdf, report, searchParams]);

  return (
    <PageContainer
      title={t('student.report.title')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.reports'), path: '/teacher/reports' },
          { title: t('student.report.title') },
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
          <ProCard bordered loading className="apple-soft-card" />
        ) : !report ? (
          <SoftEmpty description={t('student.report.empty')}>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
              {t('student.report.emptyHint')}
            </Typography.Paragraph>
          </SoftEmpty>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ProCard bordered className="apple-soft-card">
              <Space direction="vertical" size={4}>
                <Typography.Text type="secondary">
                  {t('common.student')}: {report.studentName}
                </Typography.Text>
                <Typography.Text type="secondary">ID: {report.studentId}</Typography.Text>
              </Space>
            </ProCard>

            <ProCard bordered title={t('student.report.summary')} className="apple-soft-card">
              {hasSummary ? (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <ProCard gutter={16} wrap>
                    <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                      <div style={{ textAlign: 'center' }}>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          <Space size={6} align="center">
                            <span>{t('student.report.avgScore')}</span>
                            <span className="stat-chip">{rangeTag}</span>
                          </Space>
                        </Typography.Text>
                        <Progress 
                          type="dashboard" 
                          percent={report.summary.avg} 
                          size={100}
                          strokeColor={getScoreColor(report.summary.avg)}
                          format={(percent) => (
                            <span style={{ fontSize: 24, fontWeight: 600, color: getScoreColor(percent || 0) }}>
                              {percent}
                            </span>
                          )}
                        />
                      </div>
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
                </Space>
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

            <ProCard bordered title={t('student.report.nextSteps')} className="apple-soft-card">
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
