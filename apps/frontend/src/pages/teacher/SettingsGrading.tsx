import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Descriptions, Empty, Tag, Typography } from 'antd';

export const TeacherSettingsGradingPage = () => {
  const defaultMode = import.meta.env.VITE_GRADING_MODE || 'Not configured';
  const budgetMode = import.meta.env.VITE_BUDGET_MODE || 'Not configured';

  return (
    <PageContainer
      title="Grading Settings"
      breadcrumb={{
        items: [
          { title: 'Teacher', path: '/teacher/dashboard' },
          { title: 'Settings' },
          { title: 'Grading' },
        ],
      }}
    >
      <ProCard bordered>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Default Grading Mode">
            <Tag>{defaultMode}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Budget Mode">
            <Tag>{budgetMode}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Provider">
            <Typography.Text type="secondary">Configured by administrator</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>
      <ProCard bordered title="Advanced Settings" style={{ marginTop: 16 }}>
        {/* TODO: connect grading configuration API */}
        <Empty description="Advanced grading settings are managed by admin" />
      </ProCard>
    </PageContainer>
  );
};
