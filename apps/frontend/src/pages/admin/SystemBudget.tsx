import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Descriptions, Empty, Tag, Typography } from 'antd';

export const AdminSystemBudgetPage = () => {
  return (
    <PageContainer
      title="System Budget"
      breadcrumb={{
        items: [
          { title: 'Admin', path: '/admin/dashboard' },
          { title: 'System' },
          { title: 'Budget' },
        ],
      }}
    >
      <ProCard bordered>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Budget Mode">
            <Tag>Not configured</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Daily Call Limit">
            <Typography.Text type="secondary">--</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Token Limit">
            <Typography.Text type="secondary">--</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>
      <ProCard bordered title="Usage Trends" style={{ marginTop: 16 }}>
        {/* TODO: connect budget analytics API */}
        <Empty description="Budget analytics will appear here" />
      </ProCard>
    </PageContainer>
  );
};
