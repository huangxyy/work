import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStore, login } from '../api';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { account: string; password: string }) => {
    setLoading(true);
    try {
      const result = await login(values.account, values.password);
      authStore.setToken(result.token);
      authStore.setUser(result.user);
      message.success('Login successful');

      if (result.user.role === 'TEACHER') {
        navigate('/teacher/classes');
      } else if (result.user.role === 'ADMIN') {
        navigate('/admin/config');
      } else {
        navigate('/student/homeworks');
      }
    } catch (error) {
      message.error('Login failed. Check your account or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: 360, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>
          Login
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="account"
            label="Account"
            rules={[{ required: true, message: 'Please input account' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="student01" autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please input password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="????????"
              autoComplete="current-password"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
};
