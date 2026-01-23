import { Button, Card, DatePicker, Form, Input, List, Select, Space, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createHomework, fetchClasses, fetchHomeworksByClass } from '../../api';

export const TeacherHomeworksPage = () => {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  useEffect(() => {
    if (!selectedClassId && classes && classes.length) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const { data: homeworks, isLoading: homeworksLoading } = useQuery({
    queryKey: ['homeworks', selectedClassId],
    queryFn: () => fetchHomeworksByClass(selectedClassId || ''),
    enabled: !!selectedClassId,
  });

  const classOptions = useMemo(
    () =>
      (classes || []).map((klass) => ({
        label: klass.name,
        value: klass.id,
      })),
    [classes],
  );

  const createMutation = useMutation({
    mutationFn: createHomework,
    onSuccess: async () => {
      if (selectedClassId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks', selectedClassId] });
      }
      message.success('Homework created');
      form.resetFields(['title', 'desc', 'dueAt']);
    },
    onError: () => message.error('Failed to create homework'),
  });

  const onCreate = async (values: { title: string; desc?: string; dueAt?: Dayjs }) => {
    if (!selectedClassId) {
      message.warning('Select a class first');
      return;
    }
    await createMutation.mutateAsync({
      classId: selectedClassId,
      title: values.title,
      desc: values.desc,
      dueAt: values.dueAt ? values.dueAt.toISOString() : undefined,
    });
  };

  return (
    <Card title="Homeworks">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ minWidth: 200 }}
          placeholder="Select class"
          options={classOptions}
          loading={classesLoading}
          value={selectedClassId || undefined}
          onChange={(value) => setSelectedClassId(value)}
        />
      </Space>
      <Form form={form} layout="vertical" onFinish={onCreate}>
        <Form.Item
          name="title"
          label="Homework Title"
          rules={[{ required: true, message: 'Please input title' }]}
        >
          <Input placeholder="Essay Practice" />
        </Form.Item>
        <Form.Item name="desc" label="Description">
          <Input.TextArea rows={3} placeholder="Write a 300-word essay" />
        </Form.Item>
        <Form.Item name="dueAt" label="Due At">
          <DatePicker showTime />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
          Create Homework
        </Button>
      </Form>
      <List
        style={{ marginTop: 24 }}
        loading={homeworksLoading}
        dataSource={homeworks || []}
        locale={{ emptyText: 'No homeworks yet' }}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={item.title}
              description={
                item.dueAt
                  ? `Due: ${new Date(item.dueAt).toLocaleDateString()}`
                  : 'No due date'
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
