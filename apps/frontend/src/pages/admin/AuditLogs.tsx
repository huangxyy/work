import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Select, Space, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: 'green', LOGIN_FAILED: 'orange', LOGIN_LOCKED: 'red',
  LOGOUT: 'default', REGISTER: 'blue', PASSWORD_CHANGE: 'purple',
  PASSWORD_RESET: 'purple', ROLE_CHANGE: 'gold', USER_DELETE: 'red',
  USER_CREATE: 'blue', CONFIG_UPDATE: 'cyan', DATA_DELETE: 'red',
  ADMIN_ACTION: 'gold',
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'admin.auditLogs.actionLoginSuccess',
  LOGIN_FAILED: 'admin.auditLogs.actionLoginFailed',
  LOGIN_LOCKED: 'admin.auditLogs.actionLoginLocked',
  LOGOUT: 'admin.auditLogs.actionLogout',
  REGISTER: 'admin.auditLogs.actionRegister',
  PASSWORD_CHANGE: 'admin.auditLogs.actionPasswordChange',
  PASSWORD_RESET: 'admin.auditLogs.actionPasswordReset',
  ROLE_CHANGE: 'admin.auditLogs.actionRoleChange',
  USER_DELETE: 'admin.auditLogs.actionUserDelete',
  USER_CREATE: 'admin.auditLogs.actionUserCreate',
  CONFIG_UPDATE: 'admin.auditLogs.actionConfigUpdate',
  DATA_DELETE: 'admin.auditLogs.actionDataDelete',
  ADMIN_ACTION: 'admin.auditLogs.actionAdminAction',
};

const localizeAction = (action: string, t: (key: string) => string): string => {
  const key = ACTION_LABELS[action];
  return key ? t(key) : action;
};

export const AdminAuditLogsPage = () => {
  const { t } = useI18n();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const logsQuery = useQuery({
    queryKey: ['admin-audit-logs', page, actionFilter],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const res = await api.get('/admin/audit-logs', {
        params: {
          limit: pageSize,
          offset,
          ...(actionFilter ? { action: actionFilter } : {}),
        },
      });
      return res.data;
    },
    staleTime: 15_000,
  });

  const filteredLogs = useMemo(() => logsQuery.data || [], [logsQuery.data]);

  const columns = useMemo(() => [
    { title: t('admin.auditLogs.time'), dataIndex: 'createdAt', render: (v: string) => formatDate(v), width: 180 },
    { title: t('admin.auditLogs.action'), dataIndex: 'action', render: (v: string) => <Tag color={ACTION_COLORS[v] || 'default'} className="apple-tag-pill">{localizeAction(v, t)}</Tag>, width: 160 },
    { title: t('admin.auditLogs.userId'), dataIndex: 'userId', width: 200, render: (v: string) => v || '--' },
    { title: t('admin.auditLogs.targetId'), dataIndex: 'targetId', width: 200, render: (v: string) => v || '--' },
    { title: 'IP', dataIndex: 'ip', width: 140, render: (v: string) => v || '--' },
    { title: t('admin.auditLogs.detail'), dataIndex: 'detail', ellipsis: true },
  ], [t]);

  return (
    <PageContainer title={t('admin.auditLogs.title')}>
      {logsQuery.isError ? (
        <Alert type="error" message={t('common.loadError')} action={<Button size="small" onClick={() => logsQuery.refetch()}>{t('common.retry')}</Button>} className="apple-inline-alert" />
      ) : null}
      <ProCard bordered className="apple-soft-card">
        <Space className="apple-toolbar" style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder={t('admin.auditLogs.filterAction')}
            value={actionFilter}
            onChange={(v) => { setActionFilter(v); setPage(1); }}
            style={{ width: 200 }}
            options={Object.keys(ACTION_COLORS).map(k => ({ label: k, value: k }))}
          />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredLogs}
          loading={logsQuery.isLoading}
          pagination={{ current: page, pageSize, onChange: setPage, showSizeChanger: false }}
          size="small"
        />
      </ProCard>
    </PageContainer>
  );
};
