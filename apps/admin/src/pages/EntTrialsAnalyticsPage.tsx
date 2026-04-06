import { useQuery } from '@tanstack/react-query';
import { Card, Statistic, Row, Col, Spin, Alert, Typography } from 'antd';
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
      <h2 className="admin-page-title">Аналитика по пробным ЕНТ</h2>
      <p className="admin-page-lead">
        Статистика по завершённым сессиям с типом экзамена ENT: объём прохождений, средний балл и доля
        верных ответов (агрегировано по завершённым попыткам).
      </p>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Данные строятся по полю статуса «completed» и привязке к exam_type.slug = ent."
      />

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
