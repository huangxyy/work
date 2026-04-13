import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Segmented, Space, Spin, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentHomeworks } from '../../api';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';
import { SoftEmpty } from '../../components/SoftEmpty';

const { Text } = Typography;

type FilterType = 'all' | 'ongoing' | 'late' | 'expired';

const getStatus = (dueAt?: string | null, allowLateSubmission?: boolean, t?: (key: string) => string): { key: FilterType; label: string; color: string } => {
  const tr = t || ((k: string) => k);
  if (!dueAt) {
    return { key: 'ongoing', label: tr('student.homeworks.statusOngoing'), color: 'blue' };
  }
  const dueDate = new Date(dueAt);
  const now = Date.now();
  if (dueDate.getTime() < now) {
    if (allowLateSubmission) {
      return { key: 'late', label: tr('student.homeworks.statusLate'), color: 'orange' };
    }
    return { key: 'expired', label: tr('student.homeworks.statusExpired'), color: 'red' };
  }
  return { key: 'ongoing', label: tr('student.homeworks.statusOngoing'), color: 'blue' };
};

export const StudentHomeworksPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterType>('all');

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('student.homeworks.greetingMorning');
    if (hour < 18) return t('student.homeworks.greetingAfternoon');
    return t('student.homeworks.greetingEvening');
  }, [t]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
    staleTime: 2 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    const list = data || [];
    return list.filter((item) => {
      const status = getStatus(item.dueAt, item.allowLateSubmission, t);
      if (filter === 'all') return true;
      return status.key === filter;
    });
  }, [data, filter, t]);

  const pendingCount = useMemo(() => {
    if (!data) return 0;
    return data.filter(item => {
      const status = getStatus(item.dueAt, item.allowLateSubmission, t);
      return status.key === 'ongoing' || status.key === 'late';
    }).length;
  }, [data, t]);

  const handleSubmit = useCallback((id: string) => navigate(`/student/submit/${id}`), [navigate]);

  const filterOptions = useMemo(() => [
    { label: t('student.homeworks.filterAll'), value: 'all' as FilterType },
    { label: t('student.homeworks.filterOngoing'), value: 'ongoing' as FilterType },
    { label: t('student.homeworks.filterLate'), value: 'late' as FilterType },
    { label: t('student.homeworks.filterExpired'), value: 'expired' as FilterType },
  ], [t]);

  return (
    <PageContainer
      title={t('nav.homeworks')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/dashboard' },
          { title: t('nav.homeworks') },
        ],
      }}
    >
      {/* Error State */}
      {isError ? (
        <Alert
          type="error"
          message={t('common.loadError')}
          description={error instanceof Error ? error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : null}

      {/* Welcome Hero */}
      <div style={{ marginBottom: '16px' }}>
        <Typography.Title level={3} style={{ marginBottom: '8px' }}>
          {getGreeting()}
        </Typography.Title>
        <Text type="secondary">{t('student.homeworks.pendingPrefix')}{pendingCount}{t('student.homeworks.pendingSuffix')}</Text>
      </div>

      {/* Filter Chips */}
      <div style={{ marginBottom: '16px' }}>
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as FilterType)}
          options={filterOptions}
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : null}

      {/* Empty State */}
      {!isLoading && filteredData.length === 0 ? (
        <ProCard bordered className="apple-soft-card">
          <SoftEmpty description={t('student.homeworks.empty')}>
            <Typography.Paragraph type="secondary" style={{ marginTop: '8px', marginBottom: 0 }}>
              {t('student.homeworks.emptyHint')}
            </Typography.Paragraph>
          </SoftEmpty>
        </ProCard>
      ) : null}

      {/* Homework List */}
      {!isLoading && filteredData.length > 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {filteredData.map((item) => {
            const status = getStatus(item.dueAt, item.allowLateSubmission, t);
            const isUrgent = status.key === 'ongoing' && item.dueAt &&
              new Date(item.dueAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

            return (
              <ProCard
                key={item.id}
                bordered
                className="apple-soft-card"
                bodyStyle={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Text strong style={{ fontSize: '16px' }}>
                      {item.title}
                    </Text>
                    <Tag color={status.color} className="apple-tag-pill">{status.label}</Tag>
                    {isUrgent && (
                      <Tag color="red" className="apple-tag-pill">{t('student.homeworks.urgent')}</Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    {item.dueAt ? `${t('student.homeworks.deadline')}${formatDate(item.dueAt)}` : t('student.homeworks.flexibleDeadline')} · {item.class.name}
                  </Text>
                </div>
                {status.key !== 'expired' && (
                  <Button
                    type="primary"
                    onClick={() => handleSubmit(item.id)}
                    style={{ borderRadius: '8px' }}
                  >
                    {t('student.homeworks.submitBtn')}
                  </Button>
                )}
              </ProCard>
            );
          })}
        </Space>
      )}
    </PageContainer>
  );
};
