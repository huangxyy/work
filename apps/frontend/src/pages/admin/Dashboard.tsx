import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Empty, Statistic, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { fetchAdminClassSummaries, fetchAdminMetrics } from '../../api';
import { useI18n } from '../../i18n';

export const AdminDashboardPage = () => {
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: metrics } = useQuery({ queryKey: ['admin-metrics'], queryFn: fetchAdminMetrics });
  const { data: classSummaries } = useQuery({
    queryKey: ['admin-class-summaries'],
    queryFn: fetchAdminClassSummaries,
  });

  const topClasses = useMemo(() => (classSummaries || []).slice(0, 5), [classSummaries]);
  const classRows = classSummaries || [];

  return (
    <PageContainer
      title={t('admin.dashboard.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.dashboard') },
        ],
      }}
    >
      <ProCard gutter={16} wrap>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }}>
          <Statistic title={t('admin.dashboard.totalUsers')} value={metrics?.users.total ?? 0} />
          <Typography.Text type="secondary">
            {`${t('admin.dashboard.students')}: ${metrics?.users.students ?? 0} · ${t(
              'admin.dashboard.teachers',
            )}: ${metrics?.users.teachers ?? 0} · ${t('admin.dashboard.admins')}: ${
              metrics?.users.admins ?? 0
            }`}
          </Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }}>
          <Statistic title={t('admin.dashboard.totalClasses')} value={metrics?.classes.total ?? 0} />
          <Typography.Text type="secondary">{t('admin.dashboard.classHint')}</Typography.Text>
        </ProCard>
        <ProCard bordered colSpan={{ xs: 24, md: 8 }}>
          <Statistic title={t('admin.dashboard.submissionsToday')} value={metrics?.submissions.today ?? 0} />
          <Typography.Text type="secondary">{t('admin.dashboard.submissionHint')}</Typography.Text>
        </ProCard>
        <ProCard
          bordered
          colSpan={{ xs: 24, md: 24 }}
          title={t('admin.dashboard.classSizeTitle')}
          extra={
            classRows.length ? (
              <Button size="small" onClick={() => setDrawerOpen(true)}>
                {t('admin.dashboard.viewAllClasses')}
              </Button>
            ) : null
          }
        >
          {topClasses.length ? (
            <Table
              rowKey="id"
              dataSource={topClasses}
              pagination={false}
              size="small"
              columns={[
                {
                  title: t('common.class'),
                  dataIndex: 'name',
                  render: (value: string, row) => (
                    <div>
                      <Typography.Text strong>{value}</Typography.Text>
                      {row.grade ? (
                        <Tag style={{ marginLeft: 8 }}>{row.grade}</Tag>
                      ) : null}
                    </div>
                  ),
                },
                { title: t('admin.dashboard.students'), dataIndex: 'studentCount', width: 120 },
                { title: t('admin.dashboard.teachers'), dataIndex: 'teacherCount', width: 120 },
                { title: t('admin.dashboard.homeworks'), dataIndex: 'homeworkCount', width: 140 },
              ]}
            />
          ) : (
            <Empty description={t('admin.dashboard.noClasses')} />
          )}
        </ProCard>
      </ProCard>
      <Drawer
        title={t('admin.dashboard.classSizeTitle')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
      >
        <Table
          rowKey="id"
          dataSource={classRows}
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: t('common.class'),
              dataIndex: 'name',
              render: (value: string, row) => (
                <div>
                  <Typography.Text strong>{value}</Typography.Text>
                  {row.grade ? <Tag style={{ marginLeft: 8 }}>{row.grade}</Tag> : null}
                </div>
              ),
            },
            { title: t('admin.dashboard.students'), dataIndex: 'studentCount', width: 120 },
            { title: t('admin.dashboard.teachers'), dataIndex: 'teacherCount', width: 120 },
            { title: t('admin.dashboard.homeworks'), dataIndex: 'homeworkCount', width: 140 },
          ]}
        />
      </Drawer>
    </PageContainer>
  );
};
