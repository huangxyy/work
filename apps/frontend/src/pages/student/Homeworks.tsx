import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Input, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentHomeworks } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
  allowLateSubmission?: boolean;
  class: { id: string; name: string };
};

const getStatus = (t: (key: string) => string, dueAt?: string | null, allowLateSubmission?: boolean) => {
  if (!dueAt) {
    return { key: 'nodue', label: t('status.noDue'), color: 'default' as const };
  }
  const dueDate = new Date(dueAt);
  if (dueDate.getTime() < Date.now()) {
    if (allowLateSubmission) {
      return { key: 'lateOpen', label: t('status.lateOpen'), color: 'warning' as const };
    }
    return { key: 'overdue', label: t('status.overdue'), color: 'error' as const };
  }
  return { key: 'open', label: t('status.open'), color: 'success' as const };
};

export const StudentHomeworksPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
    staleTime: 2 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    const list = data || [];
    return list.filter((item) => {
      const status = getStatus(t, item.dueAt, item.allowLateSubmission).key;
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
  }, [data, keyword, statusFilter, t]);

  const handleView = useCallback((id: string) => navigate(`/student/homeworks/${id}`), [navigate]);
  const handleSubmit = useCallback((id: string) => navigate(`/student/submit/${id}`), [navigate]);

  const columns = useMemo<ProColumns<HomeworkItem>[]>(() => [
    {
      title: t('common.homework'),
      dataIndex: 'title',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{item.title}</Typography.Text>
          <Typography.Text type="secondary">
            {t('common.class')}: {item.class.name}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: t('common.due'),
      dataIndex: 'dueAt',
      render: (_, item) => {
        const status = getStatus(t, item.dueAt, item.allowLateSubmission);
        return (
          <Space direction="vertical" size={0}>
            <Tag color={status.color} className="apple-tag-pill">{status.label}</Tag>
            <Typography.Text type="secondary">
              {item.dueAt ? formatDate(item.dueAt) : t('student.homeworks.flexibleDeadline')}
            </Typography.Text>
          </Space>
        );
      },
      width: 220,
    },
    {
      title: t('common.description'),
      dataIndex: 'desc',
      renderText: (value) => value || t('common.noDescription'),
      width: 280,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, item) => {
        const canSubmit = getStatus(t, item.dueAt, item.allowLateSubmission).key !== 'overdue';
        return [
          <Button key="view" onClick={() => handleView(item.id)}>
            {t('common.view')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!canSubmit}
            onClick={() => handleSubmit(item.id)}
          >
            {canSubmit ? t('common.submit') : t('student.homeworks.submitClosed')}
          </Button>,
        ];
      },
    },
  ], [t, handleView, handleSubmit]);

  return (
    <PageContainer
      title={t('student.homeworks.title')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/dashboard' },
          { title: t('nav.homeworks') },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message={t('student.homeworks.loadError')}
          description={error instanceof Error ? error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : null}
      <ProCard bordered className="apple-soft-card">
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
              <SoftEmpty description={t('student.homeworks.empty')}>
                <Typography.Paragraph type="secondary" className="apple-empty-hint">
                  {t('student.homeworks.emptyHint')}
                </Typography.Paragraph>
              </SoftEmpty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              className="apple-toolbar-search"
              placeholder={t('student.homeworks.searchPlaceholder')}
              allowClear
              onSearch={(value) => setKeyword(value.trim())}
            />,
            <Select
              key="status"
              className="apple-toolbar-select"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { label: t('common.allStatuses'), value: 'all' },
                { label: t('status.open'), value: 'open' },
                { label: t('status.lateOpen'), value: 'lateOpen' },
                { label: t('status.overdue'), value: 'overdue' },
                { label: t('status.noDue'), value: 'nodue' },
              ]}
            />,
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};
