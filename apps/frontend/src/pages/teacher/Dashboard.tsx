import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Empty, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchClasses } from '../../api';

export const TeacherDashboardPage = () => {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const classCount = data?.length ?? 0;

  return (
    <PageContainer
      title="Dashboard"
      breadcrumb={{
        items: [
          { title: 'Teacher', path: '/teacher/dashboard' },
          { title: 'Dashboard' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load dashboard"
          description={error instanceof Error ? error.message : 'Please try again.'}
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProCard gutter={16} wrap>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Statistic title="Classes" value={classCount} />
          <Typography.Text type="secondary">Track active classes you manage.</Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Submission Activity</Typography.Text>
          {/* TODO: connect submission analytics */}
          <Empty description="No activity data yet" />
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Average Score Trend</Typography.Text>
          {/* TODO: connect score trend analytics */}
          <Empty description="Score trend will appear here" />
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 12 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Top Mistakes</Typography.Text>
          {/* TODO: connect error analytics */}
          <Empty description="No insights yet" />
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 12 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Upcoming Deadlines</Typography.Text>
          <Empty description="Review class schedules" />
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};
