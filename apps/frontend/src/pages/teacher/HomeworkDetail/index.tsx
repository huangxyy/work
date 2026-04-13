import { PageContainer } from '@ant-design/pro-components';
import { Button, Tabs } from 'antd';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { SoftEmpty } from '../../../components/SoftEmpty';
import { useI18n } from '../../../i18n';
import { OverviewTab } from './OverviewTab';
import { SubmissionsTab } from './SubmissionsTab';
import { BatchUploadTab } from './BatchUploadTab';
import type { HomeworkItem } from './types';

export const TeacherHomeworkDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const state = location.state as { homework?: HomeworkItem; classId?: string | null } | undefined;
  const homework = state?.homework;
  const classId = state?.classId || '';
  const homeworkId = id || '';

  return (
    <PageContainer
      title={t('teacher.homeworkDetail.title')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.homeworks'), path: '/teacher/homeworks' },
          { title: homework?.title || t('common.detail') },
        ],
      }}
    >
      {!homework ? (
        <SoftEmpty description={t('teacher.homeworkDetail.unavailable')}>
          <Button type="primary" onClick={() => navigate('/teacher/homeworks')}>
            {t('common.backToHomeworks')}
          </Button>
        </SoftEmpty>
      ) : (
        <Tabs
          items={[
            {
              key: 'overview',
              label: t('common.overview'),
              children: <OverviewTab homeworkId={homeworkId} homework={homework} classId={classId} />,
            },
            {
              key: 'submissions',
              label: t('nav.submissions'),
              children: <SubmissionsTab homeworkId={homeworkId} />,
            },
            {
              key: 'batch',
              label: t('teacher.batchUpload.title'),
              children: <BatchUploadTab homeworkId={homeworkId} classId={classId} />,
            },
          ]}
        />
      )}
    </PageContainer>
  );
};
