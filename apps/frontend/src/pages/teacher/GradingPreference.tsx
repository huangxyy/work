import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Radio, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { fetchTeacherGradingPreference, updateTeacherGradingPreference } from '../../api';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

type GradingMode = 'cheap' | 'quality';

export const TeacherGradingPreferencePage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<GradingMode>('cheap');

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-grading-preference'],
    queryFn: fetchTeacherGradingPreference,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.mode) {
      setMode(data.mode);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: { mode: GradingMode }) => updateTeacherGradingPreference(payload),
    onSuccess: async () => {
      message.success(t('teacher.settings.preferenceSaved'));
      await queryClient.invalidateQueries({ queryKey: ['teacher-grading-preference'] });
    },
    onError: () => {
      message.error(t('common.saveFailed'));
    },
  });

  const handleSave = () => {
    mutation.mutate({ mode });
  };

  return (
    <PageContainer
      title={t('teacher.settings.gradingTitle')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.settings') },
          { title: t('nav.grading') },
        ],
      }}
    >
      <ProCard bordered loading={isLoading} className="apple-soft-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message={t('teacher.settings.preferenceInfoTitle')}
            description={t('teacher.settings.preferenceInfoDesc')}
          />
          
          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 16 }}>
              {t('teacher.settings.selectMode')}
            </Typography.Text>
            
            <Radio.Group
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio.Button
                  value="cheap"
                  style={{
                    width: '100%',
                    height: 'auto',
                    padding: '16px 24px',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <Typography.Text strong>
                      {t('teacher.settings.modeFast')}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      {t('teacher.settings.modeFastDesc')}
                    </Typography.Text>
                  </div>
                </Radio.Button>
                
                <Radio.Button
                  value="quality"
                  style={{
                    width: '100%',
                    height: 'auto',
                    padding: '16px 24px',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <Typography.Text strong>
                      {t('teacher.settings.modeQuality')}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      {t('teacher.settings.modeQualityDesc')}
                    </Typography.Text>
                  </div>
                </Radio.Button>
              </Space>
            </Radio.Group>
          </div>

          <Button
            type="primary"
            size="large"
            loading={mutation.isPending}
            onClick={handleSave}
          >
            {t('common.save')}
          </Button>
        </Space>
      </ProCard>
    </PageContainer>
  );
};
