import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Form, Input, Result, Space, Steps, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useI18n } from '../i18n';
import { useMessage } from '../hooks/useMessage';

export const ForgotPasswordPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSendCode = async (values: { email: string }) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: values.email });
      setEmail(values.email);
      setStep(1);
      message.success(t('forgotPassword.codeSent'));
    } catch {
      message.error(t('forgotPassword.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values: { code: string; newPassword: string }) => {
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code: values.code, newPassword: values.newPassword });
      setDone(true);
    } catch {
      message.error(t('forgotPassword.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
        <Result
          status="success"
          title={t('forgotPassword.success')}
          subTitle={t('forgotPassword.successHint')}
          extra={<Button type="primary" onClick={() => navigate('/login')}>{t('forgotPassword.backToLogin')}</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
      <ProCard bordered className="apple-soft-card">
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          {t('forgotPassword.title')}
        </Typography.Title>
        <Steps current={step} size="small" style={{ marginBottom: 24 }} items={[
          { title: t('forgotPassword.step1') },
          { title: t('forgotPassword.step2') },
        ]} />

        {step === 0 ? (
          <Form layout="vertical" onFinish={handleSendCode}>
            <Form.Item name="email" label={t('profile.email')} rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="user@example.com" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {t('forgotPassword.sendCode')}
            </Button>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleResetPassword}>
            <Alert message={`${t('forgotPassword.codeSentTo')} ${email}`} type="info" className="apple-inline-alert" />
            <Form.Item name="code" label={t('forgotPassword.code')} rules={[{ required: true, len: 6 }]}>
              <Input placeholder="123456" maxLength={6} />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label={t('profile.newPassword')}
              rules={[{ required: true }, { min: 8 }, { pattern: /(?=.*[a-zA-Z])(?=.*\d)/, message: t('profile.passwordFormat') }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label={t('profile.confirmPassword')}
              dependencies={['newPassword']}
              rules={[{ required: true }, ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error(t('profile.passwordMismatch')));
                },
              })]}
            >
              <Input.Password />
            </Form.Item>
            <Space style={{ width: '100%' }} direction="vertical">
              <Button type="primary" htmlType="submit" loading={loading} block>
                {t('forgotPassword.resetPassword')}
              </Button>
              <Button type="link" block onClick={() => setStep(0)}>
                {t('forgotPassword.resendCode')}
              </Button>
            </Space>
          </Form>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" onClick={() => navigate('/login')}>
            {t('forgotPassword.backToLogin')}
          </Button>
        </div>
      </ProCard>
    </div>
  );
};
