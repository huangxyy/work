import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAdminConfig,
  testAdminLlmHealth,
  testAdminStorageHealth,
  testAdminEmailHealth,
  testAdminRedisHealth,
  testAdminOcrHealth,
  updateAdminConfig,
} from '../../../api';
import { api } from '../../../api/client';
import { useI18n } from '../../../i18n';
import { useMessage } from '../../../hooks/useMessage';
import { useHealthCheck } from './useHealthCheck';
import { HealthCheckResult } from './HealthCheckResult';
import { LlmTestSection } from './LlmTestSection';
import { LlmLogsSection } from './LlmLogsSection';

export const AdminConfigPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [ocrTestFile, setOcrTestFile] = useState<File | null>(null);
  const [ocrTestLoading, setOcrTestLoading] = useState(false);
  const [ocrTestResult, setOcrTestResult] = useState<{ ok: boolean; text?: string; length?: number; error?: string } | null>(null);
  const llmLogsSectionRef = useRef<HTMLDivElement | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: fetchAdminConfig,
  });

  const providerOptions = useMemo(
    () =>
      (config?.llmProviders || []).map((provider) => ({
        label: provider.name || provider.id,
        value: provider.id,
      })),
    [config?.llmProviders],
  );

  const llmCheck = useHealthCheck({
    mutationFn: testAdminLlmHealth,
    successKey: 'admin.config.llmHealthOk',
    failKey: 'admin.config.llmHealthFail',
  });

  const ocrCheck = useHealthCheck({
    mutationFn: testAdminOcrHealth,
    successKey: 'admin.config.ocrHealthOk',
    failKey: 'admin.config.ocrHealthFail',
  });

  const storageCheck = useHealthCheck({
    mutationFn: testAdminStorageHealth,
    successKey: 'admin.config.storageHealthOk',
    failKey: 'admin.config.storageHealthFail',
  });

  const emailCheck = useHealthCheck({
    mutationFn: testAdminEmailHealth,
    successKey: 'admin.config.emailHealthOk',
    failKey: 'admin.config.emailHealthFail',
  });

  const redisCheck = useHealthCheck({
    mutationFn: testAdminRedisHealth,
    successKey: 'admin.config.redisHealthOk',
    failKey: 'admin.config.redisHealthFail',
  });

  const mutation = useMutation({
    mutationFn: updateAdminConfig,
    onSuccess: () => {
      message.success(t('admin.config.saved'));
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
    },
  });

  useEffect(() => {
    if (!config) {
      return;
    }
    form.setFieldsValue({
      llm: {
        providerName: config.llm.providerName,
        baseUrl: config.llm.baseUrl,
        model: config.llm.model,
        cheaperModel: config.llm.cheaperModel,
        qualityModel: config.llm.qualityModel,
        maxTokens: config.llm.maxTokens,
        temperature: config.llm.temperature,
        topP: config.llm.topP,
        presencePenalty: config.llm.presencePenalty,
        frequencyPenalty: config.llm.frequencyPenalty,
        timeoutMs: config.llm.timeoutMs,
        stop: config.llm.stop || [],
        responseFormat: config.llm.responseFormat,
        systemPrompt: config.llm.systemPrompt,
        activeProviderId: config.llm.activeProviderId,
        apiKey: '',
        clearApiKey: false,
      },
      llmProviders: (config.llmProviders || []).map((provider) => ({
        ...provider,
        apiKey: '',
        clearApiKey: false,
        headers: provider.headers || [],
        models: provider.models || [],
      })),
      ocr: {
        apiKey: '',
        secretKey: '',
        clearApiKey: false,
        clearSecretKey: false,
      },
      budget: {
        enabled: config.budget.enabled,
        dailyCallLimit: config.budget.dailyCallLimit,
        mode: config.budget.mode,
      },
      storage: {
        endpoint: config.storage.endpoint,
        bucket: config.storage.bucket,
        region: config.storage.region,
      },
      email: {
        host: config.email.host,
        port: config.email.port,
        user: config.email.user,
        from: config.email.from,
        secure: config.email.secure,
      },
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
        username: config.redis.username,
        tls: config.redis.tls,
      },
    });
    llmCheck.setHealth(config.health?.llm ?? null);
    ocrCheck.setHealth(config.health?.ocr ?? null);
    storageCheck.setHealth(null);
    emailCheck.setHealth(null);
    redisCheck.setHealth(null);
  }, [config, form]);

  const handleFinish = (values: {
    llm?: {
      providerName?: string;
      baseUrl?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      model?: string;
      cheaperModel?: string;
      qualityModel?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
      timeoutMs?: number;
      stop?: string[];
      responseFormat?: string;
      systemPrompt?: string;
      activeProviderId?: string;
    };
    llmProviders?: Array<{
      id: string;
      name?: string;
      baseUrl?: string;
      path?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      enabled?: boolean;
      headers?: Array<{ key: string; value: string; secret?: boolean }>;
      models?: Array<{ name: string; priceIn?: number; priceOut?: number; isDefault?: boolean }>;
    }>;
    ocr?: {
      apiKey?: string;
      secretKey?: string;
      clearApiKey?: boolean;
      clearSecretKey?: boolean;
    };
    budget?: { enabled?: boolean; dailyCallLimit?: number; mode?: 'soft' | 'hard' };
    storage?: { endpoint?: string; bucket?: string; region?: string };
    email?: { host?: string; port?: number; user?: string; from?: string; secure?: boolean };
    redis?: { host?: string; port?: number; db?: number; username?: string; tls?: boolean };
  }) => {
    const payload = { ...values };
    if (payload.llm) {
      const apiKey = payload.llm.apiKey?.trim() || '';
      if (payload.llm.clearApiKey) {
        payload.llm.apiKey = '';
      } else if (!apiKey) {
        delete payload.llm.apiKey;
      } else {
        payload.llm.apiKey = apiKey;
      }
      delete payload.llm.clearApiKey;
    }
    if (payload.llmProviders) {
      payload.llmProviders = payload.llmProviders.map((provider) => {
        const next = { ...provider };
        const apiKey = next.apiKey?.trim() || '';
        if (next.clearApiKey) {
          next.apiKey = '';
        } else if (!apiKey) {
          delete next.apiKey;
        } else {
          next.apiKey = apiKey;
        }
        delete next.clearApiKey;
        return next;
      });
    }
    if (payload.ocr) {
      const apiKey = payload.ocr.apiKey?.trim() || '';
      if (payload.ocr.clearApiKey) {
        payload.ocr.apiKey = '';
      } else if (!apiKey) {
        delete payload.ocr.apiKey;
      } else {
        payload.ocr.apiKey = apiKey;
      }

      const secretKey = payload.ocr.secretKey?.trim() || '';
      if (payload.ocr.clearSecretKey) {
        payload.ocr.secretKey = '';
      } else if (!secretKey) {
        delete payload.ocr.secretKey;
      } else {
        payload.ocr.secretKey = secretKey;
      }

      delete payload.ocr.clearApiKey;
      delete payload.ocr.clearSecretKey;
    }
    if (payload.storage) {
      payload.storage.endpoint = payload.storage.endpoint?.trim() || undefined;
      payload.storage.bucket = payload.storage.bucket?.trim() || undefined;
      payload.storage.region = payload.storage.region?.trim() || undefined;
    }
    if (payload.email) {
      payload.email.host = payload.email.host?.trim() || undefined;
      payload.email.user = payload.email.user?.trim() || undefined;
      payload.email.from = payload.email.from?.trim() || undefined;
    }
    if (payload.redis) {
      payload.redis.host = payload.redis.host?.trim() || undefined;
      payload.redis.username = payload.redis.username?.trim() || undefined;
    }
    mutation.mutate(payload);
  };

  return (
    <PageContainer
      title={t('admin.config.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.system') },
          { title: t('nav.config') },
        ],
      }}
    >
      <Card loading={isLoading} className="apple-soft-card">
        <ProCard
          bordered
          title={t('admin.config.promptQuickAccessTitle')}
          colSpan={24}
          className="apple-soft-card"
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              {t('admin.config.promptQuickAccessDesc')}
            </Typography.Text>
            <Typography.Paragraph
              copyable={Boolean(config?.llm.systemPrompt)}
              style={{
                whiteSpace: 'pre-wrap',
                marginBottom: 0,
                maxHeight: 120,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.02)',
                borderRadius: 8,
                padding: 12,
              }}
            >
              {config?.llm.systemPrompt || t('common.notConfigured')}
            </Typography.Paragraph>
            <Space wrap>
              <Button
                onClick={() =>
                  llmLogsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {t('admin.config.goToPromptLogs')}
              </Button>
            </Space>
          </Space>
        </ProCard>
        <Form layout="vertical" form={form} onFinish={handleFinish}>
          <ProCard bordered title={t('admin.config.section.llm')} colSpan={24} className="apple-soft-card">
            <Form.Item label={t('admin.config.providerName')} name={['llm', 'providerName']}>
              <Input placeholder={t('admin.config.providerNamePlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.baseUrl')} name={['llm', 'baseUrl']}>
              <Input placeholder={t('admin.config.baseUrlPlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('admin.config.apiKey')}
              name={['llm', 'apiKey']}
              extra={
                config?.llm.apiKeySet
                  ? t('admin.config.apiKeyHintSet')
                  : t('admin.config.apiKeyHintEmpty')
              }
            >
              <Input.Password placeholder={t('admin.config.apiKeyPlaceholder')} autoComplete="new-password" />
            </Form.Item>
            <Form.Item label={t('admin.config.clearApiKey')} name={['llm', 'clearApiKey']} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Divider />
            <Form.Item label={t('admin.config.model')} name={['llm', 'model']}>
              <Input placeholder={t('admin.config.modelPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.cheaperModel')} name={['llm', 'cheaperModel']}>
              <Input placeholder={t('admin.config.cheaperModelPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.qualityModel')} name={['llm', 'qualityModel']}>
              <Input placeholder={t('admin.config.qualityModelPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.maxTokens')} name={['llm', 'maxTokens']}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.temperature')} name={['llm', 'temperature']}>
              <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.topP')} name={['llm', 'topP']}>
              <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.presencePenalty')} name={['llm', 'presencePenalty']}>
              <InputNumber min={-2} max={2} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.frequencyPenalty')} name={['llm', 'frequencyPenalty']}>
              <InputNumber min={-2} max={2} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.timeoutMs')} name={['llm', 'timeoutMs']}>
              <InputNumber min={1000} step={500} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.responseFormat')} name={['llm', 'responseFormat']}>
              <Select
                allowClear
                options={[
                  { label: t('admin.config.responseFormatText'), value: 'text' },
                  { label: t('admin.config.responseFormatJson'), value: 'json_object' },
                ]}
              />
            </Form.Item>
            <Form.Item label={t('admin.config.stopSequences')} name={['llm', 'stop']}>
              <Select mode="tags" placeholder={t('admin.config.stopSequencesPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.systemPrompt')} name={['llm', 'systemPrompt']}>
              <Input.TextArea rows={4} placeholder={t('admin.config.systemPromptPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.activeProvider')} name={['llm', 'activeProviderId']}>
              <Select allowClear options={providerOptions} placeholder={t('admin.config.activeProviderPlaceholder')} />
            </Form.Item>
            <Button
              onClick={() => llmCheck.mutation.mutate()}
              loading={llmCheck.mutation.isPending}
            >
              {t('admin.config.testLlm')}
            </Button>
            <HealthCheckResult
              health={llmCheck.health}
              successLabel={t('admin.config.llmHealthOk')}
              failLabel={t('admin.config.llmHealthFail')}
            />
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.llmProviders')} colSpan={24} className="apple-soft-card">
            <Form.List name="llmProviders">
              {(fields, { add, remove }) => (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {fields.map((field) => {
                    const { key: fieldKey, ...restField } = field;
                    return (
                      <Card
                        key={fieldKey}
                        size="small"
                        title={t('admin.config.provider')}
                        extra={
                          <Button danger onClick={() => remove(field.name)}>
                            {t('common.remove')}
                          </Button>
                        }
                      >
                      <Form.Item
                        {...restField}
                        label={t('admin.config.providerId')}
                        name={[field.name, 'id']}
                        rules={[{ required: true, message: t('admin.config.providerIdRequired') }]}
                      >
                        <Input placeholder={t('admin.config.providerIdPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={t('admin.config.providerName')}
                        name={[field.name, 'name']}
                      >
                        <Input placeholder={t('admin.config.providerNamePlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={t('admin.config.baseUrl')}
                        name={[field.name, 'baseUrl']}
                        rules={[{ required: true, message: t('admin.config.baseUrlRequired') }]}
                      >
                        <Input placeholder={t('admin.config.baseUrlPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={t('admin.config.providerPath')}
                        name={[field.name, 'path']}
                      >
                        <Input placeholder={t('admin.config.providerPathPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={t('admin.config.apiKey')}
                        name={[field.name, 'apiKey']}
                        extra={
                          config?.llmProviders?.[field.name]?.apiKeySet
                            ? t('admin.config.apiKeyHintSet')
                            : t('admin.config.apiKeyHintEmpty')
                        }
                      >
                        <Input.Password placeholder={t('admin.config.apiKeyPlaceholder')} autoComplete="new-password" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={t('admin.config.clearApiKey')}
                        name={[field.name, 'clearApiKey']}
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={t('admin.config.providerEnabled')}
                        name={[field.name, 'enabled']}
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>

                      <Divider />

                      <Typography.Text type="secondary">{t('admin.config.customHeaders')}</Typography.Text>
                      <Form.List name={[field.name, 'headers']}>
                        {(headerFields, { add: addHeader, remove: removeHeader }) => (
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {headerFields.map((headerField) => (
                              <Space key={headerField.key} align="baseline" wrap>
                                <Form.Item
                                  name={[headerField.name, 'key']}
                                  rules={[{ required: true, message: t('admin.config.headerKeyRequired') }]}
                                >
                                  <Input placeholder={t('admin.config.headerKey')} />
                                </Form.Item>
                                <Form.Item
                                  name={[headerField.name, 'value']}
                                  rules={[{ required: true, message: t('admin.config.headerValueRequired') }]}
                                >
                                  <Input placeholder={t('admin.config.headerValue')} />
                                </Form.Item>
                                <Form.Item
                                  name={[headerField.name, 'secret']}
                                  valuePropName="checked"
                                >
                                  <Switch checkedChildren={t('admin.config.secret')} unCheckedChildren={t('admin.config.public')} />
                                </Form.Item>
                                <Button onClick={() => removeHeader(headerField.name)}>{t('common.remove')}</Button>
                              </Space>
                            ))}
                            <Button type="dashed" onClick={() => addHeader({})}>
                              {t('admin.config.addHeader')}
                            </Button>
                          </Space>
                        )}
                      </Form.List>

                      <Divider />

                      <Typography.Text type="secondary">{t('admin.config.modelPricing')}</Typography.Text>
                      <Form.List name={[field.name, 'models']}>
                        {(modelFields, { add: addModel, remove: removeModel }) => (
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {modelFields.map((modelField) => (
                              <Space key={modelField.key} align="baseline" wrap>
                                <Form.Item
                                  name={[modelField.name, 'name']}
                                  rules={[{ required: true, message: t('admin.config.modelRequired') }]}
                                >
                                  <Input placeholder={t('admin.config.modelPlaceholder')} />
                                </Form.Item>
                                <Form.Item name={[modelField.name, 'priceIn']}>
                                  <InputNumber min={0} step={0.001} placeholder={t('admin.config.priceIn')} />
                                </Form.Item>
                                <Form.Item name={[modelField.name, 'priceOut']}>
                                  <InputNumber min={0} step={0.001} placeholder={t('admin.config.priceOut')} />
                                </Form.Item>
                                <Form.Item name={[modelField.name, 'isDefault']} valuePropName="checked">
                                  <Switch />
                                </Form.Item>
                                <Button onClick={() => removeModel(modelField.name)}>{t('common.remove')}</Button>
                              </Space>
                            ))}
                            <Button type="dashed" onClick={() => addModel({})}>
                              {t('admin.config.addModel')}
                            </Button>
                          </Space>
                        )}
                      </Form.List>
                    </Card>
                    );
                  })}

                  <Button type="dashed" onClick={() => add({ headers: [], models: [], enabled: true })}>
                    {t('admin.config.addProvider')}
                  </Button>
                </Space>
              )}
            </Form.List>
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.ocr')} colSpan={24} className="apple-soft-card">
            <Form.Item
              label={t('admin.config.ocrApiKey')}
              name={['ocr', 'apiKey']}
              extra={
                config?.ocr.apiKeySet
                  ? t('admin.config.apiKeyHintSet')
                  : t('admin.config.apiKeyHintEmpty')
              }
            >
              <Input.Password
                placeholder={t('admin.config.ocrApiKeyPlaceholder')}
                autoComplete="new-password"
              />
            </Form.Item>
            <Form.Item
              label={t('admin.config.ocrSecretKey')}
              name={['ocr', 'secretKey']}
              extra={
                config?.ocr.secretKeySet
                  ? t('admin.config.apiKeyHintSet')
                  : t('admin.config.apiKeyHintEmpty')
              }
            >
              <Input.Password
                placeholder={t('admin.config.ocrSecretKeyPlaceholder')}
                autoComplete="new-password"
              />
            </Form.Item>
            <Form.Item
              label={t('admin.config.clearOcrApiKey')}
              name={['ocr', 'clearApiKey']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('admin.config.clearOcrSecretKey')}
              name={['ocr', 'clearSecretKey']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Button
              onClick={() => ocrCheck.mutation.mutate()}
              loading={ocrCheck.mutation.isPending}
            >
              {t('admin.config.testOcr')}
            </Button>
            <HealthCheckResult
              health={ocrCheck.health}
              successLabel={t('admin.config.ocrHealthOk')}
              failLabel={t('admin.config.ocrHealthFail')}
            />
            <Divider />
            <Typography.Text strong>{t('admin.config.ocrTest')}</Typography.Text>
            <Upload.Dragger
              maxCount={1}
              beforeUpload={() => false}
              accept="image/*"
              onChange={({ fileList }) => setOcrTestFile(fileList[0]?.originFileObj || null)}
              style={{ marginTop: 8 }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p>{t('admin.config.ocrTestHint')}</p>
            </Upload.Dragger>
            <Button
              style={{ marginTop: 8 }}
              onClick={async () => {
                if (!ocrTestFile) return;
                setOcrTestLoading(true);
                try {
                  const formData = new FormData();
                  formData.append('image', ocrTestFile);
                  const res = await api.post('/admin/ocr/test', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                  setOcrTestResult(res.data);
                } catch {
                  setOcrTestResult({ ok: false, error: 'Request failed' });
                } finally {
                  setOcrTestLoading(false);
                }
              }}
              loading={ocrTestLoading}
              disabled={!ocrTestFile}
            >
              {t('admin.config.ocrTestRun')}
            </Button>
            {ocrTestResult ? (
              <Card size="small" style={{ marginTop: 12 }}>
                <Tag color={ocrTestResult.ok ? 'green' : 'red'}>{ocrTestResult.ok ? 'OK' : 'ERROR'}</Tag>
                {ocrTestResult.length ? <Typography.Text type="secondary"> {ocrTestResult.length} chars</Typography.Text> : null}
                <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
                  {ocrTestResult.ok ? ocrTestResult.text : ocrTestResult.error}
                </Typography.Paragraph>
              </Card>
            ) : null}
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.budget')} colSpan={24} className="apple-soft-card">
            <Form.Item label={t('admin.config.budgetEnabled')} name={['budget', 'enabled']} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={t('admin.config.dailyBudgetLimit')} name={['budget', 'dailyCallLimit']}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.budgetMode')} name={['budget', 'mode']}>
              <Select
                options={[
                  { value: 'soft', label: t('admin.systemBudget.mode.soft') },
                  { value: 'hard', label: t('admin.systemBudget.mode.hard') },
                ]}
              />
            </Form.Item>
            <Typography.Text type="secondary">{t('admin.config.budgetHint')}</Typography.Text>
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.storage')} colSpan={24} className="apple-soft-card">
            <Form.Item label={t('admin.config.storageEndpoint')} name={['storage', 'endpoint']}>
              <Input placeholder="http://127.0.0.1:9000" />
            </Form.Item>
            <Form.Item label={t('admin.config.storageBucket')} name={['storage', 'bucket']}>
              <Input placeholder="submissions" />
            </Form.Item>
            <Form.Item label={t('admin.config.storageRegion')} name={['storage', 'region']}>
              <Input placeholder="us-east-1" />
            </Form.Item>
            <Typography.Text type="secondary">
              {`${t('admin.config.accessKeyStatus')}: ${config?.storage.accessKeySet ? t('common.yes') : t('common.no')} | ${t('admin.config.secretKeyStatus')}: ${config?.storage.secretKeySet ? t('common.yes') : t('common.no')}`}
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Button onClick={() => storageCheck.mutation.mutate()} loading={storageCheck.mutation.isPending}>
                {t('admin.config.testStorage')}
              </Button>
            </div>
            <HealthCheckResult
              health={storageCheck.health}
              successLabel={t('admin.config.storageHealthOk')}
              failLabel={t('admin.config.storageHealthFail')}
            />
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.email')} colSpan={24} className="apple-soft-card">
            <Form.Item label={t('admin.config.emailHost')} name={['email', 'host']}>
              <Input placeholder="smtp.example.com" />
            </Form.Item>
            <Form.Item label={t('admin.config.emailPort')} name={['email', 'port']}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.emailUser')} name={['email', 'user']}>
              <Input placeholder="noreply@example.com" />
            </Form.Item>
            <Form.Item label={t('admin.config.emailFrom')} name={['email', 'from']}>
              <Input placeholder="noreply@example.com" />
            </Form.Item>
            <Form.Item label={t('admin.config.emailSecure')} name={['email', 'secure']} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Typography.Text type="secondary">
              {`${t('admin.config.passwordStatus')}: ${config?.email.passwordSet ? t('common.yes') : t('common.no')} (${t('admin.config.envOnlySecretHint')})`}
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Button onClick={() => emailCheck.mutation.mutate()} loading={emailCheck.mutation.isPending}>
                {t('admin.config.testEmail')}
              </Button>
            </div>
            <HealthCheckResult
              health={emailCheck.health}
              successLabel={t('admin.config.emailHealthOk')}
              failLabel={t('admin.config.emailHealthFail')}
            />
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.redis')} colSpan={24} className="apple-soft-card">
            <Form.Item label={t('admin.config.redisHost')} name={['redis', 'host']}>
              <Input placeholder="127.0.0.1" />
            </Form.Item>
            <Form.Item label={t('admin.config.redisPort')} name={['redis', 'port']}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.redisDb')} name={['redis', 'db']}>
              <InputNumber min={0} max={15} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('admin.config.redisUsername')} name={['redis', 'username']}>
              <Input placeholder={t('admin.config.redisUsernamePlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.redisTls')} name={['redis', 'tls']} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Typography.Text type="secondary">
              {`${t('admin.config.passwordStatus')}: ${config?.redis.passwordSet ? t('common.yes') : t('common.no')} (${t('admin.config.envOnlySecretHint')})`}
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Button onClick={() => redisCheck.mutation.mutate()} loading={redisCheck.mutation.isPending}>
                {t('admin.config.testRedis')}
              </Button>
            </div>
            <HealthCheckResult
              health={redisCheck.health}
              successLabel={t('admin.config.redisHealthOk')}
              failLabel={t('admin.config.redisHealthFail')}
            />
          </ProCard>

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              {t('admin.config.save')}
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <LlmTestSection providerOptions={providerOptions} />

        <Divider />

        <LlmLogsSection ref={llmLogsSectionRef} providerOptions={providerOptions} />
      </Card>
    </PageContainer>
  );
};
