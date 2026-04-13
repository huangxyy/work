import type { ProColumns } from '@ant-design/pro-components';
import { ProCard, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Dropdown,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteTeacherSubmission,
  downloadTeacherHomeworkSubmissionsCsv,
  downloadTeacherHomeworkImagesZip,
  downloadTeacherHomeworkRemindersCsv,
  downloadTeacherSubmissionsPdf,
  fetchTeacherHomeworkSubmissions,
  fetchUnsubmittedStudents,
  regradeHomeworkSubmissions,
  regradeSubmission,
} from '../../../api';
import { SoftEmpty } from '../../../components/SoftEmpty';
import { useI18n } from '../../../i18n';
import { useMessage } from '../../../hooks/useMessage';
import { formatDateShort } from '../../../utils/dateFormat';
import { downloadBlob, resolveApiErrorMessage } from './utils';
import type { SubmissionRow } from './types';

interface SubmissionsTabProps {
  homeworkId: string;
}

export const SubmissionsTab = ({ homeworkId }: SubmissionsTabProps) => {
  const { t, language } = useI18n();
  const message = useMessage();
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState<number | null>(null);
  const [scoreMax, setScoreMax] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const submissionsQuery = useQuery<SubmissionRow[]>({
    queryKey: ['homework-submissions', homeworkId],
    queryFn: () => fetchTeacherHomeworkSubmissions(homeworkId),
    enabled: !!homeworkId,
  });

  const unsubmittedQuery = useQuery({
    queryKey: ['unsubmitted-students', homeworkId],
    queryFn: () => fetchUnsubmittedStudents(homeworkId),
    enabled: !!homeworkId,
    staleTime: 60_000,
  });

  const filteredSubmissions = useMemo(() => {
    const list = (submissionsQuery.data || []) as SubmissionRow[];
    return list.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (scoreMin !== null && (typeof item.totalScore !== 'number' || item.totalScore < scoreMin)) return false;
      if (scoreMax !== null && (typeof item.totalScore !== 'number' || item.totalScore > scoreMax)) return false;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        if (!item.updatedAt) return false;
        const updatedAtMs = new Date(item.updatedAt).getTime();
        if (dateRange[0] && updatedAtMs < dateRange[0].startOf('day').valueOf()) return false;
        if (dateRange[1] && updatedAtMs > dateRange[1].endOf('day').valueOf()) return false;
      }
      if (!keyword) return true;
      const needle = keyword.toLowerCase();
      return item.studentName.toLowerCase().includes(needle) || item.studentAccount.toLowerCase().includes(needle);
    });
  }, [keyword, statusFilter, submissionsQuery.data, scoreMin, scoreMax, dateRange]);

  const failedCount = useMemo(
    () => (submissionsQuery.data || []).filter((item) => item.status === 'FAILED').length,
    [submissionsQuery.data],
  );

  const regradeMutation = useMutation({
    mutationFn: ({ submissionId, mode }: { submissionId: string; mode?: 'cheap' | 'quality' }) =>
      regradeSubmission(submissionId, { mode }),
    onSuccess: () => {
      message.success(t('teacher.homeworkDetail.regradeSuccess'));
      submissionsQuery.refetch();
    },
    onError: () => message.error(t('teacher.homeworkDetail.regradeFailed')),
  });

  const regradeFailedMutation = useMutation({
    mutationFn: regradeHomeworkSubmissions,
    onSuccess: (data) => {
      message.success(`${t('teacher.homeworkDetail.retryFailedSuccess')} ${data.count}`);
      submissionsQuery.refetch();
    },
    onError: () => message.error(t('teacher.homeworkDetail.retryFailedFailed')),
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: (submissionId: string) => deleteTeacherSubmission(submissionId),
    onSuccess: () => {
      message.success(t('teacher.homeworkDetail.deleteFailedSuccess'));
      submissionsQuery.refetch();
    },
    onError: (error: unknown) => message.error(resolveApiErrorMessage(error, t('teacher.homeworkDetail.deleteFailedFailed'))),
  });

  const handleSelectAll = useCallback((checked: boolean) => {
    const doneIds = filteredSubmissions.filter((s) => s.status === 'DONE').map((s) => s.id);
    if (checked) {
      setSelectedRowKeys((prev) => {
        const newKeys = [...prev];
        doneIds.forEach((id) => { if (!newKeys.includes(id)) newKeys.push(id); });
        return newKeys;
      });
    } else {
      setSelectedRowKeys((prev) => prev.filter((key) => !doneIds.includes(key)));
    }
  }, [filteredSubmissions]);

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedRowKeys((prev) => checked ? [...prev, id] : prev.filter((key) => key !== id));
  }, []);

  const handleExportCsv = async () => {
    try {
      const blob = await downloadTeacherHomeworkSubmissionsCsv(homeworkId, language);
      downloadBlob(blob, `homework-${homeworkId}-submissions.csv`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const handleExportImages = async () => {
    try {
      const blob = await downloadTeacherHomeworkImagesZip(homeworkId);
      downloadBlob(blob, `homework-${homeworkId}-images.zip`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const handleExportReminders = async () => {
    try {
      const blob = await downloadTeacherHomeworkRemindersCsv(homeworkId, language);
      downloadBlob(blob, `homework-${homeworkId}-reminders.csv`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const handleBatchExportPdf = async () => {
    if (!selectedRowKeys.length) return;
    try {
      const submissionIds = selectedRowKeys.join(',');
      const blob = await downloadTeacherSubmissionsPdf(homeworkId, submissionIds, language);
      downloadBlob(blob, `homework-${homeworkId}-grading-sheets.pdf`);
      message.success(`${t('teacher.homeworkDetail.exportPdfSuccess')} ${selectedRowKeys.length}`);
    } catch {
      message.error(t('teacher.homeworkDetail.exportFailed'));
    }
  };

  const doneCount = useMemo(
    () => filteredSubmissions.filter((s) => s.status === 'DONE').length,
    [filteredSubmissions],
  );

  const columns: ProColumns<SubmissionRow>[] = useMemo(
    () => [
      {
        title: (
          <Checkbox
            checked={selectedRowKeys.length === doneCount && doneCount > 0}
            indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < doneCount}
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
          return (
            <Tag color={item.status === 'DONE' ? 'success' : item.status === 'FAILED' ? 'error' : item.status === 'PROCESSING' ? 'processing' : 'default'}>
              {statusMap[item.status] || item.status}
            </Tag>
          );
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
        render: (_, item) => {
          const actions = [
            <Button key="view" size="small" onClick={() => navigate(`/teacher/submission/${item.id}`)}>
              {t('common.view')}
            </Button>,
            <Button key="regrade" size="small" onClick={() => regradeMutation.mutate({ submissionId: item.id, mode: 'cheap' })} loading={regradeMutation.isPending}>
              {t('teacher.homeworkDetail.regrade')}
            </Button>,
            <Button key="regrade-quality" size="small" type="primary" onClick={() => regradeMutation.mutate({ submissionId: item.id, mode: 'quality' })} loading={regradeMutation.isPending}>
              {t('teacher.homeworkDetail.regradeQuality')}
            </Button>,
          ];
          if (item.status === 'FAILED') {
            actions.push(
              <Popconfirm key="delete" title={t('teacher.homeworkDetail.deleteFailedConfirm')} onConfirm={() => deleteSubmissionMutation.mutate(item.id)} okButtonProps={{ loading: deleteSubmissionMutation.isPending }}>
                <Button danger size="small">{t('common.delete')}</Button>
              </Popconfirm>,
            );
          }
          return actions;
        },
      },
    ],
    [t, selectedRowKeys, doneCount, navigate, regradeMutation, deleteSubmissionMutation, handleSelectAll, handleSelectRow],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {(unsubmittedQuery.data?.length ?? 0) > 0 && (
        <ProCard bordered title={`${t('teacher.homeworkDetail.unsubmitted')} (${unsubmittedQuery.data!.length})`}>
          <Space wrap size={[8, 8]}>
            {unsubmittedQuery.data!.map((s: { id: string; name: string; account: string }) => (
              <Tag key={s.id} color="warning">{s.name} ({s.account})</Tag>
            ))}
          </Space>
        </ProCard>
      )}
      {submissionsQuery.isError ? (
        <Alert
          type="error"
          message={t('teacher.homeworkDetail.loadSubmissionsError')}
          description={submissionsQuery.error instanceof Error ? submissionsQuery.error.message : t('common.tryAgain')}
          action={<Button size="small" onClick={() => submissionsQuery.refetch()}>{t('common.retry')}</Button>}
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
          scroll={{ x: 'max-content' }}
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
            <Input.Search key="search" placeholder={t('teacher.homeworkDetail.searchPlaceholder')} allowClear onSearch={(value) => setKeyword(value.trim())} style={{ width: 220 }} />,
            <Select key="status" value={statusFilter} onChange={setStatusFilter} style={{ width: 160 }} options={[
              { label: t('common.allStatuses'), value: 'all' },
              { label: t('status.queued'), value: 'QUEUED' },
              { label: t('status.processing'), value: 'PROCESSING' },
              { label: t('status.done'), value: 'DONE' },
              { label: t('status.failed'), value: 'FAILED' },
            ]} />,
            <Space key="score" size={4}>
              <Typography.Text>{t('teacher.homeworkDetail.scoreRange')}</Typography.Text>
              <InputNumber min={0} max={100} placeholder="0" value={scoreMin ?? undefined} onChange={(v) => setScoreMin(typeof v === 'number' ? v : null)} />
              <Typography.Text>~</Typography.Text>
              <InputNumber min={0} max={100} placeholder="100" value={scoreMax ?? undefined} onChange={(v) => setScoreMax(typeof v === 'number' ? v : null)} />
            </Space>,
            <DatePicker.RangePicker key="date" value={dateRange || undefined} onChange={(value) => setDateRange(value)} placeholder={[t('teacher.homeworkDetail.dateRangeStart'), t('teacher.homeworkDetail.dateRangeEnd')]} />,
            <Button key="retry" disabled={!failedCount || regradeFailedMutation.isPending} loading={regradeFailedMutation.isPending} onClick={() => regradeFailedMutation.mutate({ homeworkId, mode: 'cheap' })}>
              {`${t('teacher.homeworkDetail.retryFailed')} ${failedCount || 0}`}
            </Button>,
            <Dropdown.Button key="export" type="primary" disabled={selectedRowKeys.length === 0} onClick={handleBatchExportPdf} menu={{
              items: [
                { key: 'csv', label: t('teacher.homeworkDetail.exportCsv'), onClick: handleExportCsv },
                { key: 'images', label: t('teacher.homeworkDetail.exportImages'), onClick: handleExportImages },
                { key: 'reminders', label: t('teacher.homeworkDetail.exportReminders'), onClick: handleExportReminders },
              ],
            }}>
              {t('teacher.homeworkDetail.exportPdf')} ({selectedRowKeys.length})
            </Dropdown.Button>,
          ]}
        />
      </ProCard>
    </Space>
  );
};
