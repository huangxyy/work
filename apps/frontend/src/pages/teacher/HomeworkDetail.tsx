import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Empty, Space, Tabs, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
};

type SubmissionRow = {
  id: string;
  studentName: string;
  status: string;
  totalScore?: number | null;
  updatedAt?: string;
};

export const TeacherHomeworkDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { homework?: HomeworkItem; classId?: string | null } | undefined;
  const homework = state?.homework;

  const submissionsQuery = useQuery<SubmissionRow[]>({
    queryKey: ['homework-submissions', id],
    // TODO: replace placeholder with homework submissions API
    queryFn: async () => [],
    enabled: !!id,
  });

  const columns: ProColumns<SubmissionRow>[] = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      renderText: (value) => value || '--',
      width: 140,
    },
    {
      title: 'Score',
      dataIndex: 'totalScore',
      renderText: (value) => (typeof value === 'number' ? value : '--'),
      width: 120,
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      renderText: (value) => value || '--',
      width: 200,
    },
  ];

  return (
    <PageContainer
      title="Homework Detail"
      breadcrumb={{
        items: [
          { title: 'Teacher', path: '/teacher/dashboard' },
          { title: 'Homeworks', path: '/teacher/homeworks' },
          { title: homework?.title || 'Detail' },
        ],
      }}
    >
      {!homework ? (
        <Empty description="Homework details unavailable">
          <Button type="primary" onClick={() => navigate('/teacher/homeworks')}>
            Back to Homeworks
          </Button>
        </Empty>
      ) : (
        <Tabs
          items={[
            {
              key: 'overview',
              label: 'Overview',
              children: (
                <ProCard bordered>
                  <Descriptions column={1} bordered>
                    <Descriptions.Item label="Title">{homework.title}</Descriptions.Item>
                    <Descriptions.Item label="Due Date">
                      {homework.dueAt ? new Date(homework.dueAt).toLocaleString() : 'No due date'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Description">
                      {homework.desc ? (
                        <Typography.Paragraph style={{ margin: 0 }}>{homework.desc}</Typography.Paragraph>
                      ) : (
                        <Typography.Text type="secondary">No description provided.</Typography.Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Class Reference">
                      {state?.classId ? state.classId : 'Not specified'}
                    </Descriptions.Item>
                  </Descriptions>
                </ProCard>
              ),
            },
            {
              key: 'submissions',
              label: 'Submissions',
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {submissionsQuery.isError ? (
                    <Alert
                      type="error"
                      message="Failed to load submissions"
                      description={
                        submissionsQuery.error instanceof Error
                          ? submissionsQuery.error.message
                          : 'Please try again.'
                      }
                      action={
                        <Button size="small" onClick={() => submissionsQuery.refetch()}>
                          Retry
                        </Button>
                      }
                    />
                  ) : null}
                  <ProCard bordered>
                    <ProTable<SubmissionRow>
                      rowKey="id"
                      columns={columns}
                      dataSource={(submissionsQuery.data || []) as SubmissionRow[]}
                      loading={submissionsQuery.isLoading}
                      search={false}
                      pagination={{ pageSize: 8 }}
                      options={false}
                      locale={{
                        emptyText: (
                          <Empty description="No submissions yet">
                            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                              Submissions will appear here once students upload their work.
                            </Typography.Paragraph>
                          </Empty>
                        ),
                      }}
                    />
                  </ProCard>
                </Space>
              ),
            },
          ]}
        />
      )}
    </PageContainer>
  );
};
