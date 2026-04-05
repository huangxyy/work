import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, Button, Dropdown, InputNumber, Progress, Select, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadTeacherClassReportCsv,
  fetchClasses,
  fetchTeacherClassReportOverview,
} from '../../api';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { CHART_PALETTE, getDefaultGrid, getDefaultTooltip } from '../../theme/charts';

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
  trend: TrendPoint[];
};

const { Title, Text } = Typography;

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

  const distributionOption = useMemo<EChartsOption>(() => {
    const data = report?.distribution || [];
    const colors: Record<string, string> = {
      '90-100': '#10b981',
      '80-89': '#f59e0b',
      '60-79': '#fbbf24',
      '0-59': '#ef4444',
    };
    return {
      grid: { left: 16, right: 16, top: 16, bottom: 16, containLabel: true },
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'item',
        formatter: '{b}: {c}�?({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}\n{c}�?,
            fontSize: 12,
          },
          labelLine: {
            show: true,
            length: 10,
            length2: 10,
          },
          data: data.map((item) => ({
            value: item.count,
            name: item.bucket,
            itemStyle: { color: colors[item.bucket] || CHART_PALETTE[0] },
          })),
          animationType: 'scale',
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
      ],
    };
  }, [report?.distribution]);

  const trendOption = useMemo<EChartsOption>(() => {
    const data = report?.trend || [];
    return {
      grid: getDefaultGrid(),
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'axis',
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.date),
        axisLabel: { rotate: 30, width: 80, overflow: 'truncate' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: { 
        type: 'value',
        min: 0,
        max: 100,
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'line',
          data: data.map((item) => item.avg),
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: CHART_PALETTE[0] },
          itemStyle: { color: CHART_PALETTE[0], borderWidth: 2, borderColor: '#fff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${CHART_PALETTE[0]}40` },
                { offset: 1, color: `${CHART_PALETTE[0]}05` },
              ],
            },
          },
          animationDuration: 1000,
          animationEasing: 'cubicOut',
        },
      ],
    };
  }, [report?.trend]);

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
      pdf.save(`class-${selectedClassId}-report.pdf`);
    } catch (error) {
      console.error('导出PDF失败:', error);
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
    } catch (error) {
      console.error('导出CSV失败:', error);
      message.error(t('teacher.reports.exportFailed'));
    }
  };

  const getScoreColor = (avg: number) => {
    if (avg >= 90) return '#10b981';
    if (avg >= 80) return '#f59e0b';
    if (avg >= 60) return '#fbbf24';
    return '#ef4444';
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

      <ProCard bordered className="apple-soft-card" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Select
            placeholder={t('teacher.reports.selectClass')}
            style={{ minWidth: 180 }}
            options={classOptions}
            loading={classesQuery.isLoading}
            value={selectedClassId || undefined}
            onChange={(value) => setSelectedClassId(value)}
          />
          <Space>
            <Text type="secondary">{t('teacher.reports.rangeDays')}</Text>
            <InputNumber min={1} max={30} value={rangeDays} onChange={(value) => setRangeDays(value || 7)} />
          </Space>
          <Dropdown.Button
            type="primary"
            onClick={handleExportPdf}
            loading={exporting}
            menu={{
              items: [{ key: 'csv', label: t('teacher.reports.exportCsv'), onClick: handleExportCsv }],
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
            <ProCard bordered className="apple-soft-card">
              <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ minWidth: 200 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.submissionRate')}</Text>
                  <div style={{ marginTop: 8 }}>
                    <Progress 
                      type="circle" 
                      percent={submissionRate} 
                      size={120}
                      strokeColor={submissionRate >= 80 ? '#10b981' : submissionRate >= 60 ? '#f59e0b' : '#ef4444'}
                      format={(percent) => <span style={{ fontSize: 28, fontWeight: 700 }}>{percent}%</span>}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 300 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.totalStudents')}</Text>
                      <Title level={2} style={{ margin: '8px 0 0' }}>{report.totalStudents}</Title>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.submittedStudents')}</Text>
                      <Title level={2} style={{ margin: '8px 0 0', color: '#10b981' }}>{report.submittedStudents}</Title>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.pendingStudents')}</Text>
                      <Title level={2} style={{ margin: '8px 0 0', color: '#f59e0b' }}>{report.pendingStudents}</Title>
                    </div>
                  </div>
                </div>
              </div>
            </ProCard>

            {hasSummary && (
              <ProCard bordered className="apple-soft-card">
                <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 200, textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.avgScore')}</Text>
                    <div style={{ marginTop: 8 }}>
                      <Progress 
                        type="dashboard" 
                        percent={report.summary.avg} 
                        size={140}
                        strokeColor={getScoreColor(report.summary.avg)}
                        format={(percent) => (
                          <span style={{ fontSize: 32, fontWeight: 700 }}>{percent}</span>
                        )}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.highestScore')}</Text>
                        <Title level={2} style={{ margin: '8px 0 0', color: '#10b981' }}>{report.summary.max}</Title>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.lowestScore')}</Text>
                        <Title level={2} style={{ margin: '8px 0 0', color: '#ef4444' }}>{report.summary.min}</Title>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('teacher.reports.submissions')}</Text>
                        <Title level={2} style={{ margin: '8px 0 0' }}>{report.summary.count}</Title>
                      </div>
                    </div>
                  </div>
                </div>
              </ProCard>
            )}

            <ProCard gutter={24} wrap ghost>
              <ProCard 
                colSpan={{ xs: 24, md: 12 }} 
                bordered 
                className="apple-soft-card"
              >
                <Title level={5} style={{ marginBottom: 16 }}>{t('teacher.reports.scoreDistribution')}</Title>
                {report.distribution?.length ? (
                  <ChartPanel option={distributionOption} height={240} />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noDistribution')} />
                )}
              </ProCard>
              <ProCard 
                colSpan={{ xs: 24, md: 12 }} 
                bordered 
                className="apple-soft-card"
              >
                <Title level={5} style={{ marginBottom: 16 }}>{t('teacher.reports.trend')}</Title>
                {report.trend?.length ? (
                  <ChartPanel option={trendOption} height={240} />
                ) : (
                  <SoftEmpty description={t('teacher.reports.noTrend')} />
                )}
              </ProCard>
            </ProCard>
          </Space>
        )}
      </div>
    </PageContainer>
  );
};
