import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Collapse, Descriptions, List, Skeleton, Space, Statistic, Steps, Tabs, Tag, Timeline, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSubmission } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';

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
    sampleEssay?: string;
  };
  summary: string;
  nextSteps: string[];
};

type SubmissionStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

const statusStepIndex: Record<SubmissionStatus, number> = {
  QUEUED: 0,
  PROCESSING: 1,
  DONE: 2,
  FAILED: 3,
};

export const SubmissionResultPage = () => {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => fetchSubmission(id || ''),
    enabled: !!id,
    refetchInterval: (query) => {
      const result = query.state.data as { status: SubmissionStatus } | undefined;
      if (!result) {
        return 2000;
      }
      return result.status === 'DONE' || result.status === 'FAILED' ? false : 2000;
    },
  });

  const status = (data?.status as SubmissionStatus) || 'QUEUED';
  const grading =
    status === 'DONE' && data?.gradingJson && typeof data.gradingJson === 'object'
      ? (data.gradingJson as GradingResult)
      : null;
  const currentStep = statusStepIndex[status] ?? 0;
  const isFailed = status === 'FAILED';

  const statusLabels = useMemo(
    () => ({
      QUEUED: t('status.queued'),
      PROCESSING: t('status.processing'),
      DONE: t('status.done'),
      FAILED: t('status.failed'),
    }),
    [t],
  );

  const errorCodeMessages = useMemo<Record<string, string>>(
    () => ({
      OCR_EMPTY: t('submission.error.ocrEmpty'),
      OCR_TIMEOUT: t('submission.error.ocrTimeout'),
      OCR_ERROR: t('submission.error.ocrError'),
      LLM_TIMEOUT: t('submission.error.llmTimeout'),
      LLM_SCHEMA_INVALID: t('submission.error.llmInvalid'),
      LLM_API_ERROR: t('submission.error.llmError'),
      LLM_QUOTA_EXCEEDED: t('submission.error.llmQuota'),
    }),
    [t],
  );

  const failureMessage =
    (data?.errorCode && errorCodeMessages[data.errorCode]) ||
    data?.errorMsg ||
    t('submission.failureFallback');

  const kpiScore = data?.totalScore ?? grading?.totalScore ?? 0;
  const errorCount = grading?.errors?.length ?? 0;
  const ocrLength = data?.ocrText?.length ?? 0;

  const suggestionsTabs = useMemo(
    () => [
      {
        key: 'low',
        label: t('submission.suggestionsLow'),
        children: grading?.suggestions?.low?.length ? (
          <List
            size="small"
            dataSource={grading.suggestions.low}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        ) : (
          <SoftEmpty description={t('submission.suggestionsLowEmpty')} />
        ),
      },
      {
        key: 'mid',
        label: t('submission.suggestionsMid'),
        children: grading?.suggestions?.mid?.length ? (
          <List
            size="small"
            dataSource={grading.suggestions.mid}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        ) : (
          <SoftEmpty description={t('submission.suggestionsMidEmpty')} />
        ),
      },
      {
        key: 'high',
        label: t('submission.suggestionsHigh'),
        children: grading?.suggestions?.high?.length ? (
          <List
            size="small"
            dataSource={grading.suggestions.high}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        ) : (
          <SoftEmpty description={t('submission.suggestionsHighEmpty')} />
        ),
      },
      {
        key: 'errors',
        label: t('submission.suggestionsErrors'),
        children: grading?.errors?.length ? (
          <List
            size="small"
            dataSource={grading.errors}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text>
                  {localizeErrorType(item.type)}: {item.message} ({item.original} → {item.suggestion})
                </Typography.Text>
              </List.Item>
            )}
          />
        ) : (
          <SoftEmpty description={t('submission.suggestionsErrorsEmpty')} />
        ),
      },
      {
        key: 'summary',
        label: t('submission.suggestionsSummary'),
        children: grading?.summary ? (
          <Typography.Paragraph>{grading.summary}</Typography.Paragraph>
        ) : (
          <SoftEmpty description={t('submission.suggestionsSummaryEmpty')} />
        ),
      },
    ],
    [grading, t],
  );

  const timelineItems = useMemo(() => {
    const stages = [
      t('submission.timeline.queued'),
      t('submission.timeline.ocrProcessing'),
      t('submission.timeline.llmGrading'),
      status === 'FAILED' ? t('submission.timeline.failed') : t('submission.timeline.completed'),
    ];
    return stages.map((label, index) => {
      const isActive = index <= currentStep;
      const color = isFailed && index === currentStep ? 'red' : isActive ? 'green' : 'gray';
      return { color, children: label };
    });
  }, [currentStep, isFailed, status, t]);

  return (
    <PageContainer
      title={t('submission.resultTitle')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/submissions' },
          { title: t('submission.resultTitle') },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message={t('submission.loadError')}
          description={error instanceof Error ? error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {status === 'FAILED' ? (
        <Alert
          type="error"
          message={t('submission.processingFailed')}
          description={failureMessage}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {isLoading && !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !data ? (
        <SoftEmpty description={t('submission.noData')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered>
            <Steps
              current={currentStep}
              status={isFailed ? 'error' : status === 'DONE' ? 'finish' : 'process'}
              items={[
                { title: statusLabels.QUEUED },
                { title: statusLabels.PROCESSING },
                { title: statusLabels.DONE },
                { title: statusLabels.FAILED },
              ]}
            />
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Typography.Text type="secondary">{t('common.status')}</Typography.Text>
              <div>
                <Tag
                  color={
                    status === 'DONE' ? 'success' : status === 'FAILED' ? 'error' : 'processing'
                  }
                >
                  {statusLabels[status] || status}
                </Tag>
              </div>
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Statistic title={t('submission.totalScore')} value={kpiScore} suffix="/ 100" />
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Statistic title={t('submission.errors')} value={errorCount} />
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
              <Statistic title={t('submission.ocrLength')} value={ocrLength} />
            </ProCard>
          </ProCard>

          <ProCard bordered title={t('submission.highlights')}>
            <Descriptions column={1} bordered>
              <Descriptions.Item label={t('submission.summary')}>
                {grading?.summary ? (
                  <Typography.Paragraph style={{ margin: 0 }}>{grading.summary}</Typography.Paragraph>
                ) : (
                  <Typography.Text type="secondary">{t('submission.waiting')}</Typography.Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('submission.nextSteps')}>
                {grading?.nextSteps?.length ? (
                  <List
                    size="small"
                    dataSource={grading.nextSteps}
                    renderItem={(item) => <List.Item>{item}</List.Item>}
                  />
                ) : (
                  <Typography.Text type="secondary">{t('submission.noNextSteps')}</Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </ProCard>

          <ProCard bordered title={t('submission.feedback')}>
            <Tabs items={suggestionsTabs} />
            {grading?.suggestions?.rewrite ? (
              <ProCard bordered title={t('submission.rewrite')} style={{ marginTop: 16 }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {grading.suggestions.rewrite}
                </Typography.Paragraph>
              </ProCard>
            ) : null}
            {grading?.suggestions?.sampleEssay ? (
              <ProCard bordered title={t('submission.sampleEssay')} style={{ marginTop: 16 }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {grading.suggestions.sampleEssay}
                </Typography.Paragraph>
              </ProCard>
            ) : null}
          </ProCard>

          <ProCard bordered title={t('submission.processingTimeline')}>
            <Timeline items={timelineItems} />
          </ProCard>

          {data?.ocrText ? (
            <Collapse
              items={[
                {
                  key: 'ocr',
                  label: t('submission.ocrText'),
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
