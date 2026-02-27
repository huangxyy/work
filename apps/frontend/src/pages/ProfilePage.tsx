import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Button, Form, Input, Space } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { api, authStore } from '../api/client';
import { useI18n } from '../i18n';
import { useMessage } from '../hooks/useMessage';

export const ProfilePage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const user = authStore.getUser();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const profileMutation = useMutation({
    mutationFn: async (values: { name?: string; email?: string; phone?: string }) => {
      const res = await api.patch('/auth/profile', values);
      return res.data;
    },
    onSuccess: (data) => {
      message.success(t('profile.saved'));
      if (data && user) {
        authStore.setUser({ ...user, name: data.name || user.name, email: data.email, phone: data.phone });
      }
    },
    onError: () => message.error(t('profile.saveFailed')),
  });

  const passwordMutation = useMutation({
    mutationFn: async (values: { oldPassword: string; newPassword: string }) => {
      const res = await api.post('/auth/change-password', values);
      return res.data;
    },
    onSuccess: () => {
      message.success(t('profile.passwordChanged'));
      passwordForm.resetFields();
    },
    onError: () => message.error(t('profile.passwordChangeFailed')),
  });

  if (!user) return null;

  return (
    <PageContainer title={t('profile.title')}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <ProCard bordered title={t('profile.basicInfo')} className="apple-soft-card">
          <Form
            form={profileForm}
            layout="vertical"
            initialValues={{ name: user.name, email: user.email || '', phone: user.phone || '' }}
            onFinish={(values) => profileMutation.mutate(values)}
          >
            <Form.Item label={t('common.account')}>
              <Input value={user.account} disabled />
            </Form.Item>
            <Form.Item name="name" label={t('profile.name')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label={t('profile.email')}>
              <Input type="email" placeholder="user@example.com" />
            </Form.Item>
            <Form.Item name="phone" label={t('profile.phone')}>
              <Input placeholder="13800138000" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={profileMutation.isPending}>
              {t('profile.save')}
            </Button>
          </Form>
        </ProCard>

        <ProCard bordered title={t('profile.changePassword')} className="apple-soft-card">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={(values) => passwordMutation.mutate(values)}
          >
            <Form.Item
              name="oldPassword"
              label={t('profile.currentPassword')}
              rules={[{ required: true }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label={t('profile.newPassword')}
              rules={[
                { required: true },
                { min: 8, message: t('profile.passwordMinLength') },
                { pattern: /(?=.*[a-zA-Z])(?=.*\d)/, message: t('profile.passwordFormat') },
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label={t('profile.confirmPassword')}
              dependencies={['newPassword']}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                    return Promise.reject(new Error(t('profile.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordMutation.isPending}>
              {t('profile.changePasswordBtn')}
            </Button>
          </Form>
        </ProCard>
      </Space>
    </PageContainer>
  );
};
