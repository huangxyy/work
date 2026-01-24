import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Empty, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchStudentHomeworks } from '../../api';

export const StudentDashboardPage = () => {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
  });

  const homeworkCount = data?.length ?? 0;

  return (
    <PageContainer
      title="Dashboard"
      breadcrumb={{
        items: [
          { title: 'Student', path: '/student/dashboard' },
          { title: 'Dashboard' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load dashboard data"
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
          <Statistic title="Assignments Available" value={homeworkCount} />
          <Typography.Text type="secondary">
            Updated from your latest homework list.
          </Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Weekly Submissions</Typography.Text>
          {/* TODO: connect submissions summary API */}
          <Empty description="No submission summary yet" />
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Average Score Trend</Typography.Text>
          {/* TODO: connect scoring trend API */}
          <Empty description="Score trend will appear here" />
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 12 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Top Error Types</Typography.Text>
          {/* TODO: connect top error analytics */}
          <Empty description="No error insights yet" />
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 12 }} loading={isLoading && !data}>
          <Typography.Text type="secondary">Upcoming Deadlines</Typography.Text>
          <Empty description={homeworkCount ? 'Review deadlines in Homeworks' : 'No upcoming deadlines'} />
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};
