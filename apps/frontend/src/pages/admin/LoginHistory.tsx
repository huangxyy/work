import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Select, Space, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: 'green',
  LOGIN_FAILED: 'orange',
  LOGIN_LOCKED: 'red',
  LOGOUT: 'default',
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'admin.auditLogs.actionLoginSuccess',
  LOGIN_FAILED: 'admin.auditLogs.actionLoginFailed',
  LOGIN_LOCKED: 'admin.auditLogs.actionLoginLocked',
  LOGOUT: 'admin.auditLogs.actionLogout',
};

const localizeAction = (action: string, t: (key: string) => string): string => {
  const key = ACTION_LABELS[action];
  return key ? t(key) : action;
};

export const AdminLoginHistoryPage = () => {
  const { t } = useI18n();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const loginActions = useMemo(() => Object.keys(ACTION_COLORS), []);

  const logsQuery = useQuery({
    queryKey: ['admin-login-history', page, actionFilter],
    queryFn: async () => {
      const res = await api.get('/admin/audit-logs', {
        params: {
          limit: 50,
          offset: (page - 1) * 50,
          ...(actionFilter ? { action: actionFilter } : { actions: loginActions.join(',') }),
        },
      });
      return res.data;
    },
    staleTime: 15_000,
  });

  const loginLogs = useMemo(() => {
    return logsQuery.data || [];
  }, [logsQuery.data]);

  const columns = useMemo(() => [
    { title: t('admin.auditLogs.time'), dataIndex: 'createdAt', render: (v: string) => formatDate(v), width: 180 },
    { title: t('admin.auditLogs.action'), dataIndex: 'action', render: (v: string) => <Tag color={ACTION_COLORS[v] || 'default'} className="apple-tag-pill">{localizeAction(v, t)}</Tag>, width: 160 },
    { title: 'IP', dataIndex: 'ip', width: 140, render: (v: string) => v || '--' },
    { title: t('admin.auditLogs.detail'), dataIndex: 'detail', ellipsis: true },
  ], [t]);

  return (
    <PageContainer title={t('admin.loginHistory.title')}>
      {logsQuery.isError ? (
        <Alert type="error" message={t('common.loadError')} action={<Button size="small" onClick={() => logsQuery.refetch()}>{t('common.retry')}</Button>} className="apple-inline-alert" />
      ) : null}
      <ProCard bordered className="apple-soft-card">
        <Space className="apple-toolbar" style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder={t('admin.loginHistory.filterAction')}
            value={actionFilter}
            onChange={(value) => {
              setActionFilter(value);
              setPage(1);
            }}
            style={{ width: 200 }}
            options={[
              { label: t('admin.loginHistory.success'), value: 'LOGIN_SUCCESS' },
              { label: t('admin.loginHistory.failed'), value: 'LOGIN_FAILED' },
              { label: t('admin.loginHistory.locked'), value: 'LOGIN_LOCKED' },
              { label: t('admin.loginHistory.logout'), value: 'LOGOUT' },
            ]}
          />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={loginLogs}
          loading={logsQuery.isLoading}
          pagination={{ current: page, pageSize: 50, onChange: setPage }}
          size="small"
        />
      </ProCard>
    </PageContainer>
  );
};
