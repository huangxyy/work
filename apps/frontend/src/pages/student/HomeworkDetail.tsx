import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, List, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchStudentHomeworks, fetchStudentSubmissions } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

export const StudentHomeworkDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useI18n();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
  });

  const homework = useMemo(
    () => (data || []).find((item) => item.id === id),
    [data, id],
  );

  const submissionsQuery = useQuery({
    queryKey: ['student-homework-submissions', id],
    queryFn: () => fetchStudentSubmissions({ homeworkId: id || '' }),
    enabled: !!id,
  });

  const statusMeta = useMemo(
    () => ({
      QUEUED: { label: t('status.queued'), color: 'default' },
      PROCESSING: { label: t('status.processing'), color: 'processing' },
      DONE: { label: t('status.done'), color: 'success' },
      FAILED: { label: t('status.failed'), color: 'error' },
    }),
    [t],
  );

  const dueAtLabel = homework?.dueAt
    ? formatDate(homework.dueAt)
    : t('student.homeworkDetail.flexible');
  const isOverdue = Boolean(homework?.dueAt && new Date(homework.dueAt).getTime() < Date.now());
  const canSubmit = !isOverdue || Boolean(homework?.allowLateSubmission);
  const dueTag = !homework?.dueAt
    ? t('status.noDue')
    : isOverdue
      ? homework.allowLateSubmission
        ? t('status.lateOpen')
        : t('status.overdue')
      : t('status.open');

  return (
    <PageContainer
      title={t('student.homeworkDetail.title')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/dashboard' },
          { title: t('nav.homeworks'), path: '/student/homeworks' },
          { title: t('common.detail') },
        ],
      }}
    >
      {isError ? (
        <Alert
          type="error"
          message={t('student.homeworkDetail.loadError')}
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
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !homework ? (
        <SoftEmpty description={t('student.homeworkDetail.notFound')}>
          <Button type="primary" onClick={() => navigate('/student/homeworks')}>
            {t('common.backToHomeworks')}
          </Button>
        </SoftEmpty>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard
            bordered
              title={homework.title}
              extra={
              <Button
                type="primary"
                disabled={!canSubmit}
                onClick={() => navigate(`/student/submit/${homework.id}`)}
              >
                {canSubmit ? t('student.homeworkDetail.submitHomework') : t('student.homeworks.submitClosed')}
              </Button>
              }
            >
            <Descriptions column={1} bordered>
              <Descriptions.Item label={t('common.class')}>{homework.class.name}</Descriptions.Item>
              <Descriptions.Item label={t('common.dueDate')}>{dueAtLabel}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag>{dueTag}</Tag>
              </Descriptions.Item>
              {!canSubmit ? (
                <Descriptions.Item label={t('common.action')}>
                  <Typography.Text type="secondary">
                    {t('student.homeworkDetail.submitClosedHint')}
                  </Typography.Text>
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('common.description')}>
                {homework.desc ? (
                  <Typography.Paragraph style={{ margin: 0 }}>{homework.desc}</Typography.Paragraph>
                ) : (
                  <Typography.Text type="secondary">{t('common.noDescriptionProvided')}</Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </ProCard>
          <ProCard
            bordered
            title={t('student.homeworkDetail.submissionHistory')}
            extra={
              <Button onClick={() => navigate('/student/submissions')}>
                {t('common.viewAllSubmissions')}
              </Button>
            }
          >
            {submissionsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : submissionsQuery.data && submissionsQuery.data.length ? (
              <List
                dataSource={submissionsQuery.data}
                renderItem={(item) => {
                  const meta = statusMeta[item.status];
                  return (
                    <List.Item
                      actions={[
                        <Button key="view" onClick={() => navigate(`/student/submission/${item.id}`)}>
                          {t('common.view')}
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Typography.Text strong>{item.homeworkTitle}</Typography.Text>
                            <Tag color={meta.color}>{meta.label}</Tag>
                          </Space>
                        }
                        description={
                          <Typography.Text type="secondary">
                            {item.updatedAt ? formatDate(item.updatedAt) : '--'}
                          </Typography.Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <SoftEmpty description={t('student.homeworkDetail.noSubmissionHistory')} />
            )}
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
