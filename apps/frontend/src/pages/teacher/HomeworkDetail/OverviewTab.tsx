import {
  Button,
  Descriptions,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteHomework,
  fetchHomeworkDeletePreview,
  updateHomeworkLateSubmission,
} from '../../../api';
import { useI18n } from '../../../i18n';
import { useMessage } from '../../../hooks/useMessage';
import { formatDateShort } from '../../../utils/dateFormat';
import { resolveApiErrorMessage } from './utils';
import type { HomeworkItem } from './types';

interface OverviewTabProps {
  homeworkId: string;
  homework: HomeworkItem;
  classId: string;
}

export const OverviewTab = ({ homeworkId, homework, classId }: OverviewTabProps) => {
  const { t } = useI18n();
  const message = useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [allowLateSubmission, setAllowLateSubmission] = useState(Boolean(homework.allowLateSubmission));

  useEffect(() => {
    setAllowLateSubmission(Boolean(homework.allowLateSubmission));
  }, [homework.allowLateSubmission, homework.id]);

  const deletePreviewQuery = useQuery({
    queryKey: ['homework-delete-preview', homeworkId],
    queryFn: () => fetchHomeworkDeletePreview(homeworkId),
    enabled: !!homeworkId,
  });

  const updateLateSubmissionMutation = useMutation({
    mutationFn: (allow: boolean) => updateHomeworkLateSubmission(homeworkId, allow),
    onSuccess: async (data) => {
      setAllowLateSubmission(data.allowLateSubmission);
      message.success(
        data.allowLateSubmission
          ? t('teacher.homeworkDetail.lateSubmissionOpened')
          : t('teacher.homeworkDetail.lateSubmissionClosed'),
      );
      if (classId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks-summary', classId] });
      }
    },
    onError: (error: unknown) =>
      message.error(resolveApiErrorMessage(error, t('teacher.homeworkDetail.updateLateSubmissionFailed'))),
  });

  const deleteHomeworkMutation = useMutation({
    mutationFn: () => deleteHomework(homeworkId, true),
    onSuccess: async () => {
      message.success(t('teacher.homeworks.deleted'));
      if (classId) {
        await queryClient.invalidateQueries({ queryKey: ['homeworks-summary', classId] });
      }
      navigate('/teacher/homeworks');
    },
    onError: (error: unknown) =>
      message.error(resolveApiErrorMessage(error, t('teacher.homeworks.deleteFailed'))),
  });

  const isOverdue = Boolean(homework.dueAt && new Date(homework.dueAt).getTime() < Date.now());
  const lateSubmissionTag = allowLateSubmission
    ? t('teacher.homeworkDetail.lateSubmissionEnabled')
    : t('teacher.homeworkDetail.lateSubmissionDisabled');

  return (
    <ProCard bordered>
      <Descriptions column={1} bordered>
        <Descriptions.Item label={t('common.title')}>{homework.title}</Descriptions.Item>
        <Descriptions.Item label={t('common.dueDate')}>
          {homework.dueAt ? formatDateShort(homework.dueAt) : t('status.noDue')}
        </Descriptions.Item>
        <Descriptions.Item label={t('common.description')}>
          {homework.desc ? (
            <Typography.Paragraph style={{ margin: 0 }}>{homework.desc}</Typography.Paragraph>
          ) : (
            <Typography.Text type="secondary">{t('common.noDescriptionProvided')}</Typography.Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('teacher.homeworkDetail.classReference')}>
          {classId || t('teacher.homeworkDetail.notSpecified')}
        </Descriptions.Item>
        <Descriptions.Item label={t('teacher.homeworkDetail.lateSubmission')}>
          <Space direction="vertical" size={4}>
            <Tag color={allowLateSubmission ? 'success' : isOverdue ? 'error' : 'default'}>
              {lateSubmissionTag}
            </Tag>
            {isOverdue && !allowLateSubmission ? (
              <Typography.Text type="secondary">
                {t('teacher.homeworkDetail.lateSubmissionHint')}
              </Typography.Text>
            ) : null}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label={t('common.action')}>
          <Space wrap>
            <Button
              loading={updateLateSubmissionMutation.isPending}
              onClick={() => updateLateSubmissionMutation.mutate(!allowLateSubmission)}
            >
              {allowLateSubmission
                ? t('teacher.homeworkDetail.closeLateSubmission')
                : t('teacher.homeworkDetail.openLateSubmission')}
            </Button>
            <Popconfirm
              title={t('teacher.homeworkDetail.deleteConfirmTitle')}
              description={
                <Space direction="vertical" size={0}>
                  <Typography.Text>{t('teacher.homeworkDetail.deleteConfirmDesc')}</Typography.Text>
                  <Typography.Text type="secondary">
                    {deletePreviewQuery.isLoading
                      ? t('teacher.homeworkDetail.deletePreviewLoading')
                      : deletePreviewQuery.isError
                        ? t('teacher.homeworkDetail.deletePreviewFailed')
                        : `${t('teacher.homeworkDetail.deleteWillRemove')} ${deletePreviewQuery.data?.submissionCount || 0} ${t('teacher.homeworkDetail.deleteSubmissionsUnit')}、${deletePreviewQuery.data?.imageCount || 0} ${t('teacher.homeworkDetail.deleteImagesUnit')}`}
                  </Typography.Text>
                </Space>
              }
              onConfirm={() => deleteHomeworkMutation.mutate()}
              okButtonProps={{ loading: deleteHomeworkMutation.isPending }}
            >
              <Button danger loading={deleteHomeworkMutation.isPending}>
                {t('teacher.homeworkDetail.deleteHomework')}
              </Button>
            </Popconfirm>
          </Space>
        </Descriptions.Item>
      </Descriptions>
    </ProCard>
  );
};
