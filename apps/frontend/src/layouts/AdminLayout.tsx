import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BugOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  FlagOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  NotificationOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
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

export const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const routeConfig = useMemo<ProLayoutProps['route']>(
    () => ({
      path: '/admin',
      routes: [
        {
          path: '/admin/dashboard',
          name: t('nav.dashboard'),
          icon: <DashboardOutlined />,
        },
        {
          path: '/admin/users',
          name: t('nav.users'),
          icon: <TeamOutlined />,
        },
        {
          path: '/admin/classes',
          name: t('nav.classes'),
          icon: <AppstoreOutlined />,
        },
        {
          path: '/admin/usage',
          name: t('nav.usage'),
          icon: <BarChartOutlined />,
        },
        {
          path: '/admin/system',
          name: t('nav.system'),
          icon: <SettingOutlined />,
          routes: [
            {
              path: '/admin/system/config',
              name: t('nav.config'),
              icon: <SettingOutlined />,
            },
            {
              path: '/admin/system/budget',
              name: t('nav.budget'),
              icon: <WalletOutlined />,
            },
            {
              path: '/admin/system/retention',
              name: t('nav.retention'),
              icon: <HistoryOutlined />,
            },
            {
              path: '/admin/system/info',
              name: t('admin.systemInfo.title'),
              icon: <InfoCircleOutlined />,
            },
            {
              path: '/admin/system/queue',
              name: t('nav.queue'),
              icon: <CloudServerOutlined />,
            },
          ],
        },
        {
          path: '/admin/diagnosis',
          name: t('nav.diagnosis'),
          icon: <BugOutlined />,
        },
        {
          path: '/admin/audit-logs',
          name: t('nav.auditLogs'),
          icon: <AuditOutlined />,
        },
        {
          path: '/admin/login-history',
          name: t('admin.loginHistory.title'),
          icon: <LoginOutlined />,
        },
        {
          path: '/admin/feature-flags',
          name: t('admin.featureFlags.title'),
          icon: <FlagOutlined />,
        },
        {
          path: '/admin/announcements',
          name: t('nav.announcements'),
          icon: <NotificationOutlined />,
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
          <div className="app-pro-layout__brand-subtitle">{t('app.adminConsole')}</div>
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
            onClick={() => navigate('/admin/profile')}
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
      contentStyle={{ padding: '20px 24px 32px' }}
    >
      <Outlet />
    </ProLayout>
  );
};
