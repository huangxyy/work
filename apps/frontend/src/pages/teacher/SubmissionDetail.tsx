import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Empty,
  List,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSubmission, regradeSubmission } from '../../api';
import { useI18n } from '../../i18n';

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

export const TeacherSubmissionDetailPage = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const [needRewrite, setNeedRewrite] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => fetchSubmission(id || ''),
    enabled: !!id,
  });

  const regradeMutation = useMutation({
    mutationFn: (payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean }) =>
      regradeSubmission(id || '', payload),
    onSuccess: () => {
      message.success(t('teacher.submissionDetail.regradeQueued'));
      refetch();
    },
    onError: () => message.error(t('teacher.submissionDetail.regradeFailed')),
  });

  const status = data?.status || 'QUEUED';
  const grading =
    status === 'DONE' && data?.gradingJson && typeof data.gradingJson === 'object'
      ? (data.gradingJson as GradingResult)
      : null;

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
          <Empty description={t('submission.suggestionsLowEmpty')} />
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
          <Empty description={t('submission.suggestionsMidEmpty')} />
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
          <Empty description={t('submission.suggestionsHighEmpty')} />
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
                  {item.type}: {item.message} ({item.original} → {item.suggestion})
                </Typography.Text>
              </List.Item>
            )}
          />
        ) : (
          <Empty description={t('submission.suggestionsErrorsEmpty')} />
        ),
      },
    ],
    [grading, t],
  );

  return (
    <PageContainer
      title={t('teacher.submissionDetail.title')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/classes' },
          { title: t('teacher.submissionDetail.breadcrumb') },
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
      {data?.status === 'FAILED' ? (
        <Alert
          type="error"
          message={t('submission.processingFailed')}
          description={failureMessage}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {isLoading && !data ? (
        <ProCard bordered loading />
      ) : !data ? (
        <Empty description={t('submission.noData')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered>
            <Descriptions column={2} bordered>
              <Descriptions.Item label={t('common.student')}>
                {data.student?.name || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.account')}>
                {data.student?.account || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.homework')}>
                {data.homework?.title || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag
                  color={
                    status === 'DONE'
                      ? 'success'
                      : status === 'FAILED'
                        ? 'error'
                        : 'processing'
                  }
                >
                  {t(`status.${status.toLowerCase()}`)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('common.score')}>
                {typeof data.totalScore === 'number' ? data.totalScore : '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.lastUpdated')}>
                {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '--'}
              </Descriptions.Item>
            </Descriptions>
            <Space style={{ marginTop: 16 }} wrap>
              <Space>
                <Typography.Text>{t('teacher.submissionDetail.needRewrite')}</Typography.Text>
                <Switch checked={needRewrite} onChange={(value) => setNeedRewrite(value)} />
              </Space>
              <Button
                onClick={() =>
                  regradeMutation.mutate({ mode: 'cheap', needRewrite })
                }
                loading={regradeMutation.isPending}
              >
                {t('teacher.submissionDetail.regradeCheap')}
              </Button>
              <Button
                type="primary"
                onClick={() =>
                  regradeMutation.mutate({ mode: 'quality', needRewrite })
                }
                loading={regradeMutation.isPending}
              >
                {t('teacher.submissionDetail.regradeQuality')}
              </Button>
            </Space>
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

          {data.ocrText ? (
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
