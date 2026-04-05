import { PageContainer, ProCard, ModalForm, ProFormText, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { Alert, Button, List, Popconfirm, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAnnouncement, deleteAnnouncement, fetchAnnouncements } from '../../api/announcements';
import { fetchClasses } from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';
import { formatDate } from '../../utils/dateFormat';
import { useMemo } from 'react';

export const TeacherAnnouncementsPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses, staleTime: 5 * 60_000 });
  const announcementsQuery = useQuery({ queryKey: ['teacher-announcements'], queryFn: () => fetchAnnouncements(), staleTime: 60_000 });

  const classOptions = useMemo(() => (classesQuery.data || []).map(c => ({ label: c.name, value: c.id })), [classesQuery.data]);

  const createMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => { message.success(t('announcements.created')); queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] }); },
    onError: () => message.error(t('announcements.createFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => { message.success(t('announcements.deleted')); queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] }); },
  });

  return (
    <PageContainer title={t('announcements.title')}>
      {announcementsQuery.isError ? (
        <Alert type="error" message={t('announcements.loadError')} action={<Button size="small" onClick={() => announcementsQuery.refetch()}>{t('common.retry')}</Button>} className="apple-inline-alert" />
      ) : null}
      <ProCard bordered loading={announcementsQuery.isLoading} className="apple-soft-card"
        extra={
          <ModalForm
            title={t('announcements.create')}
            trigger={<Button type="primary">{t('announcements.create')}</Button>}
            onFinish={async (values) => { await createMutation.mutateAsync(values as { classId?: string; title: string; content: string; pinned?: boolean }); return true; }}
            modalProps={{ destroyOnHidden: true }}
          >
            <ProFormSelect name="classId" label={t('announcements.class')} options={classOptions} placeholder={t('announcements.allClasses')} />
            <ProFormText name="title" label={t('common.title')} rules={[{ required: true }]} />
            <ProFormTextArea name="content" label={t('announcements.content')} rules={[{ required: true }]} fieldProps={{ rows: 4 }} />
          </ModalForm>
        }
      >
        {announcementsQuery.data?.length ? (
          <List
            dataSource={announcementsQuery.data}
            renderItem={(item) => (
              <List.Item actions={[
                <Popconfirm key="del" title={t('common.confirmDelete')} onConfirm={() => deleteMutation.mutate(item.id)}>
                  <Button danger size="small">{t('common.delete')}</Button>
                </Popconfirm>,
              ]}>
                <List.Item.Meta
                  title={<Space><Typography.Text strong>{item.title}</Typography.Text>{item.pinned ? <Tag color="red" className="apple-tag-pill">{t('announcements.pinned')}</Tag> : null}{item.class ? <Tag className="apple-tag-pill">{item.class.name}</Tag> : null}</Space>}
                  description={<Space direction="vertical" size={4}><Typography.Paragraph style={{ margin: 0 }}>{item.content}</Typography.Paragraph><Typography.Text type="secondary">{formatDate(item.createdAt)}</Typography.Text></Space>}
                />
              </List.Item>
            )}
          />
        ) : (
          <SoftEmpty description={t('announcements.empty')} />
        )}
      </ProCard>
    </PageContainer>
  );
};
