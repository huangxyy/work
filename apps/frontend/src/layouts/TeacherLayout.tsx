import {
  BarChartOutlined,
  BookOutlined,
  ClusterOutlined,
  DashboardOutlined,
  SettingOutlined,
  SlidersOutlined,
} from '@ant-design/icons';
import { ProLayout } from '@ant-design/pro-components';
import type { ProLayoutProps } from '@ant-design/pro-components';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
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
      className="app-pro-layout teacher-soft app-motion"
      title={t('app.title')}
      logo={false}
      navTheme="light"
      fixedHeader
      siderWidth={252}
      route={routeConfig}
      location={{ pathname: location.pathname }}
      token={{
        header: {
          colorBgHeader: '#ffffff',
          colorHeaderTitle: '#0f172a',
        },
        sider: {
          colorMenuBackground: '#ffffff',
          colorTextMenu: '#1f2937',
          colorTextMenuSelected: '#3e6ee6',
        },
      }}
      menuProps={{
        inlineIndent: 18,
        style: { padding: '12px 12px 20px' },
      }}
      menuHeaderRender={() => (
        <div className="app-pro-layout__brand">
          <div className="app-pro-layout__brand-title">{t('app.title')}</div>
          <div className="app-pro-layout__brand-subtitle">{t('app.teacherConsole')}</div>
        </div>
      )}
      menuItemRender={(item, dom) =>
        item.path ? (
          <span onClick={() => navigate(item.path)} style={{ cursor: 'pointer' }}>
            {dom}
          </span>
        ) : (
          dom
        )
      }
      actionsRender={() => [<LanguageSwitcher key="lang" />]}
      contentStyle={{ padding: '24px 28px 40px' }}
    >
      <Outlet />
    </ProLayout>
  );
};
