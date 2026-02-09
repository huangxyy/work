import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, List, Progress, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchStudentHomeworks, fetchStudentReportOverview } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

export const StudentDashboardPage = () => {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
  });
  const reportQuery = useQuery({
    queryKey: ['student-dashboard-report'],
    queryFn: () => fetchStudentReportOverview(7),
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
            <span>{t('student.dashboard.assignmentsAvailable')}</span>
            <span className="stat-chip">{t('common.realtime')}</span>
          </Space>
        ),
        value: homeworkCount,
      },
      {
        key: 'submissions',
        title: (
          <Space size={6} align="center">
            <span>{t('student.dashboard.weeklySubmissions')}</span>
            <span className="stat-chip">{t('common.last7Days')}</span>
          </Space>
        ),
        value: summary?.count,
      },
      {
        key: 'avg',
        title: (
          <Space size={6} align="center">
            <span>{t('student.report.avgScore')}</span>
            <span className="stat-chip">{t('common.last7Days')}</span>
          </Space>
        ),
        value: summary?.avg,
      },
      {
        key: 'max',
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

  const getDueStatus = (dueAt?: Date | null) => {
    if (!dueAt) {
      return { label: t('status.noDue'), color: 'default' as const };
    }
    if (dueAt.getTime() < Date.now()) {
      return { label: t('status.overdue'), color: 'error' as const };
    }
    return { label: t('status.open'), color: 'success' as const };
  };

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
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <ProCard bordered title={t('student.report.summary')}>
          <ProCard gutter={16} wrap>
            {summaryCards.map((card) => (
              <ProCard
                bordered
                key={card.key}
                colSpan={{ xs: 24, sm: 12, md: 6 }}
                loading={isLoading && !data}
              >
                <AnimatedStatistic title={card.title} value={card.value} />
                {card.key === 'assignments' ? (
                  <Typography.Text type="secondary">{t('student.dashboard.updatedFromList')}</Typography.Text>
                ) : null}
              </ProCard>
            ))}
          </ProCard>
        </ProCard>

        <ProCard gutter={16} wrap>
          <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.errorTypes')}>
            {topErrors.length ? (
              <List
                dataSource={topErrors}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text>{localizeErrorType(item.type)}</Typography.Text>
                        <Tag>{item.count}</Tag>
                      </Space>
                      <Progress
                        percent={Math.round(item.ratio * 100)}
                        showInfo={false}
                        strokeColor="#1d4ed8"
                      />
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <SoftEmpty description={t('student.dashboard.noErrorInsights')} />
            )}
          </ProCard>
          <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('student.report.nextSteps')}>
            {nextSteps.length ? (
              <List
                dataSource={nextSteps}
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
        </ProCard>

        <ProCard bordered title={t('student.dashboard.upcomingDeadlines')}>
          {upcoming.length ? (
            <List
              dataSource={upcoming}
              renderItem={(item) => {
                const status = getDueStatus(item.dueAt);
                return (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{item.title}</Typography.Text>
                        <Typography.Text type="secondary">
                          {item.dueAt ? formatDate(item.dueAt) : '--'}
                        </Typography.Text>
                      </Space>
                      <Tag color={status.color}>{status.label}</Tag>
                    </Space>
                  </List.Item>
                );
              }}
            />
          ) : (
            <SoftEmpty description={upcomingDeadlineText} />
          )}
        </ProCard>
      </Space>
    </PageContainer>
  );
};
