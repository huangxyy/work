import { InboxOutlined } from '@ant-design/icons';
import { Button, Card, Space, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSubmission } from '../../api';

export const SubmitHomeworkPage = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { homeworkId } = useParams();

  const handleSubmit = async () => {
    if (!homeworkId) {
      message.error('Missing homework id');
      return;
    }

    const files = fileList
      .map((file) => file.originFileObj)
      .filter((file): file is File => !!file);

    if (!files.length) {
      message.warning('Please upload at least one image');
      return;
    }

    if (files.length > 3) {
      message.warning('You can upload up to 3 images');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSubmission({ homeworkId, files });
      message.success('Submission created');
      navigate(`/student/submission/${result.submissionId}`);
    } catch (error) {
      message.error('Failed to submit, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Submit Homework">
      <Upload.Dragger
        multiple
        beforeUpload={() => false}
        fileList={fileList}
        maxCount={3}
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
      </Upload.Dragger>
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" onClick={handleSubmit} loading={submitting}>
          Submit
        </Button>
        <Button onClick={() => setFileList([])}>Reset</Button>
      </Space>
    </Card>
  );
};
