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
  Switch,
  Typography,
  message,
} from 'antd';
import { useEffect } from 'react';
import { fetchAdminConfig, updateAdminConfig } from '../../api';
import { useI18n } from '../../i18n';

export const AdminConfigPage = () => {
  const { t } = useI18n();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: fetchAdminConfig,
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
        timeoutMs: config.llm.timeoutMs,
        apiKey: '',
        clearApiKey: false,
      },
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
      timeoutMs?: number;
    };
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
            <Form.Item label={t('admin.config.timeoutMs')} name={['llm', 'timeoutMs']}>
              <InputNumber min={1000} step={500} style={{ width: '100%' }} />
            </Form.Item>
          </ProCard>

          <Divider />

          <ProCard bordered title={t('admin.config.section.ocr')} colSpan={24}>
            <Form.Item label={t('admin.config.ocrBaseUrl')} name={['ocr', 'baseUrl']}>
              <Input placeholder={t('admin.config.ocrBaseUrlPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('admin.config.ocrTimeout')} name={['ocr', 'timeoutMs']}>
              <InputNumber min={1000} step={500} style={{ width: '100%' }} />
            </Form.Item>
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
      </Card>
    </PageContainer>
  );
};
