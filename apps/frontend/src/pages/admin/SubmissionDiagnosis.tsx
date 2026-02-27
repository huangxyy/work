import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Collapse, Descriptions, Input, Skeleton, Space, Steps, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

export const AdminSubmissionDiagnosisPage = () => {
  const { t } = useI18n();
  const [submissionId, setSubmissionId] = useState('');
  const [searchId, setSearchId] = useState('');

  const diagQuery = useQuery({
    queryKey: ['admin-submission-diagnosis', searchId],
    queryFn: async () => {
      if (!searchId) return null;
      const res = await api.get(`/admin/submissions/${searchId}/diagnosis`);
      return res.data;
    },
    enabled: !!searchId,
  });

  const data = diagQuery.data;
  const statusColor = data?.status === 'DONE' ? 'success' : data?.status === 'FAILED' ? 'error' : 'processing';

  return (
    <PageContainer title={t('admin.diagnosis.title')}>
      <ProCard bordered className="apple-soft-card" style={{ marginBottom: 16 }}>
        <Space className="apple-toolbar">
          <Input
            placeholder={t('admin.diagnosis.inputId')}
            value={submissionId}
            onChange={(e) => setSubmissionId(e.target.value.trim())}
            style={{ width: 360 }}
            onPressEnter={() => setSearchId(submissionId)}
          />
          <Button type="primary" onClick={() => setSearchId(submissionId)} loading={diagQuery.isLoading}>
            {t('admin.diagnosis.search')}
          </Button>
        </Space>
      </ProCard>

      {diagQuery.isError ? (
        <Alert type="error" message={t('admin.diagnosis.notFound')} className="apple-inline-alert" />
      ) : null}

      {diagQuery.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : null}

      {data ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title={t('admin.diagnosis.basicInfo')} className="apple-soft-card">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={statusColor} className="apple-tag-pill">{data.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('common.student')}>
                {data.student?.name} ({data.student?.account})
              </Descriptions.Item>
              <Descriptions.Item label={t('common.homework')}>
                {data.homework?.title}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.class')}>
                {data.homework?.class?.name}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.score')}>
                {data.totalScore ?? '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.diagnosis.errorCode')}>
                <Tag color={data.errorCode ? 'error' : 'default'} className="apple-tag-pill">{data.errorCode || 'none'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.diagnosis.errorMsg')}>
                {data.errorMsg || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.diagnosis.imageCount')}>
                {data.images?.length || 0}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.lastUpdated')}>
                {formatDate(data.updatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </ProCard>

          <ProCard bordered title={t('admin.diagnosis.pipeline')} className="apple-soft-card">
            <Steps
              direction="vertical"
              current={data.status === 'DONE' ? 3 : data.status === 'FAILED' ? -1 : 1}
              status={data.status === 'FAILED' ? 'error' : 'process'}
              items={[
                {
                  title: t('admin.diagnosis.step.upload'),
                  description: `${data.images?.length || 0} ${t('admin.diagnosis.images')}`,
                  status: data.images?.length ? 'finish' : 'wait',
                },
                {
                  title: t('admin.diagnosis.step.ocr'),
                  description: data.ocrText
                    ? `${data.ocrText.length} ${t('admin.diagnosis.chars')}`
                    : data.errorCode?.startsWith('OCR') ? data.errorMsg : t('admin.diagnosis.noData'),
                  status: data.ocrText ? 'finish' : data.errorCode?.startsWith('OCR') ? 'error' : 'wait',
                },
                {
                  title: t('admin.diagnosis.step.llm'),
                  description: data.gradingJson
                    ? `${t('common.score')}: ${data.totalScore}`
                    : data.errorCode?.startsWith('LLM') ? data.errorMsg : t('admin.diagnosis.noData'),
                  status: data.gradingJson ? 'finish' : data.errorCode?.startsWith('LLM') ? 'error' : 'wait',
                },
                {
                  title: t('admin.diagnosis.step.complete'),
                  status: data.status === 'DONE' ? 'finish' : data.status === 'FAILED' ? 'error' : 'wait',
                },
              ]}
            />
          </ProCard>

          <Collapse items={[
            {
              key: 'ocr',
              label: `${t('admin.diagnosis.ocrOutput')} (${data.ocrText?.length || 0} chars)`,
              children: (
                <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
                  {data.ocrText || t('admin.diagnosis.noData')}
                </Typography.Paragraph>
              ),
            },
            {
              key: 'grading',
              label: t('admin.diagnosis.gradingResult'),
              children: (
                <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                  {data.gradingJson ? JSON.stringify(data.gradingJson, null, 2) : t('admin.diagnosis.noData')}
                </Typography.Paragraph>
              ),
            },
          ]} />

          {data.llmLogs?.length ? (
            <ProCard bordered title={`${t('admin.diagnosis.llmCallLogs')} (${data.llmLogs.length})`} className="apple-soft-card">
              <Collapse items={data.llmLogs.map((log: { id: string; status: string; providerName?: string; providerId?: string; model?: string; latencyMs?: number; createdAt: string; prompt?: string; response?: string; error?: string }) => ({
                key: log.id,
                label: (
                  <Space>
                    <Tag color={log.status === 'OK' ? 'green' : 'red'} className="apple-tag-pill">{log.status}</Tag>
                    <Typography.Text>{log.providerName || log.providerId || '--'}</Typography.Text>
                    <Typography.Text type="secondary">{log.model || '--'}</Typography.Text>
                    <Typography.Text type="secondary">{log.latencyMs ? `${log.latencyMs}ms` : ''}</Typography.Text>
                    <Typography.Text type="secondary">{formatDate(log.createdAt)}</Typography.Text>
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Typography.Text strong>{t('admin.diagnosis.prompt')}</Typography.Text>
                      <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                        {log.prompt || '--'}
                      </Typography.Paragraph>
                    </div>
                    <div>
                      <Typography.Text strong>{t('admin.diagnosis.response')}</Typography.Text>
                      <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                        {log.response || '--'}
                      </Typography.Paragraph>
                    </div>
                    {log.error ? (
                      <div>
                        <Typography.Text strong type="danger">{t('admin.diagnosis.error')}</Typography.Text>
                        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', color: '#ff4d4f' }}>
                          {log.error}
                        </Typography.Paragraph>
                      </div>
                    ) : null}
                  </Space>
                ),
              }))} />
            </ProCard>
          ) : null}
        </Space>
      ) : null}
    </PageContainer>
  );
};
