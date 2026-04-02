import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert, Button, Space, Spin, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentHomeworks } from '../../api';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';
import { SoftEmpty } from '../../components/SoftEmpty';

const { Text } = Typography;

type FilterType = 'all' | 'ongoing' | 'late' | 'expired';

const getStatus = (dueAt?: string | null, allowLateSubmission?: boolean): { key: FilterType; label: string; color: string } => {
  if (!dueAt) {
    return { key: 'ongoing', label: '进行中', color: 'blue' };
  }
  const dueDate = new Date(dueAt);
  const now = Date.now();
  if (dueDate.getTime() < now) {
    if (allowLateSubmission) {
      return { key: 'late', label: '逾期补交', color: 'orange' };
    }
    return { key: 'expired', label: '已截止', color: 'red' };
  }
  return { key: 'ongoing', label: '进行中', color: 'blue' };
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
};

export const StudentHomeworksPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterType>('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
    staleTime: 2 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    const list = data || [];
    return list.filter((item) => {
      const status = getStatus(item.dueAt, item.allowLateSubmission);
      if (filter === 'all') return true;
      return status.key === filter;
    });
  }, [data, filter]);

  const pendingCount = useMemo(() => {
    if (!data) return 0;
    return data.filter(item => {
      const status = getStatus(item.dueAt, item.allowLateSubmission);
      return status.key === 'ongoing' || status.key === 'late';
    }).length;
  }, [data]);

  const handleSubmit = useCallback((id: string) => navigate(`/student/submit/${id}`), [navigate]);

  const filters = [
    { key: 'all' as FilterType, label: '全部' },
    { key: 'ongoing' as FilterType, label: '进行中' },
    { key: 'late' as FilterType, label: '逾期' },
    { key: 'expired' as FilterType, label: '已截止' },
  ];

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
          message="加载失败"
          description={error instanceof Error ? error.message : '请重试'}
          action={
            <Button size="small" onClick={() => refetch()}>
              重试
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : null}

      {/* Welcome Hero */}
      <div style={{ marginBottom: '16px' }}>
        <Typography.Title level={3} style={{ marginBottom: '8px' }}>
          {getGreeting()}，同学
        </Typography.Title>
        <Text type="secondary">你有 {pendingCount} 个作业待提交</Text>
      </div>

      {/* Filter Chips */}
      <Space size="middle" style={{ marginBottom: '16px' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              background: filter === f.key ? '#1890ff' : '#f5f5f5',
              color: filter === f.key ? '#fff' : '#666',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (filter !== f.key) {
                e.currentTarget.style.background = '#e6e6e6';
              }
            }}
            onMouseLeave={(e) => {
              if (filter !== f.key) {
                e.currentTarget.style.background = '#f5f5f5';
              }
            }}
          >
            {f.label}
          </button>
        ))}
      </Space>

      {/* Loading State */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : null}

      {/* Empty State */}
      {!isLoading && filteredData.length === 0 ? (
        <ProCard bordered className="apple-soft-card">
          <SoftEmpty description="暂无作业">
            <Typography.Paragraph type="secondary" style={{ marginTop: '8px', marginBottom: 0 }}>
              老师发布作业后会显示在这里
            </Typography.Paragraph>
          </SoftEmpty>
        </ProCard>
      ) : null}

      {/* Homework List */}
      {!isLoading && filteredData.length > 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {filteredData.map((item) => {
            const status = getStatus(item.dueAt, item.allowLateSubmission);
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
                      <Tag color="red" className="apple-tag-pill">即将截止</Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    {item.dueAt ? `截止时间：${formatDate(item.dueAt)}` : '弹性截止'} · {item.class.name}
                  </Text>
                </div>
                {status.key !== 'expired' && (
                  <Button
                    type="primary"
                    onClick={() => handleSubmit(item.id)}
                    style={{ borderRadius: '8px' }}
                  >
                    提交作业
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
