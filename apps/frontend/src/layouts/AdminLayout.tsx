import {
  ApartmentOutlined,
  DashboardOutlined,
  HistoryOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { ProLayout } from '@ant-design/pro-components';
import type { ProLayoutProps } from '@ant-design/pro-components';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
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
          path: '/admin/classes',
          name: t('nav.classes'),
          icon: <ApartmentOutlined />,
        },
        {
          path: '/admin/users',
          name: t('nav.users'),
          icon: <TeamOutlined />,
        },
        {
          path: '/admin/system',
          name: t('nav.system'),
          icon: <SettingOutlined />,
          routes: [
            {
              path: '/admin/system/config',
              name: t('nav.config'),
              icon: <ToolOutlined />,
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
          ],
        },
      ],
    }),
    [t],
  );

  return (
    <ProLayout
      className="app-pro-layout"
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
          colorTextMenuSelected: '#1d4ed8',
        },
      }}
      menuProps={{
        inlineIndent: 18,
        style: { padding: '12px 12px 20px' },
      }}
      menuHeaderRender={() => (
        <div className="app-pro-layout__brand">
          <div className="app-pro-layout__brand-title">{t('app.title')}</div>
          <div className="app-pro-layout__brand-subtitle">{t('app.adminConsole')}</div>
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
      contentStyle={{ padding: '20px 24px 32px' }}
    >
      <Outlet />
    </ProLayout>
  );
};
