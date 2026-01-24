import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Empty, Input, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

type UserRow = {
  id: string;
  name: string;
  account: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
};

const roleMeta: Record<UserRow['role'], { label: string; color: string }> = {
  STUDENT: { label: 'Student', color: 'blue' },
  TEACHER: { label: 'Teacher', color: 'green' },
  ADMIN: { label: 'Admin', color: 'purple' },
};

export const AdminUsersPage = () => {
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const { data, isLoading, isError, error, refetch } = useQuery<UserRow[]>({
    queryKey: ['admin-users'],
    // TODO: replace placeholder with admin users API
    queryFn: async () => [],
  });

  const filteredData = useMemo(() => {
    const list = (data || []) as UserRow[];
    return list.filter((item) => {
      if (roleFilter !== 'all' && item.role !== roleFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const needle = keyword.toLowerCase();
      return item.name.toLowerCase().includes(needle) || item.account.toLowerCase().includes(needle);
    });
  }, [data, keyword, roleFilter]);

  const columns: ProColumns<UserRow>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Account',
      dataIndex: 'account',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (_, item) => {
        const meta = roleMeta[item.role];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
      width: 160,
    },
  ];

  return (
    <PageContainer
      title="Users"
      breadcrumb={{
        items: [
          { title: 'Admin', path: '/admin/dashboard' },
          { title: 'Users' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load users"
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
        <ProTable<UserRow>
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          search={false}
          pagination={{ pageSize: 8 }}
          options={false}
          locale={{
            emptyText: (
              <Empty description="No users available">
                <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                  User management data will appear here once connected.
                </Typography.Paragraph>
              </Empty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              placeholder="Search user"
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
                { label: 'All roles', value: 'all' },
                { label: 'Student', value: 'STUDENT' },
                { label: 'Teacher', value: 'TEACHER' },
                { label: 'Admin', value: 'ADMIN' },
              ]}
            />,
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};
