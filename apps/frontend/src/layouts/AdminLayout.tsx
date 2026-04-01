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
  NotificationOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { ProLayout } from '@ant-design/pro-components';
import type { ProLayoutProps } from '@ant-design/pro-components';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import {
  buildLayoutActions,
  sharedLayoutContentStyle,
  sharedProLayoutMenuProps,
  sharedProLayoutToken,
} from './layoutShared';

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
          path: '/admin/announcements',
          name: t('nav.announcements'),
          icon: <NotificationOutlined />,
        },
        {
          path: '/admin/system',
          name: t('nav.systemSettings'),
          icon: <SettingOutlined />,
          routes: [
            {
              path: '/admin/system/config',
              name: t('nav.gradingConfig'),
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
              path: '/admin/system/queue',
              name: t('nav.queue'),
              icon: <CloudServerOutlined />,
            },
            {
              path: '/admin/system/info',
              name: t('admin.systemInfo.title'),
              icon: <InfoCircleOutlined />,
            },
          ],
        },
        {
          path: '/admin/advanced',
          name: t('nav.advancedTools'),
          icon: <BugOutlined />,
          routes: [
            {
              path: '/admin/usage',
              name: t('nav.usage'),
              icon: <BarChartOutlined />,
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
      token={sharedProLayoutToken}
      menuProps={sharedProLayoutMenuProps}
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
      actionsRender={() => buildLayoutActions({ navigate, t, profilePath: '/admin/profile' })}
      contentStyle={sharedLayoutContentStyle}
    >
      <div className="apple-route-shell">
        <Outlet />
      </div>
    </ProLayout>
  );
};
