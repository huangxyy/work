import type { ProColumns } from '@ant-design/pro-components';
import { ModalForm, PageContainer, ProCard, ProFormText, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Skeleton, Space, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createClass, fetchClasses } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

type ClassItem = {
  id: string;
  name: string;
  grade?: string | null;
};

export const TeacherClassesPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useI18n();
  const message = useMessage();

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
      message.success(t('teacher.classes.created'));
    },
    onError: () => message.error(t('teacher.classes.createFailed')),
  });

  const columns: ProColumns<ClassItem>[] = [
    {
      title: t('teacher.classes.class'),
      dataIndex: 'name',
      width: '50%',
    },
    {
      title: t('teacher.classes.grade'),
      dataIndex: 'grade',
      render: (_, item) => (item.grade ? <Tag>{item.grade}</Tag> : <Tag>{t('teacher.classes.unassigned')}</Tag>),
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, item) => [
        <Button key="detail" onClick={() => navigate(`/teacher/classes/${item.id}`)}>
          {t('common.view')}
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title={t('nav.classes')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.classes') },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message={t('teacher.classes.loadError')}
          description={error instanceof Error ? error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('common.retry')}
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
            locale={{ emptyText: <SoftEmpty description={t('teacher.classes.empty')} /> }}
            toolBarRender={() => [
              <Space key="toolbar">
                <ModalForm
                  title={t('teacher.classes.create')}
                  trigger={<Button type="primary">{t('teacher.classes.create')}</Button>}
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
                    label={t('teacher.classes.className')}
                    placeholder={t('teacher.classes.classNamePlaceholder')}
                    rules={[{ required: true, message: t('teacher.classes.classNameRequired') }]}
                  />
                  <ProFormText
                    name="grade"
                    label={t('teacher.classes.grade')}
                    placeholder={t('teacher.classes.gradePlaceholder')}
                  />
                </ModalForm>
              </Space>,
            ]}
          />
        </ProCard>
      )}
    </PageContainer>
  );
};
