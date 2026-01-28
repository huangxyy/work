import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Empty, Input, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentSubmissions } from '../../api';
import { useI18n } from '../../i18n';

type SubmissionRow = {
  id: string;
  homeworkTitle: string;
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  totalScore?: number | null;
  updatedAt?: string;
};

export const StudentSubmissionsPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const statusMeta = useMemo(
    () => ({
      QUEUED: { label: t('status.queued'), color: 'default' },
      PROCESSING: { label: t('status.processing'), color: 'processing' },
      DONE: { label: t('status.done'), color: 'success' },
      FAILED: { label: t('status.failed'), color: 'error' },
    }),
    [t],
  );

  const { data, isLoading, isError, error, refetch } = useQuery<SubmissionRow[]>({
    queryKey: ['student-submissions'],
    queryFn: fetchStudentSubmissions,
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
      title: t('common.homework'),
      dataIndex: 'homeworkTitle',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, item) => {
        const meta = statusMeta[item.status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
      width: 140,
    },
    {
      title: t('common.score'),
      dataIndex: 'totalScore',
      renderText: (value) => (typeof value === 'number' ? value : '--'),
      width: 120,
    },
    {
      title: t('common.lastUpdated'),
      dataIndex: 'updatedAt',
      renderText: (value) => value || '--',
      width: 200,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, item) => [
        <Button key="view" onClick={() => navigate(`/student/submission/${item.id}`)}>
          {t('common.view')}
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title={t('nav.submissions')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/dashboard' },
          { title: t('nav.submissions') },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message={t('student.submissions.loadError')}
          description={error instanceof Error ? error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('common.retry')}
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
              <Empty description={t('student.submissions.empty')}>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                  {t('student.submissions.emptyHint')}
                </Typography.Paragraph>
              </Empty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              placeholder={t('student.submissions.searchPlaceholder')}
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
                { label: t('common.allStatuses'), value: 'all' },
                { label: t('status.queued'), value: 'QUEUED' },
                { label: t('status.processing'), value: 'PROCESSING' },
                { label: t('status.done'), value: 'DONE' },
                { label: t('status.failed'), value: 'FAILED' },
              ]}
            />,
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};
