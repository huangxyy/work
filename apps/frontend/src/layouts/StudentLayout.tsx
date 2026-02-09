import { Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';

const { Header, Content } = Layout;

export const StudentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

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
      { key: '/student/dashboard', label: t('nav.dashboard') },
      { key: '/student/homeworks', label: t('nav.homeworks') },
      { key: '/student/submissions', label: t('nav.submissions') },
      { key: '/student/report', label: t('nav.report') },
    ],
    [t],
  );

  return (
    <Layout className="app-student-layout dashboard-clean app-motion" style={{ minHeight: '100vh' }}>
      <Header
        className="student-dashboard__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 32px',
          height: 60,
        }}
      >
        <Typography.Title level={4} className="student-dashboard__title" style={{ margin: 0 }}>
          {t('app.title')}
        </Typography.Title>
        <Menu
          className="student-dashboard__menu"
          theme="light"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={(info) => navigate(info.key)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            borderBottom: 'none',
            fontWeight: 500,
            height: 60,
            lineHeight: '60px',
          }}
        />
        <LanguageSwitcher />
      </Header>
      <Content>
        <div className="student-dashboard__content">
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
};
