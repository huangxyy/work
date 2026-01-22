import { Button, Card, List } from 'antd';

export const TeacherClassesPage = () => {
  const classes = [
    { name: 'Class 1A', students: 32 },
    { name: 'Class 2B', students: 28 },
  ];

  return (
    <Card title="Classes" extra={<Button type="primary">Create Class</Button>}>
      <List
        dataSource={classes}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta title={item.name} description={`${item.students} students`} />
          </List.Item>
        )}
      />
    </Card>
  );
};