import { Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../i18n';

const { Header, Content } = Layout;

export const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const items = useMemo<MenuProps['items']>(() => {
    return [
      { key: '/student/homeworks', label: t('nav.student') },
      { key: '/teacher/classes', label: t('nav.teacher') },
      { key: '/admin/config', label: t('nav.admin') },
    ];
  }, [t]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          {t('app.title')}
        </Typography.Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(info) => navigate(info.key)}
        />
        <LanguageSwitcher />
      </Header>
      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  );
};
