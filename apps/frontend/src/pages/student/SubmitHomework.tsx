import { InboxOutlined } from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  List,
  Progress,
  Space,
  Typography,
  Upload,
  message,
} from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSubmission } from '../../api';

const tips = [
  'Upload 1-3 clear images of your handwritten essay.',
  'Avoid shadows and crop margins for best OCR results.',
  'Make sure your handwriting is legible and aligned.',
];

export const SubmitHomeworkPage = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const navigate = useNavigate();
  const { homeworkId } = useParams();

  const handleSubmit = async () => {
    if (!homeworkId) {
      message.error('Missing homework id');
      return;
    }

    const files = fileList
      .map((file) => file.originFileObj)
      .filter((file): file is RcFile => !!file);

    if (!files.length) {
      message.warning('Please upload at least one image');
      return;
    }

    if (files.length > 3) {
      message.warning('You can upload up to 3 images');
      return;
    }

    setSubmitting(true);
    setUploadPercent(20);
    try {
      const result = await createSubmission({ homeworkId, files });
      setUploadPercent(100);
      message.success('Submission created');
      navigate(`/student/submission/${result.submissionId}`);
    } catch (error) {
      message.error('Failed to submit, please try again');
      setUploadPercent(0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="Submit Homework"
      breadcrumb={{
        items: [
          { title: 'Student', path: '/student/homeworks' },
          { title: 'Submit' },
        ],
      }}
    >
      {!homeworkId ? (
        <Alert
          type="error"
          message="Missing homework reference"
          description="Please return to the homework list and choose an assignment."
          action={
            <Button onClick={() => navigate('/student/homeworks')}>Back to homeworks</Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProCard gutter={16} wrap>
        <ProCard bordered title="Upload Your Work" colSpan={{ xs: 24, lg: 16 }}>
          <Upload.Dragger
            multiple
            beforeUpload={() => false}
            fileList={fileList}
            maxCount={3}
            disabled={submitting}
            onChange={({ fileList: newList }) => {
              if (newList.length > 3) {
                message.warning('Only 3 images allowed');
              }
              setFileList(newList.slice(0, 3));
            }}
            accept="image/*"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drag & drop images or click to upload</p>
            <Typography.Text type="secondary">
              JPG/PNG, upload 1 to 3 images. Clear handwriting improves OCR accuracy.
            </Typography.Text>
          </Upload.Dragger>
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" onClick={handleSubmit} loading={submitting} disabled={submitting}>
              Submit
            </Button>
            <Button onClick={() => setFileList([])} disabled={submitting}>
              Reset
            </Button>
          </Space>
          {submitting ? (
            <Progress
              style={{ marginTop: 16 }}
              percent={uploadPercent}
              status="active"
              showInfo={false}
            />
          ) : null}
        </ProCard>
        <ProCard bordered title="Submission Tips" colSpan={{ xs: 24, lg: 8 }}>
          <List
            dataSource={tips}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text>{item}</Typography.Text>
              </List.Item>
            )}
          />
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};
