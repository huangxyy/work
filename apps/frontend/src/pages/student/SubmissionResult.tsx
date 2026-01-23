import { Card, Descriptions, Spin, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchSubmission } from '../../api';

export const SubmissionResultPage = () => {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => fetchSubmission(id || ''),
    enabled: !!id,
    refetchInterval: (query) => {
      const result = query.state.data as
        | { status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED' }
        | undefined;
      if (!result) {
        return 2000;
      }
      return result.status === 'DONE' || result.status === 'FAILED' ? false : 2000;
    },
  });

  const status = data?.status || 'QUEUED';

  return (
    <Card title="Submission Result">
      {isLoading ? (
        <Spin />
      ) : (
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Status">
            <Tag color={status === 'DONE' ? 'green' : status === 'FAILED' ? 'red' : 'blue'}>
              {status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Total Score">
            {data?.totalScore ?? '--'}
          </Descriptions.Item>
          <Descriptions.Item label="OCR Text">
            {data?.ocrText || 'Pending...'}
          </Descriptions.Item>
          <Descriptions.Item label="LLM Result">
            {data?.gradingJson ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(data.gradingJson, null, 2)}
              </pre>
            ) : (
              <Typography.Text type="secondary">Waiting for processing</Typography.Text>
            )}
          </Descriptions.Item>
          {data?.errorMsg ? (
            <Descriptions.Item label="Error">
              <Typography.Text type="danger">{data.errorMsg}</Typography.Text>
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      )}
    </Card>
  );
};
