import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Empty,
  List,
  Skeleton,
  Space,
  Statistic,
  Steps,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
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

const statusStepIndex: Record<string, number> = {
  QUEUED: 0,
  PROCESSING: 1,
  DONE: 2,
  FAILED: 3,
};

const errorCodeMessages: Record<string, string> = {
  OCR_EMPTY: 'No readable text was detected. Please upload clearer images.',
  OCR_TIMEOUT: 'OCR timed out. Please try again later.',
  OCR_ERROR: 'OCR service error. Please retry.',
  LLM_TIMEOUT: 'Grading timed out. Please try again later.',
  LLM_SCHEMA_INVALID: 'Grading output was invalid. Please retry.',
  LLM_API_ERROR: 'Grading service error. Please retry.',
  LLM_QUOTA_EXCEEDED: 'Daily grading quota exceeded. Please try tomorrow.',
};

export const SubmissionResultPage = () => {
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useQuery({
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
  const currentStep = statusStepIndex[status] ?? 0;
  const isFailed = status === 'FAILED';
  const failureMessage =
    (data?.errorCode && errorCodeMessages[data.errorCode]) ||
    data?.errorMsg ||
    'Please try submitting again later.';

  const kpiScore = data?.totalScore ?? grading?.totalScore ?? 0;
  const errorCount = grading?.errors?.length ?? 0;
  const ocrLength = data?.ocrText?.length ?? 0;

  const suggestionsTabs = useMemo(
    () => [
      {
        key: 'low',
        label: 'Low',
        children: grading?.suggestions?.low?.length ? (
          <List
            size="small"
            dataSource={grading.suggestions.low}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        ) : (
          <Empty description="No low-tier suggestions" />
        ),
      },
      {
        key: 'mid',
        label: 'Mid',
        children: grading?.suggestions?.mid?.length ? (
          <List
            size="small"
            dataSource={grading.suggestions.mid}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        ) : (
          <Empty description="No mid-tier suggestions" />
        ),
      },
      {
        key: 'high',
        label: 'High',
        children: grading?.suggestions?.high?.length ? (
          <List
            size="small"
            dataSource={grading.suggestions.high}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        ) : (
          <Empty description="No high-tier suggestions" />
        ),
      },
      {
        key: 'errors',
        label: 'Errors',
        children: grading?.errors?.length ? (
          <List
            size="small"
            dataSource={grading.errors}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text>
                  {item.type}: {item.message} ({item.original} → {item.suggestion})
                </Typography.Text>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No errors detected" />
        ),
      },
      {
        key: 'summary',
        label: 'Summary',
        children: grading?.summary ? (
          <Typography.Paragraph>{grading.summary}</Typography.Paragraph>
        ) : (
          <Empty description="Summary will appear after grading" />
        ),
      },
    ],
    [grading],
  );

  const timelineItems = useMemo(() => {
    const stages = ['Queued', 'OCR Processing', 'LLM Grading', status === 'FAILED' ? 'Failed' : 'Completed'];
    return stages.map((label, index) => {
      const isActive = index <= currentStep;
      const color = isFailed && index === currentStep ? 'red' : isActive ? 'green' : 'gray';
      return { color, children: label };
    });
  }, [currentStep, isFailed, status]);

  return (
    <PageContainer
      title="Submission Result"
      breadcrumb={{
        items: [
          { title: 'Student', path: '/student/submissions' },
          { title: 'Submission Result' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load submission"
          description={error instanceof Error ? error.message : 'Please try again.'}
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {status === 'FAILED' ? (
        <Alert
          type="error"
          message="Processing failed"
          description={failureMessage}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {isLoading && !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !data ? (
        <Empty description="No submission data" />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered>
            <Steps
              current={currentStep}
              status={isFailed ? 'error' : status === 'DONE' ? 'finish' : 'process'}
              items={[
                { title: 'Queued' },
                { title: 'Processing' },
                { title: 'Done' },
                { title: 'Failed' },
              ]}
            />
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Typography.Text type="secondary">Status</Typography.Text>
              <div>
                <Tag
                  color={
                    status === 'DONE' ? 'success' : status === 'FAILED' ? 'error' : 'processing'
                  }
                >
                  {status}
                </Tag>
              </div>
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Statistic title="Total Score" value={kpiScore} suffix="/ 100" />
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Statistic title="Errors" value={errorCount} />
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Statistic title="OCR Length" value={ocrLength} />
            </ProCard>
          </ProCard>

          <ProCard bordered title="Highlights">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Summary">
                {grading?.summary ? (
                  <Typography.Paragraph style={{ margin: 0 }}>{grading.summary}</Typography.Paragraph>
                ) : (
                  <Typography.Text type="secondary">Waiting for processing</Typography.Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Next Steps">
                {grading?.nextSteps?.length ? (
                  <List
                    size="small"
                    dataSource={grading.nextSteps}
                    renderItem={(item) => <List.Item>{item}</List.Item>}
                  />
                ) : (
                  <Typography.Text type="secondary">No next steps yet</Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </ProCard>

          <ProCard bordered title="Feedback">
            <Tabs items={suggestionsTabs} />
            {grading?.suggestions?.rewrite ? (
              <ProCard bordered title="Rewrite" style={{ marginTop: 16 }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {grading.suggestions.rewrite}
                </Typography.Paragraph>
              </ProCard>
            ) : null}
          </ProCard>

          <ProCard bordered title="Processing Timeline">
            <Timeline items={timelineItems} />
          </ProCard>

          {data?.ocrText ? (
            <Collapse
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
        </Space>
      )}
    </PageContainer>
  );
};
