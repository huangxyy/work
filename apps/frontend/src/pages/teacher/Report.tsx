import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, Button, Dropdown, InputNumber, List, Select, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadTeacherClassReportCsv,
  downloadTeacherClassReportPdf,
  fetchClasses,
  fetchTeacherClassReportOverview,
} from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

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

export const TeacherReportPage = () => {
  const { t, language } = useI18n();
  const message = useMessage();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    staleTime: 5 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
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
  const rangeTag = rangeDays === 7 ? t('common.last7Days') : t('common.recent');
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
        axisLabel: { rotate: 30, width: 80, overflow: 'truncate' },
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

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const handleExportPdf = async () => {
    if (!selectedClassId) {
      message.warning(t('teacher.reports.selectClassHint'));
      return;
    }
    try {
      setExporting(true);
      const blob = await downloadTeacherClassReportPdf(selectedClassId, rangeDays, language);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `class-${selectedClassId}-report.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出PDF失败:', error);
      // 尝试使用备用方案（html2canvas + jsPDF）
      if (!reportRef.current) {
        message.error(t('teacher.reports.exportFailed'));
        return;
      }
      try {
        message.loading(t('teacher.reports.fallbackExporting'));
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
        pdf.save(`class-${selectedClassId}-report.pdf`);
        message.success(t('teacher.reports.exportSuccess'));
      } catch (fallbackError) {
        console.error('PDF备用导出失败:', fallbackError);
        message.error(t('teacher.reports.exportFailed'));
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedClassId) {
      message.warning(t('teacher.reports.selectClassHint'));
      return;
    }
    try {
      const blob = await downloadTeacherClassReportCsv(selectedClassId, rangeDays, language);
      downloadBlob(blob, `class-${selectedClassId}-report.csv`);
    } catch (error) {
      console.error('导出CSV失败:', error);
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
          className="apple-inline-alert"
        />
      ) : null}

      <ProCard bordered className="apple-soft-card apple-section-card">
        <Space wrap className="apple-toolbar">
          <Select
            placeholder={t('teacher.reports.selectClass')}
            className="apple-toolbar-select-wide"
            options={classOptions}
            loading={classesQuery.isLoading}
            value={selectedClassId || undefined}
            onChange={(value) => setSelectedClassId(value)}
          />
          <Space className="apple-toolbar-score-range">
            <Typography.Text>{t('teacher.reports.rangeDays')}</Typography.Text>
            <InputNumber min={1} max={30} value={rangeDays} onChange={(value) => setRangeDays(value || 7)} />
          </Space>
          <Dropdown.Button
            type="primary"
            onClick={handleExportPdf}
            loading={exporting}
            menu={{
              items: [
                {
                  key: 'csv',
                  label: t('teacher.reports.exportCsv'),
                  onClick: handleExportCsv,
                },
              ],
            }}
          >
            {t('teacher.reports.exportPdf')}
          </Dropdown.Button>
        </Space>
      </ProCard>

      <div ref={reportRef}>
        {!selectedClassId ? (
          <SoftEmpty description={t('teacher.reports.selectClassHint')} />
        ) : reportQuery.isLoading && !report ? (
          <ProCard bordered loading />
        ) : !report ? (
          <SoftEmpty description={t('teacher.reports.noData')} />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ProCard 
              title={t('teacher.reports.insightsTitle')} 
              headerBordered 
              bordered 
              className="chart-panel apple-soft-card"
            >
              <ProCard gutter={[24, 24]} wrap ghost>
                <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span className="apple-muted-label">{t('teacher.reports.totalStudents')}</span>
                        <span className="stat-chip">{t('common.realtime')}</span>
                      </Space>
                    }
                    value={report.totalStudents}
                  />
                </ProCard>
                <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span className="apple-muted-label">{t('teacher.reports.submittedStudents')}</span>
                        <span className="stat-chip">{rangeTag}</span>
                      </Space>
                    }
                    value={report.submittedStudents}
                  />
                </ProCard>
                <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span className="apple-muted-label">{t('teacher.reports.pendingStudents')}</span>
                        <span className="stat-chip">{rangeTag}</span>
                      </Space>
                    }
                    value={report.pendingStudents}
                  />
                </ProCard>
                <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span className="apple-muted-label">{t('teacher.reports.submissionRate')}</span>
                        <span className="stat-chip">{rangeTag}</span>
                      </Space>
                    }
                    value={submissionRate}
                    suffix="%"
                  />
                </ProCard>
              </ProCard>
            </ProCard>
            <ProCard 
              title={t('teacher.reports.summary')} 
              headerBordered 
              bordered 
              className="chart-panel apple-soft-card"
            >
              {hasSummary ? (
                <ProCard gutter={[24, 24]} wrap ghost>
                  <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span className="apple-muted-label">{t('teacher.reports.avgScore')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.avg}
                    />
                  </ProCard>
                  <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span className="apple-muted-label">{t('teacher.reports.highestScore')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.max}
                    />
                  </ProCard>
                  <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span className="apple-muted-label">{t('teacher.reports.lowestScore')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.min}
                    />
                  </ProCard>
                  <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }} ghost>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span className="apple-muted-label">{t('teacher.reports.submissions')}</span>
                          <span className="stat-chip">{rangeTag}</span>
                        </Space>
                      }
                      value={report.summary.count}
                    />
                  </ProCard>
                </ProCard>
              ) : (
                <SoftEmpty description={t('teacher.reports.noCompleted')} />
              )}
            </ProCard>

            <ProCard gutter={[24, 24]} wrap ghost>
              <ProCard 
                colSpan={{ xs: 24, lg: 12 }} 
                title={t('teacher.reports.scoreDistribution')} 
                headerBordered 
                bordered 
                className="chart-panel apple-soft-card"
              >
                {report.distribution?.length ? (
                  <ChartPanel option={distributionOption} />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noDistribution')} />
                )}
              </ProCard>
              <ProCard 
                colSpan={{ xs: 24, lg: 12 }} 
                title={t('teacher.reports.trend')} 
                headerBordered 
                bordered 
                className="chart-panel apple-soft-card"
              >
                {report.trend?.length ? (
                  <ChartPanel option={trendOption} height={280} />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noTrend')} />
                )}
              </ProCard>
            </ProCard>

            <ProCard gutter={[24, 24]} wrap ghost>
              <ProCard 
                colSpan={{ xs: 24, lg: 12 }} 
                title={t('teacher.reports.topStudents')} 
                headerBordered 
                bordered 
                className="chart-panel apple-soft-card"
              >
                {report.topRank?.length ? (
                  <List
                    dataSource={report.topRank}
                    renderItem={(item) => (
                      <List.Item className="apple-list-row">
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text style={{ fontWeight: 500, fontSize: '15px' }}>{item.name}</Typography.Text>
                          <Typography.Text style={{ color: 'var(--apple-primary)', fontWeight: 600 }}>
                            {t('common.avgShort')} {item.avgScore}
                          </Typography.Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noRanking')} />
                )}
              </ProCard>
              <ProCard 
                colSpan={{ xs: 24, lg: 12 }} 
                title={t('teacher.reports.topErrorTypes')} 
                headerBordered 
                bordered 
                className="chart-panel apple-soft-card"
              >
                {report.errorTypes?.length ? (
                  <ChartPanel option={errorOption} />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noErrorStats')} />
                )}
              </ProCard>
            </ProCard>
          </Space>
        )}
      </div>
    </PageContainer>
  );
};
