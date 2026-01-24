import { Alert, Card, Collapse, Descriptions, List, Spin, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchSubmission } from '../../api';

type GradingResult = {
  totalScore: number;
  dimensionScores: {
    grammar: number;
    vocabulary: number;
    structure: number;
    content: number;
    coherence: number;
    handwritingClarity?: number;
  };
  errors: Array<{
    type: string;
    message: string;
    original: string;
    suggestion: string;
  }>;
  suggestions: {
    low: string[];
    mid: string[];
    high: string[];
    rewrite?: string;
  };
  summary: string;
  nextSteps: string[];
};

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
  const grading =
    status === 'DONE' && data?.gradingJson && typeof data.gradingJson === 'object'
      ? (data.gradingJson as GradingResult)
      : null;

  return (
    <Card title="Submission Result">
      {isLoading ? (
        <Spin />
      ) : (
        <>
          {status === 'FAILED' ? (
            <Alert
              type="error"
              message="Processing failed"
              description={data?.errorMsg || 'Please try submitting again later.'}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Status">
              <Tag color={status === 'DONE' ? 'green' : status === 'FAILED' ? 'red' : 'blue'}>
                {status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Total Score">
              {data?.totalScore ?? grading?.totalScore ?? '--'}
            </Descriptions.Item>
            <Descriptions.Item label="Summary">
              {grading?.summary ? (
                <Typography.Paragraph style={{ margin: 0 }}>{grading.summary}</Typography.Paragraph>
              ) : (
                <Typography.Text type="secondary">Waiting for processing</Typography.Text>
              )}
            </Descriptions.Item>
          </Descriptions>
          {grading ? (
            <>
              <Descriptions style={{ marginTop: 16 }} column={1} bordered>
                <Descriptions.Item label="Dimension Scores">
                  <List
                    size="small"
                    dataSource={Object.entries(grading.dimensionScores || {})}
                    renderItem={([key, value]) => (
                      <List.Item>
                        {key}: {value}
                      </List.Item>
                    )}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="Next Steps">
                  {grading.nextSteps?.length ? (
                    <List
                      size="small"
                      dataSource={grading.nextSteps}
                      renderItem={(item) => <List.Item>{item}</List.Item>}
                    />
                  ) : (
                    <Typography.Text type="secondary">--</Typography.Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
              <Collapse
                style={{ marginTop: 16 }}
                items={[
                  {
                    key: 'suggestions',
                    label: 'Suggestions',
                    children: (
                      <>
                        <Typography.Text strong>Low</Typography.Text>
                        {grading.suggestions?.low?.length ? (
                          <List
                            size="small"
                            dataSource={grading.suggestions.low}
                            renderItem={(item) => <List.Item>{item}</List.Item>}
                          />
                        ) : (
                          <Typography.Text type="secondary">--</Typography.Text>
                        )}
                        <Typography.Text strong>Mid</Typography.Text>
                        {grading.suggestions?.mid?.length ? (
                          <List
                            size="small"
                            dataSource={grading.suggestions.mid}
                            renderItem={(item) => <List.Item>{item}</List.Item>}
                          />
                        ) : (
                          <Typography.Text type="secondary">--</Typography.Text>
                        )}
                        <Typography.Text strong>High</Typography.Text>
                        {grading.suggestions?.high?.length ? (
                          <List
                            size="small"
                            dataSource={grading.suggestions.high}
                            renderItem={(item) => <List.Item>{item}</List.Item>}
                          />
                        ) : (
                          <Typography.Text type="secondary">--</Typography.Text>
                        )}
                        {grading.suggestions?.rewrite ? (
                          <>
                            <Typography.Text strong>Rewrite</Typography.Text>
                            <Typography.Paragraph style={{ marginBottom: 0 }}>
                              {grading.suggestions.rewrite}
                            </Typography.Paragraph>
                          </>
                        ) : null}
                      </>
                    ),
                  },
                  {
                    key: 'errors',
                    label: 'Errors',
                    children: grading.errors?.length ? (
                      <List
                        size="small"
                        dataSource={grading.errors}
                        renderItem={(item) => (
                          <List.Item>
                            {item.type}: {item.message} ({item.original} {"->"} {item.suggestion})
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Typography.Text type="secondary">No errors</Typography.Text>
                    ),
                  },
                ]}
              />
            </>
          ) : null}
          {data?.ocrText ? (
            <Collapse
              style={{ marginTop: 16 }}
              items={[
                {
                  key: 'ocr',
                  label: 'OCR Text',
                  children: (
                    <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {data.ocrText}
                    </Typography.Paragraph>
                  ),
                },
              ]}
            />
          ) : null}
        </>
      )}
    </Card>
  );
};
