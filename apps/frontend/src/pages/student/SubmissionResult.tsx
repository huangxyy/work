import { Card, Descriptions, Tag, Typography } from 'antd';

export const SubmissionResultPage = () => {
  return (
    <Card title="Submission Result">
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Status">
          <Tag color="blue">QUEUED</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="OCR Text">Pending...</Descriptions.Item>
        <Descriptions.Item label="LLM Result">
          <Typography.Text type="secondary">Waiting for processing</Typography.Text>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};