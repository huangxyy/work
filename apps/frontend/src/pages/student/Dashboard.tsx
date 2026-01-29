import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Empty, List, Space, Statistic, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchStudentHomeworks, fetchStudentReportOverview } from '../../api';
import { useI18n } from '../../i18n';

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
  const topErrors = (report?.errorTypes || []).slice(0, 5);

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
      <ProCard gutter={16} wrap>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Statistic title={t('student.dashboard.assignmentsAvailable')} value={homeworkCount} />
          <Typography.Text type="secondary">{t('student.dashboard.updatedFromList')}</Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">{t('student.dashboard.weeklySubmissions')}</Typography.Text>
          {report ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic value={report.summary.count} />
              <Typography.Text type="secondary">
                {t('common.avgShort')} {report.summary.avg}
              </Typography.Text>
            </Space>
          ) : (
            <Empty description={t('student.dashboard.noSubmissionSummary')} />
          )}
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">{t('student.dashboard.avgScoreTrend')}</Typography.Text>
          {report ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic value={report.summary.avg} />
              <Typography.Text type="secondary">{t('student.dashboard.scoreTrendPlaceholder')}</Typography.Text>
            </Space>
          ) : (
            <Empty description={t('student.dashboard.scoreTrendPlaceholder')} />
          )}
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 12 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">{t('student.dashboard.topErrorTypes')}</Typography.Text>
          {topErrors.length ? (
            <List
              dataSource={topErrors}
              renderItem={(item) => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text>{item.type}</Typography.Text>
                    <Tag>{item.count}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Empty description={t('student.dashboard.noErrorInsights')} />
          )}
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 12 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">{t('student.dashboard.upcomingDeadlines')}</Typography.Text>
          {upcoming.length ? (
            <List
              dataSource={upcoming}
              renderItem={(item) => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text>{item.title}</Typography.Text>
                    <Typography.Text type="secondary">
                      {item.dueAt ? item.dueAt.toLocaleString() : '--'}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Empty description={upcomingDeadlineText} />
          )}
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};
