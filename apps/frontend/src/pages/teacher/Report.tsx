import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Alert, Button, Dropdown, InputNumber, List, Select, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadTeacherClassReportCsv,
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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 200);
  };

  const handleExportPdf = async () => {
    if (!selectedClassId) {
      message.warning(t('teacher.reports.selectClassHint'));
      return;
    }
    if (!reportRef.current) {
      message.error(t('teacher.reports.exportFailed'));
      return;
    }
    try {
      setExporting(true);
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
    } catch {
      message.error(t('teacher.reports.exportFailed'));
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
            <ProCard bordered title={t('teacher.reports.insightsTitle')}>
              <ProCard gutter={16} wrap>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span>{t('teacher.reports.totalStudents')}</span>
                        <span className="stat-chip">{t('common.realtime')}</span>
                      </Space>
                    }
                    value={report.totalStudents}
                  />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span>{t('teacher.reports.submittedStudents')}</span>
                        <span className="stat-chip">{rangeTag}</span>
                      </Space>
                    }
                    value={report.submittedStudents}
                  />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span>{t('teacher.reports.pendingStudents')}</span>
                        <span className="stat-chip">{rangeTag}</span>
                      </Space>
                    }
                    value={report.pendingStudents}
                  />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <AnimatedStatistic
                    title={
                      <Space size={6} align="center">
                        <span>{t('teacher.reports.submissionRate')}</span>
                        <span className="stat-chip">{rangeTag}</span>
                      </Space>
                    }
                    value={submissionRate}
                    suffix="%"
                  />
                </ProCard>
              </ProCard>
            </ProCard>
            <ProCard bordered title={t('teacher.reports.summary')}>
              {hasSummary ? (
                <ProCard gutter={16} wrap>
                  <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                    <AnimatedStatistic
                      title={
                        <Space size={6} align="center">
                          <span>{t('teacher.reports.avgScore')}</span>
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
                          <span>{t('teacher.reports.highestScore')}</span>
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
                          <span>{t('teacher.reports.lowestScore')}</span>
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
                          <span>{t('teacher.reports.submissions')}</span>
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

            <ProCard gutter={16} wrap>
              <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.reports.scoreDistribution')}>
                {report.distribution?.length ? (
                  <ChartPanel option={distributionOption} />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noDistribution')} />
                )}
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.reports.trend')}>
                {report.trend?.length ? (
                  <ChartPanel option={trendOption} height={280} />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noTrend')} />
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
                  <SoftEmpty description={t('teacher.reports.noRanking')} />
                )}
              </ProCard>
              <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.reports.topErrorTypes')}>
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
