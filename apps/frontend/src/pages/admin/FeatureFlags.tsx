import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, List, Space, Switch, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchFeatureFlags, updateFeatureFlag } from '../../api';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

const FLAG_DESCRIPTIONS: Record<string, { en: string; zh: string }> = {
  dark_mode: { en: 'Dark Mode', zh: '深色模式' },
  announcements: { en: 'Announcements System', zh: '公告系统' },
  templates: { en: 'Homework Templates', zh: '作业模板' },
  pwa: { en: 'PWA / Offline Mode', zh: 'PWA / 离线模式' },
  notifications: { en: 'Notification System', zh: '通知系统' },
  image_preview: { en: 'Image Preview', zh: '图片预览' },
  teacher_feedback: { en: 'Teacher Feedback', zh: '教师反馈' },
  global_search: { en: 'Global Search', zh: '全局搜索' },
  class_comparison: { en: 'Class Comparison Charts', zh: '班级对比图表' },
  onboarding: { en: 'New User Onboarding', zh: '新用户引导' },
};

export const AdminFeatureFlagsPage = () => {
  const { t, language } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();

  const flagsQuery = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ flag, enabled }: { flag: string; enabled: boolean }) => updateFeatureFlag(flag, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      message.success(t('admin.featureFlags.updated'));
    },
    onError: () => message.error(t('admin.featureFlags.updateFailed')),
  });

  const flags = flagsQuery.data || {};
  const allFlagKeys = Object.keys(FLAG_DESCRIPTIONS);

  return (
    <PageContainer title={t('admin.featureFlags.title')}>
      <Alert
        type="warning"
        showIcon
        message={t('admin.featureFlags.experimentalTitle')}
        description={t('admin.featureFlags.experimentalDesc')}
        style={{ marginBottom: 16 }}
      />
      {flagsQuery.isError ? (
        <Alert type="error" message={t('common.loadError')} action={<Button size="small" onClick={() => flagsQuery.refetch()}>{t('common.retry')}</Button>} className="apple-inline-alert" />
      ) : null}
      <ProCard bordered loading={flagsQuery.isLoading} className="apple-soft-card">
        <List
          dataSource={allFlagKeys}
          renderItem={(key) => {
            const desc = FLAG_DESCRIPTIONS[key];
            const enabled = flags[key] === true;
            return (
              <List.Item
                actions={[
                  <Switch
                    key="toggle"
                    checked={enabled}
                    loading={toggleMutation.isPending}
                    onChange={(checked) => toggleMutation.mutate({ flag: key, enabled: checked })}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong>{language === 'zh-CN' ? desc.zh : desc.en}</Typography.Text>
                      <Tag className="apple-tag-pill">{key}</Tag>
                    </Space>
                  }
                  description={
                    <Tag color={enabled ? 'success' : 'default'} className="apple-tag-pill">
                      {enabled ? t('common.enabled') : t('common.disabled')}
                    </Tag>
                  }
                />
              </List.Item>
            );
          }}
        />
      </ProCard>
    </PageContainer>
  );
};
