import { useQuery } from '@tanstack/react-query';
import { Card, Statistic, Row, Col, Spin, Alert } from 'antd';
import { UserOutlined, FileTextOutlined, QuestionCircleOutlined, CrownOutlined } from '@ant-design/icons';
import { api } from '../api/client';

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get('/admin/analytics/overview')).data,
  });

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Аналитика</h2>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Сводные метрики по платформе обновляются в реальном времени"
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Пользователей"
              value={data?.totalUsers || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Завершённых тестов"
              value={data?.totalTests || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Вопросов в базе"
              value={data?.totalQuestions || 0}
              prefix={<QuestionCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Активных подписок"
              value={data?.activeSubscriptions || 0}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
