import { InboxOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Divider,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createTeacherBatchSubmissions,
  fetchTeacherBatchUploads,
  importClassStudents,
  previewTeacherBatchSubmissions,
  retryTeacherBatchUploads,
  retrySkippedSubmission,
} from '../../../api';
import { SoftEmpty } from '../../../components/SoftEmpty';
import { useI18n } from '../../../i18n';
import { useMessage } from '../../../hooks/useMessage';
import { formatDateShort } from '../../../utils/dateFormat';
import { resolveApiErrorMessage, validateUploadFiles } from './utils';
import type {
  BatchHistoryRow,
  BatchStatusCounts,
  TeacherBatchUploadResult,
  TeacherBatchPreviewResult,
} from './types';

interface BatchUploadTabProps {
  homeworkId: string;
  classId: string;
}

export const BatchUploadTab = ({ homeworkId, classId }: BatchUploadTabProps) => {
  const { t } = useI18n();
  const message = useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- local state ---
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStage, setUploadStage] = useState<'uploading' | 'grading' | 'finishing' | null>(null);
  const [previewPercent, setPreviewPercent] = useState(0);
  const [batchResult, setBatchResult] = useState<TeacherBatchUploadResult | null>(null);
  const [previewResult, setPreviewResult] = useState<TeacherBatchPreviewResult | null>(null);
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({});
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [skippedFileNames, setSkippedFileNames] = useState<Record<string, string>>({});
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importResults, setImportResults] = useState<{
    created: number;
    conflicts: Array<{ account: string; name: string; reason: string }>;
  } | null>(null);

  const uploadStageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previewPercentTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (uploadStageTimerRef.current) {
        clearTimeout(uploadStageTimerRef.current);
      }
      if (previewPercentTimerRef.current) {
        clearTimeout(previewPercentTimerRef.current);
      }
    };
  }, []);

  // Reset preview state when file list changes
  useEffect(() => {
    setPreviewResult(null);
    setPreviewPercent(0);
    setMappingOverrides({});
    setNameOverrides({});
    setExcludedItems(new Set());
    setExpandedDetails(new Set());
    setUploadPercent(0);
    setUploadStage(null);
  }, [fileList]);

  // --- memoised labels ---
  const uploadTips = useMemo(
    () => [t('teacher.batchUpload.tip1'), t('teacher.batchUpload.tip2'), t('teacher.batchUpload.tip3')],
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
      USER_EXCLUDED: t('teacher.batchUpload.reason.userExcluded'),
    }),
    [t],
  );

  // --- queries ---
  const batchesQuery = useQuery<BatchHistoryRow[]>({
    queryKey: ['batch-uploads', homeworkId],
    queryFn: () => fetchTeacherBatchUploads(homeworkId),
    enabled: !!homeworkId,
  });

  // --- mutations ---
  const batchMutation = useMutation({
    mutationFn: createTeacherBatchSubmissions,
    onMutate: () => {
      setUploadPercent(10);
      setUploadStage('uploading');
    },
    onSuccess: (data) => {
      setBatchResult(data);
      setPreviewResult(null);
      setMappingOverrides({});
      setUploadPercent(100);
      setUploadStage('finishing');
      message.success(t('teacher.batchUpload.success'));
      // Refresh submissions tab & batch history
      queryClient.invalidateQueries({ queryKey: ['homework-submissions', homeworkId] });
      batchesQuery.refetch();
      uploadStageTimerRef.current = setTimeout(() => setUploadStage(null), 2000);
    },
    onError: (error: unknown) => {
      setUploadPercent(0);
      setUploadStage(null);
      message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.failed')));
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewTeacherBatchSubmissions,
    onMutate: () => {
      setPreviewPercent(10);
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setMappingOverrides({});
      setPreviewPercent(100);
      message.success(t('teacher.batchUpload.previewSuccess'));
      previewPercentTimerRef.current = setTimeout(() => setPreviewPercent(0), 2000);
    },
    onError: (error: unknown) => {
      setPreviewPercent(0);
      message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.previewFailed')));
    },
  });

  const retryBatchMutation = useMutation({
    mutationFn: retryTeacherBatchUploads,
    onSuccess: (data) => {
      message.success(`${t('teacher.batchUpload.retryFailedSuccess')} ${data.count}`);
      batchesQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['homework-submissions', homeworkId] });
    },
    onError: () => message.error(t('teacher.batchUpload.retryFailedFailed')),
  });

  const retrySkippedMutation = useMutation({
    mutationFn: ({
      homeworkId: hwId,
      fileKey,
      filename,
      studentName,
      batchId,
    }: {
      homeworkId: string;
      fileKey: string;
      filename: string;
      studentName: string;
      batchId?: string;
    }) => retrySkippedSubmission(hwId, fileKey, filename, studentName, batchId),
    onSuccess: (_, variables) => {
      message.success(t('teacher.batchUpload.retrySkippedSuccess'));
      setBatchResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          skipped: prev.skipped.filter((item) => item.fileKey !== variables.fileKey),
        };
      });
      setSkippedFileNames((prev) => {
        const next = { ...prev };
        delete next[variables.fileKey];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['homework-submissions', homeworkId] });
      batchesQuery.refetch();
    },
    onError: (error: unknown) =>
      message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.retrySkippedFailed'))),
  });

  const batchImportMutation = useMutation({
    mutationFn: ({
      classId: cId,
      students,
    }: {
      classId: string;
      students: Array<{ account: string; name: string }>;
    }) => importClassStudents(cId, { students }),
    onSuccess: (data) => {
      setImportResults({
        created: data.created.length,
        conflicts: data.existing.map((e: { account: string; name: string }) => ({
          account: e.account,
          name: e.name,
          reason: t('teacher.batchUpload.accountExists'),
        })),
      });
      if (data.created.length > 0) {
        message.success(`${t('teacher.batchUpload.batchImportSuccess')} ${data.created.length}`);
      }
    },
    onError: (error: unknown) => {
      message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.batchImportFailed')));
    },
  });

  // --- handlers ---
  const getRawFiles = () =>
    fileList.map((file) => file.originFileObj).filter((file): file is RcFile => !!file);

  const handlePreview = async () => {
    if (!homeworkId) {
      message.error(t('teacher.batchUpload.missingHomework'));
      return;
    }
    const rawFiles = getRawFiles();
    if (!rawFiles.length) {
      message.warning(t('teacher.batchUpload.uploadAtLeastOne'));
      return;
    }
    const { imageFiles, zipFiles, valid } = validateUploadFiles(rawFiles, t, (msg) =>
      message.warning(msg),
    );
    if (!valid) return;

    setBatchResult(null);
    setPreviewResult(null);
    try {
      await previewMutation.mutateAsync({
        homeworkId,
        images: zipFiles.length ? [] : imageFiles,
        archive: zipFiles.length ? zipFiles[0] : null,
        nameOverrides: Object.keys(nameOverrides).length ? nameOverrides : undefined,
      });
    } catch {
      // handled by mutation onError
    }
  };

  const handleBatchUpload = async () => {
    if (!homeworkId) {
      message.error(t('teacher.batchUpload.missingHomework'));
      return;
    }
    const rawFiles = getRawFiles();
    if (!rawFiles.length) {
      message.warning(t('teacher.batchUpload.uploadAtLeastOne'));
      return;
    }
    const { imageFiles, zipFiles, valid } = validateUploadFiles(rawFiles, t, (msg) =>
      message.warning(msg),
    );
    if (!valid) return;

    setBatchResult(null);
    setPreviewResult(null);
    setUploadStage('uploading');
    try {
      await batchMutation.mutateAsync({
        homeworkId,
        images: zipFiles.length ? [] : imageFiles,
        archive: zipFiles.length ? zipFiles[0] : null,
        mappingOverrides: Object.keys(mappingOverrides).length ? mappingOverrides : undefined,
        nameOverrides: Object.keys(nameOverrides).length ? nameOverrides : undefined,
        excludedFileKeys:
          excludedItems.size > 0 ? JSON.stringify(Array.from(excludedItems)) : undefined,
      });
    } catch {
      // handled by mutation onError
    }
  };

  const handleBatchImport = (
    items: Array<{ extractedName?: { zh: string; pinyin: string } }>,
  ) => {
    if (!classId) {
      message.warning(t('teacher.classDetail.selectClass'));
      return;
    }
    const students = items
      .filter((item) => item.extractedName)
      .map((item) => ({
        account: item.extractedName!.pinyin,
        name: item.extractedName!.zh,
      }));
    if (students.length === 0) {
      message.warning(t('teacher.batchUpload.noStudentsToImport'));
      return;
    }
    setImportResults(null);
    setImportModalVisible(true);
    batchImportMutation.mutate({ classId, students });
  };

  const handleConfirmImport = () => {
    setImportModalVisible(false);
    setImportResults(null);
    if (fileList.length > 0) {
      handlePreview();
    }
  };

  const toggleExclude = (fileKey: string) => {
    setExcludedItems((prev) => {
      const next = new Set(prev);
      if (next.has(fileKey)) {
        next.delete(fileKey);
      } else {
        next.add(fileKey);
      }
      return next;
    });
  };

  const toggleExpand = (fileKey: string) => {
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(fileKey)) {
        next.delete(fileKey);
      } else {
        next.add(fileKey);
      }
      return next;
    });
  };

  // --- batch history columns ---
  const batchStatusMeta = useMemo(
    () => ({
      DONE: { label: t('status.done'), color: 'success' },
      PROCESSING: { label: t('status.processing'), color: 'processing' },
      FAILED: { label: t('status.failed'), color: 'error' },
      PARTIAL: { label: t('teacher.batchUpload.partial'), color: 'warning' },
      EMPTY: { label: t('teacher.batchUpload.empty'), color: 'default' },
    }),
    [t],
  );

  const batchColumns: ColumnsType<BatchHistoryRow> = useMemo(
    () => [
      {
        title: t('teacher.batchUpload.historyCreatedAt'),
        dataIndex: 'createdAt',
        render: (value: string) => formatDateShort(value),
        width: 180,
      },
      {
        title: t('teacher.batchUpload.historyUploader'),
        dataIndex: 'uploader',
        render: (value: { name: string; account: string }) =>
          value ? `${value.name} (${value.account})` : '--',
        width: 180,
      },
      {
        title: t('teacher.batchUpload.totalImages'),
        dataIndex: 'totalImages',
        width: 120,
      },
      {
        title: t('teacher.batchUpload.matchedImages'),
        dataIndex: 'matchedImages',
        width: 140,
      },
      {
        title: t('teacher.batchUpload.unmatchedImages'),
        dataIndex: 'unmatchedCount',
        width: 140,
      },
      {
        title: t('teacher.batchUpload.createdSubmissions'),
        dataIndex: 'createdSubmissions',
        width: 140,
      },
      {
        title: t('teacher.batchUpload.historyStatus'),
        dataIndex: 'status',
        render: (value: string) => {
          const meta = batchStatusMeta[value as keyof typeof batchStatusMeta];
          return meta ? <Tag color={meta.color}>{meta.label}</Tag> : value;
        },
        width: 140,
      },
      {
        title: t('teacher.batchUpload.progress'),
        dataIndex: 'statusCounts',
        render: (counts: BatchStatusCounts | undefined, row: BatchHistoryRow) => {
          const total = row.createdSubmissions || 0;
          const done = counts?.done || 0;
          const processing = counts?.processing || 0;
          const queued = counts?.queued || 0;
          const failed = counts?.failed || 0;
          const percent = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <Space direction="vertical" size={4}>
              <Typography.Text strong style={{ fontSize: 14 }}>
                {percent}% ({done}/{total})
              </Typography.Text>
              <Space size={[4, 4]} wrap>
                <Tag color="success">
                  {t('status.done')} {done}
                </Tag>
                <Tag color="processing">
                  {t('status.processing')} {processing}
                </Tag>
                <Tag>
                  {t('status.queued')} {queued}
                </Tag>
                <Tag color="error">
                  {t('status.failed')} {failed}
                </Tag>
              </Space>
            </Space>
          );
        },
        width: 200,
      },
      {
        title: t('common.action'),
        dataIndex: 'id',
        render: (_: string, row: BatchHistoryRow) => (
          <Space size={8}>
            <Button size="small" onClick={() => navigate(`/teacher/batches/${row.id}`)}>
              {t('common.view')}
            </Button>
            <Button
              size="small"
              disabled={!row.statusCounts?.failed}
              loading={retryBatchMutation.isPending}
              onClick={() => retryBatchMutation.mutate(row.id)}
            >
              {t('teacher.batchUpload.retryFailed')}
            </Button>
          </Space>
        ),
        width: 160,
      },
    ],
    [t, batchStatusMeta, navigate, retryBatchMutation],
  );

  // --- render ---
  return (
    <>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Upload area */}
        <ProCard bordered>
          <Upload.Dragger
            multiple
            beforeUpload={() => false}
            fileList={fileList}
            maxCount={100}
            disabled={batchMutation.isPending}
            onChange={({ fileList: newList }) => setFileList(newList.slice(0, 100))}
            accept="image/*,.zip,.tif,.tiff"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('teacher.batchUpload.draggerText')}</p>
            <Typography.Text type="secondary">
              {t('teacher.batchUpload.draggerHint')}
            </Typography.Text>
          </Upload.Dragger>
          <Space style={{ marginTop: 16 }}>
            <Button
              onClick={handlePreview}
              loading={previewMutation.isPending}
              disabled={previewMutation.isPending || batchMutation.isPending}
            >
              {t('teacher.batchUpload.preview')}
            </Button>
            <Button
              type="primary"
              onClick={handleBatchUpload}
              loading={batchMutation.isPending}
              disabled={batchMutation.isPending}
            >
              {previewResult
                ? t('teacher.batchUpload.applyUpload')
                : t('teacher.batchUpload.submit')}
            </Button>
            <Button onClick={() => setFileList([])} disabled={batchMutation.isPending}>
              {t('common.reset')}
            </Button>
          </Space>
          {previewMutation.isPending || previewPercent > 0 ? (
            <div style={{ marginTop: 16 }}>
              <Progress percent={previewPercent} status="active" showInfo={true} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('teacher.batchUpload.previewing')}
              </Typography.Text>
            </div>
          ) : null}
          {batchMutation.isPending || uploadStage ? (
            <div style={{ marginTop: 16 }}>
              <Progress percent={uploadPercent} status="active" showInfo={true} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {uploadStage === 'uploading'
                  ? t('teacher.batchUpload.uploading')
                  : uploadStage === 'grading'
                    ? t('teacher.batchUpload.grading')
                    : uploadStage === 'finishing'
                      ? t('teacher.batchUpload.finishing')
                      : t('teacher.batchUpload.processing')}
              </Typography.Text>
            </div>
          ) : null}
        </ProCard>

        {/* Preview results */}
        {previewResult ? (
          <ProCard bordered title={t('teacher.batchUpload.previewTitle')}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label={t('teacher.batchUpload.totalImages')}>
                {previewResult.totalImages}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.matchedImages')}>
                {previewResult.matchedImages}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.unmatchedImages')}>
                {previewResult.unmatchedCount}
              </Descriptions.Item>
            </Descriptions>
            <Divider />

            {previewResult.matchResults ? (
              <Row gutter={16}>
                {/* Matched column */}
                <Col span={8}>
                  <ProCard
                    title={`${t('teacher.batchUpload.matched')} (${previewResult.matchResults.filter((r) => r.matchedAccount).length})`}
                    size="small"
                    bordered
                  >
                    <List
                      dataSource={previewResult.matchResults.filter((r) => r.matchedAccount)}
                      size="small"
                      pagination={{ pageSize: 5, size: 'small' }}
                      renderItem={(item) => (
                        <List.Item>
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <Typography.Text>{item.file}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {item.matchedName} ({item.matchedBy})
                            </Typography.Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </ProCard>
                </Col>

                {/* Unmatched with name column */}
                <Col span={8}>
                  <ProCard
                    title={`${t('teacher.batchUpload.unmatchedWithName')} (${(previewResult.matchResults || []).filter((r) => !r.matchedAccount && r.extractedName).length})`}
                    size="small"
                    bordered
                    extra={
                      <Button
                        type="primary"
                        size="small"
                        onClick={() =>
                          handleBatchImport(
                            (previewResult.matchResults || []).filter(
                              (r) => !r.matchedAccount && r.extractedName,
                            ),
                          )
                        }
                        disabled={
                          (previewResult.matchResults || []).filter(
                            (r) => !r.matchedAccount && r.extractedName,
                          ).length === 0
                        }
                      >
                        {t('teacher.batchUpload.batchImport')}
                      </Button>
                    }
                  >
                    <List
                      dataSource={(previewResult.matchResults || []).filter(
                        (r) => !r.matchedAccount && r.extractedName,
                      )}
                      size="small"
                      pagination={{ pageSize: 5, size: 'small' }}
                      renderItem={(item) => (
                        <List.Item>
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Typography.Text style={{ fontSize: 12 }}>{item.file}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {t('teacher.batchUpload.extractedName')}: {item.extractedName?.zh}
                            </Typography.Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </ProCard>
                </Col>

                {/* Unhandled column */}
                <Col span={8}>
                  <ProCard
                    title={`${t('teacher.batchUpload.unhandled')} (${previewResult.matchResults.filter((r) => !r.matchedAccount && !r.extractedName).length})`}
                    size="small"
                    bordered
                  >
                    <List
                      dataSource={previewResult.matchResults.filter(
                        (r) => !r.matchedAccount && !r.extractedName,
                      )}
                      size="small"
                      pagination={{ pageSize: 5, size: 'small' }}
                      renderItem={(item) => {
                        const isExcluded = item.fileKey && excludedItems.has(item.fileKey);
                        return (
                          <List.Item
                            actions={[
                              <Button
                                key="exclude"
                                size="small"
                                type={isExcluded ? 'primary' : 'default'}
                                danger={Boolean(isExcluded)}
                                onClick={() => item.fileKey && toggleExclude(item.fileKey)}
                              >
                                {isExcluded
                                  ? t('teacher.batchUpload.excluded')
                                  : t('teacher.batchUpload.exclude')}
                              </Button>,
                            ]}
                          >
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Typography.Text style={{ fontSize: 12 }}>
                                {item.file}
                              </Typography.Text>
                              <Space size={4}>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {reasonLabels[item.reason as keyof typeof reasonLabels] ||
                                    item.reason}
                                </Typography.Text>
                                {(item.analysisZh || item.analysisEn) && (
                                  <Typography.Link
                                    style={{ fontSize: 12 }}
                                    onClick={() => item.fileKey && toggleExpand(item.fileKey)}
                                  >
                                    {expandedDetails.has(item.fileKey || '')
                                      ? t('teacher.batchUpload.hideDetails')
                                      : t('teacher.batchUpload.showDetails')}
                                  </Typography.Link>
                                )}
                              </Space>
                              {expandedDetails.has(item.fileKey || '') &&
                                (item.analysisZh || item.analysisEn) && (
                                  <Alert
                                    type="info"
                                    message={item.analysisZh || item.analysisEn}
                                    banner
                                    style={{ fontSize: 11, padding: '4px 8px' }}
                                  />
                                )}
                            </Space>
                          </List.Item>
                        );
                      }}
                    />
                  </ProCard>
                </Col>
              </Row>
            ) : (
              <>
                {/* Fallback to original layout for backwards compatibility */}
                {previewResult.groups.length ? (
                  <List
                    header={t('teacher.batchUpload.groupsTitle')}
                    dataSource={previewResult.groups}
                    renderItem={(item) => (
                      <List.Item>
                        <Typography.Text>{`${item.name} (${item.account})`}</Typography.Text>
                        <Typography.Text type="secondary">
                          {t('teacher.batchUpload.imageCount')} {item.imageCount}
                        </Typography.Text>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Typography.Text type="secondary">
                    {t('teacher.batchUpload.noGroups')}
                  </Typography.Text>
                )}
                <Divider />
                {previewResult.unmatched.length ? (
                  <List
                    header={t('teacher.batchUpload.unmatchedTitle')}
                    dataSource={previewResult.unmatched}
                    pagination={{ pageSize: 6 }}
                    renderItem={(item) => (
                      <List.Item>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
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
                          <Input
                            style={{ minWidth: 200 }}
                            placeholder={t('teacher.batchUpload.inputNamePlaceholder')}
                            value={nameOverrides[item.fileKey || ''] || ''}
                            onChange={(e) => {
                              if (!item.fileKey) return;
                              setNameOverrides((prev) => {
                                const next = { ...prev };
                                const value = e.target.value.trim();
                                const fileKey = item.fileKey;
                                if (!fileKey) return next;
                                if (!value) {
                                  delete next[fileKey];
                                } else {
                                  next[fileKey] = value;
                                }
                                return next;
                              });
                            }}
                            allowClear
                          />
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Typography.Text type="secondary">
                    {t('teacher.batchUpload.noUnmatched')}
                  </Typography.Text>
                )}
              </>
            )}
          </ProCard>
        ) : null}

        {/* Tips */}
        <ProCard bordered title={t('teacher.batchUpload.tipsTitle')}>
          <List
            dataSource={uploadTips}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text>{item}</Typography.Text>
              </List.Item>
            )}
          />
        </ProCard>

        {/* Batch result (after upload) */}
        {batchResult ? (
          <ProCard bordered title={t('teacher.batchUpload.resultTitle')}>
            <Descriptions column={1} bordered>
              <Descriptions.Item label={t('teacher.batchUpload.totalImages')}>
                {batchResult.totalImages}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.acceptedImages')}>
                {batchResult.acceptedImages}
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.batchUpload.createdSubmissions')}>
                {batchResult.createdSubmissions}
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            {batchResult.skipped.length ? (
              <List
                header={t('teacher.batchUpload.skippedTitle')}
                dataSource={batchResult.skipped}
                pagination={{ pageSize: 6 }}
                renderItem={(item) => (
                  <List.Item
                    actions={
                      item.fileKey
                        ? [
                            <Button
                              key="retry"
                              type="primary"
                              size="small"
                              loading={retrySkippedMutation.isPending}
                              disabled={!skippedFileNames[item.fileKey]?.trim()}
                              onClick={() => {
                                if (!homeworkId || !item.fileKey) return;
                                const studentName = skippedFileNames[item.fileKey]?.trim();
                                if (!studentName) return;
                                retrySkippedMutation.mutate({
                                  homeworkId,
                                  fileKey: item.fileKey,
                                  filename: item.file,
                                  studentName,
                                  batchId: batchResult.batchId,
                                });
                              }}
                            >
                              {t('teacher.batchUpload.continueGrading')}
                            </Button>,
                          ]
                        : undefined
                    }
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
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
                      {item.fileKey && (
                        <Input
                          size="small"
                          style={{ width: 200 }}
                          placeholder={t('teacher.batchUpload.inputNamePlaceholder')}
                          value={skippedFileNames[item.fileKey] || ''}
                          onChange={(e) => {
                            setSkippedFileNames((prev) => ({
                              ...prev,
                              [item.fileKey!]: e.target.value,
                            }));
                          }}
                          allowClear
                        />
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Typography.Text type="secondary">
                {t('teacher.batchUpload.noSkipped')}
              </Typography.Text>
            )}
          </ProCard>
        ) : null}

        {/* Batch history */}
        <ProCard bordered title={t('teacher.batchUpload.historyTitle')}>
          {batchesQuery.isLoading ? (
            <ProCard bordered loading />
          ) : !batchesQuery.data?.length ? (
            <SoftEmpty description={t('teacher.batchUpload.historyEmpty')} />
          ) : (
            <Table<BatchHistoryRow>
              rowKey="id"
              columns={batchColumns}
              dataSource={batchesQuery.data}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          )}
        </ProCard>
      </Space>

      {/* Import modal */}
      <Modal
        title={t('teacher.batchUpload.batchImport')}
        open={importModalVisible}
        onOk={handleConfirmImport}
        onCancel={() => setImportModalVisible(false)}
        width={600}
      >
        <Descriptions column={1} bordered>
          <Descriptions.Item label={t('teacher.batchUpload.batchImportRules')}>
            {t('teacher.batchUpload.batchImportRules')}
          </Descriptions.Item>
        </Descriptions>
        {batchImportMutation.isPending ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Progress type="circle" />
          </div>
        ) : importResults ? (
          <>
            {importResults.created > 0 && (
              <Alert
                type="success"
                message={`${t('teacher.batchUpload.batchImportSuccess')} ${importResults.created}`}
                style={{ marginBottom: 16 }}
              />
            )}
            {importResults.conflicts.length > 0 && (
              <Alert
                type="warning"
                message={t('teacher.batchUpload.batchImportConflict')}
                description={
                  <List
                    size="small"
                    dataSource={importResults.conflicts}
                    renderItem={(item) => (
                      <List.Item>
                        {item.name} ({item.account}) - {item.reason}
                      </List.Item>
                    )}
                  />
                }
              />
            )}
          </>
        ) : null}
      </Modal>
    </>
  );
};
