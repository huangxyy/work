import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Collapse, Descriptions, Image, Input, InputNumber, List, Progress, Space, Switch, Tabs, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSubmission, regradeSubmission, addTeacherFeedback } from '../../api';
import { ChartPanel } from '../../components/ChartPanel';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n, localizeErrorType } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { formatDate } from '../../utils/dateFormat';
import { CHART_PALETTE } from '../../theme/charts';

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
  const message = useMessage();
  const [needRewrite, setNeedRewrite] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => fetchSubmission(id || ''),
    enabled: !!id,
    staleTime: 60 * 1000,
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

  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  const isEditedRef = useRef(false);

  const teacherComment = data?.teacherComment || '';
  const manualScore = data?.manualScore ?? null;

  // Only sync server data when user hasn't made local edits
  useEffect(() => {
    if (data && !isEditedRef.current) {
      setFeedbackComment(teacherComment);
      setFeedbackScore(manualScore);
    }
  }, [data, teacherComment, manualScore]);

  const handleCommentChange = useCallback((value: string) => {
    isEditedRef.current = true;
    setFeedbackComment(value);
  }, []);

  const handleScoreChange = useCallback((value: number | null) => {
    isEditedRef.current = true;
    setFeedbackScore(value);
  }, []);

  const feedbackMutation = useMutation({
    mutationFn: () => addTeacherFeedback(id || '', {
      comment: feedbackComment || undefined,
      manualScore: feedbackScore,
    }),
    onSuccess: () => {
      isEditedRef.current = false;
      message.success(t('teacher.submissionDetail.feedbackSaved'));
      refetch();
    },
    onError: () => message.error(t('teacher.submissionDetail.feedbackFailed')),
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
                  {localizeErrorType(item.type)}: {item.message} ({item.original} �?{item.suggestion})
                </Typography.Text>
              </List.Item>
            )}
          />
        ) : (
          <SoftEmpty description={t('submission.suggestionsErrorsEmpty')} />
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
          className="apple-inline-alert"
        />
      ) : null}
      {data?.status === 'FAILED' ? (
        <Alert
          type="error"
          message={t('submission.processingFailed')}
          description={failureMessage}
          className="apple-inline-alert"
        />
      ) : null}
      {isLoading && !data ? (
        <ProCard bordered loading className="apple-soft-card" />
      ) : !data ? (
        <SoftEmpty description={t('submission.noData')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered className="apple-soft-card">
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
                  className="apple-tag-pill"
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
                {formatDate(data.updatedAt)}
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

          {grading?.dimensionScores ? (
            <ProCard bordered title={t('submission.dimensionScores')} className="apple-soft-card">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                <div style={{ flex: '1 1 300px', minWidth: 280 }}>
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
                        axisName: {
                          color: '#4b5563',
                        },
                        splitArea: {
                          areaStyle: {
                            color: ['#fafafa', '#f5f5f5', '#fafafa', '#f5f5f5'],
                          },
                        },
                        axisLine: {
                          lineStyle: {
                            color: '#e5e7eb',
                          },
                        },
                        splitLine: {
                          lineStyle: {
                            color: '#e5e7eb',
                          },
                        },
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
                          areaStyle: { 
                            color: `${CHART_PALETTE[0]}30`,
                          },
                          lineStyle: {
                            color: CHART_PALETTE[0],
                            width: 2,
                          },
                          itemStyle: {
                            color: CHART_PALETTE[0],
                          },
                        }],
                      }],
                      tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        textStyle: { color: '#1f2937' },
                      },
                    }}
                    height={280}
                  />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {[
                      { key: 'grammar', label: t('submission.dim.grammar'), score: grading.dimensionScores.grammar ?? 0 },
                      { key: 'vocabulary', label: t('submission.dim.vocabulary'), score: grading.dimensionScores.vocabulary ?? 0 },
                      { key: 'structure', label: t('submission.dim.structure'), score: grading.dimensionScores.structure ?? 0 },
                      { key: 'content', label: t('submission.dim.content'), score: grading.dimensionScores.content ?? 0 },
                      { key: 'coherence', label: t('submission.dim.coherence'), score: grading.dimensionScores.coherence ?? 0 },
                    ].map((dim, index) => (
                      <div key={dim.key}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text style={{ fontSize: 13 }}>{dim.label}</Typography.Text>
                          <Typography.Text strong style={{ color: CHART_PALETTE[index % CHART_PALETTE.length] }}>
                            {dim.score}/20
                          </Typography.Text>
                        </Space>
                        <Progress 
                          percent={(dim.score / 20) * 100} 
                          showInfo={false}
                          strokeColor={CHART_PALETTE[index % CHART_PALETTE.length]}
                          trailColor="#f3f4f6"
                          size="small"
                        />
                      </div>
                    ))}
                  </Space>
                </div>
              </div>
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

          {data?.images?.length ? (
            <ProCard bordered title={t('submission.uploadedImages')} className="apple-soft-card">
              <Image.PreviewGroup>
                <Space wrap size={16}>
                  {data.images.map((img: { id: string; url: string }) => (
                    <Image key={img.id} src={img.url} width={200} loading="lazy" style={{ borderRadius: 8 }} placeholder />
                  ))}
                </Space>
              </Image.PreviewGroup>
            </ProCard>
          ) : null}

          <ProCard bordered title={t('teacher.submissionDetail.feedbackTitle')} className="apple-soft-card">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Typography.Text strong>{t('submission.manualScore')}</Typography.Text>
                <InputNumber
                  min={0}
                  max={100}
                  value={feedbackScore}
                  onChange={(v) => handleScoreChange(typeof v === 'number' ? v : null)}
                  style={{ marginLeft: 12, width: 120 }}
                  placeholder="0-100"
                />
              </div>
              <div>
                <Typography.Text strong>{t('teacher.submissionDetail.commentLabel')}</Typography.Text>
                <Input.TextArea
                  rows={4}
                  value={feedbackComment}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  placeholder={t('teacher.submissionDetail.commentPlaceholder')}
                  style={{ marginTop: 8 }}
                />
              </div>
              <Button
                type="primary"
                loading={feedbackMutation.isPending}
                onClick={() => feedbackMutation.mutate()}
              >
                {t('teacher.submissionDetail.saveFeedback')}
              </Button>
            </Space>
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
