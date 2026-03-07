import { InboxOutlined } from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  List,
  Progress,
  Space,
  Steps,
  Typography,
  Upload,
} from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSubmission, fetchStudentHomeworks } from '../../api';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

export const SubmitHomeworkPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [submitStep, setSubmitStep] = useState(0);
  const navigate = useNavigate();
  const { homeworkId } = useParams();

  const homeworksQuery = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
  });

  const homework = useMemo(
    () => (homeworksQuery.data || []).find((item) => item.id === homeworkId),
    [homeworksQuery.data, homeworkId],
  );
  const isOverdue = Boolean(homework?.dueAt && new Date(homework.dueAt).getTime() < Date.now());
  const canSubmit = !isOverdue || Boolean(homework?.allowLateSubmission);

  // Maximum file size: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const tips = useMemo(
    () => [t('submit.tip1'), t('submit.tip2'), t('submit.tip3')],
    [t],
  );
  const canStartSubmit = fileList.length > 0 && canSubmit;
  const canGoUpload = Boolean(homework) && canSubmit;

  const isImageFile = (file: RcFile): boolean => {
    if (file.type?.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|tif?f?)$/i.test(file.name);
  };

  const handleSubmit = async () => {
    if (!homeworkId) {
      message.error(t('submit.missingId'));
      return;
    }

    const files = fileList
      .map((file) => file.originFileObj)
      .filter((file): file is RcFile => !!file);

    if (!files.length) {
      message.warning(t('submit.uploadAtLeastOne'));
      return;
    }

    if (!canSubmit) {
      message.warning(t('submit.closedByDue'));
      return;
    }

    if (files.length > 3) {
      message.warning(t('submit.uploadLimit'));
      return;
    }

    // Validate file type and size
    for (const file of files) {
      if (!isImageFile(file)) {
        message.error(t('submit.onlyImages'));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        message.error(`File ${file.name} exceeds 10MB limit`);
        return;
      }
    }

    setSubmitting(true);
    setUploadPercent(20);
    try {
      const result = await createSubmission({ homeworkId, files });
      setUploadPercent(100);
      message.success(t('submit.created'));
      navigate(`/student/submission/${result.submissionId}`);
    } catch (error) {
      const apiMessage = isAxiosError(error)
        ? (error.response?.data as { message?: string | string[] } | undefined)?.message
        : undefined;
      const detail = Array.isArray(apiMessage) ? apiMessage.join('; ') : apiMessage;
      message.error(detail || t('submit.failed'));
      setUploadPercent(0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      title={t('submit.title')}
      breadcrumb={{
        items: [
          { title: t('nav.student'), path: '/student/homeworks' },
          { title: t('submit.breadcrumb') },
        ],
      }}
    >
      {homeworksQuery.isError ? (
        <Alert
          type="error"
          message={t('student.dashboard.loadError')}
          description={homeworksQuery.error instanceof Error ? homeworksQuery.error.message : t('common.tryAgain')}
          action={
            <Button size="small" onClick={() => homeworksQuery.refetch()}>
              {t('common.retry')}
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : null}
      {!homeworkId ? (
        <Alert
          type="error"
          message={t('submit.missingReference')}
          description={t('submit.missingReferenceDesc')}
          action={
            <Button onClick={() => navigate('/student/homeworks')}>
              {t('common.backToHomeworks')}
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : homeworksQuery.isSuccess && !homework ? (
        <Alert
          type="warning"
          message={t('submit.homeworkNotFound')}
          description={t('submit.homeworkNotFoundDesc')}
          action={
            <Button onClick={() => navigate('/student/homeworks')}>
              {t('common.backToHomeworks')}
            </Button>
          }
          className="apple-inline-alert"
        />
      ) : !canSubmit ? (
        <Alert
          type="warning"
          message={t('submit.closedByDue')}
          description={t('submit.closedByDueHint')}
          className="apple-inline-alert"
        />
      ) : null}
      <ProCard bordered title={t('submit.wizardTitle')} className="apple-soft-card" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Steps
            size="small"
            current={submitStep}
            items={[
              { title: t('submit.wizardStepReady') },
              { title: t('submit.wizardStepUpload') },
              { title: t('submit.wizardStepConfirm') },
            ]}
          />
          <Space wrap>
            <Button onClick={() => setSubmitStep((prev) => Math.max(0, prev - 1))} disabled={submitStep === 0}>
              {t('submit.wizardPrev')}
            </Button>
            <Button
              type="primary"
              onClick={() => setSubmitStep((prev) => Math.min(2, prev + 1))}
              disabled={(submitStep === 0 && !canGoUpload) || (submitStep === 1 && !canStartSubmit) || submitStep === 2}
            >
              {t('submit.wizardNext')}
            </Button>
          </Space>
        </Space>
      </ProCard>
      <ProCard gutter={16} wrap>
        {submitStep === 0 ? (
          <ProCard bordered title={t('submit.wizardStepReady')} colSpan={{ xs: 24, lg: 16 }} className="apple-soft-card">
            <Descriptions bordered column={1}>
              <Descriptions.Item label={t('common.homework')}>
                {homework?.title || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.class')}>
                {homework?.class?.name || '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.dueAt')}>
                {homework?.dueAt || t('status.noDue')}
              </Descriptions.Item>
            </Descriptions>
            <Alert type="info" showIcon style={{ marginTop: 12 }} message={t('submit.wizardReadyHint')} />
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={() => setSubmitStep(1)} disabled={!canGoUpload}>
                {t('submit.wizardGoUpload')}
              </Button>
            </Space>
          </ProCard>
        ) : null}
        {submitStep === 1 ? (
          <ProCard bordered title={t('submit.uploadTitle')} colSpan={{ xs: 24, lg: 16 }} className="apple-soft-card">
          <Upload.Dragger
            multiple
            beforeUpload={() => false}
            fileList={fileList}
            maxCount={3}
            disabled={submitting || !canSubmit}
            onChange={({ fileList: newList }) => {
              if (newList.length > 3) {
                message.warning(t('submit.onlyThree'));
              }
              setFileList(newList.slice(0, 3));
            }}
            accept="image/*,.tif,.tiff"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('submit.draggerText')}</p>
            <Typography.Text type="secondary">{t('submit.draggerHint')}</Typography.Text>
          </Upload.Dragger>
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => setSubmitStep(2)} disabled={!canStartSubmit || submitting}>
              {t('submit.wizardNext')}
            </Button>
            <Button onClick={() => setFileList([])} disabled={submitting}>
              {t('common.reset')}
            </Button>
          </Space>
          {submitting ? (
            <Progress
              style={{ marginTop: 16 }}
              percent={uploadPercent}
              status="active"
              showInfo={false}
            />
          ) : null}
          </ProCard>
        ) : null}
        {submitStep === 1 ? (
          <ProCard bordered title={t('submit.tipsTitle')} colSpan={{ xs: 24, lg: 8 }} className="apple-soft-card">
          <List
            dataSource={tips}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text>{item}</Typography.Text>
              </List.Item>
            )}
          />
          </ProCard>
        ) : null}
        {submitStep === 2 ? (
          <ProCard bordered title={t('submit.wizardStepConfirm')} colSpan={24} className="apple-soft-card">
            <List
              bordered
              size="small"
              dataSource={fileList.map((file) => file.name)}
              renderItem={(item) => <List.Item>{item}</List.Item>}
              style={{ marginBottom: 12 }}
            />
            <Space>
              <Button onClick={() => setSubmitStep(1)}>{t('submit.wizardPrev')}</Button>
              <Button type="primary" onClick={handleSubmit} loading={submitting} disabled={submitting || !canSubmit}>
                {t('common.submit')}
              </Button>
            </Space>
          </ProCard>
        ) : null}
      </ProCard>
    </PageContainer>
  );
};
