import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Input, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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

  const columns: ProColumns<HomeworkItem>[] = [
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
            <Tag color={status.color}>{status.label}</Tag>
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
          <Button key="view" onClick={() => navigate(`/student/homeworks/${item.id}`)}>
            {t('common.view')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!canSubmit}
            onClick={() => navigate(`/student/submit/${item.id}`)}
          >
            {canSubmit ? t('common.submit') : t('student.homeworks.submitClosed')}
          </Button>,
        ];
      },
    },
  ];

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
              <SoftEmpty description={t('student.homeworks.empty')}>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                  {t('student.homeworks.emptyHint')}
                </Typography.Paragraph>
              </SoftEmpty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              placeholder={t('student.homeworks.searchPlaceholder')}
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
