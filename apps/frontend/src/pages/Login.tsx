import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { CountUpNumber } from '../components/CountUpNumber';
import { authStore, fetchPublicOverview, login } from '../api';
import { useI18n } from '../i18n';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const { data: overview } = useQuery({
    queryKey: ['public-overview', 7],
    queryFn: () => fetchPublicOverview(7),
    staleTime: 5 * 60 * 1000,
  });
  const completionRateValue =
    typeof overview?.completionRate === 'number'
      ? Math.round(overview.completionRate * 100)
      : undefined;
  const statusHint =
    completionRateValue === undefined ? t('login.systemStatusPending') : t('login.systemStatusHint');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    let frame = 0;
    let lastX = 0;
    let lastY = 0;

    const update = () => {
      frame = 0;
      root.style.setProperty('--mouse-x', `${lastX.toFixed(3)}`);
      root.style.setProperty('--mouse-y', `${lastY.toFixed(3)}`);
    };

    const handleMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      lastX = Math.max(-1, Math.min(1, x));
      lastY = Math.max(-1, Math.min(1, y));
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    const handleLeave = () => {
      lastX = 0;
      lastY = 0;
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    root.addEventListener('pointermove', handleMove, { passive: true });
    root.addEventListener('pointerleave', handleLeave);

    return () => {
      root.removeEventListener('pointermove', handleMove);
      root.removeEventListener('pointerleave', handleLeave);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

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
        navigate('/admin/config');
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
    <div ref={rootRef} className="login-dashboard dashboard-clean">
      <header className="login-dashboard__header">
        <div className="login-dashboard__brand">
          <span className="login-dashboard__brand-title">{t('app.title')}</span>
          <span className="login-dashboard__brand-subtitle">{t('login.title')}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="login-dashboard__ambient" aria-hidden="true">
        <div className="login-dashboard__orb login-dashboard__orb--one" />
        <div className="login-dashboard__orb login-dashboard__orb--two" />
        <div className="login-dashboard__orb login-dashboard__orb--three" />
        <div className="login-dashboard__rail login-dashboard__rail--one" />
        <div className="login-dashboard__rail login-dashboard__rail--two" />
        <div className="login-dashboard__chip login-dashboard__chip--alpha">
          <span className="login-dashboard__chip-label">教学周报</span>
          <span className="login-dashboard__chip-tag">本周</span>
        </div>
        <div className="login-dashboard__chip login-dashboard__chip--beta">
          <span className="login-dashboard__chip-label">学情画像</span>
          <span className="login-dashboard__chip-tag">实时</span>
        </div>
        <div className="login-dashboard__chip login-dashboard__chip--gamma">
          <span className="login-dashboard__chip-label">作业覆盖率</span>
          <span className="login-dashboard__chip-tag">更新</span>
        </div>
        <div className="login-dashboard__chip login-dashboard__chip--delta">
          <span className="login-dashboard__chip-label">批改进度</span>
          <span className="login-dashboard__chip-tag">同步</span>
        </div>
      </div>

      <main className="login-dashboard__main">
        <section className="login-dashboard__panel">
          <div className="login-dashboard__intro login-dashboard__reveal login-dashboard__reveal--delay-1">
            <Typography.Title level={2} className="login-dashboard__headline">
              {t('login.welcomeTitle')}
            </Typography.Title>
            <Typography.Text className="login-dashboard__subhead">
              {t('login.welcomeSubtitle')}
            </Typography.Text>
          </div>
          <div className="login-dashboard__tiles login-dashboard__reveal login-dashboard__reveal--delay-2">
              <div className="login-dashboard__tile">
                <span className="login-dashboard__tile-label">{t('nav.homeworks')}</span>
                <span className="login-dashboard__tile-value">
                  <CountUpNumber value={overview?.homeworks} decimals={0} />
                </span>
              </div>
              <div className="login-dashboard__tile">
                <span className="login-dashboard__tile-label">{t('nav.submissions')}</span>
                <span className="login-dashboard__tile-value">
                  <CountUpNumber value={overview?.submissions} decimals={0} />
                </span>
              </div>
              <div className="login-dashboard__tile">
                <span className="login-dashboard__tile-label">{t('nav.report')}</span>
                <span className="login-dashboard__tile-value">
                  <CountUpNumber value={completionRateValue} decimals={0} suffix="%" />
                </span>
              </div>
          </div>
          <div className="login-dashboard__sparkline login-dashboard__reveal login-dashboard__reveal--delay-3" />
        </section>

        <Card className="login-dashboard__card login-dashboard__reveal login-dashboard__reveal--delay-2">
          <Typography.Title level={4} className="login-dashboard__title">
            {t('login.title')}
          </Typography.Title>
          <div className="login-dashboard__status login-dashboard__reveal login-dashboard__reveal--delay-3">
            <span className="login-dashboard__status-dot" />
            <div className="login-dashboard__status-body">
              <span className="login-dashboard__status-label">{t('login.systemStatusTitle')}</span>
              <span className="login-dashboard__status-value">
                <CountUpNumber value={completionRateValue} decimals={0} suffix="%" />
              </span>
            </div>
            <span className="login-dashboard__status-hint">{statusHint}</span>
          </div>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="account"
              label={t('login.account')}
              rules={[{ required: true, message: t('login.accountRequired') }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('login.accountPlaceholder')}
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('login.password')}
              rules={[{ required: true, message: t('login.passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {t('login.signIn')}
            </Button>
          </Form>
        </Card>
      </main>
    </div>
  );
};
