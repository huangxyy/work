import { InboxOutlined } from '@ant-design/icons';
import { Button, Card, Space, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useState } from 'react';

export const SubmitHomeworkPage = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleSubmit = () => {
    if (!fileList.length) {
      message.warning('Please upload at least one image');
      return;
    }
    message.success('Mock submit - wiring to API soon');
  };

  return (
    <Card title="Submit Homework">
      <Upload.Dragger
        multiple
        beforeUpload={() => false}
        fileList={fileList}
        onChange={({ fileList: newList }) => setFileList(newList)}
        accept="image/*"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Drag & drop images or click to upload</p>
      </Upload.Dragger>
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" onClick={handleSubmit}>
          Submit
        </Button>
        <Button onClick={() => setFileList([])}>Reset</Button>
      </Space>
    </Card>
  );
};