import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Empty, Statistic, Typography } from 'antd';

export const AdminDashboardPage = () => {
  return (
    <PageContainer
      title="Admin Dashboard"
      breadcrumb={{
        items: [
          { title: 'Admin', path: '/admin/dashboard' },
          { title: 'Dashboard' },
        ],
      }}
    >
      <ProCard gutter={16} wrap>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }}>
          <Statistic title="Active Users" value={0} />
          <Typography.Text type="secondary">Awaiting user metrics.</Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }}>
          <Statistic title="LLM Calls Today" value={0} />
          <Typography.Text type="secondary">Realtime usage will appear here.</Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }}>
          <Statistic title="Retention Runs" value={0} />
          <Typography.Text type="secondary">Scheduled retention results pending.</Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 24 }} title="System Overview">
          {/* TODO: connect admin monitoring API */}
          <Empty description="Monitoring dashboards will appear here" />
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};
