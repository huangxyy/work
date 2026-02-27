import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';

export const ThemeToggle = () => {
  const { isDark, setMode } = useTheme();
  const { t } = useI18n();

  const toggle = () => setMode(isDark ? 'light' : 'dark');

  return (
    <Tooltip title={isDark ? t('theme.light') : t('theme.dark')}>
      <Button
        type="text"
        className="apple-icon-btn"
        icon={isDark ? <SunOutlined style={{ fontSize: 18 }} /> : <MoonOutlined style={{ fontSize: 18 }} />}
        onClick={toggle}
      />
    </Tooltip>
  );
};
