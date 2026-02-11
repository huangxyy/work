import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntdApp } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { RouterProvider } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n';
import { router } from './routes/router';
import 'antd/dist/reset.css';
import './styles.css';

// Configure React Query with proper cache strategies
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale time for all queries
      staleTime: 60 * 1000, // 1 minute
      // Cache time (gcTime in v5) - how long unused data stays in cache
      gcTime: 5 * 60 * 1000, // 5 minutes
      // Retry failed queries once
      retry: 1,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
    },
  },
});
const themeToken = {
  colorPrimary: '#1d4ed8',
  colorInfo: '#1d4ed8',
  colorBgLayout: '#f4f6fb',
  colorBgContainer: '#ffffff',
  colorTextHeading: '#0f172a',
  colorText: '#1f2937',
  borderRadius: 12,
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
};

export const App = () => {
  const { language } = useI18n();
  const locale = language === 'zh-CN' ? zhCN : enUS;

  return (
    <ConfigProvider theme={{ token: themeToken }} locale={locale}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <App />
    </I18nProvider>
  </QueryClientProvider>,
);
