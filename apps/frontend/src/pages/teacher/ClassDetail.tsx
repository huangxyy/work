import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchClassStudents, fetchClasses, fetchHomeworksByClass } from '../../api';

type StudentRow = {
  id: string;
  account: string;
  name: string;
};

type HomeworkRow = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
};

export const TeacherClassDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const classItem = useMemo(
    () => (classesQuery.data || []).find((klass) => klass.id === id),
    [classesQuery.data, id],
  );

  const studentsQuery = useQuery({
    queryKey: ['class-students', id],
    queryFn: () => fetchClassStudents(id || ''),
    enabled: !!id,
  });

  const homeworksQuery = useQuery({
    queryKey: ['homeworks', id],
    queryFn: () => fetchHomeworksByClass(id || ''),
    enabled: !!id,
  });

  const studentColumns: ProColumns<StudentRow>[] = [
    {
      title: 'Student Name',
      dataIndex: 'name',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Account',
      dataIndex: 'account',
    },
  ];

  const homeworkColumns: ProColumns<HomeworkRow>[] = [
    {
      title: 'Homework',
      dataIndex: 'title',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Due',
      dataIndex: 'dueAt',
      renderText: (value) => (value ? new Date(value).toLocaleString() : 'No due date'),
      width: 220,
    },
    {
      title: 'Action',
      valueType: 'option',
      render: (_, item) => [
        <Button
          key="detail"
          onClick={() => navigate(`/teacher/homeworks/${item.id}`, { state: { homework: item, classId: id } })}
        >
          View
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title="Class Detail"
      breadcrumb={{
        items: [
          { title: 'Teacher', path: '/teacher/dashboard' },
          { title: 'Classes', path: '/teacher/classes' },
          { title: classItem?.name || 'Detail' },
        ],
      }}
    >
      {classesQuery.isError ? (
        <Alert
          type="error"
          message="Failed to load class"
          description={
            classesQuery.error instanceof Error
              ? classesQuery.error.message
              : 'Please try again.'
          }
          action={
            <Button size="small" onClick={() => classesQuery.refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {classesQuery.isLoading && !classesQuery.data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !classItem ? (
        <Empty description="Class not found">
          <Button type="primary" onClick={() => navigate('/teacher/classes')}>
            Back to Classes
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
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Descriptions column={1} bordered>
                      <Descriptions.Item label="Class Name">{classItem.name}</Descriptions.Item>
                      <Descriptions.Item label="Grade">
                        {classItem.grade ? <Tag>{classItem.grade}</Tag> : 'Unassigned'}
                      </Descriptions.Item>
                    </Descriptions>
                    <ProCard gutter={16} wrap>
                      <ProCard bordered colSpan={{ xs: 24, md: 12 }}>
                        <Typography.Text type="secondary">Students</Typography.Text>
                        <Typography.Title level={3} style={{ margin: '8px 0 0' }}>
                          {studentsQuery.data?.length ?? 0}
                        </Typography.Title>
                      </ProCard>
                      <ProCard bordered colSpan={{ xs: 24, md: 12 }}>
                        <Typography.Text type="secondary">Homeworks</Typography.Text>
                        <Typography.Title level={3} style={{ margin: '8px 0 0' }}>
                          {homeworksQuery.data?.length ?? 0}
                        </Typography.Title>
                      </ProCard>
                    </ProCard>
                  </Space>
                </ProCard>
              ),
            },
            {
              key: 'students',
              label: 'Students',
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {studentsQuery.isError ? (
                    <Alert
                      type="error"
                      message="Failed to load students"
                      description={
                        studentsQuery.error instanceof Error
                          ? studentsQuery.error.message
                          : 'Please try again.'
                      }
                      action={
                        <Button size="small" onClick={() => studentsQuery.refetch()}>
                          Retry
                        </Button>
                      }
                    />
                  ) : null}
                  <ProCard bordered>
                    <ProTable<StudentRow>
                      rowKey="id"
                      columns={studentColumns}
                      dataSource={studentsQuery.data || []}
                      loading={studentsQuery.isLoading}
                      search={false}
                      pagination={{ pageSize: 8 }}
                      options={false}
                      locale={{ emptyText: <Empty description="No students yet" /> }}
                    />
                  </ProCard>
                </Space>
              ),
            },
            {
              key: 'homeworks',
              label: 'Homeworks',
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {homeworksQuery.isError ? (
                    <Alert
                      type="error"
                      message="Failed to load homeworks"
                      description={
                        homeworksQuery.error instanceof Error
                          ? homeworksQuery.error.message
                          : 'Please try again.'
                      }
                      action={
                        <Button size="small" onClick={() => homeworksQuery.refetch()}>
                          Retry
                        </Button>
                      }
                    />
                  ) : null}
                  <ProCard bordered>
                    <ProTable<HomeworkRow>
                      rowKey="id"
                      columns={homeworkColumns}
                      dataSource={homeworksQuery.data || []}
                      loading={homeworksQuery.isLoading}
                      search={false}
                      pagination={{ pageSize: 6 }}
                      options={false}
                      locale={{ emptyText: <Empty description="No homeworks yet" /> }}
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
