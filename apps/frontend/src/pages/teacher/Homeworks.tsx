import type { ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDateTimePicker,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Empty, Select, Skeleton, Space, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createHomework, fetchClasses, fetchHomeworksByClass } from '../../api';

type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
};

type ClassOption = {
  label: string;
  value: string;
};

export const TeacherHomeworksPage = () => {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const navigate = useNavigate();

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const classOptions = useMemo<ClassOption[]>(
    () =>
      (classesQuery.data || []).map((klass) => ({
        label: klass.name,
        value: klass.id,
      })),
    [classesQuery.data],
  );

  useEffect(() => {
    if (!selectedClassId && classesQuery.data && classesQuery.data.length) {
      setSelectedClassId(classesQuery.data[0].id);
    }
  }, [classesQuery.data, selectedClassId]);

  const homeworksQuery = useQuery({
    queryKey: ['homeworks', selectedClassId],
    queryFn: () => fetchHomeworksByClass(selectedClassId || ''),
    enabled: !!selectedClassId,
  });

  const createMutation = useMutation({
    mutationFn: createHomework,
    onSuccess: async () => {
      if (selectedClassId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks', selectedClassId] });
      }
      message.success('Homework created');
    },
    onError: () => message.error('Failed to create homework'),
  });

  const columns: ProColumns<HomeworkItem>[] = [
    {
      title: 'Title',
      dataIndex: 'title',
    },
    {
      title: 'Description',
      dataIndex: 'desc',
      renderText: (value) => value || '--',
    },
    {
      title: 'Due',
      dataIndex: 'dueAt',
      renderText: (value) => (value ? new Date(value).toLocaleString() : 'No due date'),
    },
    {
      title: 'Action',
      valueType: 'option',
      render: (_, item) => [
        <Button
          key="view"
          onClick={() =>
            navigate(`/teacher/homeworks/${item.id}`, {
              state: { homework: item, classId: selectedClassId },
            })
          }
        >
          View
        </Button>,
      ],
    },
  ];

  const noClasses = !classesQuery.isLoading && (classesQuery.data || []).length === 0;

  return (
    <PageContainer
      title="Homeworks"
      breadcrumb={{
        items: [
          { title: 'Teacher', path: '/teacher/dashboard' },
          { title: 'Homeworks' },
        ],
      }}
    >
      {classesQuery.isError ? (
        <Alert
          type="error"
          message="Failed to load classes"
          description={
            classesQuery.error instanceof Error
              ? classesQuery.error.message
              : 'Please try again.'
          }
          action={
            <Button size="small" onClick={() => classesQuery.refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {homeworksQuery.isError ? (
        <Alert
          type="error"
          message="Failed to load homeworks"
          description={
            homeworksQuery.error instanceof Error
              ? homeworksQuery.error.message
              : 'Please try again.'
          }
          action={
            <Button size="small" onClick={() => homeworksQuery.refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {classesQuery.isLoading && !classesQuery.data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : noClasses ? (
        <Empty description="No classes yet">
          <Button type="primary" onClick={() => navigate('/teacher/classes')}>
            Create a class
          </Button>
        </Empty>
      ) : (
        <ProCard bordered>
          <Space style={{ marginBottom: 16 }} wrap>
            <Select
              style={{ minWidth: 220 }}
              placeholder="Select class"
              options={classOptions}
              loading={classesQuery.isLoading}
              value={selectedClassId || undefined}
              onChange={(value) => setSelectedClassId(value)}
            />
            <ModalForm
              title="Create Homework"
              trigger={<Button type="primary">Create Homework</Button>}
              onFinish={async (values) => {
                if (!selectedClassId) {
                  message.warning('Select a class first');
                  return false;
                }
                const dueAtValue = values.dueAt as { toISOString?: () => string } | undefined;
                await createMutation.mutateAsync({
                  classId: selectedClassId,
                  title: values.title as string,
                  desc: values.desc as string | undefined,
                  dueAt: dueAtValue?.toISOString?.(),
                });
                return true;
              }}
              modalProps={{ destroyOnClose: true }}
              submitter={{ submitButtonProps: { loading: createMutation.isPending } }}
            >
              <ProFormText
                name="title"
                label="Homework Title"
                placeholder="Essay Practice"
                rules={[{ required: true, message: 'Please input title' }]}
              />
              <ProFormTextArea
                name="desc"
                label="Description"
                fieldProps={{ rows: 3 }}
                placeholder="Write a 300-word essay"
              />
              <ProFormDateTimePicker name="dueAt" label="Due At" />
            </ModalForm>
          </Space>
          {homeworksQuery.isLoading && !homeworksQuery.data ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            <ProTable<HomeworkItem>
              rowKey="id"
              columns={columns}
              dataSource={homeworksQuery.data || []}
              loading={homeworksQuery.isLoading}
              search={false}
              pagination={false}
              options={false}
              locale={{ emptyText: <Empty description="No homeworks yet" /> }}
            />
          )}
        </ProCard>
      )}
    </PageContainer>
  );
};
