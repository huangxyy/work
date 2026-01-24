import type { ProColumns } from '@ant-design/pro-components';
import { ModalForm, PageContainer, ProCard, ProFormText, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Empty, Skeleton, Space, Tag, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createClass, fetchClasses } from '../../api';

type ClassItem = {
  id: string;
  name: string;
  grade?: string | null;
};

export const TeacherClassesPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const createMutation = useMutation({
    mutationFn: createClass,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      message.success('Class created');
    },
    onError: () => message.error('Failed to create class'),
  });

  const columns: ProColumns<ClassItem>[] = [
    {
      title: 'Class',
      dataIndex: 'name',
      width: '50%',
    },
    {
      title: 'Grade',
      dataIndex: 'grade',
      render: (_, item) => (item.grade ? <Tag>{item.grade}</Tag> : <Tag>Unassigned</Tag>),
    },
    {
      title: 'Action',
      valueType: 'option',
      render: (_, item) => [
        <Button key="detail" onClick={() => navigate(`/teacher/classes/${item.id}`)}>
          View
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title="Classes"
      breadcrumb={{
        items: [
          { title: 'Teacher', path: '/teacher/dashboard' },
          { title: 'Classes' },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message="Failed to load classes"
          description={error instanceof Error ? error.message : 'Please try again.'}
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {isLoading && !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <ProCard bordered>
          <ProTable<ClassItem>
            rowKey="id"
            columns={columns}
            dataSource={data || []}
            loading={isLoading}
            search={false}
            pagination={false}
            options={false}
            locale={{ emptyText: <Empty description="No classes yet" /> }}
            toolBarRender={() => [
              <Space key="toolbar">
                <ModalForm
                  title="Create Class"
                  trigger={<Button type="primary">Create Class</Button>}
                  onFinish={async (values) => {
                    await createMutation.mutateAsync(values as { name: string; grade?: string });
                    return true;
                  }}
                  modalProps={{ destroyOnClose: true }}
                  submitter={{
                    submitButtonProps: { loading: createMutation.isPending },
                  }}
                >
                  <ProFormText
                    name="name"
                    label="Class Name"
                    placeholder="Class 1A"
                    rules={[{ required: true, message: 'Please input class name' }]}
                  />
                  <ProFormText name="grade" label="Grade" placeholder="Grade 7" />
                </ModalForm>
              </Space>,
            ]}
          />
        </ProCard>
      )}
    </PageContainer>
  );
};
