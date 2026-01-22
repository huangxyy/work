import { Card, List, Typography } from 'antd';

export const StudentHomeworksPage = () => {
  const items = [
    { title: 'Homework A', due: '2024-02-01' },
    { title: 'Homework B', due: '2024-02-05' },
  ];

  return (
    <Card title="My Homeworks">
      <List
        dataSource={items}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta title={item.title} description={`Due: ${item.due}`} />
          </List.Item>
        )}
      />
      <Typography.Paragraph type="secondary">
        Data will load from API once connected.
      </Typography.Paragraph>
    </Card>
  );
};