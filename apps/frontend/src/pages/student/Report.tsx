import { PageContainer, ProCard } from '@ant-design/pro-components';
import type { EChartsOption } from 'echarts';
import { Alert, Button, InputNumber, List, Progress, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { fetchClassComparison, fetchStudentReportOverview } from '../../api';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { CHART_PALETTE, getDefaultGrid, getDefaultTooltip } from '../../theme/charts';

type StudentReport = {
  studentId: string;
  studentName: string;
  rangeDays: number;
  summary: { avg: number; min: number; max: number; count: number };
  trend: Array<{ date: string; avg: number; count: number }>;
  errorTypes: Array<{ type: string; count: number; ratio: number }>;
  nextSteps: Array<{ text: string; count: number }>;
};

const { Title, Text } = Typography;

export const StudentReportPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const [rangeDays, setRangeDays] = useState(7);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const reportQuery = useQuery({
    queryKey: ['student-report', rangeDays],
    queryFn: () => fetchStudentReportOverview(rangeDays),
  });

  const report = reportQuery.data as StudentReport | undefined;
  const hasSummary = report?.summary?.count && report.summary.count > 0;

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
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
      },
      yAxis: [
        { 
          type: 'value', 
          name: t('common.avgShort'),
          min: 0,
          max: 100,
          splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        { 
          type: 'value', 
          name: t('student.report.submissions'), 
          minInterval: 1,
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
        },
      ],
      series: [
        {
          name: t('common.avgShort'),
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
        {
          name: t('student.report.submissions'),
          type: 'bar',
          yAxisIndex: 1,
          data: data.map((item) => item.count),
          itemStyle: { 
            color: CHART_PALETTE[4],
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 24,
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
      ],
    };
  }, [report?.trend, t]);

  const errorOption = useMemo<EChartsOption>(() => {
    const data = report?.errorTypes || [];
    return {
      grid: { left: 16, right: 16, top: 16, bottom: 16, containLabel: true },
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}\n{c}',
            fontSize: 11,
          },
          labelLine: {
            show: true,
            length: 8,
            length2: 8,
          },
          data: data.map((item, index) => ({
            value: item.count,
            name: localizeErrorType(item.type),
            itemStyle: { color: CHART_PALETTE[index % CHART_PALETTE.length] },
          })),
          animationType: 'scale',
          animationDuration: 800,
          animationEasing: 'cubicOut',
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
      grid: getDefaultGrid(),
      tooltip: {
        ...getDefaultTooltip(),
        trigger: 'axis',
      },
      legend: {
        data: [t('student.report.myScore'), t('student.report.classAvg')],
        bottom: 0,
      },
      xAxis: {
        type: 'category',
        data: data.map((d: { className: string }) => d.className),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
      },
      yAxis: { 
        type: 'value', 
        max: 100,
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: t('student.report.myScore'),
          type: 'bar',
          data: data.map((d: { studentAvg: number | null }) => d.studentAvg ?? 0),
          itemStyle: { 
            color: CHART_PALETTE[1],
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 24,
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
        {
          name: t('student.report.classAvg'),
          type: 'bar',
          data: data.map((d: { classAvg: number | null }) => d.classAvg ?? 0),
          itemStyle: { 
            color: CHART_PALETTE[4],
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 24,
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
      ],
    };
  }, [comparisonQuery.data, t]);

  const handleExportPdf = async () => {
    if (!reportRef.current) {
      message.error(t('student.report.exportFailed'));
      return;
    }
    try {
      setExporting(true);
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      // Show PDF header temporarily
      const pdfHeader = reportRef.current.querySelector('[data-pdf-header="true"]') as HTMLElement;
      const originalDisplay = pdfHeader?.style.display;
      if (pdfHeader) {
        pdfHeader.style.display = 'block';
      }

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      // Hide PDF header after capture
      if (pdfHeader) {
        pdfHeader.style.display = originalDisplay || 'none';
      }

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
    } catch (error) {
      console.error('导出PDF失败:', error);
      message.error(t('student.report.exportFailed'));
    } finally {
      setExporting(false);
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
          <Space>
            <Text type="secondary">{t('student.report.rangeDays')}</Text>
            <InputNumber min={1} max={30} value={rangeDays} onChange={(value) => setRangeDays(value || 7)} />
          </Space>
          <Button type="primary" onClick={handleExportPdf} loading={exporting}>
            {t('student.report.exportPdf')}
          </Button>
        </Space>
      </ProCard>

      <div ref={reportRef}>
        {/* PDF Export Header - only visible when exporting */}
        <div style={{ display: 'none' }} data-pdf-header="true">
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', marginBottom: '20px', textAlign: 'center' }}>
            <Title level={2} style={{ margin: '0 0 16px 0' }}>{t('student.report.pdfTitle')}</Title>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '14px', color: '#666', textAlign: 'left' }}>
              <div>{t('common.student')}{t('common.colon')}{report?.studentName || '-'}</div>
              <div>ID{t('common.colon')}{report?.studentId || '-'}</div>
              <div>生成时间：{new Date().toLocaleString('zh-CN')}</div>
              <div>统计范围：近{rangeDays}天</div>
            </div>
          </div>
        </div>

        {reportQuery.isLoading && !report ? (
          <ProCard bordered loading />
        ) : !report ? (
          <SoftEmpty description={t('student.report.empty')}>
            <Text type="secondary">{t('student.report.emptyHint')}</Text>
          </SoftEmpty>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {hasSummary && (
              <ProCard bordered className="apple-soft-card">
                <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 200, textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>{t('student.report.avgScore')}</Text>
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
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('student.report.highestScore')}</Text>
                        <Title level={2} style={{ margin: '8px 0 0', color: '#10b981' }}>{report.summary.max}</Title>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('student.report.lowestScore')}</Text>
                        <Title level={2} style={{ margin: '8px 0 0', color: '#ef4444' }}>{report.summary.min}</Title>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('student.report.submissions')}</Text>
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
                <Title level={5} style={{ marginBottom: 16 }}>{t('student.report.trend')}</Title>
                {report.trend?.length ? (
                  <ChartPanel option={trendOption} height={240} />
                ) : (
                  <SoftEmpty description={t('student.report.noTrend')} />
                )}
              </ProCard>
              <ProCard 
                colSpan={{ xs: 24, md: 12 }} 
                bordered 
                className="apple-soft-card"
              >
                <Title level={5} style={{ marginBottom: 16 }}>{t('student.report.errorTypes')}</Title>
                {report.errorTypes?.length ? (
                  <ChartPanel option={errorOption} height={240} />
                ) : (
                  <SoftEmpty description={t('student.report.noErrorStats')} />
                )}
              </ProCard>
            </ProCard>

            <ProCard bordered className="apple-soft-card">
              <Title level={5} style={{ marginBottom: 16 }}>{t('student.report.classComparison')}</Title>
              {comparisonQuery.data?.length ? (
                <ChartPanel option={comparisonOption} height={200} />
              ) : (
                <SoftEmpty description={t('student.report.noClassData')} />
              )}
            </ProCard>

            {report.nextSteps?.length > 0 && (
              <ProCard bordered className="apple-soft-card">
                <Title level={5} style={{ marginBottom: 16 }}>{t('student.report.nextSteps')}</Title>
                <List
                  dataSource={report.nextSteps}
                  renderItem={(item) => (
                    <List.Item className="apple-list-row">
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text>{item.text}</Text>
                        <Text type="secondary">{item.count} 次</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </ProCard>
            )}
          </Space>
        )}
      </div>
    </PageContainer>
  );
};
