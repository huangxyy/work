import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchAnnouncements } from '../../api/announcements';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';

export const StudentAnnouncementsPage = () => {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-announcements'],
    queryFn: () => fetchAnnouncements(),
    staleTime: 60_000,
  });

  return (
    <PageContainer title={t('announcements.title')}>
      {isError ? (
        <Alert type="error" message={t('announcements.loadError')} action={<Button size="small" onClick={() => refetch()}>{t('common.retry')}</Button>} className="apple-inline-alert" />
      ) : null}
      <ProCard bordered loading={isLoading} className="apple-soft-card">
        {data?.length ? (
          <List
            dataSource={data}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong>{item.title}</Typography.Text>
                      {item.pinned ? <Tag color="red" className="apple-tag-pill">{t('announcements.pinned')}</Tag> : null}
                      {item.class ? <Tag className="apple-tag-pill">{item.class.name}</Tag> : <Tag color="blue" className="apple-tag-pill">{t('announcements.system')}</Tag>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.content}</Typography.Paragraph>
                      <Typography.Text type="secondary">{item.author.name} · {formatDate(item.createdAt)}</Typography.Text>
                    </Space>
                  }
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
