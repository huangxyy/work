import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Alert,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Select,
  Segmented,
  Steps,
  Switch,
  Tag,
  Table,
  Typography,
  Upload,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearAdminLlmLogs,
  fetchAdminConfig,
  fetchAdminLlmLogs,
  testAdminLlmCall,
  testAdminLlmHealth,
  testAdminStorageHealth,
  testAdminEmailHealth,
  testAdminRedisHealth,
  testAdminOcrHealth,
  updateAdminConfig,
} from '../../api';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';
import { useMessage } from '../../hooks/useMessage';

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

type LlmLogItem = {
  id: string;
  source: string;
  providerId?: string | null;
  providerName?: string | null;
  model?: string | null;
  status: string;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  cost?: number | null;
  prompt?: string | null;
  systemPrompt?: string | null;
  response?: string | null;
  error?: string | null;
  meta?: unknown;
  userId?: string | null;
  submissionId?: string | null;
  createdAt: string;
};

export const AdminConfigPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const [form] = Form.useForm();
  const [llmTestForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [llmHealth, setLlmHealth] = useState<HealthState | null>(null);
  const [ocrHealth, setOcrHealth] = useState<HealthState | null>(null);
  const [storageHealth, setStorageHealth] = useState<HealthState | null>(null);
  const [emailHealth, setEmailHealth] = useState<HealthState | null>(null);
  const [redisHealth, setRedisHealth] = useState<HealthState | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<LlmTestResult | null>(null);
  const [logDetailOpen, setLogDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LlmLogItem | null>(null);
  const [logFilters, setLogFilters] = useState<{ providerId?: string; status?: string; source?: string }>({
    providerId: undefined,
    status: undefined,
    source: undefined,
  });
  const [clearDays, setClearDays] = useState(7);
  const [ocrTestFile, setOcrTestFile] = useState<File | null>(null);
  const [ocrTestLoading, setOcrTestLoading] = useState(false);
  const [ocrTestResult, setOcrTestResult] = useState<{ ok: boolean; text?: string; length?: number; error?: string } | null>(null);
  const [configMode, setConfigMode] = useState<'wizard' | 'advanced'>('wizard');
  const [wizardStep, setWizardStep] = useState(0);
  const llmConfigSectionRef = useRef<HTMLDivElement | null>(null);
  const llmLogsSectionRef = useRef<HTMLDivElement | null>(null);
  const llmProvidersSectionRef = useRef<HTMLDivElement | null>(null);
  const serviceSectionRef = useRef<HTMLDivElement | null>(null);
  const validationSectionRef = useRef<HTMLDivElement | null>(null);
  const publishSectionRef = useRef<HTMLDivElement | null>(null);

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
  const wizardItems = useMemo(
    () => [
      { title: t('admin.config.wizard.stepCore') },
      { title: t('admin.config.wizard.stepProviders') },
      { title: t('admin.config.wizard.stepValidation') },
      { title: t('admin.config.wizard.stepPublish') },
    ],
    [t],
  );

  const logsQuery = useQuery({
    queryKey: ['admin-llm-logs', logFilters],
    queryFn: () => fetchAdminLlmLogs({ page: 1, pageSize: 10, ...logFilters }),
  });

  const logs: LlmLogItem[] = logsQuery.data?.items || [];
  const isWizard = configMode === 'wizard';
  const canShowCoreConfig = !isWizard || wizardStep === 0;
  const canShowProviders = !isWizard || wizardStep === 1;
  const canShowValidation = !isWizard || wizardStep === 2;
  const canShowPublish = !isWizard || wizardStep === 3;
  const goToCurrentStep = useCallback(() => {
    const target =
      wizardStep === 0
        ? llmConfigSectionRef.current
        : wizardStep === 1
          ? llmProvidersSectionRef.current
          : wizardStep === 2
            ? validationSectionRef.current
            : publishSectionRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [wizardStep]);

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
        render: (value: string) => (
          <Tag color={value === 'OK' ? 'green' : 'red'}>{value}</Tag>
        ),
      },
      {
        title: t('admin.config.logTokens'),
        dataIndex: 'totalTokens',
        render: (_: number, row: LlmLogItem) => (
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
      {
        title: t('common.detail'),
        key: 'detail',
        render: (_: unknown, row: LlmLogItem) => (
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedLog(row);
              setLogDetailOpen(true);
            }}
          >
            {t('common.detail')}
          </Button>
        ),
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

  const storageHealthMutation = useMutation({
    mutationFn: testAdminStorageHealth,
    onSuccess: (data) => {
      setStorageHealth({
        ok: data.ok,
        checkedAt: new Date().toISOString(),
        reason: data.reason,
        status: data.status,
        latencyMs: data.latencyMs,
      });
      if (data.ok) {
        message.success(t('admin.config.storageHealthOk'));
      } else {
        message.error(`${t('admin.config.storageHealthFail')}: ${data.reason || data.status || ''}`);
      }
    },
    onError: () => {
      setStorageHealth({ ok: false, checkedAt: new Date().toISOString(), reason: t('common.tryAgain') });
      message.error(t('admin.config.storageHealthFail'));
    },
  });

  const emailHealthMutation = useMutation({
    mutationFn: testAdminEmailHealth,
    onSuccess: (data) => {
      setEmailHealth({
        ok: data.ok,
        checkedAt: new Date().toISOString(),
        reason: data.reason,
        status: data.status,
        latencyMs: data.latencyMs,
      });
      if (data.ok) {
        message.success(t('admin.config.emailHealthOk'));
      } else {
        message.error(`${t('admin.config.emailHealthFail')}: ${data.reason || data.status || ''}`);
      }
    },
    onError: () => {
      setEmailHealth({ ok: false, checkedAt: new Date().toISOString(), reason: t('common.tryAgain') });
      message.error(t('admin.config.emailHealthFail'));
    },
  });

  const redisHealthMutation = useMutation({
    mutationFn: testAdminRedisHealth,
    onSuccess: (data) => {
      setRedisHealth({
        ok: data.ok,
        checkedAt: new Date().toISOString(),
        reason: data.reason,
        status: data.status,
        latencyMs: data.latencyMs,
      });
      if (data.ok) {
        message.success(t('admin.config.redisHealthOk'));
      } else {
        message.error(`${t('admin.config.redisHealthFail')}: ${data.reason || data.status || ''}`);
      }
    },
    onError: () => {
      setRedisHealth({ ok: false, checkedAt: new Date().toISOString(), reason: t('common.tryAgain') });
      message.error(t('admin.config.redisHealthFail'));
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
    setLlmHealth(config.health?.llm ?? null);
    setOcrHealth(config.health?.ocr ?? null);
    setStorageHealth(null);
    setEmailHealth(null);
    setRedisHealth(null);
  }, [config, form]);

  useEffect(() => {
    if (!isWizard) {
      return;
    }
    goToCurrentStep();
  }, [wizardStep, isWizard, goToCurrentStep]);

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
        <ProCard bordered title={t('admin.config.wizard.title')} colSpan={24} className="apple-soft-card" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Segmented
              value={configMode}
              onChange={(value) => setConfigMode(value as 'wizard' | 'advanced')}
              options={[
                { label: t('admin.config.wizard.modeWizard'), value: 'wizard' },
                { label: t('admin.config.wizard.modeAdvanced'), value: 'advanced' },
              ]}
            />
            {isWizard ? (
              <>
                <Alert type="info" showIcon message={t('admin.config.wizard.hint')} />
                <Steps current={wizardStep} items={wizardItems} size="small" />
                <Space wrap>
                  <Button
                    onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}
                    disabled={wizardStep === 0}
                  >
                    {t('admin.config.wizard.prev')}
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => setWizardStep((prev) => Math.min(3, prev + 1))}
                    disabled={wizardStep === 3}
                  >
                    {t('admin.config.wizard.next')}
                  </Button>
                  <Button onClick={goToCurrentStep}>{t('admin.config.wizard.goCurrent')}</Button>
                </Space>
              </>
            ) : (
              <Typography.Text type="secondary">{t('admin.config.wizard.advancedHint')}</Typography.Text>
            )}
          </Space>
        </ProCard>
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
                type="primary"
                onClick={() =>
                  llmConfigSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {t('admin.config.goToPromptEdit')}
              </Button>
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
          {canShowCoreConfig ? (
            <div ref={llmConfigSectionRef}>
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
                  {t('admin.config.lastChecked')} {formatDate(llmHealth.checkedAt)}
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
            </div>
          ) : null}

          {canShowProviders ? <Divider /> : null}

          {canShowProviders ? (
            <div ref={llmProvidersSectionRef}>
              <ProCard bordered title={t('admin.config.section.llmProviders')} colSpan={24} className="apple-soft-card">
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
            </div>
          ) : null}

          {canShowCoreConfig ? <Divider /> : null}

          {canShowCoreConfig ? (
            <div ref={serviceSectionRef}>
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
                  {t('admin.config.lastChecked')} {formatDate(ocrHealth.checkedAt)}
                </Typography.Text>
                {typeof ocrHealth.latencyMs === 'number' ? (
                  <Typography.Text type="secondary">{ocrHealth.latencyMs}ms</Typography.Text>
                ) : null}
                {!ocrHealth.ok && ocrHealth.reason ? (
                  <Typography.Text type="secondary">{ocrHealth.reason}</Typography.Text>
                ) : null}
              </Space>
            ) : null}
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
              <Button onClick={() => storageHealthMutation.mutate()} loading={storageHealthMutation.isPending}>
                {t('admin.config.testStorage')}
              </Button>
            </div>
            {storageHealth ? (
              <Space size={8} style={{ marginTop: 8 }} wrap>
                <Tag color={storageHealth.ok ? 'green' : 'red'}>
                  {storageHealth.ok ? t('admin.config.storageHealthOk') : t('admin.config.storageHealthFail')}
                </Tag>
                <Typography.Text type="secondary">
                  {t('admin.config.lastChecked')} {formatDate(storageHealth.checkedAt)}
                </Typography.Text>
                {typeof storageHealth.latencyMs === 'number' ? (
                  <Typography.Text type="secondary">{storageHealth.latencyMs}ms</Typography.Text>
                ) : null}
                {!storageHealth.ok && storageHealth.reason ? (
                  <Typography.Text type="secondary">{storageHealth.reason}</Typography.Text>
                ) : null}
              </Space>
            ) : null}
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
              <Button onClick={() => emailHealthMutation.mutate()} loading={emailHealthMutation.isPending}>
                {t('admin.config.testEmail')}
              </Button>
            </div>
            {emailHealth ? (
              <Space size={8} style={{ marginTop: 8 }} wrap>
                <Tag color={emailHealth.ok ? 'green' : 'red'}>
                  {emailHealth.ok ? t('admin.config.emailHealthOk') : t('admin.config.emailHealthFail')}
                </Tag>
                <Typography.Text type="secondary">
                  {t('admin.config.lastChecked')} {formatDate(emailHealth.checkedAt)}
                </Typography.Text>
                {typeof emailHealth.latencyMs === 'number' ? (
                  <Typography.Text type="secondary">{emailHealth.latencyMs}ms</Typography.Text>
                ) : null}
                {!emailHealth.ok && emailHealth.reason ? (
                  <Typography.Text type="secondary">{emailHealth.reason}</Typography.Text>
                ) : null}
              </Space>
            ) : null}
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
              <Button onClick={() => redisHealthMutation.mutate()} loading={redisHealthMutation.isPending}>
                {t('admin.config.testRedis')}
              </Button>
            </div>
            {redisHealth ? (
              <Space size={8} style={{ marginTop: 8 }} wrap>
                <Tag color={redisHealth.ok ? 'green' : 'red'}>
                  {redisHealth.ok ? t('admin.config.redisHealthOk') : t('admin.config.redisHealthFail')}
                </Tag>
                <Typography.Text type="secondary">
                  {t('admin.config.lastChecked')} {formatDate(redisHealth.checkedAt)}
                </Typography.Text>
                {typeof redisHealth.latencyMs === 'number' ? (
                  <Typography.Text type="secondary">{redisHealth.latencyMs}ms</Typography.Text>
                ) : null}
                {!redisHealth.ok && redisHealth.reason ? (
                  <Typography.Text type="secondary">{redisHealth.reason}</Typography.Text>
                ) : null}
              </Space>
            ) : null}
          </ProCard>
            </div>
          ) : null}

          {canShowPublish ? <Divider /> : null}

          {canShowPublish ? (
            <div ref={publishSectionRef}>
              <Alert
                type="success"
                showIcon
                message={t('admin.config.wizard.publishHint')}
                style={{ marginBottom: 12 }}
              />
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={mutation.isPending}>
                  {t('admin.config.save')}
                </Button>
              </Form.Item>
            </div>
          ) : null}
        </Form>
        {isWizard ? (
          <div className="apple-sticky-action-bar">
            <Space wrap>
              <Button onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))} disabled={wizardStep === 0}>
                {t('admin.config.wizard.prev')}
              </Button>
              <Button type="primary" onClick={() => setWizardStep((prev) => Math.min(3, prev + 1))} disabled={wizardStep === 3}>
                {t('admin.config.wizard.next')}
              </Button>
              <Button type="primary" ghost onClick={() => form.submit()} loading={mutation.isPending}>
                {t('admin.config.save')}
              </Button>
            </Space>
          </div>
        ) : null}

        {canShowValidation ? <Divider /> : null}

        {canShowValidation ? (
          <div ref={validationSectionRef}>
            <ProCard bordered title={t('admin.config.section.llmTest')} colSpan={24} className="apple-soft-card">
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

            <div ref={llmLogsSectionRef}>
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
                  <Descriptions.Item label={t('admin.config.logTime')}>
                    {formatDate(selectedLog.createdAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logSource')}>
                    {selectedLog.source || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logStatus')}>
                    <Tag color={selectedLog.status === 'OK' ? 'green' : 'red'}>{selectedLog.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logProviderName')}>
                    {selectedLog.providerName || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logProviderId')}>
                    {selectedLog.providerId || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logModel')}>
                    {selectedLog.model || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logLatency')}>
                    {selectedLog.latencyMs ? `${selectedLog.latencyMs}ms` : '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logTokens')}>
                    <Space size={6} wrap>
                      <Typography.Text>{selectedLog.totalTokens ?? '--'}</Typography.Text>
                      <Typography.Text type="secondary">
                        {selectedLog.promptTokens ?? '--'} / {selectedLog.completionTokens ?? '--'}
                      </Typography.Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logCost')}>
                    {typeof selectedLog.cost === 'number' ? selectedLog.cost.toFixed(4) : '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logUserId')}>
                    {selectedLog.userId || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admin.config.logSubmissionId')}>
                    {selectedLog.submissionId || '--'}
                  </Descriptions.Item>
                </Descriptions>
                <Divider />
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div>
                    <Typography.Text type="secondary">{t('admin.config.logPrompt')}</Typography.Text>
                    <Typography.Paragraph
                      copyable
                      style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}
                    >
                      {selectedLog.prompt || '--'}
                    </Typography.Paragraph>
                  </div>
                  <div>
                    <Typography.Text type="secondary">{t('admin.config.logSystemPrompt')}</Typography.Text>
                    <Typography.Paragraph
                      copyable
                      style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}
                    >
                      {selectedLog.systemPrompt || '--'}
                    </Typography.Paragraph>
                  </div>
                  <div>
                    <Typography.Text type="secondary">{t('admin.config.logResponse')}</Typography.Text>
                    <Typography.Paragraph
                      copyable
                      style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}
                    >
                      {selectedLog.response || '--'}
                    </Typography.Paragraph>
                  </div>
                  <div>
                    <Typography.Text type="secondary">{t('admin.config.logError')}</Typography.Text>
                    <Typography.Paragraph
                      copyable
                      style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}
                    >
                      {selectedLog.error || '--'}
                    </Typography.Paragraph>
                  </div>
                  <div>
                    <Typography.Text type="secondary">{t('admin.config.logMeta')}</Typography.Text>
                    <Typography.Paragraph
                      copyable
                      style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}
                    >
                      {selectedLog.meta ? JSON.stringify(selectedLog.meta, null, 2) : '--'}
                    </Typography.Paragraph>
                  </div>
                </Space>
              </Space>
            ) : null}
          </Modal>
              </ProCard>
            </div>
          </div>
        ) : null}
      </Card>
    </PageContainer>
  );
};
