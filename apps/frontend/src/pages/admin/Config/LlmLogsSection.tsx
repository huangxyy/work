import { ProCard } from '@ant-design/pro-components';
import {
  Button,
  Descriptions,
  Divider,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { forwardRef, useMemo, useState } from 'react';
import { clearAdminLlmLogs, fetchAdminLlmLogs } from '../../../api';
import { useI18n } from '../../../i18n';
import { useMessage } from '../../../hooks/useMessage';
import { formatDate } from '../../../utils/dateFormat';
import type { LlmLogItem } from './types';

interface LlmLogsSectionProps {
  providerOptions: Array<{ label: string; value: string }>;
}

export const LlmLogsSection = forwardRef<HTMLDivElement, LlmLogsSectionProps>(
  ({ providerOptions }, ref) => {
    const { t } = useI18n();
    const message = useMessage();
    const [logDetailOpen, setLogDetailOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<LlmLogItem | null>(null);
    const [logFilters, setLogFilters] = useState<{ providerId?: string; status?: string; source?: string }>({});
    const [clearDays, setClearDays] = useState(7);

    const logsQuery = useQuery({
      queryKey: ['admin-llm-logs', logFilters],
      queryFn: () => fetchAdminLlmLogs({ page: 1, pageSize: 10, ...logFilters }),
    });

    const logs: LlmLogItem[] = logsQuery.data?.items || [];

    const clearLogsMutation = useMutation({
      mutationFn: clearAdminLlmLogs,
      onSuccess: (data) => {
        message.success(`${t('admin.config.llmLogsCleared')} ${data.deleted}`);
        logsQuery.refetch();
      },
      onError: () => message.error(t('admin.config.llmLogsClearFailed')),
    });

    const logColumns = useMemo(
      () => [
        {
          title: t('admin.config.logTime'),
          dataIndex: 'createdAt',
          render: (value: string) => formatDate(value),
        },
        {
          title: t('admin.config.logProvider'),
          dataIndex: 'providerName',
          render: (_: string, row: LlmLogItem) => (
            <Space direction="vertical" size={0}>
              <Typography.Text>{row.providerName || '--'}</Typography.Text>
              <Typography.Text type="secondary">{row.model || '--'}</Typography.Text>
            </Space>
          ),
        },
        {
          title: t('admin.config.logStatus'),
          dataIndex: 'status',
          render: (value: string) => <Tag color={value === 'OK' ? 'green' : 'red'}>{value}</Tag>,
        },
        {
          title: t('admin.config.logTokens'),
          dataIndex: 'totalTokens',
          render: (_: number, row: LlmLogItem) => <Typography.Text>{row.totalTokens ?? '--'}</Typography.Text>,
        },
        {
          title: t('admin.config.logLatency'),
          dataIndex: 'latencyMs',
          render: (value: number) => (value ? `${value}ms` : '--'),
        },
        {
          title: t('admin.config.logCost'),
          dataIndex: 'cost',
          render: (value: number) => (typeof value === 'number' ? value.toFixed(4) : '--'),
        },
        {
          title: t('common.detail'),
          key: 'detail',
          render: (_: unknown, row: LlmLogItem) => (
            <Button type="link" size="small" onClick={() => { setSelectedLog(row); setLogDetailOpen(true); }}>
              {t('common.detail')}
            </Button>
          ),
        },
      ],
      [t],
    );

    return (
      <div ref={ref}>
        <ProCard bordered title={t('admin.config.section.llmLogs')} colSpan={24} className="apple-soft-card">
          <Space wrap style={{ marginBottom: 12 }}>
            <Select
              allowClear
              placeholder={t('admin.config.logProviderPlaceholder')}
              options={providerOptions}
              value={logFilters.providerId}
              onChange={(value) => setLogFilters((prev) => ({ ...prev, providerId: value }))}
              style={{ minWidth: 200 }}
            />
            <Select
              allowClear
              placeholder={t('admin.config.logStatusPlaceholder')}
              options={[{ label: 'OK', value: 'OK' }, { label: 'ERROR', value: 'ERROR' }]}
              value={logFilters.status}
              onChange={(value) => setLogFilters((prev) => ({ ...prev, status: value }))}
              style={{ minWidth: 140 }}
            />
            <Select
              allowClear
              placeholder={t('admin.config.logSourcePlaceholder')}
              options={[
                { label: t('admin.config.logSourceGrading'), value: 'grading' },
                { label: t('admin.config.logSourceAdminTest'), value: 'admin-test' },
              ]}
              value={logFilters.source}
              onChange={(value) => setLogFilters((prev) => ({ ...prev, source: value }))}
              style={{ minWidth: 160 }}
            />
            <Popconfirm
              title={t('admin.config.confirmClearLogs')}
              onConfirm={() => clearLogsMutation.mutate({ before: new Date(Date.now() - clearDays * 24 * 60 * 60 * 1000).toISOString() })}
            >
              <Button danger loading={clearLogsMutation.isPending}>{t('admin.config.clearLogs')}</Button>
            </Popconfirm>
            <Space size={6}>
              <Typography.Text>{t('admin.config.clearBefore')}</Typography.Text>
              <InputNumber min={1} max={365} value={clearDays} onChange={(value) => setClearDays(value || 7)} />
              <Typography.Text type="secondary">{t('common.days')}</Typography.Text>
            </Space>
          </Space>

          <Table rowKey="id" columns={logColumns} dataSource={logs} loading={logsQuery.isLoading} pagination={false} size="small" />

          <Modal
            open={logDetailOpen}
            onCancel={() => setLogDetailOpen(false)}
            footer={<Button onClick={() => setLogDetailOpen(false)}>{t('common.close')}</Button>}
            width={900}
            title={t('admin.config.logDetailTitle')}
          >
            {selectedLog ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label={t('admin.config.logId')}>{selectedLog.id}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logTime')}>{formatDate(selectedLog.createdAt)}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logSource')}>{selectedLog.source || '--'}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logStatus')}>
                    <Tag color={selectedLog.status === 'OK' ? 'green' : 'red'}>{selectedLog.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logProviderName')}>{selectedLog.providerName || '--'}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logProviderId')}>{selectedLog.providerId || '--'}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logModel')}>{selectedLog.model || '--'}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logLatency')}>{selectedLog.latencyMs ? `${selectedLog.latencyMs}ms` : '--'}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logTokens')}>
                    <Space size={6} wrap>
                      <Typography.Text>{selectedLog.totalTokens ?? '--'}</Typography.Text>
                      <Typography.Text type="secondary">{selectedLog.promptTokens ?? '--'} / {selectedLog.completionTokens ?? '--'}</Typography.Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logCost')}>{typeof selectedLog.cost === 'number' ? selectedLog.cost.toFixed(4) : '--'}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logUserId')}>{selectedLog.userId || '--'}</Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logSubmissionId')}>{selectedLog.submissionId || '--'}</Descriptions.Item>
                </Descriptions>
                <Divider />
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {(['prompt', 'systemPrompt', 'response', 'error'] as const).map((field) => (
                    <div key={field}>
                      <Typography.Text type="secondary">{t(`admin.config.log${field.charAt(0).toUpperCase() + field.slice(1)}`)}</Typography.Text>
                      <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', maxHeight: field === 'response' ? 240 : 180, overflow: 'auto' }}>
                        {(selectedLog[field] as string) || '--'}
                      </Typography.Paragraph>
                    </div>
                  ))}
                  <div>
                    <Typography.Text type="secondary">{t('admin.config.logMeta')}</Typography.Text>
                    <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
                      {selectedLog.meta ? JSON.stringify(selectedLog.meta, null, 2) : '--'}
                    </Typography.Paragraph>
                  </div>
                </Space>
              </Space>
            ) : null}
          </Modal>
        </ProCard>
      </div>
    );
  },
);

LlmLogsSection.displayName = 'LlmLogsSection';
