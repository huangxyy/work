import { PageContainer } from '@ant-design/pro-components';
import type { ReactNode } from 'react';

type PageShellProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  breadcrumbItems?: Array<{ title: ReactNode; path?: string }>;
  extra?: ReactNode;
  children: ReactNode;
};

export const PageShell = ({ title, subtitle, breadcrumbItems, extra, children }: PageShellProps) => (
  <PageContainer
    className="apple-page-shell"
    title={title}
    subTitle={subtitle}
    extra={extra}
    breadcrumb={breadcrumbItems ? { items: breadcrumbItems } : undefined}
  >
    <div className="apple-page-body">{children}</div>
  </PageContainer>
);
