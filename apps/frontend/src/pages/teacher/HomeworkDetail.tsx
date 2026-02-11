import { InboxOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Dropdown,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Tabs,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  createTeacherBatchSubmissions,
  deleteHomework,
  fetchHomeworkDeletePreview,
  importClassStudents,
  fetchTeacherHomeworkSubmissions,
  fetchTeacherBatchUploads,
  previewTeacherBatchSubmissions,
  regradeSubmission,
  regradeHomeworkSubmissions,
  downloadTeacherHomeworkSubmissionsCsv,
  downloadTeacherHomeworkImagesZip,
  downloadTeacherHomeworkRemindersCsv,
  downloadTeacherSubmissionsPdf,
  retryTeacherBatchUploads,
  retrySkippedSubmission,
  updateHomeworkLateSubmission,
  type TeacherBatchUploadResult,
  type TeacherBatchPreviewResult,
} from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { formatDateShort } from '../../utils/dateFormat';

type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
  allowLateSubmission?: boolean;
};

type SubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  updatedAt?: string;
};

type BatchStatusCounts = {
  done?: number;
  processing?: number;
  queued?: number;
  failed?: number;
};

type BatchHistoryRow = {
  id: string;
  createdAt: string;
  uploader?: { name: string; account: string };
  totalImages: number;
  matchedImages: number;
  unmatchedCount: number;
  createdSubmissions: number;
  status: string;
  statusCounts?: BatchStatusCounts;
};

