import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { ProLayoutProps } from '@ant-design/pro-components';
import { Button, Tooltip } from 'antd';
import type { ReactNode } from 'react';
import { logout } from '../api/auth';
import { GlobalSearch } from '../components/GlobalSearch';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { NotificationBell } from '../components/NotificationBell';
import { ThemeToggle } from '../components/ThemeToggle';

type ActionFactoryParams = {
  navigate: (path: string) => void;
  t: (key: string) => string;
  profilePath: string;
};

export const sharedProLayoutToken: ProLayoutProps['token'] = {
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
};

export const sharedProLayoutMenuProps: ProLayoutProps['menuProps'] = {
  inlineIndent: 18,
  style: { padding: '12px 10px 20px' },
};

export const sharedLayoutContentStyle = { padding: '20px 24px 32px' };

export const buildLayoutActions = ({ navigate, t, profilePath }: ActionFactoryParams): ReactNode[] => [
  <GlobalSearch key="search" />,
  <NotificationBell key="notifications" />,
  <ThemeToggle key="theme" />,
  <LanguageSwitcher key="lang" />,
  <Tooltip key="profile" title={t('profile.title')}>
    <Button
      type="text"
      icon={<UserOutlined />}
      className="apple-icon-btn"
      onClick={() => navigate(profilePath)}
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
];
