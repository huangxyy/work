import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Collapse, Descriptions, Image, List, Skeleton, Space, Statistic, Steps, Tabs, Tag, Timeline, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchSubmission } from '../../api';
import { ChartPanel } from '../../components/ChartPanel';
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
type SubmissionPollData = { status: SubmissionStatus; updatedAt?: string };

const statusStepIndex: Record<SubmissionStatus, number> = {
  QUEUED: 0,
  PROCESSING: 1,
  DONE: 2,
  FAILED: 3,
};

export const SubmissionResultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => fetchSubmission(id || ''),
    enabled: !!id,
    refetchInterval: (query) => {
      const result = query.state.data as SubmissionPollData | undefined;
      if (!result) {
        return 2000;
      }

      if (result.status === 'DONE' || result.status === 'FAILED') {
        return false;
      }

      if (result.status === 'QUEUED') {
        return 2000;
      }

      const baseline = result.updatedAt ? new Date(result.updatedAt).getTime() : query.state.dataUpdatedAt;
      const elapsed = Math.max(0, Date.now() - (Number.isFinite(baseline) ? baseline : Date.now()));
      const step = Math.floor(elapsed / 30000);
      return Math.min(2000 * (2 ** step), 15000);
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
          className="apple-inline-alert"
        />
      ) : null}
      {status === 'FAILED' ? (
        <Alert
          type="error"
          message={t('submission.processingFailed')}
          description={failureMessage}
          action={
            data?.homework?.id ? (
              <Button
                type="primary"
                onClick={() => {
                  if (data?.homework?.id) {
                    navigate(`/student/submit/${data.homework.id}`);
                  }
                }}
              >
                {t('submission.resubmit')}
              </Button>
            ) : null
          }
          className="apple-inline-alert"
        />
      ) : null}
      {isLoading && !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !data ? (
        <SoftEmpty description={t('submission.noData')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered className="apple-soft-card">
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
                  className="apple-tag-pill"
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

          {grading?.dimensionScores ? (
            <ProCard bordered title={t('submission.dimensionScores')} className="apple-soft-card">
              <ChartPanel
                option={{
                  radar: {
                    indicator: [
                      { name: t('submission.dim.grammar'), max: 20 },
                      { name: t('submission.dim.vocabulary'), max: 20 },
                      { name: t('submission.dim.structure'), max: 20 },
                      { name: t('submission.dim.content'), max: 20 },
                      { name: t('submission.dim.coherence'), max: 20 },
                    ],
                    radius: '65%',
                  },
                  series: [{
                    type: 'radar',
                    data: [{
                      value: [
                        grading.dimensionScores.grammar ?? 0,
                        grading.dimensionScores.vocabulary ?? 0,
                        grading.dimensionScores.structure ?? 0,
                        grading.dimensionScores.content ?? 0,
                        grading.dimensionScores.coherence ?? 0,
                      ],
                      name: t('submission.dimensionScores'),
                      areaStyle: { opacity: 0.2 },
                    }],
                  }],
                  tooltip: {},
                }}
                height={320}
              />
            </ProCard>
          ) : null}

          {data?.images?.length ? (
            <ProCard bordered title={t('submission.uploadedImages')} className="apple-soft-card">
              <Image.PreviewGroup>
                <Space wrap size={16}>
                  {data.images.map((img: { id: string; url: string }) => (
                    <Image
                      key={img.id}
                      src={img.url}
                      width={200}
                      loading="lazy"
                      style={{ borderRadius: 8, objectFit: 'cover' }}
                      placeholder
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            </ProCard>
          ) : null}

          <ProCard bordered title={t('submission.highlights')} className="apple-soft-card">
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

          {data?.teacherComment || data?.manualScore != null ? (
            <ProCard bordered title={t('submission.teacherFeedback')} className="apple-soft-card">
              <Descriptions column={1} bordered>
                {data.manualScore != null ? (
                  <Descriptions.Item label={t('submission.manualScore')}>
                    <Typography.Text strong style={{ fontSize: 18, color: 'var(--apple-primary)' }}>
                      {data.manualScore} / 100
                    </Typography.Text>
                  </Descriptions.Item>
                ) : null}
                {data.teacherComment ? (
                  <Descriptions.Item label={t('submission.teacherComment')}>
                    <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {data.teacherComment}
                    </Typography.Paragraph>
                  </Descriptions.Item>
                ) : null}
              </Descriptions>
            </ProCard>
          ) : null}

          <ProCard bordered title={t('submission.feedback')} className="apple-soft-card">
            <Tabs items={suggestionsTabs} />
            {grading?.suggestions?.rewrite ? (
              <ProCard bordered title={t('submission.rewrite')} className="apple-soft-card" style={{ marginTop: 16 }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {grading.suggestions.rewrite}
                </Typography.Paragraph>
              </ProCard>
            ) : null}
            {grading?.suggestions?.sampleEssay ? (
              <ProCard bordered title={t('submission.sampleEssay')} className="apple-soft-card" style={{ marginTop: 16 }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {grading.suggestions.sampleEssay}
                </Typography.Paragraph>
              </ProCard>
            ) : null}
          </ProCard>

          <ProCard bordered title={t('submission.processingTimeline')} className="apple-soft-card">
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
