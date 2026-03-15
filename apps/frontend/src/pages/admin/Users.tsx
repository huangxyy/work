import type { ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Input, Popconfirm, Select, Space, Switch, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  bulkImportUsers,
  createAdminUser,
  deleteAdminUser,
  fetchClasses,
  fetchAdminUsers,
  importClassStudents,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
} from '../../api';
import { api } from '../../api/client';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

export const AdminUsersPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

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
    staleTime: 2 * 60 * 1000,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    staleTime: 10 * 60 * 1000,
  });

  const classOptions = useMemo(
    () =>
      (classesQuery.data || []).map((klass: { id: string; name: string }) => ({
        label: klass.name,
        value: klass.id,
      })),
    [classesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-class-summaries'] });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      message.success(t('admin.users.createSuccess'));
    },
    onError: () => message.error(t('admin.users.createFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminUser(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-class-summaries'] });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      message.success(t('admin.users.deleteSuccess'));
    },
    onError: () => message.error(t('admin.users.deleteFailed')),
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

  const assignMutation = useMutation({
    mutationFn: ({ classId, account, name }: { classId: string; account: string; name: string }) =>
      importClassStudents(classId, { students: [{ account, name }] }),
    onSuccess: () => message.success(t('admin.users.assignSuccess')),
    onError: () => message.error(t('admin.users.assignFailed')),
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

  const columns = useMemo<ProColumns<AdminUser>[]>(() => [
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
        return <Tag color={meta?.color} className="apple-tag-pill">{meta?.label}</Tag>;
      },
      width: 160,
    },
    {
      title: t('admin.users.status'),
      dataIndex: 'isActive',
      render: (value) =>
        value ? <Tag color="green" className="apple-tag-pill">{t('admin.users.active')}</Tag> : <Tag className="apple-tag-pill">{t('common.disabled')}</Tag>,
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
            } catch (error) {
              console.error('修改角色失败:', error);
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
        item.role === 'STUDENT' ? (
          <ModalForm
            key="assign"
            title={t('admin.users.assignClass')}
            trigger={<Button size="small">{t('admin.users.assignClass')}</Button>}
            onFinish={async (values) => {
              try {
                await assignMutation.mutateAsync({
                  classId: values.classId as string,
                  account: item.account,
                  name: item.name,
                });
                return true;
              } catch (error) {
                console.error('分配班级失败:', error);
                return false;
              }
            }}
            modalProps={{ destroyOnClose: true }}
          >
            <ProFormSelect
              name="classId"
              label={t('admin.users.assignClassLabel')}
              options={classOptions}
              placeholder={t('admin.users.assignClassPlaceholder')}
              rules={[{ required: true, message: t('admin.users.assignClassRequired') }]}
            />
          </ModalForm>
        ) : null,
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
            } catch (error) {
              console.error('重置密码失败:', error);
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
        <Popconfirm
          key="delete"
          title={t('admin.users.deleteConfirmTitle')}
          description={t('admin.users.deleteConfirmDesc')}
          okText={t('common.remove')}
          cancelText={t('common.close')}
          onConfirm={() => deleteMutation.mutate(item.id)}
        >
          <Button
            size="small"
            danger
            loading={deleteMutation.isPending && deleteMutation.variables === item.id}
          >
            {t('admin.users.deleteUser')}
          </Button>
        </Popconfirm>,
      ].filter(Boolean),
    },
  ], [t, roleMeta, classOptions, updateMutation, assignMutation, resetPasswordMutation, deleteMutation]);

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
          className="apple-inline-alert"
        />
      ) : null}
      <ProCard bordered className="apple-soft-card">
        <ProTable<AdminUser>
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          search={false}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 'max-content' }}
          options={false}
          rowSelection={{
            selectedRowKeys: selectedUserIds,
            onChange: (keys) => setSelectedUserIds(keys as string[]),
          }}
          locale={{
            emptyText: (
              <SoftEmpty description={t('admin.users.empty')}>
                <Typography.Paragraph type="secondary" className="apple-empty-hint">
                  {t('admin.users.emptyHint')}
                </Typography.Paragraph>
              </SoftEmpty>
            ),
          }}
          toolBarRender={() => [
            selectedUserIds.length > 0 ? (
              <Space key="bulk" className="apple-toolbar">
                <Typography.Text type="secondary">{selectedUserIds.length} {t('admin.users.selected')}</Typography.Text>
                <Popconfirm
                  title={t('admin.users.bulkDisableConfirm')}
                  onConfirm={async () => {
                    await api.post('/admin/users/bulk-disable', { userIds: selectedUserIds });
                    message.success(t('admin.users.bulkDisabled'));
                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                    setSelectedUserIds([]);
                  }}
                >
                  <Button danger size="small" className="apple-tag-pill">{t('admin.users.bulkDisable')}</Button>
                </Popconfirm>
                <Popconfirm
                  title={t('admin.users.bulkResetConfirm')}
                  onConfirm={async () => {
                    await api.post('/admin/users/bulk-reset-password', { userIds: selectedUserIds, newPassword: 'Test1234' });
                    message.success(t('admin.users.bulkResetDone'));
                    setSelectedUserIds([]);
                  }}
                >
                  <Button size="small" className="apple-tag-pill">{t('admin.users.bulkReset')}</Button>
                </Popconfirm>
              </Space>
            ) : null,
            <Input.Search
              key="search"
              className="apple-toolbar-search"
              placeholder={t('admin.users.searchPlaceholder')}
              allowClear
              onSearch={(value) => setKeyword(value.trim())}
            />,
            <Select
              key="role"
              className="apple-toolbar-select"
              value={roleFilter}
              onChange={(value) => setRoleFilter(value)}
              options={[
                { label: t('common.allRoles'), value: 'all' },
                { label: t('role.student'), value: 'STUDENT' },
                { label: t('role.teacher'), value: 'TEACHER' },
                { label: t('role.admin'), value: 'ADMIN' },
              ]}
            />,
            <Select
              key="status"
              className="apple-toolbar-select"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { label: t('common.allStatuses'), value: 'all' },
                { label: t('admin.users.active'), value: 'true' },
                { label: t('common.disabled'), value: 'false' },
              ]}
            />,
            <ModalForm
              key="bulk-import"
              title={t('admin.users.bulkImport')}
              trigger={<Button>{t('admin.users.bulkImport')}</Button>}
              onFinish={async (values) => {
                try {
                  const res = await bulkImportUsers({
                    text: values.text as string,
                    role: values.role as string | undefined,
                    classId: values.classId as string | undefined,
                    defaultPassword: values.defaultPassword as string | undefined,
                  });
                  message.success(`${t('admin.users.bulkImportDone')}: ${res.created} ${t('admin.users.bulkCreated')}, ${res.exists} ${t('admin.users.bulkExists')}`);
                  queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                  return true;
                } catch (error) {
                  console.error('批量导入失败:', error);
                  message.error(t('admin.users.bulkImportFailed'));
                  return false;
                }
              }}
              modalProps={{ destroyOnClose: true, width: 600 }}
            >
              <Alert
                type="info"
                showIcon
                message={t('admin.users.bulkImportHint')}
                className="apple-inline-alert"
              />
              <ProFormTextArea
                name="text"
                label={t('admin.users.bulkImportLabel')}
                placeholder={t('admin.users.bulkImportPlaceholder')}
                fieldProps={{ rows: 8, style: { fontFamily: 'monospace' } }}
                rules={[{ required: true, message: t('admin.users.bulkImportRequired') }]}
              />
              <ProFormSelect
                name="role"
                label={t('admin.users.role')}
                initialValue="STUDENT"
                options={[
                  { label: t('role.student'), value: 'STUDENT' },
                  { label: t('role.teacher'), value: 'TEACHER' },
                ]}
              />
              <ProFormSelect
                name="classId"
                label={t('admin.users.classOnCreate')}
                options={classOptions}
                placeholder={t('admin.users.classOnCreatePlaceholder')}
                allowClear
              />
              <ProFormText
                name="defaultPassword"
                label={t('admin.users.defaultPassword')}
                placeholder="Abc123456"
              />
            </ModalForm>,
            <ModalForm
              key="create"
              title={t('admin.users.createUser')}
              trigger={<Button type="primary">{t('admin.users.createUser')}</Button>}
              onFinish={async (values) => {
                try {
                  const role = values.role as 'STUDENT' | 'TEACHER' | 'ADMIN';
                  await createMutation.mutateAsync({
                    account: values.account as string,
                    name: values.name as string,
                    role,
                    password: values.password as string,
                    classId: role === 'STUDENT' ? (values.classId as string | undefined) : undefined,
                  });
                  return true;
                } catch (error) {
                  console.error('创建用户失败:', error);
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
              <ProFormDependency name={['role']}>
                {({ role }) =>
                  role === 'STUDENT' ? (
                    <ProFormSelect
                      name="classId"
                      label={t('admin.users.classOnCreate')}
                      options={classOptions}
                      placeholder={t('admin.users.classOnCreatePlaceholder')}
                      allowClear
                    />
                  ) : null
                }
              </ProFormDependency>
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
