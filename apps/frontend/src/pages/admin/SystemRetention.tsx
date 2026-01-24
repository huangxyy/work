import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Descriptions, Empty, Tag, Typography } from 'antd';

export const AdminSystemRetentionPage = () => {
  return (
    <PageContainer
      title="Retention"
      breadcrumb={{
        items: [
          { title: 'Admin', path: '/admin/dashboard' },
          { title: 'System' },
          { title: 'Retention' },
        ],
      }}
    >
      <ProCard bordered>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Retention Window">
            <Tag>7 days</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Next Run">
            <Typography.Text type="secondary">Scheduled by backend cron</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Dry Run">
            <Typography.Text type="secondary">Disabled</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>
      <ProCard bordered title="Retention Logs" style={{ marginTop: 16 }}>
        {/* TODO: connect retention logs API */}
        <Empty description="Retention history will appear here" />
      </ProCard>
    </PageContainer>
  );
};
