import { Button, Card, Form, Input, List, Modal, message } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClass, fetchClasses } from '../../api';

export const TeacherClassesPage = () => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const createMutation = useMutation({
    mutationFn: createClass,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      message.success('Class created');
      setOpen(false);
      form.resetFields();
    },
    onError: () => message.error('Failed to create class'),
  });

  const onCreate = async (values: { name: string; grade?: string }) => {
    await createMutation.mutateAsync(values);
  };

  return (
    <Card
      title="Classes"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          Create Class
        </Button>
      }
    >
      <List
        loading={isLoading}
        dataSource={data || []}
        locale={{ emptyText: 'No classes yet' }}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={item.name}
              description={item.grade ? `Grade: ${item.grade}` : 'Grade: -'}
            />
          </List.Item>
        )}
      />
      <Modal
        title="Create Class"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item
            name="name"
            label="Class Name"
            rules={[{ required: true, message: 'Please input class name' }]}
          >
            <Input placeholder="Class 1A" />
          </Form.Item>
          <Form.Item name="grade" label="Grade">
            <Input placeholder="Grade 7" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
