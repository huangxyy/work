import { Button, Card, Empty, List, Spin, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchStudentHomeworks } from '../../api';
import { useNavigate } from 'react-router-dom';

export const StudentHomeworksPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['student-homeworks'],
    queryFn: fetchStudentHomeworks,
  });

  return (
    <Card title="My Homeworks">
      {isLoading ? (
        <Spin />
      ) : data && data.length ? (
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={item.title}
                description={`Class: ${item.class.name}${
                  item.dueAt ? ` | Due: ${new Date(item.dueAt).toLocaleDateString()}` : ''
                }`}
              />
              <Button type="link" onClick={() => navigate(`/student/submit/${item.id}`)}>
                Submit
              </Button>
            </List.Item>
          )}
        />
      ) : (
        <>
          <Empty description="No homework yet" />
          <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
            Submitters will appear here once your teacher publishes assignments.
          </Typography.Paragraph>
        </>
      )}
    </Card>
  );
};
