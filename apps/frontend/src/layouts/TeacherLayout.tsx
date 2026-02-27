import {
  BarChartOutlined,
  BookOutlined,
  ClusterOutlined,
  DashboardOutlined,
  LogoutOutlined,
  NotificationOutlined,
  SettingOutlined,
  SlidersOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { ProLayout } from '@ant-design/pro-components';
import type { ProLayoutProps } from '@ant-design/pro-components';
import { Button, Tooltip } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { GlobalSearch } from '../components/GlobalSearch';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { NotificationBell } from '../components/NotificationBell';
import { ThemeToggle } from '../components/ThemeToggle';
import { useI18n } from '../i18n';

export const TeacherLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const routeConfig = useMemo<ProLayoutProps['route']>(
    () => ({
      path: '/teacher',
      routes: [
        {
          path: '/teacher/dashboard',
          name: t('nav.dashboard'),
          icon: <DashboardOutlined />,
        },
        {
          path: '/teacher/classes',
          name: t('nav.classes'),
          icon: <ClusterOutlined />,
        },
        {
          path: '/teacher/homeworks',
          name: t('nav.homeworks'),
          icon: <BookOutlined />,
        },
        {
          path: '/teacher/reports',
          name: t('nav.reports'),
          icon: <BarChartOutlined />,
        },
        {
          path: '/teacher/announcements',
          name: t('nav.announcements'),
          icon: <NotificationOutlined />,
        },
        {
          path: '/teacher/settings',
          name: t('nav.settings'),
          icon: <SettingOutlined />,
          routes: [
            {
              path: '/teacher/settings/grading',
              name: t('nav.grading'),
              icon: <SlidersOutlined />,
            },
          ],
        },
      ],
    }),
    [t],
  );

  return (
    <ProLayout
      className="app-pro-layout apple-shell apple-page-stack"
      title={t('app.title')}
      logo={false}
      navTheme="light"
      fixedHeader
      siderWidth={260}
      fixSiderbar
      route={routeConfig}
      location={{ pathname: location.pathname }}
      token={{
        header: {
          colorBgHeader: 'var(--apple-surface)',
          colorHeaderTitle: 'var(--apple-text-main)',
          heightLayoutHeader: 64,
        },
        sider: {
          colorMenuBackground: 'var(--apple-surface-soft)',
          colorTextMenu: 'var(--apple-text-muted)',
          colorTextMenuSelected: 'var(--apple-text-main)',
          colorBgMenuItemSelected: 'var(--apple-primary-soft)',
          colorTextMenuActive: 'var(--apple-primary)',
        },
        pageContainer: {
          paddingBlockPageContainerContent: 24,
          paddingInlinePageContainerContent: 24,
        },
      }}
      menuProps={{
        inlineIndent: 18,
        style: { padding: '12px 10px 20px' },
      }}
      menuHeaderRender={() => (
        <div className="app-pro-layout__brand">
          <div className="app-pro-layout__brand-title">{t('app.title')}</div>
          <div className="app-pro-layout__brand-subtitle">{t('app.teacherConsole')}</div>
        </div>
      )}
      menuItemRender={(item, dom) =>
        item.path ? (
          <span onClick={() => item.path && navigate(item.path)} style={{ cursor: 'pointer' }}>
            {dom}
          </span>
        ) : (
          dom
        )
      }
      actionsRender={() => [
        <GlobalSearch key="search" />,
        <NotificationBell key="notifications" />,
        <ThemeToggle key="theme" />,
        <LanguageSwitcher key="lang" />,
        <Tooltip key="profile" title={t('profile.title')}>
          <Button
            type="text"
            icon={<UserOutlined />}
            className="apple-icon-btn"
            onClick={() => navigate('/teacher/profile')}
          />
        </Tooltip>,
        <Tooltip key="logout" title={t('nav.logout')}>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            className="apple-icon-btn"
            onClick={() => logout().then(() => navigate('/login'))}
          />
        </Tooltip>,
      ]}
      contentStyle={{ padding: '24px 28px 40px' }}
    >
      <Outlet />
    </ProLayout>
  );
};
