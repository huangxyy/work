import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  message,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  downloadTeacherStudentReportPdf,
  fetchClassStudents,
  fetchClasses,
  fetchHomeworksByClass,
} from '../../api';
import { useI18n } from '../../i18n';

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
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const classItem = useMemo(
    () => (classesQuery.data || []).find((klass) => klass.id === id),
    [classesQuery.data, id],
  );

  const studentsQuery = useQuery({
    queryKey: ['class-students', id],
    queryFn: () => fetchClassStudents(id || ''),
    enabled: !!id,
  });

  const homeworksQuery = useQuery({
    queryKey: ['homeworks', id],
    queryFn: () => fetchHomeworksByClass(id || ''),
    enabled: !!id,
  });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadStudentReport = async (studentId: string) => {
    try {
      const blob = await downloadTeacherStudentReportPdf(studentId, 7);
      downloadBlob(blob, `student-${studentId}-report.pdf`);
    } catch {
      message.error(t('teacher.classDetail.downloadFailed'));
    }
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
      renderText: (value) => (value ? new Date(value).toLocaleString() : t('status.noDue')),
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
        <Empty description={t('teacher.classDetail.notFound')}>
          <Button type="primary" onClick={() => navigate('/teacher/classes')}>
            {t('common.backToClasses')}
          </Button>
        </Empty>
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
                      locale={{ emptyText: <Empty description={t('teacher.classDetail.noStudents')} /> }}
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
                      locale={{ emptyText: <Empty description={t('teacher.classDetail.noHomeworks')} /> }}
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