export const TeacherHomeworkDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const state = location.state as { homework?: HomeworkItem; classId?: string | null } | undefined;
  const homework = state?.homework;
  const classId = state?.classId || '';
  const [allowLateSubmission, setAllowLateSubmission] = useState(Boolean(homework?.allowLateSubmission));
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStage, setUploadStage] = useState<'uploading' | 'grading' | 'finishing' | null>(null);
  const [previewPercent, setPreviewPercent] = useState(0);
  const [batchResult, setBatchResult] = useState<TeacherBatchUploadResult | null>(null);
  const [previewResult, setPreviewResult] = useState<TeacherBatchPreviewResult | null>(null);
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({});
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState<number | null>(null);
  const [scoreMax, setScoreMax] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importResults, setImportResults] = useState<{ created: number; conflicts: Array<{ account: string; name: string; reason: string }> } | null>(null);
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [skippedFileNames, setSkippedFileNames] = useState<Record<string, string>>({});

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

  useEffect(() => {
    setAllowLateSubmission(Boolean(homework?.allowLateSubmission));
  }, [homework?.allowLateSubmission, homework?.id]);

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

  const submissionsQuery = useQuery<SubmissionRow[]>({
    queryKey: ['homework-submissions', id],
    queryFn: () => fetchTeacherHomeworkSubmissions(id || ''),
    enabled: !!id,
  });

  const batchesQuery = useQuery<BatchHistoryRow[]>({
    queryKey: ['batch-uploads', id],
    queryFn: () => fetchTeacherBatchUploads(id || ''),
    enabled: !!id,
  });

  const deletePreviewQuery = useQuery({
    queryKey: ['homework-delete-preview', id],
    queryFn: () => fetchHomeworkDeletePreview(id || ''),
    enabled: !!id,
  });

  const filteredSubmissions = useMemo(() => {
    const list = (submissionsQuery.data || []) as SubmissionRow[];
    return list.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (scoreMin !== null) {
        if (typeof item.totalScore !== 'number' || item.totalScore < scoreMin) {
          return false;
        }
      }
      if (scoreMax !== null) {
        if (typeof item.totalScore !== 'number' || item.totalScore > scoreMax) {
          return false;
        }
      }
      if (dateRange && (dateRange[0] || dateRange[1])) {
        if (!item.updatedAt) {
          return false;
        }
        const updatedAtMs = new Date(item.updatedAt).getTime();
        if (dateRange[0]) {
          const startMs = dateRange[0].startOf('day').valueOf();
          if (updatedAtMs < startMs) {
            return false;
          }
        }
        if (dateRange[1]) {
          const endMs = dateRange[1].endOf('day').valueOf();
          if (updatedAtMs > endMs) {
            return false;
          }
        }
      }
      if (!keyword) {
        return true;
      }
      const needle = keyword.toLowerCase();
      return (
        item.studentName.toLowerCase().includes(needle) ||
        item.studentAccount.toLowerCase().includes(needle)
      );
    });
  }, [keyword, statusFilter, submissionsQuery.data, scoreMin, scoreMax, dateRange]);

  const failedCount = useMemo(
    () => (submissionsQuery.data || []).filter((item) => item.status === 'FAILED').length,
    [submissionsQuery.data],
  );

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
      submissionsQuery.refetch();
      batchesQuery.refetch();
      // Reset stage after a delay
      setTimeout(() => setUploadStage(null), 2000);
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
      // Reset preview percent after a delay
      setTimeout(() => setPreviewPercent(0), 2000);
    },
    onError: (error: unknown) => {
      setPreviewPercent(0);
      message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.previewFailed')));
    },
  });

  const updateLateSubmissionMutation = useMutation({
    mutationFn: (allow: boolean) => updateHomeworkLateSubmission(id || '', allow),
    onSuccess: async (data) => {
      setAllowLateSubmission(data.allowLateSubmission);
      message.success(
        data.allowLateSubmission
          ? t('teacher.homeworkDetail.lateSubmissionOpened')
          : t('teacher.homeworkDetail.lateSubmissionClosed'),
      );
      if (classId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks-summary', classId] });
      }
    },
    onError: (error: unknown) =>
      message.error(resolveApiErrorMessage(error, t('teacher.homeworkDetail.updateLateSubmissionFailed'))),
  });

  const deleteHomeworkMutation = useMutation({
    mutationFn: () => deleteHomework(id || ''),
    onSuccess: async () => {
      message.success(t('teacher.homeworks.deleted'));
      if (classId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks-summary', classId] });
      }
      navigate('/teacher/homeworks');
    },
    onError: (error: unknown) =>
      message.error(resolveApiErrorMessage(error, t('teacher.homeworks.deleteFailed'))),
  });

  const regradeFailedMutation = useMutation({
    mutationFn: regradeHomeworkSubmissions,
    onSuccess: (data) => {
      message.success(`${t('teacher.homeworkDetail.retryFailedSuccess')} ${data.count}`);
      submissionsQuery.refetch();
    },
    onError: () => message.error(t('teacher.homeworkDetail.retryFailedFailed')),
  });

  const regradeMutation = useMutation({
    mutationFn: ({ submissionId, mode }: { submissionId: string; mode?: 'cheap' | 'quality' }) =>
      regradeSubmission(submissionId, { mode }),
    onSuccess: () => {
      message.success(t('teacher.homeworkDetail.regradeSuccess'));
      submissionsQuery.refetch();
    },
    onError: () => message.error(t('teacher.homeworkDetail.regradeFailed')),
  });

  const retryBatchMutation = useMutation({
    mutationFn: retryTeacherBatchUploads,
    onSuccess: (data) => {
      message.success(`${t('teacher.batchUpload.retryFailedSuccess')} ${data.count}`);
      batchesQuery.refetch();
      submissionsQuery.refetch();
    },
    onError: () => message.error(t('teacher.batchUpload.retryFailedFailed')),
  });

  const retrySkippedMutation = useMutation({
    mutationFn: ({ homeworkId, fileKey, filename, studentName, batchId }: { homeworkId: string; fileKey: string; filename: string; studentName: string; batchId?: string }) =>
      retrySkippedSubmission(homeworkId, fileKey, filename, studentName, batchId),
    onSuccess: (data, variables) => {
      message.success(t('teacher.batchUpload.retrySkippedSuccess'));
      // Remove the item from skipped list
      setBatchResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          skipped: prev.skipped.filter((item) => item.fileKey !== variables.fileKey),
        };
      });
      // Clear the name input
      setSkippedFileNames((prev) => {
        const next = { ...prev };
        delete next[variables.fileKey];
        return next;
      });
      submissionsQuery.refetch();
      batchesQuery.refetch();
    },
    onError: (error: unknown) => message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.retrySkippedFailed'))),
  });

  const batchImportMutation = useMutation({
    mutationFn: ({ classId, students }: { classId: string; students: Array<{ account: string; name: string }> }) =>
      importClassStudents(classId, { students }),
    onSuccess: (data) => {
      setImportResults({
        created: data.created.length,
        conflicts: data.existing.map((e) => ({ account: e.account, name: e.name, reason: '账号已存在' })),
      });
      if (data.created.length > 0) {
        message.success(`${t('teacher.batchUpload.batchImportSuccess')} ${data.created.length}`);
      }
    },
    onError: (error: unknown) => {
      message.error(resolveApiErrorMessage(error, t('teacher.batchUpload.batchImportFailed')));
    },
  });

  const handleBatchImport = (items: Array<{ extractedName?: { zh: string; pinyin: string } }>) => {
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
      message.warning('没有可导入的学生');
      return;
    }
    setImportResults(null);
    setImportModalVisible(true);
    batchImportMutation.mutate({ classId, students });
  };

  const handleConfirmImport = () => {
    setImportModalVisible(false);
    setImportResults(null);
    // Refresh preview after import
    if (fileList.length > 0) {
      handlePreview();
    }
  };

  // Toggle exclude status for an image
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

  // Toggle expand/collapse for details
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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 200);
  };

  const handleSelectAll = (checked: boolean) => {
    const doneIds = filteredSubmissions.filter((s) => s.status === 'DONE').map((s) => s.id);
    if (checked) {
      // Accumulate selections instead of replacing
      setSelectedRowKeys((prev) => {
        const newKeys = [...prev];
        doneIds.forEach((id) => {
          if (!newKeys.includes(id)) {
            newKeys.push(id);
          }
        });
        return newKeys;
      });
    } else {
      // Deselect only current page items, preserve other selections
      setSelectedRowKeys((prev) => prev.filter((key) => !doneIds.includes(key)));
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRowKeys([...selectedRowKeys, id]);
    } else {
      setSelectedRowKeys(selectedRowKeys.filter((key) => key !== id));
    }
  };

  const handleExportCsv = async () => {
    if (!id) {
      return;
    }
    try {
      const blob = await downloadTeacherHomeworkSubmissionsCsv(id, language);
      downloadBlob(blob, `homework-${id}-submissions.csv`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const handleExportImages = async () => {
    if (!id) {
      return;
    }
    try {
      const blob = await downloadTeacherHomeworkImagesZip(id);
      downloadBlob(blob, `homework-${id}-images.zip`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const handleExportReminders = async () => {
    if (!id) {
      return;
    }
    try {
      const blob = await downloadTeacherHomeworkRemindersCsv(id, language);
      downloadBlob(blob, `homework-${id}-reminders.csv`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const handleBatchExportPdf = async () => {
    if (!selectedRowKeys.length || !id) {
      return;
    }
    try {
      const submissionIds = selectedRowKeys.join(',');
      const blob = await downloadTeacherSubmissionsPdf(id, submissionIds, language);
      downloadBlob(blob, `homework-${id}-grading-sheets.pdf`);
      message.success(`${t('teacher.homeworkDetail.exportPdfSuccess')} ${selectedRowKeys.length}`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const thisIsImage = (file: RcFile) => {
    if (file.type?.startsWith('image/')) {
      return true;
    }
    return /\.(png|jpe?g|webp|tif?f?)$/i.test(file.name);
  };

  const handleBatchUpload = async () => {
    if (!id) {
      message.error(t('teacher.batchUpload.missingHomework'));
      return;
    }

    const rawFiles = fileList
      .map((file) => file.originFileObj)
      .filter((file): file is RcFile => !!file);

    if (!rawFiles.length) {
      message.warning(t('teacher.batchUpload.uploadAtLeastOne'));
      return;
    }

    const zipFiles = rawFiles.filter((file) => file.name.toLowerCase().endsWith('.zip'));
    const imageFiles = rawFiles.filter(
      (file) => !file.name.toLowerCase().endsWith('.zip') && thisIsImage(file),
    );
    const invalidFiles = rawFiles.filter(
      (file) => !file.name.toLowerCase().endsWith('.zip') && !thisIsImage(file),
    );

    if (zipFiles.length > 1) {
      message.warning(t('teacher.batchUpload.onlyOneZip'));
      return;
    }

    if (zipFiles.length && imageFiles.length) {
      message.warning(t('teacher.batchUpload.zipOrImagesOnly'));
      return;
    }

    if (invalidFiles.length) {
      message.warning(t('teacher.batchUpload.invalidFile'));
      return;
    }

    if (!zipFiles.length && imageFiles.length > 100) {
      message.warning(t('teacher.batchUpload.imageLimit'));
      return;
    }

    setBatchResult(null);
    setPreviewResult(null);
    setUploadStage('uploading');
    try {
      await batchMutation.mutateAsync({
        homeworkId: id,
        images: zipFiles.length ? [] : imageFiles,
        archive: zipFiles.length ? zipFiles[0] : null,
        mappingOverrides: Object.keys(mappingOverrides).length ? mappingOverrides : undefined,
        nameOverrides: Object.keys(nameOverrides).length ? nameOverrides : undefined,
        excludedFileKeys: excludedItems.size > 0 ? JSON.stringify(Array.from(excludedItems)) : undefined,
      });
    } catch {
      return;
    }
  };

  const handlePreview = async () => {
    if (!id) {
      message.error(t('teacher.batchUpload.missingHomework'));
      return;
    }

    const rawFiles = fileList
      .map((file) => file.originFileObj)
      .filter((file): file is RcFile => !!file);

    if (!rawFiles.length) {
      message.warning(t('teacher.batchUpload.uploadAtLeastOne'));
      return;
    }

    const zipFiles = rawFiles.filter((file) => file.name.toLowerCase().endsWith('.zip'));
    const imageFiles = rawFiles.filter(
      (file) => !file.name.toLowerCase().endsWith('.zip') && thisIsImage(file),
    );
    const invalidFiles = rawFiles.filter(
      (file) => !file.name.toLowerCase().endsWith('.zip') && !thisIsImage(file),
    );

    if (zipFiles.length > 1) {
      message.warning(t('teacher.batchUpload.onlyOneZip'));
      return;
    }

    if (zipFiles.length && imageFiles.length) {
      message.warning(t('teacher.batchUpload.zipOrImagesOnly'));
      return;
    }

    if (invalidFiles.length) {
      message.warning(t('teacher.batchUpload.invalidFile'));
      return;
    }

    if (!zipFiles.length && imageFiles.length > 100) {
      message.warning(t('teacher.batchUpload.imageLimit'));
      return;
    }

    setBatchResult(null);
    setPreviewResult(null);
    try {
      await previewMutation.mutateAsync({
        homeworkId: id,
        images: zipFiles.length ? [] : imageFiles,
        archive: zipFiles.length ? zipFiles[0] : null,
        nameOverrides: Object.keys(nameOverrides).length ? nameOverrides : undefined,
      });
    } catch {
      return;
    }
  };

  const columns: ProColumns<SubmissionRow>[] = [
    {
      title: (
        <Checkbox
          checked={selectedRowKeys.length === filteredSubmissions.filter((s) => s.status === 'DONE').length && filteredSubmissions.filter((s) => s.status === 'DONE').length > 0}
          indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < filteredSubmissions.filter((s) => s.status === 'DONE').length}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      dataIndex: 'id',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedRowKeys.includes(record.id)}
          onChange={(e) => handleSelectRow(record.id, e.target.checked)}
          disabled={record.status !== 'DONE'}
        />
      ),
    },
    {
      title: t('common.student'),
      dataIndex: 'studentName',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('common.account'),
      dataIndex: 'studentAccount',
      width: 160,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, item) => {
        const statusMap: Record<string, string> = {
          QUEUED: t('status.queued'),
          PROCESSING: t('status.processing'),
          DONE: t('status.done'),
          FAILED: t('status.failed'),
        };
        return <Tag color={item.status === 'DONE' ? 'success' : item.status === 'FAILED' ? 'error' : item.status === 'PROCESSING' ? 'processing' : 'default'}>{statusMap[item.status] || item.status}</Tag>;
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
      renderText: (value) => formatDateShort(value),
      width: 200,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, item) => [
        <Button key="view" onClick={() => navigate(`/teacher/submission/${item.id}`)}>
          {t('common.view')}
        </Button>,
        <Button
          key="regrade"
          size="small"
          onClick={() => regradeMutation.mutate({ submissionId: item.id, mode: 'cheap' })}
          loading={regradeMutation.isPending}
        >
          {t('teacher.homeworkDetail.regrade')}
        </Button>,
        <Button
          key="regrade-quality"
          size="small"
          type="primary"
          onClick={() => regradeMutation.mutate({ submissionId: item.id, mode: 'quality' })}
          loading={regradeMutation.isPending}
        >
          {t('teacher.homeworkDetail.regradeQuality')}
        </Button>,
      ],
    },
  ];

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

  const batchColumns: ColumnsType<BatchHistoryRow> = [
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
        const total = row.totalImages || 1;
        const done = counts?.done || 0;
        const processing = counts?.processing || 0;
        const queued = counts?.queued || 0;
        const failed = counts?.failed || 0;
        const percent = Math.round((done / total) * 100);

        return (
          <Space direction="vertical" size={4}>
            <Typography.Text strong style={{ fontSize: 14 }}>
              {percent}% ({done}/{total})
            </Typography.Text>
            <Space size={[4, 4]} wrap>
              <Tag color="success">{t('status.done')} {done}</Tag>
              <Tag color="processing">{t('status.processing')} {processing}</Tag>
              <Tag>{t('status.queued')} {queued}</Tag>
              <Tag color="error">{t('status.failed')} {failed}</Tag>
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
  ];

  const isOverdue = Boolean(homework?.dueAt && new Date(homework.dueAt).getTime() < Date.now());
  const lateSubmissionTag = allowLateSubmission
    ? t('teacher.homeworkDetail.lateSubmissionEnabled')
    : t('teacher.homeworkDetail.lateSubmissionDisabled');

  return (
    <PageContainer
      title={t('teacher.homeworkDetail.title')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.homeworks'), path: '/teacher/homeworks' },
          { title: homework?.title || t('common.detail') },
        ],
      }}
    >
      {!homework ? (
        <SoftEmpty description={t('teacher.homeworkDetail.unavailable')}>
          <Button type="primary" onClick={() => navigate('/teacher/homeworks')}>
            {t('common.backToHomeworks')}
          </Button>
        </SoftEmpty>
      ) : (
        <Tabs
          items={[
            {
              key: 'overview',
              label: t('common.overview'),
              children: (
                <ProCard bordered>
                  <Descriptions column={1} bordered>
                    <Descriptions.Item label={t('common.title')}>{homework.title}</Descriptions.Item>
                    <Descriptions.Item label={t('common.dueDate')}>
                      {homework.dueAt ? formatDateShort(homework.dueAt) : t('status.noDue')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('common.description')}>
                      {homework.desc ? (
                        <Typography.Paragraph style={{ margin: 0 }}>{homework.desc}</Typography.Paragraph>
                      ) : (
                        <Typography.Text type="secondary">{t('common.noDescriptionProvided')}</Typography.Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('teacher.homeworkDetail.classReference')}>
                      {state?.classId ? state.classId : t('teacher.homeworkDetail.notSpecified')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('teacher.homeworkDetail.lateSubmission')}>
                      <Space direction="vertical" size={4}>
                        <Tag color={allowLateSubmission ? 'success' : isOverdue ? 'error' : 'default'}>
                          {lateSubmissionTag}
                        </Tag>
                        {isOverdue && !allowLateSubmission ? (
                          <Typography.Text type="secondary">
                            {t('teacher.homeworkDetail.lateSubmissionHint')}
                          </Typography.Text>
                        ) : null}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('common.action')}>
                      <Space wrap>
                        <Button
                          loading={updateLateSubmissionMutation.isPending}
                          onClick={() =>
                            updateLateSubmissionMutation.mutate(!allowLateSubmission)
                          }
                        >
                          {allowLateSubmission
                            ? t('teacher.homeworkDetail.closeLateSubmission')
                            : t('teacher.homeworkDetail.openLateSubmission')}
                        </Button>
                        <Popconfirm
                          title={t('teacher.homeworkDetail.deleteConfirmTitle')}
                          description={
                            <Space direction="vertical" size={0}>
                              <Typography.Text>{t('teacher.homeworkDetail.deleteConfirmDesc')}</Typography.Text>
                              <Typography.Text type="secondary">
                                {deletePreviewQuery.isLoading
                                  ? t('teacher.homeworkDetail.deletePreviewLoading')
                                  : deletePreviewQuery.isError
                                    ? t('teacher.homeworkDetail.deletePreviewFailed')
                                    : `${t('teacher.homeworkDetail.deleteWillRemove')} ${deletePreviewQuery.data?.submissionCount || 0} ${t('teacher.homeworkDetail.deleteSubmissionsUnit')}，${deletePreviewQuery.data?.imageCount || 0} ${t('teacher.homeworkDetail.deleteImagesUnit')}`}
                              </Typography.Text>
                            </Space>
                          }
                          onConfirm={() => deleteHomeworkMutation.mutate()}
                          okButtonProps={{ loading: deleteHomeworkMutation.isPending }}
                        >
                          <Button danger loading={deleteHomeworkMutation.isPending}>
                            {t('teacher.homeworkDetail.deleteHomework')}
                          </Button>
                        </Popconfirm>
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>
                </ProCard>
              ),
            },
            {
              key: 'submissions',
              label: t('nav.submissions'),
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {submissionsQuery.isError ? (
                    <Alert
                      type="error"
                      message={t('teacher.homeworkDetail.loadSubmissionsError')}
                      description={
                        submissionsQuery.error instanceof Error
                          ? submissionsQuery.error.message
                          : t('common.tryAgain')
                      }
                      action={
                        <Button size="small" onClick={() => submissionsQuery.refetch()}>
                          {t('common.retry')}
                        </Button>
                      }
                    />
                  ) : null}
                  <ProCard bordered>
                    <ProTable<SubmissionRow>
                      rowKey="id"
                      columns={columns}
                      dataSource={filteredSubmissions}
                      loading={submissionsQuery.isLoading}
                      search={false}
                      pagination={{ pageSize: 8 }}
                      options={false}
                      locale={{
                        emptyText: (
                          <SoftEmpty description={t('teacher.homeworkDetail.noSubmissions')}>
                            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                              {t('teacher.homeworkDetail.noSubmissionsHint')}
                            </Typography.Paragraph>
                          </SoftEmpty>
                        ),
                      }}
                      toolBarRender={() => [
                        <Input.Search
                          key="search"
                          placeholder={t('teacher.homeworkDetail.searchPlaceholder')}
                          allowClear
                          onSearch={(value) => setKeyword(value.trim())}
                          style={{ width: 220 }}
                        />,
                        <Select
                          key="status"
                          value={statusFilter}
                          onChange={(value) => setStatusFilter(value)}
                          style={{ width: 160 }}
                          options={[
                            { label: t('common.allStatuses'), value: 'all' },
                            { label: t('status.queued'), value: 'QUEUED' },
                            { label: t('status.processing'), value: 'PROCESSING' },
                            { label: t('status.done'), value: 'DONE' },
                            { label: t('status.failed'), value: 'FAILED' },
                          ]}
                        />,
                        <Space key="score" size={4}>
                          <Typography.Text>{t('teacher.homeworkDetail.scoreRange')}</Typography.Text>
                          <InputNumber
                            min={0}
                            max={100}
                            placeholder="0"
                            value={scoreMin ?? undefined}
                            onChange={(value) => setScoreMin(typeof value === 'number' ? value : null)}
                          />
                          <Typography.Text>~</Typography.Text>
                          <InputNumber
                            min={0}
                            max={100}
                            placeholder="100"
                            value={scoreMax ?? undefined}
                            onChange={(value) => setScoreMax(typeof value === 'number' ? value : null)}
                          />
                        </Space>,
                        <DatePicker.RangePicker
                          key="date"
                          value={dateRange || undefined}
                          onChange={(value) => setDateRange(value)}
                          placeholder={[t('teacher.homeworkDetail.dateRangeStart'), t('teacher.homeworkDetail.dateRangeEnd')]}
                        />,
                        <Button
                          key="retry"
                          disabled={!failedCount || regradeFailedMutation.isPending || !id}
                          loading={regradeFailedMutation.isPending}
                          onClick={() =>
                            id
                              ? regradeFailedMutation.mutate({ homeworkId: id, mode: 'cheap' })
                              : null
                          }
                        >
                          {`${t('teacher.homeworkDetail.retryFailed')} ${failedCount || 0}`}
                        </Button>,
                        <Dropdown.Button
                          key="export"
                          type="primary"
                          disabled={selectedRowKeys.length === 0 || !id}
                          onClick={handleBatchExportPdf}
                          menu={{
                            items: [
                              {
                                key: 'csv',
                                label: t('teacher.homeworkDetail.exportCsv'),
                                onClick: handleExportCsv,
                              },
                              {
                                key: 'images',
                                label: t('teacher.homeworkDetail.exportImages'),
                                onClick: handleExportImages,
                              },
                              {
                                key: 'reminders',
                                label: t('teacher.homeworkDetail.exportReminders'),
                                onClick: handleExportReminders,
                              },
                            ],
                          }}
                        >
                          {t('teacher.homeworkDetail.exportPdf')} ({selectedRowKeys.length})
                        </Dropdown.Button>,
                      ]}
                    />
                  </ProCard>
                </Space>
              ),
            },
            {
              key: 'batch',
              label: t('teacher.batchUpload.title'),
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
                      <Typography.Text type="secondary">{t('teacher.batchUpload.draggerHint')}</Typography.Text>
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
                        {previewResult ? t('teacher.batchUpload.applyUpload') : t('teacher.batchUpload.submit')}
                      </Button>
                      <Button onClick={() => setFileList([])} disabled={batchMutation.isPending}>
                        {t('common.reset')}
                      </Button>
                    </Space>
                    {previewMutation.isPending || previewPercent > 0 ? (
                      <div style={{ marginTop: 16 }}>
                        <Progress
                          percent={previewPercent}
                          status="active"
                          showInfo={true}
                        />
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {t('teacher.batchUpload.previewing')}
                        </Typography.Text>
                      </div>
                    ) : null}
                    {batchMutation.isPending || uploadStage ? (
                      <div style={{ marginTop: 16 }}>
                        <Progress
                          percent={uploadPercent}
                          status="active"
                          showInfo={true}
                        />
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

                      {/* 三列布局：已匹配、未匹配-含姓名、无法处理 */}
                      {previewResult.matchResults ? (
                        <Row gutter={16}>
                          {/* 已匹配 */}
                          <Col span={8}>
                            <ProCard
                              title={`${t('teacher.batchUpload.matched')} (${previewResult.matchResults.filter(r => r.matchedAccount).length})`}
                              size="small"
                              bordered
                            >
                              <List
                                dataSource={previewResult.matchResults.filter(r => r.matchedAccount)}
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

                          {/* 未匹配 - 含姓名 */}
                          <Col span={8}>
                            <ProCard
                              title={`${t('teacher.batchUpload.unmatchedWithName')} (${previewResult.matchResults.filter(r => !r.matchedAccount && r.extractedName).length})`}
                              size="small"
                              bordered
                              extra={
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => handleBatchImport(previewResult.matchResults.filter(r => !r.matchedAccount && r.extractedName))}
                                  disabled={previewResult.matchResults.filter(r => !r.matchedAccount && r.extractedName).length === 0}
                                >
                                  {t('teacher.batchUpload.batchImport')}
                                </Button>
                              }
                            >
                              <List
                                dataSource={previewResult.matchResults.filter(r => !r.matchedAccount && r.extractedName)}
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

                          {/* 无法处理 */}
                          <Col span={8}>
                            <ProCard
                              title={`${t('teacher.batchUpload.unhandled')} (${previewResult.matchResults.filter(r => !r.matchedAccount && !r.extractedName).length})`}
                              size="small"
                              bordered
                            >
                              <List
                                dataSource={previewResult.matchResults.filter(r => !r.matchedAccount && !r.extractedName)}
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
                                          danger={isExcluded}
                                          onClick={() => item.fileKey && toggleExclude(item.fileKey)}
                                        >
                                          {isExcluded ? t('teacher.batchUpload.excluded') : t('teacher.batchUpload.exclude')}
                                        </Button>,
                                      ]}
                                    >
                                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                        <Typography.Text style={{ fontSize: 12 }}>{item.file}</Typography.Text>
                                        <Space size={4}>
                                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                            {reasonLabels[item.reason as keyof typeof reasonLabels] || item.reason}
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
                                        {expandedDetails.has(item.fileKey || '') && (item.analysisZh || item.analysisEn) && (
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
                            <Typography.Text type="secondary">{t('teacher.batchUpload.noGroups')}</Typography.Text>
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
                                        if (!item.fileKey) {
                                          return;
                                        }
                                        setNameOverrides((prev) => {
                                          const next = { ...prev };
                                          const value = e.target.value.trim();
                                          if (!value) {
                                            delete next[item.fileKey];
                                          } else {
                                            next[item.fileKey] = value;
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
                              actions={item.fileKey ? [
                                <Button
                                  key="retry"
                                  type="primary"
                                  size="small"
                                  loading={retrySkippedMutation.isPending}
                                  disabled={!skippedFileNames[item.fileKey]?.trim()}
                                  onClick={() => {
                                    if (!id || !item.fileKey) return;
                                    const studentName = skippedFileNames[item.fileKey]?.trim();
                                    if (!studentName) return;
                                    retrySkippedMutation.mutate({
                                      homeworkId: id,
                                      fileKey: item.fileKey,
                                      filename: item.file,
                                      studentName,
                                      batchId: batchResult.batchId, // Link to original BatchUpload
                                    });
                                  }}
                                >
                                  {t('teacher.batchUpload.continueGrading')}
                                </Button>,
                              ] : undefined}
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
              ),
            },
          ]}
        />
      )}
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
    </PageContainer>
  );
};
