import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Select,
  Switch,
  Tag,
  Table,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  clearAdminLlmLogs,
  fetchAdminConfig,
  fetchAdminLlmLogs,
  testAdminLlmCall,
  testAdminLlmHealth,
  testAdminOcrHealth,
  updateAdminConfig,
} from '../../api';
import { useI18n } from '../../i18n';

type HealthState = {
  ok: boolean;
  checkedAt: string;
  reason?: string;
  status?: number;
  latencyMs?: number;
  model?: string;
};

type LlmTestResult = {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
  response?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  cost?: number;
  error?: string;
};

export const AdminConfigPage = () => {
  const { t } = useI18n();
  const [form] = Form.useForm();
  const [llmTestForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [llmHealth, setLlmHealth] = useState<HealthState | null>(null);
  const [ocrHealth, setOcrHealth] = useState<HealthState | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<LlmTestResult | null>(null);
  const [logFilters, setLogFilters] = useState<{ providerId?: string; status?: string; source?: string }>({
    providerId: undefined,
    status: undefined,
    source: undefined,
  });
  const [clearDays, setClearDays] = useState(7);

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

  const logsQuery = useQuery({
    queryKey: ['admin-llm-logs', logFilters],
    queryFn: () => fetchAdminLlmLogs({ page: 1, pageSize: 10, ...logFilters }),
  });

  const logs = logsQuery.data?.items || [];

  const logColumns = useMemo(
    () => [
      {
        title: t('admin.config.logTime'),
        dataIndex: 'createdAt',
        render: (value: string) => new Date(value).toLocaleString(),
      },
      {
        title: t('admin.config.logProvider'),
        dataIndex: 'providerName',
        render: (_: string, row: { providerName?: string; model?: string }) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>{row.providerName || '--'}</Typography.Text>
            <Typography.Text type="secondary">{row.model || '--'}</Typography.Text>
          </Space>
        ),
      },
      {
        title: t('admin.config.logStatus'),
        dataIndex: 'status',
        render: (value: string) => (
          <Tag color={value === 'OK' ? 'green' : 'red'}>{value}</Tag>
        ),
      },
      {
        title: t('admin.config.logTokens'),
        dataIndex: 'totalTokens',
        render: (_: number, row: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => (
          <Typography.Text>
            {row.totalTokens ?? '--'}
          </Typography.Text>
        ),
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
    ],
    [t],
  );

  const mutation = useMutation({
    mutationFn: updateAdminConfig,
    onSuccess: () => {
      message.success(t('admin.config.saved'));
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
    },
  });

  const llmHealthMutation = useMutation({
    mutationFn: testAdminLlmHealth,
    onSuccess: (data) => {
      setLlmHealth({
        ok: data.ok,
        checkedAt: new Date().toISOString(),
        reason: data.reason,
        status: data.status,
        latencyMs: data.latencyMs,
        model: data.model,
      });
      if (data.ok) {
        message.success(t('admin.config.llmHealthOk'));
      } else {
        message.error(`${t('admin.config.llmHealthFail')}: ${data.reason || data.status || ''}`);
      }
    },
    onError: () => {
      setLlmHealth({ ok: false, checkedAt: new Date().toISOString(), reason: t('common.tryAgain') });
      message.error(t('admin.config.llmHealthFail'));
    },
  });

  const ocrHealthMutation = useMutation({
    mutationFn: testAdminOcrHealth,
    onSuccess: (data) => {
      setOcrHealth({
        ok: data.ok,
        checkedAt: new Date().toISOString(),
        reason: data.reason,
        status: data.status,
        latencyMs: data.latencyMs,
      });
      if (data.ok) {
        message.success(t('admin.config.ocrHealthOk'));
      } else {
        message.error(`${t('admin.config.ocrHealthFail')}: ${data.reason || data.status || ''}`);
      }
    },
    onError: () => {
      setOcrHealth({ ok: false, checkedAt: new Date().toISOString(), reason: t('common.tryAgain') });
      message.error(t('admin.config.ocrHealthFail'));
    },
  });

  const llmTestMutation = useMutation({
    mutationFn: testAdminLlmCall,
    onSuccess: (data) => {
      setLlmTestResult(data);
      if (!data.ok) {
        message.error(t('admin.config.llmTestFailed'));
      }
    },
    onError: () => {
      setLlmTestResult({ ok: false, error: t('common.tryAgain') });
      message.error(t('admin.config.llmTestFailed'));
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: clearAdminLlmLogs,
    onSuccess: (data) => {
      message.success(`${t('admin.config.llmLogsCleared')} ${data.deleted}`);
      logsQuery.refetch();
    },
    onError: () => message.error(t('admin.config.llmLogsClearFailed')),
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
        baseUrl: config.ocr.baseUrl,
        timeoutMs: config.ocr.timeoutMs,
      },
      budget: {
        enabled: config.budget.enabled,
        dailyCallLimit: config.budget.dailyCallLimit,
        mode: config.budget.mode,
      },
    });
    setLlmHealth(config.health?.llm ?? null);
    setOcrHealth(config.health?.ocr ?? null);
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
    ocr?: { baseUrl?: string; timeoutMs?: number };
    budget?: { enabled?: boolean; dailyCallLimit?: number; mode?: 'soft' | 'hard' };
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
      <Card loading={isLoading}>
        <Form layout="vertical" form={form} onFinish={handleFinish}>
          <ProCard bordered title={t('admin.config.section.llm')} colSpan={24}>
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
              onClick={() => llmHealthMutation.mutate()}
              loading={llmHealthMutation.isPending}
            >
              {t('admin.config.testLlm')}
            </Button>
            {llmHealth ? (
              <Space size={8} style={{ marginTop: 8 }} wrap>
                <Tag color={llmHealth.ok ? 'green' : 'red'}>
                  {llmHealth.ok ? t('admin.config.llmHealthOk') : t('admin.config.llmHealthFail')}
                </Tag>
                <Typography.Text type="secondary">
                  {t('admin.config.lastChecked')} {new Date(llmHealth.checkedAt).toLocaleString()}
                </Typography.Text>
                {llmHealth.model ? (
                  <Typography.Text type="secondary">{llmHealth.model}</Typography.Text>
                ) : null}
                {typeof llmHealth.latencyMs === 'number' ? (
                  <Typography.Text type="secondary">{llmHealth.latencyMs}ms</Typography.Text>
                ) : null}
                {!llmHealth.ok && llmHealth.reason ? (
                  <Typography.Text type="secondary">{llmHealth.reason}</Typography.Text>
                ) : null}
              </Space>
            ) : null}
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.llmProviders')} colSpan={24}>
            <Form.List name="llmProviders">
              {(fields, { add, remove }) => (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={t('admin.config.provider')}
                      extra={
                        <Button danger onClick={() => remove(field.name)}>
                          {t('common.remove')}
                        </Button>
                      }
                    >
                      <Form.Item
                        {...field}
                        label={t('admin.config.providerId')}
                        name={[field.name, 'id']}
                        rules={[{ required: true, message: t('admin.config.providerIdRequired') }]}
                      >
                        <Input placeholder={t('admin.config.providerIdPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        label={t('admin.config.providerName')}
                        name={[field.name, 'name']}
                      >
                        <Input placeholder={t('admin.config.providerNamePlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        label={t('admin.config.baseUrl')}
                        name={[field.name, 'baseUrl']}
                        rules={[{ required: true, message: t('admin.config.baseUrlRequired') }]}
                      >
                        <Input placeholder={t('admin.config.baseUrlPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        label={t('admin.config.providerPath')}
                        name={[field.name, 'path']}
                      >
                        <Input placeholder={t('admin.config.providerPathPlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        {...field}
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
                        {...field}
                        label={t('admin.config.clearApiKey')}
                        name={[field.name, 'clearApiKey']}
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                      <Form.Item
                        {...field}
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
                                  {...headerField}
                                  name={[headerField.name, 'key']}
                                  rules={[{ required: true, message: t('admin.config.headerKeyRequired') }]}
                                >
                                  <Input placeholder={t('admin.config.headerKey')} />
                                </Form.Item>
                                <Form.Item
                                  {...headerField}
                                  name={[headerField.name, 'value']}
                                  rules={[{ required: true, message: t('admin.config.headerValueRequired') }]}
                                >
                                  <Input placeholder={t('admin.config.headerValue')} />
                                </Form.Item>
                                <Form.Item
                                  {...headerField}
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
                                  {...modelField}
                                  name={[modelField.name, 'name']}
                                  rules={[{ required: true, message: t('admin.config.modelRequired') }]}
                                >
                                  <Input placeholder={t('admin.config.modelPlaceholder')} />
                                </Form.Item>
                                <Form.Item {...modelField} name={[modelField.name, 'priceIn']}>
                                  <InputNumber min={0} step={0.001} placeholder={t('admin.config.priceIn')} />
                                </Form.Item>
                                <Form.Item {...modelField} name={[modelField.name, 'priceOut']}>
                                  <InputNumber min={0} step={0.001} placeholder={t('admin.config.priceOut')} />
                                </Form.Item>
                                <Form.Item {...modelField} name={[modelField.name, 'isDefault']} valuePropName="checked">
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
                  ))}

                  <Button type="dashed" onClick={() => add({ headers: [], models: [], enabled: true })}>
                    {t('admin.config.addProvider')}
                  </Button>
                </Space>
              )}
            </Form.List>
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.ocr')} colSpan={24}>
            <Form.Item label={t('admin.config.ocrBaseUrl')} name={['ocr', 'baseUrl']}>
              <Input placeholder={t('admin.config.ocrBaseUrlPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.ocrTimeout')} name={['ocr', 'timeoutMs']}>
              <InputNumber min={1000} step={500} style={{ width: '100%' }} />
            </Form.Item>
            <Button
              onClick={() => ocrHealthMutation.mutate()}
              loading={ocrHealthMutation.isPending}
            >
              {t('admin.config.testOcr')}
            </Button>
            {ocrHealth ? (
              <Space size={8} style={{ marginTop: 8 }} wrap>
                <Tag color={ocrHealth.ok ? 'green' : 'red'}>
                  {ocrHealth.ok ? t('admin.config.ocrHealthOk') : t('admin.config.ocrHealthFail')}
                </Tag>
                <Typography.Text type="secondary">
                  {t('admin.config.lastChecked')} {new Date(ocrHealth.checkedAt).toLocaleString()}
                </Typography.Text>
                {typeof ocrHealth.latencyMs === 'number' ? (
                  <Typography.Text type="secondary">{ocrHealth.latencyMs}ms</Typography.Text>
                ) : null}
                {!ocrHealth.ok && ocrHealth.reason ? (
                  <Typography.Text type="secondary">{ocrHealth.reason}</Typography.Text>
                ) : null}
              </Space>
            ) : null}
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.budget')} colSpan={24}>
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

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              {t('admin.config.save')}
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <ProCard bordered title={t('admin.config.section.llmTest')} colSpan={24}>
          <Form
            form={llmTestForm}
            layout="vertical"
            onFinish={(values) => {
              setLlmTestResult(null);
              llmTestMutation.mutate(values as { prompt: string });
            }}
            initialValues={{ responseFormat: 'text' }}
          >
            <Form.Item label={t('admin.config.testProvider')} name="providerId">
              <Select allowClear options={providerOptions} placeholder={t('admin.config.testProviderPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.testModel')} name="model">
              <Input placeholder={t('admin.config.modelPlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('admin.config.testPrompt')}
              name="prompt"
              rules={[{ required: true, message: t('admin.config.testPromptRequired') }]}
            >
              <Input.TextArea rows={4} placeholder={t('admin.config.testPromptPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.systemPrompt')} name="systemPrompt">
              <Input.TextArea rows={3} placeholder={t('admin.config.systemPromptPlaceholder')} />
            </Form.Item>
            <Space wrap>
              <Form.Item label={t('admin.config.maxTokens')} name="maxTokens">
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item label={t('admin.config.temperature')} name="temperature">
                <InputNumber min={0} max={2} step={0.1} />
              </Form.Item>
              <Form.Item label={t('admin.config.topP')} name="topP">
                <InputNumber min={0} max={1} step={0.05} />
              </Form.Item>
              <Form.Item label={t('admin.config.presencePenalty')} name="presencePenalty">
                <InputNumber min={-2} max={2} step={0.1} />
              </Form.Item>
              <Form.Item label={t('admin.config.frequencyPenalty')} name="frequencyPenalty">
                <InputNumber min={-2} max={2} step={0.1} />
              </Form.Item>
            </Space>
            <Form.Item label={t('admin.config.responseFormat')} name="responseFormat">
              <Select
                allowClear
                options={[
                  { label: t('admin.config.responseFormatText'), value: 'text' },
                  { label: t('admin.config.responseFormatJson'), value: 'json_object' },
                ]}
              />
            </Form.Item>
            <Form.Item label={t('admin.config.stopSequences')} name="stop">
              <Select mode="tags" placeholder={t('admin.config.stopSequencesPlaceholder')} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={llmTestMutation.isPending}>
              {t('admin.config.runTest')}
            </Button>
          </Form>

          {llmTestResult ? (
            <Card size="small" style={{ marginTop: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={llmTestResult.ok ? 'green' : 'red'}>
                    {llmTestResult.ok ? t('admin.config.testSuccess') : t('admin.config.testFailed')}
                  </Tag>
                  {llmTestResult.provider ? (
                    <Typography.Text type="secondary">{llmTestResult.provider}</Typography.Text>
                  ) : null}
                  {llmTestResult.model ? (
                    <Typography.Text type="secondary">{llmTestResult.model}</Typography.Text>
                  ) : null}
                  {typeof llmTestResult.latencyMs === 'number' ? (
                    <Typography.Text type="secondary">{llmTestResult.latencyMs}ms</Typography.Text>
                  ) : null}
                  {typeof llmTestResult.cost === 'number' ? (
                    <Typography.Text type="secondary">${llmTestResult.cost.toFixed(4)}</Typography.Text>
                  ) : null}
                  {llmTestResult.usage?.totalTokens ? (
                    <Typography.Text type="secondary">
                      {t('admin.config.logTokens')}: {llmTestResult.usage.totalTokens}
                    </Typography.Text>
                  ) : null}
                </Space>
                <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap' }}>
                  {llmTestResult.ok ? llmTestResult.response : llmTestResult.error}
                </Typography.Paragraph>
              </Space>
            </Card>
          ) : null}
        </ProCard>

        <Divider />

        <ProCard bordered title={t('admin.config.section.llmLogs')} colSpan={24}>
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
              options={[
                { label: 'OK', value: 'OK' },
                { label: 'ERROR', value: 'ERROR' },
              ]}
              value={logFilters.status}
              onChange={(value) => setLogFilters((prev) => ({ ...prev, status: value }))}
              style={{ minWidth: 140 }}
            />
            <Select
              allowClear
              placeholder={t('admin.config.logSourcePlaceholder')}
              options={[
                { label: 'grading', value: 'grading' },
                { label: 'admin-test', value: 'admin-test' },
              ]}
              value={logFilters.source}
              onChange={(value) => setLogFilters((prev) => ({ ...prev, source: value }))}
              style={{ minWidth: 160 }}
            />
            <Popconfirm
              title={t('admin.config.confirmClearLogs')}
              onConfirm={() =>
                clearLogsMutation.mutate({
                  before: new Date(Date.now() - clearDays * 24 * 60 * 60 * 1000).toISOString(),
                })
              }
            >
              <Button danger loading={clearLogsMutation.isPending}>
                {t('admin.config.clearLogs')}
              </Button>
            </Popconfirm>
            <Space size={6}>
              <Typography.Text>{t('admin.config.clearBefore')}</Typography.Text>
              <InputNumber min={1} max={365} value={clearDays} onChange={(value) => setClearDays(value || 7)} />
              <Typography.Text type="secondary">{t('common.days')}</Typography.Text>
            </Space>
          </Space>

          <Table
            rowKey="id"
            columns={logColumns}
            dataSource={logs}
            loading={logsQuery.isLoading}
            pagination={false}
            size="small"
          />
        </ProCard>
      </Card>
    </PageContainer>
  );
};
