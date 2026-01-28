import type { ProColumns } from '@ant-design/pro-components';
import { ModalForm, PageContainer, ProCard, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Empty, Input, Select, Space, Switch, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  createAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
} from '../../api';
import { useI18n } from '../../i18n';

export const AdminUsersPage = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const roleMeta = useMemo(
    () => ({
      STUDENT: { label: t('role.student'), color: 'blue' },
      TEACHER: { label: t('role.teacher'), color: 'green' },
      ADMIN: { label: t('role.admin'), color: 'gold' },
    }),
    [t],
  );

  const { data, isLoading, isError, error, refetch } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => fetchAdminUsers(),
  });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success(t('admin.users.createSuccess'));
    },
    onError: () => message.error(t('admin.users.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { role?: 'STUDENT' | 'TEACHER' | 'ADMIN'; isActive?: boolean };
    }) => updateAdminUser(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success(t('admin.users.updateSuccess'));
    },
    onError: () => message.error(t('admin.users.updateFailed')),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      resetAdminUserPassword(id, password),
    onSuccess: () => message.success(t('admin.users.resetSuccess')),
    onError: () => message.error(t('admin.users.resetFailed')),
  });

  const filteredData = useMemo(() => {
    const list = (data || []) as AdminUser[];
    return list.filter((item) => {
      if (roleFilter !== 'all' && item.role !== roleFilter) {
        return false;
      }
      if (statusFilter !== 'all' && String(item.isActive) !== statusFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const needle = keyword.toLowerCase();
      return item.name.toLowerCase().includes(needle) || item.account.toLowerCase().includes(needle);
    });
  }, [data, keyword, roleFilter, statusFilter]);

  const columns: ProColumns<AdminUser>[] = [
    {
      title: t('admin.users.name'),
      dataIndex: 'name',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('common.account'),
      dataIndex: 'account',
    },
    {
      title: t('admin.users.role'),
      dataIndex: 'role',
      render: (_, item) => {
        const meta = roleMeta[item.role];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
      width: 160,
    },
    {
      title: t('admin.users.status'),
      dataIndex: 'isActive',
      render: (value) =>
        value ? <Tag color="green">{t('admin.users.active')}</Tag> : <Tag>{t('common.disabled')}</Tag>,
      width: 140,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, item) => [
        <ModalForm
          key="role"
          title={t('admin.users.changeRole')}
          trigger={<Button size="small">{t('admin.users.changeRole')}</Button>}
          onFinish={async (values) => {
            try {
              await updateMutation.mutateAsync({
                id: item.id,
                payload: { role: values.role as 'STUDENT' | 'TEACHER' | 'ADMIN' },
              });
              return true;
            } catch {
              return false;
            }
          }}
          modalProps={{ destroyOnClose: true }}
        >
          <ProFormSelect
            name="role"
            label={t('admin.users.role')}
            initialValue={item.role}
            options={[
              { label: t('role.student'), value: 'STUDENT' },
              { label: t('role.teacher'), value: 'TEACHER' },
              { label: t('role.admin'), value: 'ADMIN' },
            ]}
          />
        </ModalForm>,
        <ModalForm
          key="reset"
          title={t('admin.users.resetPassword')}
          trigger={<Button size="small">{t('admin.users.resetPassword')}</Button>}
          onFinish={async (values) => {
            try {
              await resetPasswordMutation.mutateAsync({
                id: item.id,
                password: values.password as string,
              });
              return true;
            } catch {
              return false;
            }
          }}
          modalProps={{ destroyOnClose: true }}
        >
          <ProFormText.Password
            name="password"
            label={t('admin.users.newPassword')}
            rules={[{ required: true, message: t('admin.users.passwordRequired') }]}
          />
        </ModalForm>,
        <Space key="status" size={6}>
          <Typography.Text>{t('admin.users.status')}</Typography.Text>
          <Switch
            size="small"
            checked={item.isActive}
            onChange={(checked) =>
              updateMutation.mutate({ id: item.id, payload: { isActive: checked } })
            }
          />
        </Space>,
      ],
    },
  ];

  return (
    <PageContainer
      title={t('nav.users')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.users') },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message={t('admin.users.loadError')}
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
        <ProTable<AdminUser>
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          search={false}
          pagination={{ pageSize: 8 }}
          options={false}
          locale={{
            emptyText: (
              <Empty description={t('admin.users.empty')}>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                  {t('admin.users.emptyHint')}
                </Typography.Paragraph>
              </Empty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              placeholder={t('admin.users.searchPlaceholder')}
              allowClear
              onSearch={(value) => setKeyword(value.trim())}
              style={{ width: 220 }}
            />,
            <Select
              key="role"
              value={roleFilter}
              onChange={(value) => setRoleFilter(value)}
              style={{ width: 160 }}
              options={[
                { label: t('common.allRoles'), value: 'all' },
                { label: t('role.student'), value: 'STUDENT' },
                { label: t('role.teacher'), value: 'TEACHER' },
                { label: t('role.admin'), value: 'ADMIN' },
              ]}
            />,
            <Select
              key="status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 160 }}
              options={[
                { label: t('common.allStatuses'), value: 'all' },
                { label: t('admin.users.active'), value: 'true' },
                { label: t('common.disabled'), value: 'false' },
              ]}
            />,
            <ModalForm
              key="create"
              title={t('admin.users.createUser')}
              trigger={<Button type="primary">{t('admin.users.createUser')}</Button>}
              onFinish={async (values) => {
                try {
                  await createMutation.mutateAsync({
                    account: values.account as string,
                    name: values.name as string,
                    role: values.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
                    password: values.password as string,
                  });
                  return true;
                } catch {
                  return false;
                }
              }}
              modalProps={{ destroyOnClose: true }}
            >
              <ProFormText
                name="account"
                label={t('common.account')}
                placeholder={t('admin.users.accountPlaceholder')}
                rules={[{ required: true, message: t('admin.users.accountRequired') }]}
              />
              <ProFormText
                name="name"
                label={t('admin.users.name')}
                placeholder={t('admin.users.namePlaceholder')}
                rules={[{ required: true, message: t('admin.users.nameRequired') }]}
              />
              <ProFormSelect
                name="role"
                label={t('admin.users.role')}
                initialValue="STUDENT"
                options={[
                  { label: t('role.student'), value: 'STUDENT' },
                  { label: t('role.teacher'), value: 'TEACHER' },
                  { label: t('role.admin'), value: 'ADMIN' },
                ]}
              />
              <ProFormText.Password
                name="password"
                label={t('admin.users.password')}
                rules={[{ required: true, message: t('admin.users.passwordRequired') }]}
              />
            </ModalForm>,
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};
