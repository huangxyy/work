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
import { Alert, Button, Modal, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createHomework,
  deleteHomework,
  fetchClasses,
  fetchHomeworkDeletePreview,
  fetchHomeworksSummaryByClass,
} from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
  allowLateSubmission?: boolean;
  totalStudents: number;
  submittedStudents: number;
  pendingStudents: number;
  submissionsTotal: number;
  queuedCount: number;
  processingCount: number;
  doneCount: number;
  failedCount: number;
};

type ClassOption = {
  label: string;
  value: string;
};

export const TeacherHomeworksPage = () => {
  const message = useMessage();
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [deletingHomeworkId, setDeletingHomeworkId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useI18n();

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
    queryKey: ['homeworks-summary', selectedClassId],
    queryFn: () => fetchHomeworksSummaryByClass(selectedClassId || ''),
    enabled: !!selectedClassId,
  });

  const createMutation = useMutation({
    mutationFn: createHomework,
    onSuccess: async () => {
      if (selectedClassId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks-summary', selectedClassId] });
        await queryClient.invalidateQueries({ queryKey: ['homeworks', selectedClassId] });
      }
      message.success(t('teacher.homeworks.created'));
    },
    onError: () => message.error(t('teacher.homeworks.createFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (homeworkId: string) => {
      setDeletingHomeworkId(homeworkId);
      return deleteHomework(homeworkId);
    },
    onSuccess: async () => {
      if (selectedClassId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks-summary', selectedClassId] });
      }
      message.success(t('teacher.homeworks.deleted'));
    },
    onError: () => message.error(t('teacher.homeworks.deleteFailed')),
    onSettled: () => setDeletingHomeworkId(null),
  });

  const handleDeleteHomework = async (homeworkId: string) => {
    try {
      const preview = await fetchHomeworkDeletePreview(homeworkId);
      Modal.confirm({
        title: t('teacher.homeworkDetail.deleteConfirmTitle'),
        content: (
          <Space direction="vertical" size={0}>
            <Typography.Text>{t('teacher.homeworkDetail.deleteConfirmDesc')}</Typography.Text>
            <Typography.Text type="secondary">
              {`${t('teacher.homeworkDetail.deleteWillRemove')} ${preview.submissionCount} ${t('teacher.homeworkDetail.deleteSubmissionsUnit')}，${preview.imageCount} ${t('teacher.homeworkDetail.deleteImagesUnit')}`}
            </Typography.Text>
          </Space>
        ),
        okText: t('teacher.homeworkDetail.deleteHomework'),
        okType: 'danger',
        cancelText: t('common.close'),
        onOk: async () => {
          await deleteMutation.mutateAsync(homeworkId);
        },
      });
    } catch {
      message.error(t('teacher.homeworkDetail.deletePreviewFailed'));
    }
  };

  const columns: ProColumns<HomeworkItem>[] = [
    {
      title: t('common.title'),
      dataIndex: 'title',
    },
    {
      title: t('common.description'),
      dataIndex: 'desc',
      renderText: (value) => value || '--',
    },
    {
      title: t('common.due'),
      dataIndex: 'dueAt',
      renderText: (value) => (value ? new Date(value).toLocaleString() : t('status.noDue')),
    },
    {
      title: t('teacher.homeworkDetail.lateSubmission'),
      dataIndex: 'allowLateSubmission',
      render: (_, item) => (
        <Tag color={item.allowLateSubmission ? 'success' : 'default'}>
          {item.allowLateSubmission
            ? t('teacher.homeworkDetail.lateSubmissionEnabled')
            : t('teacher.homeworkDetail.lateSubmissionDisabled')}
        </Tag>
      ),
      width: 150,
    },
    {
      title: t('teacher.homeworks.submissionRate'),
      dataIndex: 'submittedStudents',
      render: (_, item) => {
        const total = item.totalStudents;
        const submitted = item.submittedStudents;
        const pending = item.pendingStudents;
        if (!total) {
          return '--';
        }
        return (
          <Space size={6} wrap>
            <Typography.Text strong>{`${submitted}/${total}`}</Typography.Text>
            <Tag color={pending > 0 ? 'warning' : 'success'}>
              {`${t('teacher.homeworks.pendingLabel')} ${pending}`}
            </Tag>
          </Space>
        );
      },
      width: 200,
    },
    {
      title: t('teacher.homeworks.submissionStatus'),
      dataIndex: 'doneCount',
      render: (_, item) => {
        const tags = [
          { label: t('status.done'), count: item.doneCount, color: 'success' },
          { label: t('status.processing'), count: item.processingCount, color: 'processing' },
          { label: t('status.queued'), count: item.queuedCount, color: 'default' },
          { label: t('status.failed'), count: item.failedCount, color: 'error' },
        ].filter((entry) => entry.count > 0);
        if (!tags.length) {
          return '--';
        }
        return (
          <Space size={[4, 4]} wrap>
            {tags.map((entry) => (
              <Tag key={entry.label} color={entry.color}>{`${entry.label} ${entry.count}`}</Tag>
            ))}
          </Space>
        );
      },
      width: 260,
    },
    {
      title: t('common.action'),
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
          {t('common.view')}
        </Button>,
        <Button
          key="delete"
          danger
          loading={deleteMutation.isPending && deletingHomeworkId === item.id}
          onClick={() => handleDeleteHomework(item.id)}
        >
          {t('teacher.homeworkDetail.deleteHomework')}
        </Button>,
      ],
    },
  ];

  const noClasses = !classesQuery.isLoading && (classesQuery.data || []).length === 0;

  return (
    <PageContainer
      title={t('nav.homeworks')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.homeworks') },
        ],
      }}
    >
      {classesQuery.isError ? (
        <Alert
          type="error"
          message={t('teacher.homeworks.loadClassesError')}
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
      {homeworksQuery.isError ? (
        <Alert
          type="error"
          message={t('teacher.homeworks.loadHomeworksError')}
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
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {classesQuery.isLoading && !classesQuery.data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : noClasses ? (
        <SoftEmpty description={t('teacher.homeworks.noClasses')}>
          <Button type="primary" onClick={() => navigate('/teacher/classes')}>
            {t('teacher.homeworks.createClass')}
          </Button>
        </SoftEmpty>
      ) : (
        <ProCard bordered>
          <Space style={{ marginBottom: 16 }} wrap>
            <Select
              style={{ minWidth: 220 }}
              placeholder={t('teacher.homeworks.selectClass')}
              options={classOptions}
              loading={classesQuery.isLoading}
              value={selectedClassId || undefined}
              onChange={(value) => setSelectedClassId(value)}
            />
              <ModalForm
                title={t('teacher.homeworks.createHomework')}
                trigger={<Button type="primary">{t('teacher.homeworks.createHomework')}</Button>}
                onFinish={async (values) => {
                  if (!selectedClassId) {
                    message.warning(t('teacher.homeworks.selectClassFirst'));
                    return false;
                  }
                  const dueAtValue = values.dueAt as { toISOString?: () => string } | string | undefined;
                  const dueAt = typeof dueAtValue === 'string'
                    ? dueAtValue
                    : dueAtValue?.toISOString?.();
                  await createMutation.mutateAsync({
                    classId: selectedClassId,
                    title: values.title as string,
                    desc: values.desc as string | undefined,
                    dueAt,
                  });
                  return true;
                }}
                dateFormatter={false}
                modalProps={{ destroyOnClose: true }}
                submitter={{ submitButtonProps: { loading: createMutation.isPending } }}
              >
              <ProFormText
                name="title"
                label={t('teacher.homeworks.homeworkTitle')}
                placeholder={t('teacher.homeworks.homeworkTitlePlaceholder')}
                rules={[{ required: true, message: t('teacher.homeworks.homeworkTitleRequired') }]}
              />
              <ProFormTextArea
                name="desc"
                label={t('common.description')}
                fieldProps={{ rows: 3 }}
                placeholder={t('teacher.homeworks.descriptionPlaceholder')}
              />
              <ProFormDateTimePicker name="dueAt" label={t('common.dueAt')} />
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
              locale={{ emptyText: <SoftEmpty description={t('teacher.homeworks.empty')} /> }}
            />
          )}
        </ProCard>
      )}
    </PageContainer>
  );
};
