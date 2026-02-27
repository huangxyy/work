import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, List, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentHomeworks, fetchStudentReportOverview } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { OnboardingGuide } from '../../components/OnboardingGuide';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

const REPORT_DAYS = 7;

export const StudentDashboardPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
    staleTime: 2 * 60 * 1000,
  });
  const reportQuery = useQuery({
    queryKey: ['student-dashboard-report'],
    queryFn: () => fetchStudentReportOverview(REPORT_DAYS),
    staleTime: 2 * 60 * 1000,
  });

  const homeworkCount = data?.length ?? 0;
  const upcoming = (data || [])
    .filter((item) => item.dueAt)
    .map((item) => ({
      id: item.id,
      title: item.title,
      dueAt: item.dueAt ? new Date(item.dueAt) : null,
    }))
    .filter((item) => item.dueAt && item.dueAt.getTime() >= Date.now())
    .sort((a, b) => (a.dueAt?.getTime() || 0) - (b.dueAt?.getTime() || 0))
    .slice(0, 3);
  const upcomingDeadlineText = upcoming.length
    ? t('student.dashboard.reviewDeadlines')
    : t('student.dashboard.noUpcomingDeadlines');
  const report = reportQuery.data;
  const summary = report?.summary;
  const topErrors = useMemo(() => (report?.errorTypes || []).slice(0, 5), [report?.errorTypes]);
  const nextSteps = useMemo(() => (report?.nextSteps || []).slice(0, 5), [report?.nextSteps]);
  const summaryCards = useMemo(
    () => [
      {
        key: 'assignments',
        title: (
          <Space size={6} align="center">
            <span>{t('student.report.totalAssignments')}</span>
            <span className="stat-chip">{t('common.realtime')}</span>
          </Space>
        ),
        value: homeworkCount,
      },
      {
        key: 'submissions',
        title: (
          <Space size={6} align="center">
            <span>{t('student.report.submissions')}</span>
            <span className="stat-chip">{t('common.last7Days')}</span>
          </Space>
        ),
        value: summary?.count,
      },
      {
        key: 'avgScore',
        title: (
          <Space size={6} align="center">
            <span>{t('student.report.avgScore')}</span>
            <span className="stat-chip">{t('common.last7Days')}</span>
          </Space>
        ),
        value: summary?.avg,
      },
      {
        key: 'highestScore',
        title: (
          <Space size={6} align="center">
            <span>{t('student.report.highestScore')}</span>
            <span className="stat-chip">{t('common.last7Days')}</span>
          </Space>
        ),
        value: summary?.max,
      },
    ],
    [homeworkCount, summary?.avg, summary?.count, summary?.max, t],
  );

  return (
    <PageContainer
      title={t('nav.dashboard')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/dashboard' },
          { title: t('nav.dashboard') },
        ],
      }}
    >
      <OnboardingGuide role="STUDENT" />
      {isError ? (
        <Alert
          type="error"
          message={t('student.dashboard.loadError')}
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
          message={t('student.report.loadError')}
          description={reportQuery.error instanceof Error ? reportQuery.error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => reportQuery.refetch()}>
              {t('common.retry')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {upcoming.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={`${t('student.dashboard.pendingReminder')}: ${upcoming.length} ${t('student.dashboard.homeworksToSubmit')}`}
          description={upcoming.map((u) => u.title).join(', ')}
          action={
            <Button type="primary" size="small" onClick={() => navigate('/student/homeworks')}>
              {t('student.dashboard.goToHomeworks')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {isLoading && !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <ProCard
          bordered
          title={t('student.report.summary')}
          headerBordered
          className="chart-panel apple-soft-card"
        >
          <ProCard gutter={[24, 24]} wrap ghost>
            {summaryCards.map((card) => (
              <ProCard
                ghost
                key={card.key}
                colSpan={{ xs: 24, sm: 12, md: 6 }}
              >
                <AnimatedStatistic title={<span className="apple-muted-label">{card.title}</span>} value={card.value} />
                {card.key === 'assignments' ? (
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>{t('student.dashboard.updatedFromList')}</Typography.Text>
                ) : null}
              </ProCard>
            ))}
          </ProCard>
        </ProCard>

        <ProCard gutter={[24, 24]} wrap ghost>
          <ProCard
            bordered
            colSpan={{ xs: 24, lg: 12 }}
            title={t('student.report.errorTypes')}
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
              <SoftEmpty description={t('student.dashboard.noErrorInsights')} />
            )}
          </ProCard>
          <ProCard
            bordered
            colSpan={{ xs: 24, lg: 12 }}
            title={t('student.report.nextSteps')}
            headerBordered
            className="chart-panel apple-soft-card"
          >
            {nextSteps.length ? (
              <List
                dataSource={nextSteps}
                renderItem={(item, index) => (
                  <List.Item className="apple-list-row">
                    <List.Item.Meta
                      avatar={<Tag color="processing" className="apple-tag-pill">{index + 1}</Tag>}
                      title={<span style={{ fontWeight: 500, fontSize: '15px' }}>{item.text}</span>}
                      description={<span style={{ color: 'var(--apple-text-muted)' }}>{item.count}</span>}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <SoftEmpty description={t('student.report.noNextSteps')} />
            )}
          </ProCard>
        </ProCard>

        <ProCard
          bordered
          title={t('student.dashboard.upcomingDeadlines')}
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
                    description={<span style={{ color: 'var(--apple-text-muted)' }}>{item.dueAt ? formatDate(item.dueAt) : '--'}</span>}
                  />
                  <Button
                    type="primary"
                    onClick={() => navigate(`/student/homeworks/${item.id}`)}
                    style={{ borderRadius: '999px' }}
                  >
                    {t('student.dashboard.goToSubmit')}
                  </Button>
                </List.Item>
              )}
            />
          ) : (
            <SoftEmpty description={upcomingDeadlineText} />
          )}
        </ProCard>
      </Space>
      )}
    </PageContainer>
  );
};
