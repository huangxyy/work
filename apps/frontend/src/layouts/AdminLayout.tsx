import {
  DashboardOutlined,
  HistoryOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { ProLayout } from '@ant-design/pro-components';
import type { ProLayoutProps } from '@ant-design/pro-components';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const routeConfig: ProLayoutProps['route'] = {
  path: '/admin',
  routes: [
    {
      path: '/admin/dashboard',
      name: 'Dashboard',
      icon: <DashboardOutlined />,
    },
    {
      path: '/admin/users',
      name: 'Users',
      icon: <TeamOutlined />,
    },
    {
      path: '/admin/system',
      name: 'System',
      icon: <SettingOutlined />,
      routes: [
        {
          path: '/admin/system/budget',
          name: 'Budget',
          icon: <WalletOutlined />,
        },
        {
          path: '/admin/system/retention',
          name: 'Retention',
          icon: <HistoryOutlined />,
        },
      ],
    },
  ],
};

export const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ProLayout
      title="Homework AI"
      logo={false}
      route={routeConfig}
      location={{ pathname: location.pathname }}
      menuItemRender={(item, dom) =>
        item.path ? (
          <span onClick={() => navigate(item.path)} style={{ cursor: 'pointer' }}>
            {dom}
          </span>
        ) : (
          dom
        )
      }
      contentStyle={{ padding: 24 }}
    >
      <Outlet />
    </ProLayout>
  );
};
