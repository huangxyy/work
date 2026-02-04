import { InboxOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Input,
  InputNumber,
  List,
  Progress,
  Select,
  Space,
  Tabs,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  createTeacherBatchSubmissions,
  fetchClassStudents,
  fetchTeacherHomeworkSubmissions,
  fetchTeacherBatchUploads,
  previewTeacherBatchSubmissions,
  regradeSubmission,
  regradeHomeworkSubmissions,
  downloadTeacherHomeworkSubmissionsCsv,
  downloadTeacherHomeworkImagesZip,
  downloadTeacherHomeworkRemindersCsv,
  retryTeacherBatchUploads,
  type TeacherBatchUploadResult,
  type TeacherBatchPreviewResult,
} from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
};

type SubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  updatedAt?: string;
};

export const TeacherHomeworkDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useI18n();
  const message = useMessage();
  const state = location.state as { homework?: HomeworkItem; classId?: string | null } | undefined;
  const homework = state?.homework;
  const classId = state?.classId || '';
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [batchResult, setBatchResult] = useState<TeacherBatchUploadResult | null>(null);
  const [previewResult, setPreviewResult] = useState<TeacherBatchPreviewResult | null>(null);
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState<number | null>(null);
  const [scoreMax, setScoreMax] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  useEffect(() => {
    setPreviewResult(null);
    setMappingOverrides({});
  }, [fileList]);

  const uploadTips = useMemo(
    () => [t('teacher.batchUpload.tip1'), t('teacher.batchUpload.tip2'), t('teacher.batchUpload.tip3')],
    [t],
  );
  const reasonLabels = useMemo(
    () => ({
      NON_IMAGE: t('teacher.batchUpload.reason.nonImage'),
      ACCOUNT_NOT_FOUND: t('teacher.batchUpload.reason.accountNotFound'),
      STUDENT_NOT_FOUND: t('teacher.batchUpload.reason.studentNotFound'),
    }),
    [t],
  );

  const submissionsQuery = useQuery<SubmissionRow[]>({
    queryKey: ['homework-submissions', id],
    queryFn: () => fetchTeacherHomeworkSubmissions(id || ''),
    enabled: !!id,
  });

  const studentsQuery = useQuery<Array<{ id: string; name: string; account: string }>>({
    queryKey: ['class-students', classId],
    queryFn: () => fetchClassStudents(classId),
    enabled: !!classId,
  });

  const batchesQuery = useQuery({
    queryKey: ['batch-uploads', id],
    queryFn: () => fetchTeacherBatchUploads(id || ''),
    enabled: !!id,
  });

  const studentOptions = useMemo(
    () =>
      (studentsQuery.data || []).map((student: { id: string; name: string; account: string }) => ({
        label: `${student.name} (${student.account})`,
        value: student.account,
      })),
    [studentsQuery.data],
  );

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
    onSuccess: (data) => {
      setBatchResult(data);
      setPreviewResult(null);
      setMappingOverrides({});
      setUploadPercent(100);
      message.success(t('teacher.batchUpload.success'));
      submissionsQuery.refetch();
      batchesQuery.refetch();
    },
    onError: () => {
      setUploadPercent(0);
      message.error(t('teacher.batchUpload.failed'));
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewTeacherBatchSubmissions,
    onSuccess: (data) => {
      setPreviewResult(data);
      setMappingOverrides({});
      message.success(t('teacher.batchUpload.previewSuccess'));
    },
    onError: () => message.error(t('teacher.batchUpload.previewFailed')),
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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
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

  const thisIsImage = (file: RcFile) => {
    if (file.type?.startsWith('image/')) {
      return true;
    }
    return /\.(png|jpe?g|webp)$/i.test(file.name);
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
    setUploadPercent(30);
    try {
      await batchMutation.mutateAsync({
        homeworkId: id,
        images: zipFiles.length ? [] : imageFiles,
        archive: zipFiles.length ? zipFiles[0] : null,
        mappingOverrides: Object.keys(mappingOverrides).length ? mappingOverrides : undefined,
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
      });
    } catch {
      return;
    }
  };

  const columns: ProColumns<SubmissionRow>[] = [
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
      renderText: (value) => value || '--',
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

  const batchColumns = [
    {
      title: t('teacher.batchUpload.historyCreatedAt'),
      dataIndex: 'createdAt',
      render: (value: string) =>
        value ? new Date(value).toLocaleString() : '--',
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
      render: (counts: { queued: number; processing: number; done: number; failed: number }) => {
        const tags = [
          { label: t('status.done'), count: counts?.done || 0, color: 'success' },
          { label: t('status.processing'), count: counts?.processing || 0, color: 'processing' },
          { label: t('status.queued'), count: counts?.queued || 0, color: 'default' },
          { label: t('status.failed'), count: counts?.failed || 0, color: 'error' },
        ].filter((entry) => entry.count > 0);
        if (!tags.length) {
          return '--';
        }
        return (
          <Space size={[4, 4]} wrap>
            {tags.map((entry) => (
              <Tag key={entry.label} color={entry.color}>{`${entry.label} ${entry.count}`}</Tag>
            ))}
          </Space>
        );
      },
      width: 240,
    },
    {
      title: t('common.action'),
      dataIndex: 'id',
      render: (_: string, row: { id: string; statusCounts: { failed: number } }) => (
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
                      {homework.dueAt ? new Date(homework.dueAt).toLocaleString() : t('status.noDue')}
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
                        <Button key="export-csv" onClick={handleExportCsv}>
                          {t('teacher.homeworkDetail.exportCsv')}
                        </Button>,
                        <Button key="export-images" onClick={handleExportImages}>
                          {t('teacher.homeworkDetail.exportImages')}
                        </Button>,
                        <Button key="export-reminders" onClick={handleExportReminders}>
                          {t('teacher.homeworkDetail.exportReminders')}
                        </Button>,
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
                      accept="image/*,.zip"
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
                    {batchMutation.isPending ? (
                      <Progress
                        style={{ marginTop: 16 }}
                        percent={uploadPercent}
                        status="active"
                        showInfo={false}
                      />
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
                                </Space>
                                <Select
                                  style={{ minWidth: 200 }}
                                  placeholder={t('teacher.batchUpload.assignStudent')}
                                  options={studentOptions}
                                  value={mappingOverrides[item.fileKey || '']}
                                  onChange={(value) => {
                                    if (!item.fileKey) {
                                      return;
                                    }
                                    setMappingOverrides((prev) => {
                                      const next = { ...prev };
                                      if (!value) {
                                        delete next[item.fileKey];
                                      } else {
                                        next[item.fileKey] = value;
                                      }
                                      return next;
                                    });
                                  }}
                                  allowClear
                                  showSearch
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
                            <List.Item>
                              <Typography.Text>{item.file}</Typography.Text>
                              <Typography.Text type="secondary">
                                {reasonLabels[item.reason as keyof typeof reasonLabels] || item.reason}
                              </Typography.Text>
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
                      <Table
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
    </PageContainer>
  );
};
