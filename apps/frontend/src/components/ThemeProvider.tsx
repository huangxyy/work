import { ConfigProvider, theme as antTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { ThemeContext, type ThemeMode } from '../hooks/useTheme';

const STORAGE_KEY = 'theme_mode';

function getSystemDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { language } = useI18n();
  const locale = language === 'zh-CN' ? zhCN : enUS;

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'dark' || stored === 'system') ? stored : 'light';
  });
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
  }, []);

  const ctx = useMemo(() => ({ mode, isDark, setMode }), [mode, isDark, setMode]);

  const themeToken = useMemo(
    () => ({
      colorPrimary: isDark ? '#8cb8ff' : '#1f6feb',
      colorInfo: isDark ? '#8cb8ff' : '#1f6feb',
      colorSuccess: isDark ? '#66c08a' : '#2f855a',
      colorWarning: isDark ? '#ffd166' : '#d48806',
      colorError: isDark ? '#ff8b7b' : '#c03a2b',
      colorBgLayout: isDark ? '#111317' : '#f5f6f8',
      colorBgContainer: isDark ? '#181b21' : '#ffffff',
      colorBgElevated: isDark ? '#1d2129' : '#ffffff',
      colorTextHeading: isDark ? '#e8ecf2' : '#15171a',
      colorText: isDark ? '#e8ecf2' : '#15171a',
      colorTextSecondary: isDark ? '#a7afbd' : '#5d6470',
      colorBorder: isDark ? '#2e3541' : '#dfe3ea',
      colorBorderSecondary: isDark ? '#252b36' : '#ebedf2',
      borderRadius: 14,
      borderRadiusLG: 18,
      borderRadiusSM: 10,
      fontFamily: '"Inter", "SF Pro Text", "Noto Sans SC", system-ui, sans-serif',
      wireframe: false,
      motion: true,
    }),
    [isDark],
  );

  return (
    <ThemeContext.Provider value={ctx}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: themeToken,
          components: {
            Button: {
              borderRadius: 999,
              borderRadiusLG: 999,
              controlHeight: 40,
              controlHeightLG: 46,
              fontWeight: 500,
            },
            Card: {
              borderRadiusLG: 18,
            },
            Input: {
              borderRadius: 12,
              controlHeight: 42,
            },
            Select: {
              borderRadius: 12,
              controlHeight: 42,
            },
            Menu: {
              itemBorderRadius: 12,
              itemMarginBlock: 2,
              itemMarginInline: 6,
            },
            Tag: {
              borderRadiusSM: 8,
            },
            Modal: {
              borderRadiusLG: 28,
            },
            Notification: {
              borderRadiusLG: 16,
            },
            Message: {
              borderRadiusLG: 16,
            },
          },
        }}
        locale={locale}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};
