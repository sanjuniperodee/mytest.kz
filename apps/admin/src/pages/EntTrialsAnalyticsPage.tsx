import { useQuery } from '@tanstack/react-query';
import { Card, Statistic, Row, Col, Spin, Typography } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { api } from '../api/client';

export function EntTrialsAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get('/admin/analytics/ent-trials')).data,
  });

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <p className="admin-hint" style={{ marginTop: 0 }}>
        Только завершённые сессии, тип экзамена <Typography.Text code>ent</Typography.Text>.
      </p>

      {!data?.entFound ? (
        <Card>
          <Typography.Text type="secondary">
            В каталоге экзаменов нет типа с идентификатором <code>ent</code>. Добавьте его в базе,
            чтобы аналитика заполнилась.
          </Typography.Text>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card className="admin-stat-card">
              <Statistic
                title="Завершено всего"
                value={data.completedSessions}
                prefix={<LineChartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="admin-stat-card">
              <Statistic title="Завершено за 30 дней" value={data.last30Completed} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="admin-stat-card">
              <Statistic
                title="Средний балл (score)"
                value={data.avgScore != null ? Number(data.avgScore).toFixed(2) : '—'}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="admin-stat-card">
              <Statistic
                title="Средний % верных"
                value={
                  data.avgCorrectPercent != null
                    ? `${Number(data.avgCorrectPercent).toFixed(1)}%`
                    : '—'
                }
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
