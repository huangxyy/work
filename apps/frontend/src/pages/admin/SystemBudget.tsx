import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Descriptions, Empty, Tag, Typography } from 'antd';
import { fetchAdminConfig } from '../../api';
import { useI18n } from '../../i18n';

export const AdminSystemBudgetPage = () => {
  const { t } = useI18n();
  const { data: config } = useQuery({ queryKey: ['admin-config'], queryFn: fetchAdminConfig });
  const budget = config?.budget;
  const budgetModeLabel =
    budget?.mode === 'hard' ? t('admin.systemBudget.mode.hard') : t('admin.systemBudget.mode.soft');

  return (
    <PageContainer
      title={t('admin.systemBudget.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.system') },
          { title: t('nav.budget') },
        ],
      }}
    >
      <ProCard bordered>
        <Descriptions column={1} bordered>
          <Descriptions.Item label={t('admin.systemBudget.budgetMode')}>
            {budget?.enabled ? <Tag color="blue">{budgetModeLabel}</Tag> : <Tag>{t('common.disabled')}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.systemBudget.dailyCallLimit')}>
            <Typography.Text type="secondary">
              {budget?.enabled && budget?.dailyCallLimit ? budget.dailyCallLimit : '--'}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('admin.systemBudget.tokenLimit')}>
            <Typography.Text type="secondary">--</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>
      <ProCard bordered title={t('admin.systemBudget.usageTrends')} style={{ marginTop: 16 }}>
        {/* TODO: connect budget analytics API */}
        <Empty description={t('admin.systemBudget.empty')} />
      </ProCard>
    </PageContainer>
  );
};
