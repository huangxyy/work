import { Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { buildLayoutActions } from './layoutShared';

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
    if (path.startsWith('/student/announcements')) {
      return '/student/announcements';
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
      { key: '/student/announcements', label: t('nav.announcements') },
      { key: '/student/report', label: t('nav.report') },
    ],
    [t],
  );
  const actions = useMemo(
    () => buildLayoutActions({ navigate, t, profilePath: '/student/profile' }),
    [navigate, t],
  );

  return (
    <Layout className="app-student-layout apple-shell apple-page-stack">
      <Header className="student-dashboard__header apple-layout-header">
        <Typography.Title level={4} className="student-dashboard__title apple-layout-title">
          {t('app.title')}
        </Typography.Title>
        <Menu
          className="student-dashboard__menu apple-layout-menu"
          theme="light"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={(info) => navigate(info.key)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Space size={8} className="apple-layout-actions">
          {actions}
        </Space>
      </Header>
      <Content>
        <div className="student-dashboard__content apple-layout-content">
          <div className="apple-route-shell">
            <Outlet />
          </div>
        </div>
      </Content>
    </Layout>
  );
};
