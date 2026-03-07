import { ProCard } from '@ant-design/pro-components';
import type { ReactNode } from 'react';

type PageSectionProps = {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
};

export const PageSection = ({ title, extra, children }: PageSectionProps) => (
  <ProCard
    bordered
    title={title}
    extra={extra}
    colSpan={24}
    className="apple-soft-card apple-page-section"
  >
    {children}
  </ProCard>
);
