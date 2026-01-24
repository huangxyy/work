import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Empty, Typography } from 'antd';

export const StudentReportPage = () => {
  return (
    <PageContainer
      title="Personal Report"
      breadcrumb={{
        items: [
          { title: 'Student', path: '/student/dashboard' },
          { title: 'Report' },
        ],
      }}
    >
      <ProCard bordered>
        <Empty description="No analytics yet">
          <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
            Charts and trends will appear here once analytics endpoints are available.
          </Typography.Paragraph>
        </Empty>
      </ProCard>
    </PageContainer>
  );
};
