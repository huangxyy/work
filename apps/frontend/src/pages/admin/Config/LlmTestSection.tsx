import { ProCard } from '@ant-design/pro-components';
import { Button, Card, Form, Input, InputNumber, Select, Space, Tag, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { testAdminLlmCall } from '../../../api';
import { useI18n } from '../../../i18n';
import { useMessage } from '../../../hooks/useMessage';
import type { LlmTestResult } from './types';

interface LlmTestSectionProps {
  providerOptions: Array<{ label: string; value: string }>;
}

export const LlmTestSection = ({ providerOptions }: LlmTestSectionProps) => {
  const { t } = useI18n();
  const message = useMessage();
  const [form] = Form.useForm();
  const [result, setResult] = useState<LlmTestResult | null>(null);

  const testMutation = useMutation({
    mutationFn: testAdminLlmCall,
    onSuccess: (data) => {
      setResult(data);
      if (!data.ok) {
        message.error(t('admin.config.llmTestFailed'));
      }
    },
    onError: () => {
      setResult({ ok: false, error: t('common.tryAgain') });
      message.error(t('admin.config.llmTestFailed'));
    },
  });

  return (
    <ProCard bordered title={t('admin.config.section.llmTest')} colSpan={24} className="apple-soft-card">
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          setResult(null);
          testMutation.mutate(values as { prompt: string });
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
        <Button type="primary" htmlType="submit" loading={testMutation.isPending}>
          {t('admin.config.runTest')}
        </Button>
      </Form>

      {result ? (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color={result.ok ? 'green' : 'red'}>
                {result.ok ? t('admin.config.testSuccess') : t('admin.config.testFailed')}
              </Tag>
              {result.provider ? <Typography.Text type="secondary">{result.provider}</Typography.Text> : null}
              {result.model ? <Typography.Text type="secondary">{result.model}</Typography.Text> : null}
              {typeof result.latencyMs === 'number' ? <Typography.Text type="secondary">{result.latencyMs}ms</Typography.Text> : null}
              {typeof result.cost === 'number' ? <Typography.Text type="secondary">${result.cost.toFixed(4)}</Typography.Text> : null}
              {result.usage?.totalTokens ? (
                <Typography.Text type="secondary">
                  {t('admin.config.logTokens')}: {result.usage.totalTokens}
                </Typography.Text>
              ) : null}
            </Space>
            <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap' }}>
              {result.ok ? result.response : result.error}
            </Typography.Paragraph>
          </Space>
        </Card>
      ) : null}
    </ProCard>
  );
};
