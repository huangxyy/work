import { Layout, Menu, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Header, Content } = Layout;

export const StudentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/student/dashboard')) {
      return '/student/dashboard';
    }
    if (path.startsWith('/student/submissions') || path.startsWith('/student/submission')) {
      return '/student/submissions';
    }
    if (path.startsWith('/student/report')) {
      return '/student/report';
    }
    if (path.startsWith('/student/submit')) {
      return '/student/homeworks';
    }
    return '/student/homeworks';
  }, [location.pathname]);

  const items = useMemo<MenuProps['items']>(
    () => [
      { key: '/student/dashboard', label: 'Dashboard' },
      { key: '/student/homeworks', label: 'Homeworks' },
      { key: '/student/submissions', label: 'Submissions' },
      { key: '/student/report', label: 'Report' },
    ],
    [],
  );

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 24px',
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorSplit}`,
        }}
      >
        <Typography.Title level={4} style={{ color: token.colorTextHeading, margin: 0 }}>
          Homework AI
        </Typography.Title>
        <Menu
          theme="light"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={(info) => navigate(info.key)}
        />
      </Header>
      <Content>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '24px 24px 40px',
            width: '100%',
          }}
        >
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
};
