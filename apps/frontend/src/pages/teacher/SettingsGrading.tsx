import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Divider, Select, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  clearTeacherClassPolicy,
  clearTeacherHomeworkPolicy,
  fetchClasses,
  fetchHomeworksByClass,
  fetchTeacherGradingPolicy,
  fetchTeacherGradingPolicyPreview,
  fetchTeacherGradingSettings,
  upsertTeacherClassPolicy,
  upsertTeacherHomeworkPolicy,
} from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { formatDate } from '../../utils/dateFormat';
import { useMessage } from '../../hooks/useMessage';

export const TeacherSettingsGradingPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>();
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | undefined>();
  const [classMode, setClassMode] = useState<'inherit' | 'cheap' | 'quality'>('inherit');
  const [classRewrite, setClassRewrite] = useState<'inherit' | 'on' | 'off'>('inherit');
  const [homeworkMode, setHomeworkMode] = useState<'inherit' | 'cheap' | 'quality'>('inherit');
  const [homeworkRewrite, setHomeworkRewrite] = useState<'inherit' | 'on' | 'off'>('inherit');

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-grading-settings'],
    queryFn: fetchTeacherGradingSettings,
  });

  const classesQuery = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: fetchClasses,
  });

  const homeworksQuery = useQuery({
    queryKey: ['teacher-homeworks', selectedClassId],
    queryFn: () => fetchHomeworksByClass(selectedClassId || ''),
    enabled: Boolean(selectedClassId),
  });

  const policyQuery = useQuery({
    queryKey: ['teacher-grading-policy', selectedClassId, selectedHomeworkId],
    queryFn: () =>
      fetchTeacherGradingPolicy({
        classId: selectedClassId,
        homeworkId: selectedHomeworkId,
      }),
    enabled: Boolean(selectedClassId),
  });

  const policyPreviewQuery = useQuery({
    queryKey: ['teacher-grading-policy-preview', selectedClassId],
    queryFn: () => fetchTeacherGradingPolicyPreview(selectedClassId || ''),
    enabled: Boolean(selectedClassId),
  });

  const grading = data?.grading;
  const budget = data?.budget;
  const defaultMode = grading?.defaultMode || import.meta.env.VITE_GRADING_MODE || t('common.notConfigured');
  const budgetMode = budget?.enabled ? budget?.mode || t('common.notSpecified') : t('common.disabled');
  const budgetLimit = budget?.enabled ? budget?.dailyCallLimit ?? t('common.notSpecified') : t('common.notSpecified');
  const providerName = grading?.provider?.name || t('common.notSpecified');
  const modelName = grading?.model || t('common.notSpecified');
  const formatValue = (value?: number | string | null) =>
    value === undefined || value === null || value === '' ? t('common.notSpecified') : String(value);

  const classOptions = useMemo(
    () =>
      (classesQuery.data || []).map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [classesQuery.data],
  );

  const homeworkOptions = useMemo(
    () =>
      (homeworksQuery.data || []).map((item) => ({
        label: item.title,
        value: item.id,
      })),
    [homeworksQuery.data],
  );

  const policyModeOptions = useMemo(
    () => [
      { label: t('teacher.settings.policyInherit'), value: 'inherit' },
      { label: t('teacher.settings.policyCheap'), value: 'cheap' },
      { label: t('teacher.settings.policyQuality'), value: 'quality' },
    ],
    [t],
  );

  const rewriteOptions = useMemo(
    () => [
      { label: t('teacher.settings.policyInherit'), value: 'inherit' },
      { label: t('teacher.settings.policyEnable'), value: 'on' },
      { label: t('teacher.settings.policyDisable'), value: 'off' },
    ],
    [t],
  );

  type PolicyPreviewRow = {
    homeworkId: string;
    title: string;
    dueAt?: string | null;
    submissionCount: number;
    lastStatus?: string | null;
    lastUpdatedAt?: string | null;
    effective: { mode: 'cheap' | 'quality'; needRewrite: boolean };
    source: { mode: 'default' | 'class' | 'homework'; needRewrite: 'default' | 'class' | 'homework' };
  };

  const previewColumns = useMemo(
    (): ProColumns<PolicyPreviewRow>[] => [
      {
        title: t('common.homework'),
        dataIndex: 'title',
        render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
      },
      {
        title: t('common.dueAt'),
        dataIndex: 'dueAt',
        render: (value: string | null) => (value ? formatDate(value) : '--'),
        width: 140,
      },
      {
        title: t('teacher.settings.submissionCount'),
        dataIndex: 'submissionCount',
        render: (value: number) => value ?? 0,
        width: 120,
      },
      {
        title: t('teacher.settings.effectiveMode'),
        dataIndex: 'effective',
        render: (_: unknown, row: PolicyPreviewRow) => (
          <Tag>{row.effective.mode}</Tag>
        ),
        width: 140,
      },
      {
        title: t('teacher.settings.effectiveRewrite'),
        dataIndex: 'effective',
        render: (_: unknown, row: PolicyPreviewRow) => (
          <Tag>{row.effective.needRewrite ? t('common.enabled') : t('common.disabled')}</Tag>
        ),
        width: 140,
      },
      {
        title: t('teacher.settings.lastStatus'),
        dataIndex: 'lastStatus',
        render: (value: string | null) => {
          if (!value) {
            return '--';
          }
          const key = value.toLowerCase();
          const label = t(`status.${key}`);
          const color = value === 'DONE' ? 'green' : value === 'FAILED' ? 'red' : 'blue';
          return <Tag color={color}>{label}</Tag>;
        },
        width: 150,
      },
      {
        title: t('teacher.settings.lastUpdatedAt'),
        dataIndex: 'lastUpdatedAt',
        render: (value: string | null) => (value ? formatDate(value) : '--'),
        width: 180,
      },
      {
        title: t('teacher.settings.policySource'),
        dataIndex: 'source',
        render: (_: unknown, row: PolicyPreviewRow) => {
          const modeSource = row.source.mode;
          const rewriteSource = row.source.needRewrite;
          if (modeSource === rewriteSource) {
            return <Tag>{t(`teacher.settings.policySource.${modeSource}`)}</Tag>;
          }
          return (
            <Space size={6} wrap>
              <Tag>{`${t('teacher.settings.policyMode')}: ${t(`teacher.settings.policySource.${modeSource}`)}`}</Tag>
              <Tag>{`${t('teacher.settings.policyRewrite')}: ${t(`teacher.settings.policySource.${rewriteSource}`)}`}</Tag>
            </Space>
          );
        },
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!policyQuery.data) {
      return;
    }
    const classPolicy = policyQuery.data.classPolicy;
    const homeworkPolicy = policyQuery.data.homeworkPolicy;

    setClassMode(classPolicy?.mode ? (classPolicy.mode as 'cheap' | 'quality') : 'inherit');
    setClassRewrite(
      classPolicy?.needRewrite === undefined || classPolicy?.needRewrite === null
        ? 'inherit'
        : classPolicy.needRewrite
          ? 'on'
          : 'off',
    );

    setHomeworkMode(homeworkPolicy?.mode ? (homeworkPolicy.mode as 'cheap' | 'quality') : 'inherit');
    setHomeworkRewrite(
      homeworkPolicy?.needRewrite === undefined || homeworkPolicy?.needRewrite === null
        ? 'inherit'
        : homeworkPolicy.needRewrite
          ? 'on'
          : 'off',
    );
  }, [policyQuery.data]);

  useEffect(() => {
    if (!selectedClassId) {
      setClassMode('inherit');
      setClassRewrite('inherit');
      setHomeworkMode('inherit');
      setHomeworkRewrite('inherit');
    }
  }, [selectedClassId]);

  const classPolicyMutation = useMutation({
    mutationFn: (payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean }) =>
      upsertTeacherClassPolicy(selectedClassId || '', payload),
    onSuccess: async () => {
      message.success(t('teacher.settings.policySaved'));
      await queryClient.invalidateQueries({ queryKey: ['teacher-grading-policy'] });
    },
  });

  const homeworkPolicyMutation = useMutation({
    mutationFn: (payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean }) =>
      upsertTeacherHomeworkPolicy(selectedHomeworkId || '', payload),
    onSuccess: async () => {
      message.success(t('teacher.settings.policySaved'));
      await queryClient.invalidateQueries({ queryKey: ['teacher-grading-policy'] });
    },
  });

  const clearClassPolicyMutation = useMutation({
    mutationFn: () => clearTeacherClassPolicy(selectedClassId || ''),
    onSuccess: async () => {
      message.success(t('teacher.settings.policyCleared'));
      await queryClient.invalidateQueries({ queryKey: ['teacher-grading-policy'] });
    },
  });

  const clearHomeworkPolicyMutation = useMutation({
    mutationFn: () => clearTeacherHomeworkPolicy(selectedHomeworkId || ''),
    onSuccess: async () => {
      message.success(t('teacher.settings.policyCleared'));
      await queryClient.invalidateQueries({ queryKey: ['teacher-grading-policy'] });
    },
  });

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
      <ProCard bordered loading={isLoading}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label={t('teacher.settings.defaultGradingMode')}>
            <Tag>{defaultMode}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('teacher.settings.budgetMode')}>
            <Tag>{budgetMode}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('teacher.settings.budgetDailyLimit')}>
            <Typography.Text>{budgetLimit}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('teacher.settings.provider')}>
            <Typography.Text>{providerName}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('teacher.settings.model')}>
            <Typography.Text>{modelName}</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </ProCard>
      <ProCard bordered title={t('teacher.settings.policyTitle')} style={{ marginTop: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message={t('teacher.settings.policyModeTipsTitle')}
            description={
              <Space direction="vertical" size={0}>
                <Typography.Text>{t('teacher.settings.policyModeTipsCheap')}</Typography.Text>
                <Typography.Text>{t('teacher.settings.policyModeTipsQuality')}</Typography.Text>
              </Space>
            }
          />
          <Space wrap>
            <Select
              style={{ minWidth: 220 }}
              placeholder={t('teacher.settings.selectClass')}
              options={classOptions}
              value={selectedClassId}
              onChange={(value) => {
                setSelectedClassId(value);
                setSelectedHomeworkId(undefined);
              }}
              loading={classesQuery.isLoading}
            />
            <Select
              style={{ minWidth: 240 }}
              placeholder={t('teacher.settings.selectHomework')}
              options={homeworkOptions}
              value={selectedHomeworkId}
              onChange={(value) => setSelectedHomeworkId(value)}
              loading={homeworksQuery.isLoading}
              disabled={!selectedClassId}
              allowClear
            />
          </Space>

          {selectedClassId ? (
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t('teacher.settings.effectiveMode')}>
                <Tag>{policyQuery.data?.effective?.mode || 'cheap'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('teacher.settings.effectiveRewrite')}>
                <Tag>{policyQuery.data?.effective?.needRewrite ? t('common.enabled') : t('common.disabled')}</Tag>
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Typography.Text type="secondary">{t('teacher.settings.selectClassHint')}</Typography.Text>
          )}

          <Divider />

          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text strong>{t('teacher.settings.classPolicyTitle')}</Typography.Text>
            <Space wrap>
              <Select
                style={{ minWidth: 180 }}
                options={policyModeOptions}
                value={classMode}
                onChange={(value) => setClassMode(value as 'inherit' | 'cheap' | 'quality')}
                disabled={!selectedClassId}
              />
              <Select
                style={{ minWidth: 180 }}
                options={rewriteOptions}
                value={classRewrite}
                onChange={(value) => setClassRewrite(value as 'inherit' | 'on' | 'off')}
                disabled={!selectedClassId}
              />
              <Button
                type="primary"
                loading={classPolicyMutation.isPending}
                disabled={!selectedClassId}
                onClick={() => {
                  if (!selectedClassId) {
                    message.warning(t('teacher.settings.selectClassHint'));
                    return;
                  }
                  classPolicyMutation.mutate({
                    mode: classMode === 'inherit' ? undefined : (classMode as 'cheap' | 'quality'),
                    needRewrite:
                      classRewrite === 'inherit' ? undefined : classRewrite === 'on',
                  });
                }}
              >
                {t('teacher.settings.policySave')}
              </Button>
              <Button
                danger
                loading={clearClassPolicyMutation.isPending}
                disabled={!selectedClassId}
                onClick={() => {
                  if (!selectedClassId) {
                    message.warning(t('teacher.settings.selectClassHint'));
                    return;
                  }
                  clearClassPolicyMutation.mutate();
                }}
              >
                {t('teacher.settings.policyClear')}
              </Button>
            </Space>
          </Space>

          <Divider />

          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text strong>{t('teacher.settings.homeworkPolicyTitle')}</Typography.Text>
            <Space wrap>
              <Select
                style={{ minWidth: 180 }}
                options={policyModeOptions}
                value={homeworkMode}
                onChange={(value) => setHomeworkMode(value as 'inherit' | 'cheap' | 'quality')}
                disabled={!selectedHomeworkId}
              />
              <Select
                style={{ minWidth: 180 }}
                options={rewriteOptions}
                value={homeworkRewrite}
                onChange={(value) => setHomeworkRewrite(value as 'inherit' | 'on' | 'off')}
                disabled={!selectedHomeworkId}
              />
              <Button
                type="primary"
                loading={homeworkPolicyMutation.isPending}
                disabled={!selectedHomeworkId}
                onClick={() => {
                  if (!selectedHomeworkId) {
                    message.warning(t('teacher.settings.selectHomeworkHint'));
                    return;
                  }
                  homeworkPolicyMutation.mutate({
                    mode: homeworkMode === 'inherit' ? undefined : (homeworkMode as 'cheap' | 'quality'),
                    needRewrite:
                      homeworkRewrite === 'inherit' ? undefined : homeworkRewrite === 'on',
                  });
                }}
              >
                {t('teacher.settings.policySave')}
              </Button>
              <Button
                danger
                loading={clearHomeworkPolicyMutation.isPending}
                disabled={!selectedHomeworkId}
                onClick={() => {
                  if (!selectedHomeworkId) {
                    message.warning(t('teacher.settings.selectHomeworkHint'));
                    return;
                  }
                  clearHomeworkPolicyMutation.mutate();
                }}
              >
                {t('teacher.settings.policyClear')}
              </Button>
            </Space>
          </Space>
        </Space>
      </ProCard>
      <ProCard bordered title={t('teacher.settings.advancedTitle')} style={{ marginTop: 16 }} loading={isLoading}>
        {grading ? (
          <Descriptions column={1} bordered>
            <Descriptions.Item label={t('teacher.settings.maxTokens')}>
              <Typography.Text>{formatValue(grading.maxTokens)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.temperature')}>
              <Typography.Text>{formatValue(grading.temperature)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.topP')}>
              <Typography.Text>{formatValue(grading.topP)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.presencePenalty')}>
              <Typography.Text>{formatValue(grading.presencePenalty)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.frequencyPenalty')}>
              <Typography.Text>{formatValue(grading.frequencyPenalty)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.timeoutMs')}>
              <Typography.Text>{formatValue(grading.timeoutMs)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.responseFormat')}>
              <Typography.Text>{grading.responseFormat || t('common.notSpecified')}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.stopSequences')}>
              {grading.stop && grading.stop.length ? (
                <Space size={6} wrap>
                  {grading.stop.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              ) : (
                <Typography.Text>{t('common.notSpecified')}</Typography.Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('teacher.settings.systemPrompt')}>
              <Tag color={grading.systemPromptSet ? 'green' : 'default'}>
                {grading.systemPromptSet ? t('teacher.settings.systemPromptSet') : t('teacher.settings.systemPromptUnset')}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <SoftEmpty description={t('teacher.settings.advancedEmpty')} />
        )}
      </ProCard>
      <ProCard bordered title={t('teacher.settings.policyPreviewTitle')} style={{ marginTop: 16 }}>
        {selectedClassId ? (
          <ProTable
            rowKey="homeworkId"
            search={false}
            options={false}
            loading={policyPreviewQuery.isLoading}
            columns={previewColumns}
            dataSource={policyPreviewQuery.data?.items || []}
            pagination={{ pageSize: 6 }}
            locale={{ emptyText: <SoftEmpty description={t('teacher.settings.policyPreviewEmpty')} /> }}
          />
        ) : (
          <SoftEmpty description={t('teacher.settings.selectClassHint')} />
        )}
      </ProCard>
    </PageContainer>
  );
};
