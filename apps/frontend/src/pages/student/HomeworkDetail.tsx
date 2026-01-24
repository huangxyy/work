import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchStudentHomeworks } from '../../api';

export const StudentHomeworkDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
  });

  const homework = useMemo(
    () => (data || []).find((item) => item.id === id),
    [data, id],
  );

  const dueAtLabel = homework?.dueAt ? new Date(homework.dueAt).toLocaleString() : 'Flexible';
  const dueTag = homework?.dueAt
    ? new Date(homework.dueAt).getTime() < Date.now()
      ? 'Overdue'
      : 'Open'
    : 'No due date';

  return (
    <PageContainer
      title="Homework Detail"
      breadcrumb={{
        items: [
          { title: 'Student', path: '/student/dashboard' },
          { title: 'Homeworks', path: '/student/homeworks' },
          { title: 'Detail' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load homework"
          description={error instanceof Error ? error.message : 'Please try again.'}
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {isLoading && !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !homework ? (
        <Empty description="Homework not found">
          <Button type="primary" onClick={() => navigate('/student/homeworks')}>
            Back to Homeworks
          </Button>
        </Empty>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard
            bordered
            title={homework.title}
            extra={
              <Button type="primary" onClick={() => navigate(`/student/submit/${homework.id}`)}>
                Submit Homework
              </Button>
            }
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Class">{homework.class.name}</Descriptions.Item>
              <Descriptions.Item label="Due Date">{dueAtLabel}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag>{dueTag}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {homework.desc ? (
                  <Typography.Paragraph style={{ margin: 0 }}>{homework.desc}</Typography.Paragraph>
                ) : (
                  <Typography.Text type="secondary">No description provided.</Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </ProCard>
          <ProCard
            bordered
            title="Submission History"
            extra={
              <Button onClick={() => navigate('/student/submissions')}>
                View All Submissions
              </Button>
            }
          >
            {/* TODO: connect submission history API for homework */}
            <Empty description="No submission history available" />
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
