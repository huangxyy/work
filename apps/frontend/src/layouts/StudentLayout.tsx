import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { GlobalSearch } from '../components/GlobalSearch';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { NotificationBell } from '../components/NotificationBell';
import { ThemeToggle } from '../components/ThemeToggle';
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
        <GlobalSearch />
        <NotificationBell />
        <ThemeToggle />
        <LanguageSwitcher />
        <Tooltip title={t('profile.title')}>
          <Button
            type="text"
            icon={<UserOutlined />}
            className="apple-icon-btn"
            onClick={() => navigate('/student/profile')}
          />
        </Tooltip>
        <Tooltip title={t('nav.logout')}>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            className="apple-icon-btn"
            onClick={() => logout().then(() => navigate('/login'))}
          />
        </Tooltip>
      </Header>
      <Content>
        <div className="student-dashboard__content apple-layout-content">
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
};
