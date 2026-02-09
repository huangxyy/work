import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, InputNumber, List, Progress, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchClasses, fetchHomeworksSummaryByClass, fetchTeacherClassReportOverview } from '../../api';
import { AnimatedStatistic } from '../../components/AnimatedStatistic';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

export const TeacherDashboardPage = () => {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
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
  });

  const report = reportQuery.data;
  const summary = report?.summary;
  const submissionRate = report?.submissionRate ? Number((report.submissionRate * 100).toFixed(1)) : 0;
  const topErrors = (report?.errorTypes || []).slice(0, 5);
  const trend = (report?.trend || []).slice(-7).reverse();
  const maxTrendCount = Math.max(...trend.map((item) => item.count), 1);
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
  const summaryCards: Array<{ key: string; title: ReactNode; value?: number; suffix?: string }> = [
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
  ];

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
          <ProCard bordered style={{ marginBottom: 4 }}>
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

          <ProCard bordered title={t('teacher.reports.insightsTitle')}>
            <ProCard gutter={16} wrap>
              {summaryCards.map((card) => (
                <ProCard bordered key={card.key} colSpan={{ xs: 24, sm: 12, md: 6 }} loading={summaryLoading}>
                  <AnimatedStatistic title={card.title} value={card.value} suffix={card.suffix} />
                  {card.key === 'classes' ? (
                    <Typography.Text type="secondary">{t('teacher.dashboard.trackClasses')}</Typography.Text>
                  ) : null}
                </ProCard>
              ))}
            </ProCard>
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.dashboard.submissionActivity')}>
              {trend.length ? (
                <List
                  dataSource={trend}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction="vertical" style={{ width: '100%' }} size={6}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text>{item.date}</Typography.Text>
                          <Typography.Text type="secondary">
                            {t('common.avgShort')} {item.avg}
                          </Typography.Text>
                        </Space>
                        <Progress
                          percent={Math.round((item.count / maxTrendCount) * 100)}
                          showInfo={false}
                        />
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <SoftEmpty description={t('teacher.dashboard.noActivity')} />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title={t('teacher.dashboard.topMistakes')}>
              {topErrors.length ? (
                <List
                  dataSource={topErrors}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction="vertical" style={{ width: '100%' }} size={6}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text>{localizeErrorType(item.type)}</Typography.Text>
                          <Tag>{item.count}</Tag>
                        </Space>
                        <Progress percent={Math.round(item.ratio * 100)} showInfo={false} />
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <SoftEmpty description={t('teacher.dashboard.noInsights')} />
              )}
            </ProCard>
          </ProCard>

          <ProCard bordered title={t('teacher.dashboard.upcomingDeadlines')}>
            {upcoming.length ? (
              <List
                dataSource={upcoming}
                renderItem={(item) => (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{item.title}</Typography.Text>
                        <Typography.Text type="secondary">
                          {item.dueAt ? formatDate(item.dueAt) : '--'}
                        </Typography.Text>
                      </Space>
                      <Tag>{`${item.pending}/${item.total}`}</Tag>
                    </Space>
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
