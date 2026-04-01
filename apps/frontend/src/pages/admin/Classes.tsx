import type { ProColumns } from '@ant-design/pro-components';
import { ModalForm, PageContainer, ProCard, ProFormSelect, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Drawer, Modal, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  fetchAdminClassSummaries,
  fetchAdminUsers,
  fetchClassStudents,
  fetchClasses,
  importClassStudents,
  removeClassStudent,
  updateClassTeachers,
  deleteClass,
} from '../../api';
import { SoftEmpty } from '../../components/SoftEmpty';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

type ClassItem = {
  id: string;
  name: string;
  grade?: string | null;
  teachers?: Array<{ id: string; name: string; account: string }>;
};

type StudentRow = { id: string; account: string; name: string };

export const AdminClassesPage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassItem | null>(null);

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    staleTime: 10 * 60 * 1000,
  });
  const summaryQuery = useQuery({
    queryKey: ['admin-class-summaries'],
    queryFn: fetchAdminClassSummaries,
    staleTime: 5 * 60 * 1000,
  });
  const teachersQuery = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: () => fetchAdminUsers({ role: 'TEACHER' }),
    staleTime: 5 * 60 * 1000,
  });
  const studentsQuery = useQuery<StudentRow[]>({
    queryKey: ['class-students', activeClass?.id],
    queryFn: () => fetchClassStudents(activeClass?.id || ''),
    enabled: !!activeClass?.id,
    staleTime: 2 * 60 * 1000,
  });

  const summaryMap = useMemo(() => {
    const map = new Map<string, { studentCount: number }>();
    (summaryQuery.data || []).forEach((item) => {
      map.set(item.id, { studentCount: item.studentCount });
    });
    return map;
  }, [summaryQuery.data]);

  const teacherOptions = useMemo(
    () =>
      (teachersQuery.data || []).map((teacher) => ({
        label: `${teacher.name} (${teacher.account})`,
        value: teacher.id,
      })),
    [teachersQuery.data],
  );

  const updateTeachersMutation = useMutation({
    mutationFn: ({ classId, teacherIds }: { classId: string; teacherIds: string[] }) =>
      updateClassTeachers(classId, teacherIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      message.success(t('admin.classes.assignTeachersSuccess'));
    },
    onError: () => message.error(t('admin.classes.assignTeachersFailed')),
  });

  const importMutation = useMutation({
    mutationFn: ({ classId, text }: { classId: string; text: string }) =>
      importClassStudents(classId, { text }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['class-students', activeClass?.id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-class-summaries'] });
      message.success(`${t('admin.classes.importSuccess')} ${data.enrolled}`);
    },
    onError: () => message.error(t('admin.classes.importFailed')),
  });

  const removeStudentMutation = useMutation({
    mutationFn: ({ classId, studentId }: { classId: string; studentId: string }) =>
      removeClassStudent(classId, studentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['class-students', activeClass?.id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-class-summaries'] });
      message.success(t('admin.classes.removeStudentSuccess'));
    },
    onError: () => message.error(t('admin.classes.removeStudentFailed')),
  });

  const deleteClassMutation = useMutation({
    mutationFn: (classId: string) => deleteClass(classId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-class-summaries'] });
      message.success(t('admin.classes.deleteSuccess'));
      setDrawerOpen(false);
    },
    onError: (error) => {
      console.error('删除班级失败:', error);
      message.error(t('admin.classes.deleteFailed'));
    },
  });

  const handleDeleteClass = useCallback((row: ClassItem) => {
    Modal.confirm({
      title: t('admin.classes.deleteConfirmTitle'),
      content: t('admin.classes.deleteConfirmDesc'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => deleteClassMutation.mutate(row.id),
    });
  }, [t, deleteClassMutation]);

  const handleOpenDrawer = useCallback((row: ClassItem) => {
    setActiveClass(row);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo<ProColumns<ClassItem>[]>(() => [
    {
      title: t('common.class'),
      dataIndex: 'name',
      render: (value: string, row: ClassItem) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{row.grade || t('common.notSpecified')}</Typography.Text>
        </Space>
      ),
    },
    {
      title: t('nav.teachers'),
      dataIndex: 'teachers',
      render: (_: unknown, row: ClassItem) =>
        row.teachers && row.teachers.length ? (
          <Space size={[4, 4]} wrap>
            {row.teachers.map((teacher) => (
              <Tag key={teacher.id} className="apple-tag-pill">{teacher.name}</Tag>
            ))}
          </Space>
        ) : (
          <Tag className="apple-tag-pill">{t('admin.classes.noTeachers')}</Tag>
        ),
      width: 220,
    },
    {
      title: t('admin.classes.studentCount'),
      dataIndex: 'id',
      render: (value: string) => summaryMap.get(value)?.studentCount ?? 0,
      width: 140,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      render: (_, row: ClassItem) => [
        <ModalForm
          key="teachers"
          title={t('admin.classes.assignTeachers')}
          trigger={<Button size="small">{t('admin.classes.assignTeachers')}</Button>}
          onFinish={async (values) => {
            try {
              await updateTeachersMutation.mutateAsync({
                classId: row.id,
                teacherIds: (values.teacherIds as string[]) || [],
              });
              return true;
            } catch (error) {
              console.error('分配教师失败:', error);
              return false;
            }
          }}
          modalProps={{ destroyOnClose: true }}
        >
          <ProFormSelect
            name="teacherIds"
            label={t('admin.classes.teacherLabel')}
            mode="multiple"
            options={teacherOptions}
            initialValue={(row.teachers || []).map((teacher) => teacher.id)}
          />
        </ModalForm>,
        <Button
          key="students"
          size="small"
          onClick={() => handleOpenDrawer(row)}
        >
          {t('admin.classes.manageStudents')}
        </Button>,
        <Button
          key="delete"
          size="small"
          danger
          onClick={() => handleDeleteClass(row)}
          loading={deleteClassMutation.isPending}
        >
          {t('common.delete')}
        </Button>,
      ],
    },
  ], [t, summaryMap, teacherOptions, updateTeachersMutation, handleOpenDrawer, handleDeleteClass, deleteClassMutation.isPending]);

  return (
    <PageContainer
      title={t('admin.classes.title')}
      breadcrumb={{
        items: [
          { title: t('nav.admin'), path: '/admin/dashboard' },
          { title: t('nav.classes') },
        ],
      }}
    >
      {classesQuery.isError ? (
        <Alert
          type="error"
          message={t('admin.classes.loadFailed')}
          description={
            classesQuery.error instanceof Error ? classesQuery.error.message : t('common.tryAgain')
          }
          className="apple-inline-alert"
        />
      ) : null}
      <ProCard bordered className="apple-soft-card">
        <ProTable<ClassItem>
          rowKey="id"
          columns={columns}
          dataSource={classesQuery.data || []}
          loading={classesQuery.isLoading}
          search={false}
          pagination={{ pageSize: 8 }}
          options={false}
          locale={{ emptyText: <SoftEmpty description={t('admin.classes.empty')} /> }}
        />
      </ProCard>

      <Drawer
        title={t('admin.classes.manageStudents')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        extra={
          <Button
            danger
            onClick={() => activeClass && handleDeleteClass(activeClass)}
            loading={deleteClassMutation.isPending}
          >
            {t('admin.classes.deleteClass')}
          </Button>
        }
      >
        {activeClass ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <ProCard bordered className="apple-soft-card">
              <Descriptions column={1} bordered>
                <Descriptions.Item label={t('common.class')}>{activeClass.name}</Descriptions.Item>
                <Descriptions.Item label={t('common.grade')}>
                  {activeClass.grade || t('common.notSpecified')}
                </Descriptions.Item>
              </Descriptions>
            </ProCard>

            <ProCard bordered className="apple-soft-card">
              <ModalForm
                title={t('admin.classes.importTitle')}
                trigger={<Button type="primary">{t('admin.classes.importStudents')}</Button>}
                onFinish={async (values) => {
                  const text = String(values.text || '').trim();
                  if (!activeClass?.id) {
                    return false;
                  }
                  if (!text) {
                    message.warning(t('admin.classes.importEmpty'));
                    return false;
                  }
                  try {
                    await importMutation.mutateAsync({ classId: activeClass.id, text });
                    return true;
                  } catch (error) {
                    console.error('导入学生失败:', error);
                    return false;
                  }
                }}
                modalProps={{ destroyOnClose: true }}
              >
                <ProFormTextArea
                  name="text"
                  label={t('admin.classes.importLabel')}
                  placeholder={t('admin.classes.importPlaceholder')}
                  fieldProps={{ rows: 6 }}
                  rules={[{ required: true, message: t('admin.classes.importRequired') }]}
                />
                <Typography.Text type="secondary">{t('admin.classes.importHint')}</Typography.Text>
              </ModalForm>
            </ProCard>

            <ProCard bordered className="apple-soft-card">
              <ProTable<StudentRow>
                rowKey="id"
                dataSource={studentsQuery.data || []}
                loading={studentsQuery.isLoading}
                search={false}
                pagination={{ pageSize: 8 }}
                options={false}
                columns={[
                  {
                    title: t('common.student'),
                    dataIndex: 'name',
                    render: (value) => <Typography.Text strong>{value}</Typography.Text>,
                  },
                  { title: t('common.account'), dataIndex: 'account', width: 160 },
                  {
                    title: t('common.action'),
                    valueType: 'option',
                    render: (_, row) => [
                      <Button
                        key="remove"
                        danger
                        onClick={() =>
                          activeClass?.id
                            ? removeStudentMutation.mutate({ classId: activeClass.id, studentId: row.id })
                            : null
                        }
                        loading={removeStudentMutation.isPending}
                      >
                        {t('admin.classes.removeStudent')}
                      </Button>,
                    ],
                  },
                ]}
                locale={{ emptyText: <SoftEmpty description={t('admin.classes.noStudents')} /> }}
              />
            </ProCard>
          </Space>
        ) : (
          <SoftEmpty description={t('admin.classes.selectClass')} />
        )}
      </Drawer>
    </PageContainer>
  );
};
