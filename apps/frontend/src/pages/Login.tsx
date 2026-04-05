import { LockOutlined, UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { CountUpNumber } from '../components/CountUpNumber';
import { authStore, fetchPublicOverview, login } from '../api';
import { useI18n } from '../i18n';
import { useMessage } from '../hooks/useMessage';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const message = useMessage();

  const { data: overview } = useQuery({
    queryKey: ['public-overview', 7],
    queryFn: () => fetchPublicOverview(7),
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: 3000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  
  const completionRateValue =
    typeof overview?.completionRate === 'number'
      ? Math.round(overview.completionRate * 100)
      : undefined;

  const onFinish = async (values: { account: string; password: string }) => {
    setLoading(true);
    try {
      const result = await login(values.account, values.password);
      authStore.setToken(result.token);
      authStore.setUser(result.user);
      message.success(t('login.success'));

      if (result.user.role === 'TEACHER') {
        navigate('/teacher/classes');
      } else if (result.user.role === 'ADMIN') {
        navigate('/admin/system/config');
      } else {
        navigate('/student/homeworks');
      }
    } catch (error) {
      message.error(t('login.failure'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="apple-login-layout">
      <header className="apple-login-header">
        <div className="apple-login-brand-title" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          {t('app.title')}
        </div>
        <LanguageSwitcher />
      </header>
      <main className="apple-login-main">
        <div className="apple-login-content">
          <section className="apple-login-hero">
            <Typography.Title level={1} className="apple-login-title">
              {t('app.title')}
            </Typography.Title>
            <Typography.Paragraph className="apple-login-subtitle">
              {t('login.welcomeSubtitle')}
            </Typography.Paragraph>

            {overview && (
              <div className="apple-login-stats">
                <div className="apple-login-stat-item">
                  <span className="apple-stat-value"><CountUpNumber value={overview.homeworks} decimals={0} /></span>
                  <span className="apple-stat-label">{t('nav.homeworks')}</span>
                </div>
                <div className="apple-login-stat-divider" />
                <div className="apple-login-stat-item">
                  <span className="apple-stat-value"><CountUpNumber value={overview.submissions} decimals={0} /></span>
                  <span className="apple-stat-label">{t('nav.submissions')}</span>
                </div>
                <div className="apple-login-stat-divider" />
                <div className="apple-login-stat-item">
                  <span className="apple-stat-value"><CountUpNumber value={completionRateValue} decimals={0} suffix="%" /></span>
                  <span className="apple-stat-label">{t('nav.report')}</span>
                </div>
              </div>
            )}
          </section>

          <Card className="apple-login-card" variant="borderless">
            <div className="apple-login-card-header">
              <Typography.Title level={3}>{t('login.title')}</Typography.Title>
            </div>
            <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
              <Form.Item
                name="account"
                rules={[{ required: true, message: t('login.accountRequired') }]}
              >
                <Input
                  className="apple-input"
                  prefix={<UserOutlined style={{ color: 'var(--apple-text-muted)' }} />}
                  placeholder={t('login.accountPlaceholder')}
                  autoComplete="username"
                />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[{ required: true, message: t('login.passwordRequired') }]}
                style={{ marginBottom: 24 }}
              >
                <Input.Password
                  className="apple-input"
                  prefix={<LockOutlined style={{ color: 'var(--apple-text-muted)' }} />}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="current-password"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="apple-submit-btn"
                icon={<ArrowRightOutlined />}
                iconPosition="end"
              >
                {t('login.signIn')}
              </Button>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Typography.Link onClick={() => navigate('/forgot-password')}>
                {t('forgotPassword.link')}
              </Typography.Link>
            </div>
          </Form>
          <div className="apple-login-footer-links">
            <span className="apple-login-footer-hint">
              {language.startsWith('zh') ? '登录即表示您同意我们的' : 'By signing in, you agree to our'}
            </span>
            <div className="apple-login-footer-actions">
              <Typography.Link onClick={() => navigate('/terms')}>
                {t('legal.terms')}
              </Typography.Link>
              <span className="apple-login-footer-divider">|</span>
              <Typography.Link onClick={() => navigate('/privacy')}>
                {t('legal.privacy')}
              </Typography.Link>
            </div>
          </div>
        </Card>
        </div>
      </main>
    </div>
  );
};
