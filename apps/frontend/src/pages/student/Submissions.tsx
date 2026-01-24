import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Empty, Input, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type SubmissionRow = {
  id: string;
  homeworkTitle: string;
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  totalScore?: number | null;
  updatedAt?: string;
};

const statusMeta: Record<SubmissionRow['status'], { label: string; color: string }> = {
  QUEUED: { label: 'Queued', color: 'default' },
  PROCESSING: { label: 'Processing', color: 'processing' },
  DONE: { label: 'Done', color: 'success' },
  FAILED: { label: 'Failed', color: 'error' },
};

export const StudentSubmissionsPage = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, isError, error, refetch } = useQuery<SubmissionRow[]>({
    queryKey: ['student-submissions'],
    // TODO: replace placeholder with submissions list API
    queryFn: async () => [],
  });

  const filteredData = useMemo(() => {
    const list = (data || []) as SubmissionRow[];
    return list.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return item.homeworkTitle.toLowerCase().includes(keyword.toLowerCase());
    });
  }, [data, keyword, statusFilter]);

  const columns: ProColumns<SubmissionRow>[] = [
    {
      title: 'Homework',
      dataIndex: 'homeworkTitle',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (_, item) => {
        const meta = statusMeta[item.status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
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
    {
      title: 'Action',
      valueType: 'option',
      render: (_, item) => [
        <Button key="view" onClick={() => navigate(`/student/submission/${item.id}`)}>
          View
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title="Submissions"
      breadcrumb={{
        items: [
          { title: 'Student', path: '/student/dashboard' },
          { title: 'Submissions' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load submissions"
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
        <ProTable<SubmissionRow>
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          search={false}
          pagination={{ pageSize: 8 }}
          options={false}
          locale={{
            emptyText: (
              <Empty description="No submissions yet">
                <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                  Your submission history will appear here after you upload homework.
                </Typography.Paragraph>
              </Empty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              placeholder="Search by homework"
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
                { label: 'Queued', value: 'QUEUED' },
                { label: 'Processing', value: 'PROCESSING' },
                { label: 'Done', value: 'DONE' },
                { label: 'Failed', value: 'FAILED' },
              ]}
            />,
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};
