import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { account: string; password: string }) => {
    setLoading(true);
    // TODO: integrate real login API
    await new Promise((resolve) => setTimeout(resolve, 500));
    setLoading(false);
    // navigation will be added once auth is wired
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