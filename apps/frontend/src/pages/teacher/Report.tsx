import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Empty,
  InputNumber,
  List,
  Select,
  Space,
  Statistic,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchClasses, fetchTeacherClassReportOverview } from '../../api';

type ReportSummary = {
  avg: number;
  min: number;
  max: number;
  count: number;
};

type DistributionBucket = {
  bucket: string;
  count: number;
};

type TrendPoint = {
  date: string;
  avg: number;
  count: number;
};

type ErrorTypeStat = {
  type: string;
  count: number;
  ratio: number;
};

type TopRankItem = {
  studentId: string;
  name: string;
  avgScore: number;
  count: number;
};

type ClassReport = {
  classId: string;
  className: string;
  rangeDays: number;
  summary: ReportSummary;
  distribution: DistributionBucket[];
  topRank: TopRankItem[];
  trend: TrendPoint[];
  errorTypes: ErrorTypeStat[];
};

export const TeacherReportPage = () => {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [rangeDays, setRangeDays] = useState<number>(7);

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  useEffect(() => {
    if (!selectedClassId && classesQuery.data && classesQuery.data.length) {
      setSelectedClassId(classesQuery.data[0].id);
    }
  }, [classesQuery.data, selectedClassId]);

  const reportQuery = useQuery({
    queryKey: ['teacher-report', selectedClassId, rangeDays],
    queryFn: () => fetchTeacherClassReportOverview(selectedClassId, rangeDays),
    enabled: !!selectedClassId,
  });

  const classOptions = useMemo(
    () =>
      (classesQuery.data || []).map((klass) => ({
        label: klass.name,
        value: klass.id,
      })),
    [classesQuery.data],
  );

  const report = reportQuery.data as ClassReport | undefined;
  const hasSummary = report?.summary?.count && report.summary.count > 0;

  return (
    <PageContainer
      title="Class Reports"
      breadcrumb={{
        items: [
          { title: 'Teacher', path: '/teacher/dashboard' },
          { title: 'Reports' },
        ],
      }}
    >
      {reportQuery.isError ? (
        <Alert
          type="error"
          message="Failed to load report"
          description={
            reportQuery.error instanceof Error ? reportQuery.error.message : 'Please try again.'
          }
          action={
            <Button size="small" onClick={() => reportQuery.refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <ProCard bordered style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Select class"
            style={{ minWidth: 220 }}
            options={classOptions}
            loading={classesQuery.isLoading}
            value={selectedClassId || undefined}
            onChange={(value) => setSelectedClassId(value)}
          />
          <Space>
            <Typography.Text>Range (days)</Typography.Text>
            <InputNumber min={1} max={30} value={rangeDays} onChange={(value) => setRangeDays(value || 7)} />
          </Space>
        </Space>
      </ProCard>

      {!selectedClassId ? (
        <Empty description="Select a class to view reports" />
      ) : reportQuery.isLoading && !report ? (
        <ProCard bordered loading />
      ) : !report ? (
        <Empty description="No report data" />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProCard bordered title="Summary">
            {hasSummary ? (
              <ProCard gutter={16} wrap>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title="Average Score" value={report.summary.avg} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title="Highest Score" value={report.summary.max} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title="Lowest Score" value={report.summary.min} />
                </ProCard>
                <ProCard bordered colSpan={{ xs: 24, sm: 12, md: 6 }}>
                  <Statistic title="Submissions" value={report.summary.count} />
                </ProCard>
              </ProCard>
            ) : (
              <Empty description="No completed submissions yet" />
            )}
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title="Score Distribution">
              {/* TODO: connect chart visualization */}
              {report.distribution?.length ? (
                <List
                  dataSource={report.distribution}
                  renderItem={(item) => (
                    <List.Item>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text>{item.bucket}</Typography.Text>
                        <Typography.Text>{item.count}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No distribution data" />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title="Trend">
              {/* TODO: connect chart visualization */}
              {report.trend?.length ? (
                <List
                  dataSource={report.trend}
                  renderItem={(item) => (
                    <List.Item>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text>{item.date}</Typography.Text>
                        <Typography.Text>Avg {item.avg}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No trend data" />
              )}
            </ProCard>
          </ProCard>

          <ProCard gutter={16} wrap>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title="Top Students">
              {report.topRank?.length ? (
                <List
                  dataSource={report.topRank}
                  renderItem={(item) => (
                    <List.Item>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text>{item.name}</Typography.Text>
                        <Typography.Text>Avg {item.avgScore}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No ranking data" />
              )}
            </ProCard>
            <ProCard bordered colSpan={{ xs: 24, lg: 12 }} title="Top Error Types">
              {report.errorTypes?.length ? (
                <List
                  dataSource={report.errorTypes}
                  renderItem={(item) => (
                    <List.Item>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text>{item.type}</Typography.Text>
                        <Typography.Text>{item.count}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No error stats" />
              )}
            </ProCard>
          </ProCard>
        </Space>
      )}
    </PageContainer>
  );
};
