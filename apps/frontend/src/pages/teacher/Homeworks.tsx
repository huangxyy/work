import { Button, Card, List } from 'antd';

export const TeacherHomeworksPage = () => {
  const items = [
    { title: 'Homework A', className: 'Class 1A' },
    { title: 'Homework B', className: 'Class 2B' },
  ];

  return (
    <Card title="Homeworks" extra={<Button type="primary">Create Homework</Button>}>
      <List
        dataSource={items}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta title={item.title} description={item.className} />
          </List.Item>
        )}
      />
    </Card>
  );
};