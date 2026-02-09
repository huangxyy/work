import type { ProColumns } from '@ant-design/pro-components';
import { ModalForm, PageContainer, ProCard, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchClassStudents,
  fetchClasses,
  fetchHomeworksByClass,
  importClassStudents,
} from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';
import { useMessage } from '../../hooks/useMessage';

type StudentRow = {
  id: string;
  account: string;
  name: string;
};

type HomeworkRow = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
};

export const TeacherClassDetailPage = () => {
  const message = useMessage();
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    staleTime: 10 * 60 * 1000,
  });

  const classItem = useMemo(
    () => (classesQuery.data || []).find((klass) => klass.id === id),
    [classesQuery.data, id],
  );

  const studentsQuery = useQuery({
    queryKey: ['class-students', id],
    queryFn: () => fetchClassStudents(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const homeworksQuery = useQuery({
    queryKey: ['homeworks', id],
    queryFn: () => fetchHomeworksByClass(id || ''),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const importMutation = useMutation({
    mutationFn: ({ classId, text }: { classId: string; text: string }) =>
      importClassStudents(classId, { text }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['class-students', id] });

      const { created, existing, failed, enrolled } = data;
      let messageText = `${t('teacher.classDetail.importSuccess')}: ${enrolled}`;

      if (created.length > 0) {
        messageText += `\n${t('teacher.classDetail.importCreated')}: ${created.length}`;
      }
      if (existing.length > 0) {
        messageText += `\n${t('teacher.classDetail.importExisting')}: ${existing.length}`;
      }
      if (failed.length > 0) {
        messageText += `\n${t('teacher.classDetail.importFailed')}: ${failed.length}`;
        const failedDetails = failed
          .slice(0, 3)
          .map((item) => `${item.name || item.account}: ${item.error}`)
          .join('\n');
        if (failedDetails) {
          messageText += `\n${t('teacher.classDetail.importFailedDetails')}\n${failedDetails}`;
        }
      }

      if (failed.length === 0) {
        message.success(messageText);
      } else {
        message.warning(messageText);
      }
    },
    onError: (error: unknown) => {
      const apiMessage = isAxiosError(error)
        ? (error.response?.data as { message?: string | string[] } | undefined)?.message
        : undefined;
      const detail = Array.isArray(apiMessage) ? apiMessage.join('; ') : apiMessage;
      message.error(detail || t('teacher.classDetail.importFailed'));
    },
  });

  const handleDownloadStudentReport = (studentId: string) => {
    window.open(`/teacher/reports/student/${studentId}?export=1`, '_blank');
  };

  const studentColumns: ProColumns<StudentRow>[] = [
    {
      title: t('teacher.classDetail.studentName'),
      dataIndex: 'name',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('common.account'),
      dataIndex: 'account',
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, item) => [
        <Button key="pdf" onClick={() => handleDownloadStudentReport(item.id)}>
          {t('teacher.classDetail.downloadReport')}
        </Button>,
      ],
    },
  ];

  const homeworkColumns: ProColumns<HomeworkRow>[] = [
    {
      title: t('common.homework'),
      dataIndex: 'title',
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('common.due'),
      dataIndex: 'dueAt',
      renderText: (value) => (value ? formatDate(value) : t('status.noDue')),
      width: 220,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, item) => [
        <Button
          key="detail"
          onClick={() => navigate(`/teacher/homeworks/${item.id}`, { state: { homework: item, classId: id } })}
        >
          {t('common.view')}
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title={t('teacher.classDetail.title')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.classes'), path: '/teacher/classes' },
          { title: classItem?.name || t('common.detail') },
        ],
      }}
    >
      {classesQuery.isError ? (
        <Alert
          type="error"
          message={t('teacher.classDetail.loadError')}
          description={
            classesQuery.error instanceof Error
              ? classesQuery.error.message
              : t('common.tryAgain')
          }
          action={
            <Button size="small" onClick={() => classesQuery.refetch()}>
              {t('common.retry')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {classesQuery.isLoading && !classesQuery.data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !classItem ? (
        <SoftEmpty description={t('teacher.classDetail.notFound')}>
          <Button type="primary" onClick={() => navigate('/teacher/classes')}>
            {t('common.backToClasses')}
          </Button>
        </SoftEmpty>
      ) : (
        <Tabs
          items={[
            {
              key: 'overview',
              label: t('common.overview'),
              children: (
                <ProCard bordered>
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Descriptions column={1} bordered>
                      <Descriptions.Item label={t('teacher.classDetail.className')}>
                        {classItem.name}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('teacher.classDetail.grade')}>
                        {classItem.grade ? <Tag>{classItem.grade}</Tag> : t('teacher.classDetail.unassigned')}
                      </Descriptions.Item>
                    </Descriptions>
                    <ProCard gutter={16} wrap>
                      <ProCard bordered colSpan={{ xs: 24, md: 12 }}>
                        <Typography.Text type="secondary">{t('nav.students')}</Typography.Text>
                        <Typography.Title level={3} style={{ margin: '8px 0 0' }}>
                          {studentsQuery.data?.length ?? 0}
                        </Typography.Title>
                      </ProCard>
                      <ProCard bordered colSpan={{ xs: 24, md: 12 }}>
                        <Typography.Text type="secondary">{t('nav.homeworks')}</Typography.Text>
                        <Typography.Title level={3} style={{ margin: '8px 0 0' }}>
                          {homeworksQuery.data?.length ?? 0}
                        </Typography.Title>
                      </ProCard>
                    </ProCard>
                  </Space>
                </ProCard>
              ),
            },
            {
              key: 'students',
              label: t('nav.students'),
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {studentsQuery.isError ? (
                    <Alert
                      type="error"
                      message={t('teacher.classDetail.loadStudentsError')}
                      description={
                        studentsQuery.error instanceof Error
                          ? studentsQuery.error.message
                          : t('common.tryAgain')
                      }
                      action={
                        <Button size="small" onClick={() => studentsQuery.refetch()}>
                          {t('common.retry')}
                        </Button>
                      }
                    />
                  ) : null}
                  <ProCard bordered>
                    <ProTable<StudentRow>
                      rowKey="id"
                      columns={studentColumns}
                      dataSource={studentsQuery.data || []}
                      loading={studentsQuery.isLoading}
                      search={false}
                      pagination={{ pageSize: 8 }}
                      options={false}
                      locale={{ emptyText: <SoftEmpty description={t('teacher.classDetail.noStudents')} /> }}
                      toolBarRender={() => [
                        <ModalForm
                          key="import"
                          title={t('teacher.classDetail.importTitle')}
                          trigger={<Button type="primary">{t('teacher.classDetail.importStudents')}</Button>}
                          onFinish={async (values) => {
                            if (!id) {
                              return false;
                            }
                            const text = String(values.text || '').trim();
                            if (!text) {
                              message.warning(t('teacher.classDetail.importEmpty'));
                              return false;
                            }
                            try {
                              await importMutation.mutateAsync({ classId: id, text });
                              return true;
                            } catch {
                              return false;
                            }
                          }}
                          modalProps={{ destroyOnClose: true }}
                        >
                          <ProFormTextArea
                            name="text"
                            label={t('teacher.classDetail.importLabel')}
                            placeholder={t('teacher.classDetail.importPlaceholder')}
                            fieldProps={{ rows: 6 }}
                            rules={[{ required: true, message: t('teacher.classDetail.importRequired') }]}
                          />
                          <Typography.Text type="secondary">
                            {t('teacher.classDetail.importHint')}
                          </Typography.Text>
                        </ModalForm>,
                      ]}
                    />
                  </ProCard>
                </Space>
              ),
            },
            {
              key: 'homeworks',
              label: t('nav.homeworks'),
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {homeworksQuery.isError ? (
                    <Alert
                      type="error"
                      message={t('teacher.classDetail.loadHomeworksError')}
                      description={
                        homeworksQuery.error instanceof Error
                          ? homeworksQuery.error.message
                          : t('common.tryAgain')
                      }
                      action={
                        <Button size="small" onClick={() => homeworksQuery.refetch()}>
                          {t('common.retry')}
                        </Button>
                      }
                    />
                  ) : null}
                  <ProCard bordered>
                    <ProTable<HomeworkRow>
                      rowKey="id"
                      columns={homeworkColumns}
                      dataSource={homeworksQuery.data || []}
                      loading={homeworksQuery.isLoading}
                      search={false}
                      pagination={{ pageSize: 6 }}
                      options={false}
                      locale={{ emptyText: <SoftEmpty description={t('teacher.classDetail.noHomeworks')} /> }}
                    />
                  </ProCard>
                </Space>
              ),
            },
          ]}
        />
      )}
    </PageContainer>
  );
};
