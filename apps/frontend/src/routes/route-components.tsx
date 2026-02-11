import { PageContainer } from '@ant-design/pro-components';
import { Result, Spin } from 'antd';
import { useI18n } from '../i18n';

export const PageFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
    <Spin size="large" />
  </div>
);

export const NotFoundPage = () => {
  const { t } = useI18n();

  return (
    <PageContainer title={t('errors.pageNotFoundTitle')} breadcrumb={{ items: [] }}>
      <Result status="404" title="404" subTitle={t('errors.pageNotFoundSubtitle')} />
    </PageContainer>
  );
};
