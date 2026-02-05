import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Descriptions, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchTeacherBatchUploadDetail } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';

type BatchSubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  updatedAt?: string;
};

export const TeacherBatchUploadDetailPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();

  const detailQuery = useQuery({
    queryKey: ['batch-detail', id],
    queryFn: () => fetchTeacherBatchUploadDetail(id || ''),
    enabled: !!id,
  });

  const statusMeta = useMemo(
    () => ({
      DONE: { label: t('status.done'), color: 'success' },
      PROCESSING: { label: t('status.processing'), color: 'processing' },
      FAILED: { label: t('status.failed'), color: 'error' },
      PARTIAL: { label: t('teacher.batchUpload.partial'), color: 'warning' },
      EMPTY: { label: t('teacher.batchUpload.empty'), color: 'default' },
    }),
    [t],
  );

  const reasonLabels = useMemo(
    () => ({
      NON_IMAGE: t('teacher.batchUpload.reason.nonImage'),
      ACCOUNT_NOT_FOUND: t('teacher.batchUpload.reason.accountNotFound'),
      STUDENT_NOT_FOUND: t('teacher.batchUpload.reason.studentNotFound'),
      OCR_EMPTY: t('teacher.batchUpload.reason.ocrEmpty'),
      OCR_FAILED: t('teacher.batchUpload.reason.ocrFailed'),
      AI_NO_MATCH: t('teacher.batchUpload.reason.aiNoMatch'),
      AI_AMBIGUOUS: t('teacher.batchUpload.reason.aiAmbiguous'),
      AI_PARSE_FAILED: t('teacher.batchUpload.reason.aiParseFailed'),
      AI_NOT_CONFIGURED: t('teacher.batchUpload.reason.aiNotConfigured'),
      AI_FAILED: t('teacher.batchUpload.reason.aiFailed'),
      OVERRIDE_NOT_FOUND: t('teacher.batchUpload.reason.overrideNotFound'),
    }),
    [t],
  );

  const data = detailQuery.data;
  const batchStatus = data?.status || 'EMPTY';
  const statusTag = statusMeta[batchStatus as keyof typeof statusMeta];

  return (
    <PageContainer
      title={t('teacher.batchUpload.detailTitle')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/homeworks' },
          { title: t('teacher.batchUpload.detailTitle') },
        ],
      }}
    >
      {detailQuery.isError ? (
        <Alert
          type="error"
          message={t('teacher.batchUpload.detailLoadFailed')}
          description={detailQuery.error instanceof Error ? detailQuery.error.message : t('common.tryAgain')}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {detailQuery.isLoading && !data ? (
        <ProCard bordered loading />
      ) : !data ? (
        <SoftEmpty description={t('teacher.batchUpload.detailEmpty')} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title={t('teacher.batchUpload.detailSummary')}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label={t('common.homework')}>
                {data.homework?.title || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.historyUploader')}>
                {data.uploader ? `${data.uploader.name} (${data.uploader.account})` : '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.historyStatus')}>
                {statusTag ? <Tag color={statusTag.color}>{statusTag.label}</Tag> : batchStatus}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.mode')}>
                {data.mode || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.needRewrite')}>
                {data.needRewrite ? t('common.yes') : t('common.no')}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.historyCreatedAt')}>
                {data.createdAt ? new Date(data.createdAt).toLocaleString() : '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.totalImages')}>
                {data.totalImages}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.matchedImages')}>
                {data.matchedImages}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.unmatchedImages')}>
                {data.unmatchedCount}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.createdSubmissions')}>
                {data.createdSubmissions}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.progress')}>
                <Space size={[4, 4]} wrap>
                  <Tag color="success">{`${t('status.done')} ${data.statusCounts?.done || 0}`}</Tag>
                  <Tag color="processing">{`${t('status.processing')} ${data.statusCounts?.processing || 0}`}</Tag>
                  <Tag>{`${t('status.queued')} ${data.statusCounts?.queued || 0}`}</Tag>
                  <Tag color="error">{`${t('status.failed')} ${data.statusCounts?.failed || 0}`}</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </ProCard>

          <ProCard bordered title={t('teacher.batchUpload.detailSkipped')}>
            {data.skipped && data.skipped.length ? (
              <List
                dataSource={data.skipped}
                pagination={{ pageSize: 6 }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={0}>
                      <Typography.Text>{item.file}</Typography.Text>
                      <Typography.Text type="secondary">
                        {reasonLabels[item.reason as keyof typeof reasonLabels] || item.reason}
                      </Typography.Text>
                      {item.analysisZh || item.analysisEn ? (
                        <Typography.Text type="secondary">
                          {item.analysisZh}
                          {item.analysisEn ? ` / ${item.analysisEn}` : ''}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <SoftEmpty description={t('teacher.batchUpload.detailNoSkipped')} />
            )}
          </ProCard>

          <ProCard bordered title={t('teacher.batchUpload.detailSubmissions')}>
            <ProTable<BatchSubmissionRow>
              rowKey="id"
              dataSource={data.submissions}
              search={false}
              pagination={{ pageSize: 8 }}
              options={false}
              columns={[
                {
                  title: t('common.student'),
                  dataIndex: 'studentName',
                  render: (value) => <Typography.Text strong>{value}</Typography.Text>,
                },
                { title: t('common.account'), dataIndex: 'studentAccount', width: 160 },
                {
                  title: t('common.status'),
                  dataIndex: 'status',
                  render: (value) => {
                    const map = {
                      QUEUED: { label: t('status.queued'), color: 'default' },
                      PROCESSING: { label: t('status.processing'), color: 'processing' },
                      DONE: { label: t('status.done'), color: 'success' },
                      FAILED: { label: t('status.failed'), color: 'error' },
                    } as const;
                    const meta = map[value as keyof typeof map];
                    return meta ? <Tag color={meta.color}>{meta.label}</Tag> : value;
                  },
                  width: 140,
                },
                {
                  title: t('common.score'),
                  dataIndex: 'totalScore',
                  renderText: (value) => (typeof value === 'number' ? value : '--'),
                  width: 120,
                },
                {
                  title: t('common.lastUpdated'),
                  dataIndex: 'updatedAt',
                  renderText: (value) => value || '--',
                  width: 200,
                },
                {
                  title: t('common.action'),
                  valueType: 'option',
                  render: (_, row) => [
                    <a key="view" onClick={() => navigate(`/teacher/submission/${row.id}`)}>
                      {t('common.view')}
                    </a>,
                  ],
                },
              ]}
            />
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
