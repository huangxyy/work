import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Empty, Input, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentHomeworks } from '../../api';

type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
  class: { id: string; name: string };
};

const getStatus = (dueAt?: string | null) => {
  if (!dueAt) {
    return { key: 'nodue', label: 'No due date', color: 'default' as const };
  }
  const dueDate = new Date(dueAt);
  if (dueDate.getTime() < Date.now()) {
    return { key: 'overdue', label: 'Overdue', color: 'error' as const };
  }
  return { key: 'open', label: 'Open', color: 'success' as const };
};

export const StudentHomeworksPage = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
  });

  const filteredData = useMemo(() => {
    const list = data || [];
    return list.filter((item) => {
      const status = getStatus(item.dueAt).key;
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const needle = keyword.toLowerCase();
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.desc || '').toLowerCase().includes(needle) ||
        item.class.name.toLowerCase().includes(needle)
      );
    });
  }, [data, keyword, statusFilter]);

  const columns: ProColumns<HomeworkItem>[] = [
    {
      title: 'Homework',
      dataIndex: 'title',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{item.title}</Typography.Text>
          <Typography.Text type="secondary">Class: {item.class.name}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Due',
      dataIndex: 'dueAt',
      render: (_, item) => {
        const status = getStatus(item.dueAt);
        return (
          <Space direction="vertical" size={0}>
            <Tag color={status.color}>{status.label}</Tag>
            <Typography.Text type="secondary">
              {item.dueAt ? new Date(item.dueAt).toLocaleString() : 'Flexible deadline'}
            </Typography.Text>
          </Space>
        );
      },
      width: 220,
    },
    {
      title: 'Description',
      dataIndex: 'desc',
      renderText: (value) => value || 'No description',
      width: 280,
    },
    {
      title: 'Action',
      valueType: 'option',
      render: (_, item) => [
        <Button key="view" onClick={() => navigate(`/student/homeworks/${item.id}`)}>
          View
        </Button>,
        <Button key="submit" type="primary" onClick={() => navigate(`/student/submit/${item.id}`)}>
          Submit
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title="My Homeworks"
      breadcrumb={{
        items: [
          { title: 'Student', path: '/student/dashboard' },
          { title: 'Homeworks' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load homeworks"
          description={error instanceof Error ? error.message : 'Please try again.'}
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProCard bordered>
        <ProTable<HomeworkItem>
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          search={false}
          pagination={{ pageSize: 6 }}
          options={false}
          locale={{
            emptyText: (
              <Empty description="No homework available">
                <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                  Assignments will appear here once your teacher publishes them.
                </Typography.Paragraph>
              </Empty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              placeholder="Search homework or class"
              allowClear
              onSearch={(value) => setKeyword(value.trim())}
              style={{ width: 220 }}
            />,
            <Select
              key="status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 160 }}
              options={[
                { label: 'All statuses', value: 'all' },
                { label: 'Open', value: 'open' },
                { label: 'Overdue', value: 'overdue' },
                { label: 'No due date', value: 'nodue' },
              ]}
            />,
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};
