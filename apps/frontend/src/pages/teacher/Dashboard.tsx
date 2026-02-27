import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, InputNumber, List, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchClasses, fetchHomeworksSummaryByClass, fetchTeacherClassReportOverview } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { OnboardingGuide } from '../../components/OnboardingGuide';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';

export const TeacherDashboardPage = () => {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    staleTime: 10 * 60 * 1000,
  });
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [rangeDays, setRangeDays] = useState<number>(7);

  useEffect(() => {
    if (!selectedClassId && data && data.length) {
      setSelectedClassId(data[0].id);
    }
  }, [data, selectedClassId]);

  const classOptions = useMemo(
    () =>
      (data || []).map((klass) => ({
        label: klass.name,
        value: klass.id,
      })),
    [data],
  );

  const reportQuery = useQuery({
    queryKey: ['teacher-dashboard-report', selectedClassId, rangeDays],
    queryFn: () => fetchTeacherClassReportOverview(selectedClassId, rangeDays),
    enabled: !!selectedClassId,
  });

  const homeworksQuery = useQuery({
    queryKey: ['teacher-dashboard-homeworks', selectedClassId],
    queryFn: () => fetchHomeworksSummaryByClass(selectedClassId),
    enabled: !!selectedClassId,
    staleTime: 5 * 60 * 1000,
  });

  const report = reportQuery.data;
  const summary = report?.summary;
  const submissionRate = report?.submissionRate ? Number((report.submissionRate * 100).toFixed(1)) : 0;
  const topErrors = useMemo(() => (report?.errorTypes || []).slice(0, 5), [report?.errorTypes]);
  const trend = useMemo(() => (report?.trend || []).slice(-7).reverse(), [report?.trend]);
  const summaryLoading = (isLoading && !data) || reportQuery.isLoading;
  const upcoming = (homeworksQuery.data || [])
    .filter((item) => item.dueAt)
    .map((item) => ({
      id: item.id,
      title: item.title,
      dueAt: item.dueAt ? new Date(item.dueAt) : null,
      pending: item.pendingStudents,
      total: item.totalStudents,
    }))
    .filter((item) => item.dueAt && item.dueAt.getTime() >= Date.now())
    .sort((a, b) => (a.dueAt?.getTime() || 0) - (b.dueAt?.getTime() || 0))
    .slice(0, 4);

  const classCount = data?.length ?? 0;
  const summaryCards: Array<{ key: string; title: ReactNode; value?: number; suffix?: string }> = useMemo(
    () => [
      {
        key: 'classes',
        title: (
          <Space size={6} align="center">
            <span>{t('teacher.dashboard.classes')}</span>
            <span className="stat-chip">{t('common.realtime')}</span>
          </Space>
        ),
        value: classCount,
      },
      {
        key: 'students',
        title: (
          <Space size={6} align="center">
            <span>{t('teacher.reports.totalStudents')}</span>
            <span className="stat-chip">{t('common.realtime')}</span>
          </Space>
        ),
        value: report?.totalStudents,
      },
      {
        key: 'submissions',
        title: (
          <Space size={6} align="center">
            <span>{t('teacher.reports.submissions')}</span>
            <span className="stat-chip">{rangeDays === 7 ? t('common.last7Days') : t('common.recent')}</span>
          </Space>
        ),
        value: summary?.count,
      },
      {
        key: 'submissionRate',
        title: (
          <Space size={6} align="center">
            <span>{t('teacher.reports.submissionRate')}</span>
            <span className="stat-chip">{rangeDays === 7 ? t('common.last7Days') : t('common.recent')}</span>
          </Space>
        ),
        value: submissionRate,
        suffix: '%',
      },
    ],
    [classCount, rangeDays, report?.totalStudents, submissionRate, summary?.count, t],
  );

  return (
    <PageContainer
      title={t('nav.dashboard')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.dashboard') },
        ],
      }}
    >
      <OnboardingGuide role="TEACHER" />
      {isError ? (
        <Alert
          type="error"
          message={t('teacher.dashboard.loadError')}
          description={error instanceof Error ? error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {reportQuery.isError ? (
        <Alert
          type="error"
          message={t('teacher.reports.loadError')}
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
      {classCount === 0 && !isLoading ? (
        <SoftEmpty description={t('teacher.classes.empty')}>
          <Button type="primary" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </SoftEmpty>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard
            bordered 
            style={{ marginBottom: 4 }}
            className="chart-panel apple-soft-card"
          >
            <Space wrap>
              <Select
                placeholder={t('teacher.reports.selectClass')}
                style={{ minWidth: 220 }}
                options={classOptions}
                loading={isLoading}
                value={selectedClassId || undefined}
                onChange={(value) => setSelectedClassId(value)}
              />
              <Space>
                <Typography.Text>{t('teacher.reports.rangeDays')}</Typography.Text>
                <InputNumber min={1} max={30} value={rangeDays} onChange={(value) => setRangeDays(value || 7)} />
              </Space>
            </Space>
          </ProCard>

          <ProCard
            bordered 
            title={t('teacher.reports.insightsTitle')} 
            headerBordered
            className="chart-panel apple-soft-card"
          >
            <ProCard gutter={[24, 24]} wrap ghost>
              {summaryCards.map((card) => (
                <ProCard ghost key={card.key} colSpan={{ xs: 24, sm: 12, md: 6 }} loading={summaryLoading}>
                  <AnimatedStatistic title={<span className="apple-muted-label">{card.title}</span>} value={card.value} suffix={card.suffix} />
                  {card.key === 'classes' ? (
                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>{t('teacher.dashboard.trackClasses')}</Typography.Text>
                  ) : null}
                </ProCard>
              ))}
            </ProCard>
          </ProCard>

          <ProCard gutter={[24, 24]} wrap ghost>
            <ProCard
              bordered 
              colSpan={{ xs: 24, lg: 12 }} 
              title={t('teacher.dashboard.submissionActivity')} 
              headerBordered
              className="chart-panel apple-soft-card"
            >
              {trend.length ? (
                <List
                  dataSource={trend}
                  renderItem={(item) => (
                    <List.Item className="apple-list-row">
                      <List.Item.Meta
                        title={<span style={{ fontWeight: 500, fontSize: '15px' }}>{item.date}</span>}
                      />
                      <Space>
                        <Tag color="success" className="apple-tag-pill">{t('teacher.dashboard.avgScore')} {item.avg}</Tag>
                        <Tag color="processing" className="apple-tag-pill">{item.count} {t('teacher.reports.submissions')}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <SoftEmpty description={t('teacher.dashboard.noActivity')} />
              )}
            </ProCard>
            <ProCard
              bordered 
              colSpan={{ xs: 24, lg: 12 }} 
              title={t('teacher.dashboard.topMistakes')} 
              headerBordered
              className="chart-panel apple-soft-card"
            >
              {topErrors.length ? (
                <List
                  dataSource={topErrors}
                  renderItem={(item) => (
                    <List.Item className="apple-list-row">
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text style={{ fontWeight: 500, fontSize: '15px' }}>{localizeErrorType(item.type)}</Typography.Text>
                        <Space>
                          <Typography.Text style={{ color: 'var(--apple-primary)', fontWeight: 600 }}>{item.count}</Typography.Text>
                          <Tag color="error" className="apple-tag-pill">{item.ratio}</Tag>
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <SoftEmpty description={t('teacher.dashboard.noInsights')} />
              )}
            </ProCard>
          </ProCard>

          <ProCard
            bordered 
            title={t('teacher.dashboard.upcomingDeadlines')} 
            headerBordered
            className="chart-panel apple-soft-card"
          >
            {upcoming.length ? (
              <List
                dataSource={upcoming}
                renderItem={(item) => (
                  <List.Item className="apple-list-row">
                    <List.Item.Meta
                      title={
                        <Space>
                          <span style={{ fontWeight: 500, fontSize: '15px' }}>{item.title}</span>
                          <Tag color="warning" className="apple-tag-pill">{t('student.dashboard.dueSoon')}</Tag>
                        </Space>
                      }
                      description={<span style={{ color: 'var(--apple-text-muted)' }}>{t('common.due')}: {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : '--'}</span>}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <SoftEmpty description={t('teacher.dashboard.reviewSchedules')} />
            )}
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
