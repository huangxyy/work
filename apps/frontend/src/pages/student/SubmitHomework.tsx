import { InboxOutlined } from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  List,
  Progress,
  Space,
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
          style={{ marginBottom: 16 }}
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
          style={{ marginBottom: 16 }}
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
          style={{ marginBottom: 16 }}
        />
      ) : !canSubmit ? (
        <Alert
          type="warning"
          message={t('submit.closedByDue')}
          description={t('submit.closedByDueHint')}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProCard gutter={16} wrap>
        <ProCard bordered title={t('submit.uploadTitle')} colSpan={{ xs: 24, lg: 16 }}>
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
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || !canSubmit}
            >
              {t('common.submit')}
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
        <ProCard bordered title={t('submit.tipsTitle')} colSpan={{ xs: 24, lg: 8 }}>
          <List
            dataSource={tips}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text>{item}</Typography.Text>
              </List.Item>
            )}
          />
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};
