import {
  BarChartOutlined,
  BookOutlined,
  ClusterOutlined,
  DashboardOutlined,
  NotificationOutlined,
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
      actionsRender={() => buildLayoutActions({ navigate, t, profilePath: '/teacher/profile' })}
      contentStyle={sharedLayoutContentStyle}
    >
      <div className="apple-route-shell">
        <Outlet />
      </div>
    </ProLayout>
  );
};
