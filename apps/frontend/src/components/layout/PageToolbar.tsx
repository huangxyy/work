import { Space } from 'antd';
import type { ReactNode } from 'react';

export const PageToolbar = ({ children }: { children: ReactNode }) => (
  <Space wrap size={10} className="apple-toolbar apple-page-toolbar">
    {children}
  </Space>
);
