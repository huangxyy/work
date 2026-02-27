import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, DatePicker, Input, InputNumber, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadStudentSubmissionsCsv, fetchStudentSubmissions } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { formatDateShort } from '../../utils/dateFormat';
import { getErrorMessage } from '../../utils/errorHandler';

type SubmissionRow = {
  id: string;
  homeworkTitle: string;
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  totalScore?: number | null;
  updatedAt?: string;
  errorCode?: string | null;
  errorMsg?: string | null;
  imageCount?: number;
};

export const StudentSubmissionsPage = () => {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const message = useMessage();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scoreMin, setScoreMin] = useState<number | null>(null);
  const [scoreMax, setScoreMax] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const statusMeta = useMemo(
    () => ({
      QUEUED: { label: t('status.queued'), color: 'default' },
      PROCESSING: { label: t('status.processing'), color: 'processing' },
      DONE: { label: t('status.done'), color: 'success' },
      FAILED: { label: t('status.failed'), color: 'error' },
    }),
    [t],
  );

  const { data, isLoading, isError, error, refetch } = useQuery<SubmissionRow[]>({
    queryKey: ['student-submissions'],
    queryFn: () => fetchStudentSubmissions(),
    staleTime: 60 * 1000,
  });

  const filteredData = useMemo(() => {
    const list = (data || []) as SubmissionRow[];
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
      return item.homeworkTitle.toLowerCase().includes(keyword.toLowerCase());
    });
  }, [data, keyword, statusFilter, scoreMin, scoreMax, dateRange]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 200);
  }, []);

  const handleExport = async () => {
    try {
      const blob = await downloadStudentSubmissionsCsv({
        keyword: keyword || undefined,
        status: statusFilter === 'all' ? undefined : (statusFilter as SubmissionRow['status']),
        minScore: scoreMin ?? undefined,
        maxScore: scoreMax ?? undefined,
        from: dateRange?.[0]?.startOf('day').toISOString(),
        to: dateRange?.[1]?.endOf('day').toISOString(),
        lang: language,
      });
      downloadBlob(blob, 'student-submissions.csv');
    } catch {
      message.error(t('student.submissions.exportFailed'));
    }
  };

  const handleViewSubmission = useCallback((id: string) => navigate(`/student/submission/${id}`), [navigate]);

  const columns = useMemo<ProColumns<SubmissionRow>[]>(() => [
    {
      title: t('common.homework'),
      dataIndex: 'homeworkTitle',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('student.submissions.images'),
      dataIndex: 'imageCount',
      render: (value) => (value ? <Tag className="apple-tag-pill">{value} img</Tag> : '--'),
      width: 80,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, item) => {
        const meta = statusMeta[item.status];
        return <Tag color={meta.color} className="apple-tag-pill">{meta.label}</Tag>;
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
        <Button key="view" onClick={() => handleViewSubmission(item.id)}>
          {t('common.view')}
        </Button>,
      ],
    },
  ], [t, statusMeta, handleViewSubmission]);

  return (
    <PageContainer
      title={t('nav.submissions')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/dashboard' },
          { title: t('nav.submissions') },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message={t('student.submissions.loadError')}
          description={getErrorMessage(error, language === 'zh-CN' ? 'zh' : 'en')}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : null}
      <ProCard bordered className="apple-soft-card">
        <ProTable<SubmissionRow>
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          search={false}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 'max-content' }}
          options={false}
          locale={{
            emptyText: (
              <SoftEmpty description={t('student.submissions.empty')}>
                <Typography.Paragraph type="secondary" className="apple-empty-hint">
                  {t('student.submissions.emptyHint')}
                </Typography.Paragraph>
              </SoftEmpty>
            ),
          }}
          toolBarRender={() => [
            <Input.Search
              key="search"
              className="apple-toolbar-search"
              placeholder={t('student.submissions.searchPlaceholder')}
              allowClear
              onSearch={(value) => setKeyword(value.trim())}
            />,
            <Select
              key="status"
              className="apple-toolbar-select"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { label: t('common.allStatuses'), value: 'all' },
                { label: t('status.queued'), value: 'QUEUED' },
                { label: t('status.processing'), value: 'PROCESSING' },
                { label: t('status.done'), value: 'DONE' },
                { label: t('status.failed'), value: 'FAILED' },
              ]}
            />,
            <Space key="score" className="apple-toolbar-score-range">
              <Typography.Text>{t('student.submissions.scoreRange')}</Typography.Text>
              <InputNumber
                className="apple-toolbar-score-input"
                min={0}
                max={100}
                placeholder="0"
                value={scoreMin ?? undefined}
                onChange={(value) => setScoreMin(typeof value === 'number' ? value : null)}
              />
              <Typography.Text>~</Typography.Text>
              <InputNumber
                className="apple-toolbar-score-input"
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
              placeholder={[t('student.submissions.dateRangeStart'), t('student.submissions.dateRangeEnd')]}
            />,
            <Button key="export" onClick={handleExport}>
              {t('student.submissions.exportCsv')}
            </Button>,
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};
