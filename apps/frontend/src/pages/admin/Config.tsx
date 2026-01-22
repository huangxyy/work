import { Card, Form, InputNumber, Switch } from 'antd';

export const AdminConfigPage = () => {
  return (
    <Card title="Admin Config">
      <Form layout="vertical" initialValues={{ enableBudgetLimit: true, budgetLimit: 100 }}>
        <Form.Item label="Enable Budget Limit" name="enableBudgetLimit" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="Daily Budget Limit" name="budgetLimit">
          <InputNumber min={0} addonAfter="USD" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Card>
  );
};