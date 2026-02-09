import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Input, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchTeacherBatchUploadDetail, retrySkippedSubmission, downloadTeacherSubmissionsPdf } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { formatDateShort, formatDate } from '../../utils/dateFormat';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { isAxiosError } from 'axios';

type BatchSubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  updatedAt?: string;
};

export const TeacherBatchUploadDetailPage = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const message = useMessage();
  // Track fileKeys that have been successfully retried
  const [processedFileKeys, setProcessedFileKeys] = useState<Set<string>>(new Set());
  const [skippedFileNames, setSkippedFileNames] = useState<Record<string, string>>({});
  const [retryModalVisible, setRetryModalVisible] = useState(false);
  const [currentSkippedItem, setCurrentSkippedItem] = useState<{
    file: string;
    fileKey?: string;
    reason: string;
  } | null>(null);

  // Helper function to download blob as file
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

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

  const resolveApiErrorMessage = (error: unknown, fallback: string) => {
    if (!isAxiosError(error)) {
      return fallback;
    }
    const rawMessage = (error.response?.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(rawMessage)) {
      return rawMessage.join('; ');
    }
    if (typeof rawMessage === 'string' && rawMessage.trim()) {
      return rawMessage;
    }
    return fallback;
  };

  const retrySkippedMutation = useMutation({
    mutationFn: ({ homeworkId, fileKey, filename, studentName, batchId }: {
      homeworkId: string;
      fileKey: string;
      filename: string;
      studentName: string;
      batchId?: string;
    }) => retrySkippedSubmission(homeworkId, fileKey, filename, studentName, batchId),
    onSuccess: (_, variables) => {
      message.success(t('teacher.batchUpload.retrySkippedSuccess'));
      // Mark this fileKey as processed so it won't show in the skipped list
      setProcessedFileKeys((prev) => new Set(prev).add(variables.fileKey));
      // Clear the name input for this fileKey
      setSkippedFileNames((prev) => {
        const next = { ...prev };
        delete next[variables.fileKey];
        return next;
      });
      detailQuery.refetch();
      setRetryModalVisible(false);
      setCurrentSkippedItem(null);
    },
    onError: (error: unknown) => message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.retrySkippedFailed'))),
  });

  const handleRetrySkipped = () => {
    if (!currentSkippedItem || !data?.homework?.id) return;
    const studentName = skippedFileNames[currentSkippedItem.fileKey || '']?.trim();
    if (!studentName) {
      message.warning(t('teacher.batchUpload.inputNamePlaceholder'));
      return;
    }
    retrySkippedMutation.mutate({
      homeworkId: data.homework.id,
      fileKey: currentSkippedItem.fileKey || '',
      filename: currentSkippedItem.file,
      studentName,
      batchId: id, // Link to current BatchUpload
    });
  };

  const openRetryModal = (item: { file: string; fileKey?: string; reason: string }) => {
    setCurrentSkippedItem(item);
    setRetryModalVisible(true);
  };

  // Export all PDFs for this batch
  const exportAllPdfMutation = useMutation({
    mutationFn: async () => {
      if (!data?.homework?.id || !data.submissions.length) return;
      const doneSubmissions = data.submissions.filter((s) => s.status === 'DONE');
      if (doneSubmissions.length === 0) {
        message.warning(t('teacher.batchUpload.noDoneSubmissions'));
        return;
      }
      const submissionIds = doneSubmissions.map((s) => s.id).join(',');
      return await downloadTeacherSubmissionsPdf(data.homework.id, submissionIds, language);
    },
    onSuccess: (blob) => {
      if (!blob) return;
      const doneCount = data?.submissions.filter((s) => s.status === 'DONE').length || 0;
      downloadBlob(blob, `batch-${id}-grading-sheets.pdf`);
      message.success(`${t('teacher.batchUpload.exportAllPdfSuccess')} ${doneCount}`);
    },
    onError: () => {
      message.error(t('teacher.batchUpload.exportFailed'));
    },
  });

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
                {data.createdAt ? formatDate(data.createdAt) : '--'}
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
                <Space direction="vertical" size={4}>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {Math.round(((data.statusCounts?.done || 0) / Math.max(data.totalImages, 1)) * 100)}%
                    ({data.statusCounts?.done || 0}/{data.totalImages})
                  </Typography.Text>
                  <Space size={[4, 4]} wrap>
                    <Tag color="success">{`${t('status.done')} ${data.statusCounts?.done || 0}`}</Tag>
                    <Tag color="processing">{`${t('status.processing')} ${data.statusCounts?.processing || 0}`}</Tag>
                    <Tag>{`${t('status.queued')} ${data.statusCounts?.queued || 0}`}</Tag>
                    <Tag color="error">{`${t('status.failed')} ${data.statusCounts?.failed || 0}`}</Tag>
                  </Space>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t('common.action')}>
                <Space>
                  <Button
                    type="primary"
                    disabled={!data.submissions.some((s) => s.status === 'DONE')}
                    loading={exportAllPdfMutation.isPending}
                    onClick={() => exportAllPdfMutation.mutate()}
                  >
                    {t('teacher.batchUpload.exportAllPdf')} ({data.submissions.filter((s) => s.status === 'DONE').length})
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </ProCard>

          <ProCard bordered title={t('teacher.batchUpload.detailSkipped')}>
            {data.skipped && data.skipped.filter((item) => !processedFileKeys.has(item.fileKey || '')).length ? (
              <List
                dataSource={data.skipped.filter((item) => !processedFileKeys.has(item.fileKey || ''))}
                pagination={{ pageSize: 6 }}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      item.fileKey ? (
                        <Button
                          key="retry"
                          type="primary"
                          size="small"
                          loading={retrySkippedMutation.isPending}
                          onClick={() => openRetryModal(item)}
                        >
                          {t('teacher.batchUpload.continueGrading')}
                        </Button>
                      ) : null,
                    ]}
                  >
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
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
                  render: (_, record) => formatDateShort(record.updatedAt),
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
      <Modal
        title={t('teacher.batchUpload.continueGrading')}
        open={retryModalVisible}
        onOk={handleRetrySkipped}
        onCancel={() => {
          setRetryModalVisible(false);
          setCurrentSkippedItem(null);
        }}
        okButtonProps={{ loading: retrySkippedMutation.isPending }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text>{currentSkippedItem?.file}</Typography.Text>
          <Input
            placeholder={t('teacher.batchUpload.inputNamePlaceholder')}
            value={skippedFileNames[currentSkippedItem?.fileKey || ''] || ''}
            onChange={(e) => {
              if (!currentSkippedItem?.fileKey) return;
              setSkippedFileNames((prev) => ({
                ...prev,
                [currentSkippedItem.fileKey]: e.target.value,
              }));
            }}
            allowClear
          />
        </Space>
      </Modal>
    </PageContainer>
  );
};
