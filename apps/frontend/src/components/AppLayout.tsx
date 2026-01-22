import { Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';

const { Header, Content } = Layout;

export const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = useMemo<MenuProps['items']>(() => {
    return [
      { key: '/student/homeworks', label: 'Student' },
      { key: '/teacher/classes', label: 'Teacher' },
      { key: '/admin/config', label: 'Admin' },
    ];
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          Homework AI
        </Typography.Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(info) => navigate(info.key)}
        />
      </Header>
      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  );
};