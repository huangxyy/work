import { Card, Descriptions, Tag } from 'antd';

export const TeacherSubmissionDetailPage = () => {
  return (
    <Card title="Submission Detail">
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Student">Student 01</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color="green">DONE</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Score">--</Descriptions.Item>
      </Descriptions>
    </Card>
  );
};