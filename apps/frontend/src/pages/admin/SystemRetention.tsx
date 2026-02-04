import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Descriptions, Form, InputNumber, Space, Switch, Tag, Typography } from 'antd';
import { useEffect } from 'react';
import { fetchAdminRetentionStatus, runAdminRetention } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

export const AdminSystemRetentionPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const [form] = Form.useForm();

  const statusQuery = useQuery({
    queryKey: ['admin-retention-status'],
    queryFn: fetchAdminRetentionStatus,
  });

  const runMutation = useMutation({
    mutationFn: runAdminRetention,
    onSuccess: () => {
      message.success(t('admin.retention.runSuccess'));
      statusQuery.refetch();
    },
    onError: () => message.error(t('admin.retention.runFailed')),
  });

  useEffect(() => {
    const config = statusQuery.data?.config;
    if (!config) {
      return;
    }
    form.setFieldsValue({
      days: config.retentionDays,
      dryRun: config.dryRunDefault,
      batchSize: config.batchSizeDefault,
    });
  }, [form, statusQuery.data]);

  const history = statusQuery.data?.history || [];
  const lastRun = history[0];

  return (
    <PageContainer
      title={t('admin.retention.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.system') },
          { title: t('nav.retention') },
        ],
      }}
    >
      <ProCard bordered>
        <Descriptions column={1} bordered>
          <Descriptions.Item label={t('admin.retention.window')}>
            <Tag>{statusQuery.data?.config.retentionDays ?? 0}d</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.retention.nextRun')}>
            <Typography.Text type="secondary">
              {statusQuery.data?.config.cron || '--'}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.retention.dryRun')}>
            <Typography.Text type="secondary">
              {statusQuery.data?.config.dryRunDefault ? t('common.enabled') : t('common.disabled')}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.retention.batchSize')}>
            <Typography.Text type="secondary">
              {statusQuery.data?.config.batchSizeDefault ?? '--'}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.retention.runRetention')}> 
            <Typography.Text type="secondary">
              {statusQuery.data?.config.runRetention ? t('common.enabled') : t('common.disabled')}
            </Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>

      <ProCard bordered title={t('admin.retention.runTitle')} style={{ marginTop: 16 }}>
        <Form layout="inline" form={form}>
          <Form.Item label={t('admin.retention.window')} name="days">
            <InputNumber min={1} max={365} />
          </Form.Item>
          <Form.Item label={t('admin.retention.batchSize')} name="batchSize">
            <InputNumber min={50} max={1000} />
          </Form.Item>
          <Form.Item label={t('admin.retention.dryRun')} name="dryRun" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              loading={runMutation.isPending}
              onClick={async () => {
                const values = await form.validateFields();
                runMutation.mutate(values);
              }}
            >
              {t('admin.retention.runNow')}
            </Button>
          </Form.Item>
        </Form>
      </ProCard>

      <ProCard bordered title={t('admin.retention.lastRun')} style={{ marginTop: 16 }}>
        {lastRun ? (
          <Descriptions column={2} bordered>
            <Descriptions.Item label={t('admin.retention.ranAt')}>
              {new Date(lastRun.ranAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.retention.mode')}>
              {lastRun.dryRun ? t('admin.retention.dryRunMode') : t('admin.retention.liveMode')}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.retention.scanned')}>{lastRun.scanned}</Descriptions.Item>
            <Descriptions.Item label={t('admin.retention.deleted')}>{lastRun.deleted}</Descriptions.Item>
            <Descriptions.Item label={t('admin.retention.minioOk')}>{lastRun.minioOk}</Descriptions.Item>
            <Descriptions.Item label={t('admin.retention.minioFailed')}>{lastRun.minioFailed}</Descriptions.Item>
            <Descriptions.Item label={t('admin.retention.dbFailed')}>{lastRun.dbFailed}</Descriptions.Item>
            <Descriptions.Item label={t('admin.retention.duration')}>{lastRun.durationMs}ms</Descriptions.Item>
          </Descriptions>
        ) : (
          <SoftEmpty description={t('admin.retention.logsEmpty')} />
        )}
      </ProCard>

      <ProCard bordered title={t('admin.retention.logsTitle')} style={{ marginTop: 16 }}>
        {history.length ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {history.map((entry) => (
              <ProCard key={entry.ranAt} bordered>
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>{new Date(entry.ranAt).toLocaleString()}</Typography.Text>
                  <Typography.Text type="secondary">
                    {entry.dryRun ? t('admin.retention.dryRunMode') : t('admin.retention.liveMode')} ·
                    {t('admin.retention.deleted')} {entry.deleted} ·
                    {t('admin.retention.scanned')} {entry.scanned}
                  </Typography.Text>
                </Space>
              </ProCard>
            ))}
          </Space>
        ) : (
          <SoftEmpty description={t('admin.retention.logsEmpty')} />
        )}
      </ProCard>
    </PageContainer>
  );
};
