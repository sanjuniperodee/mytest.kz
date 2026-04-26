import { useQuery } from '@tanstack/react-query';
import { Card, Statistic, Row, Col, Spin, Typography } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigGroup, HigPageLead } from '../components/HigBlocks';

export function EntTrialsAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get('/admin/analytics/ent-trials')).data,
  });

  if (isLoading) {
    return (
      <div className="admin-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AdminPageShell>
      <HigPageLead>
        Агрегаты по завершённым пробным тестам ЕНТ: объёмы, средний балл и доля верных за всё время и за 30 дней.
      </HigPageLead>
      {!data?.entFound ? (
        <HigGroup label="Состояние каталога">
          <Card>
            <Typography.Text type="secondary">
              В каталоге экзаменов нет типа с идентификатором <code>ent</code>. Добавьте его в базе, чтобы
              аналитика заполнилась.
            </Typography.Text>
          </Card>
        </HigGroup>
      ) : (
        <HigGroup label="Показатели" description="Сессии в статусе «завершено» и качество попыток.">
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Card className="admin-stat-card" size="small">
                <Statistic
                  title="Завершено всего"
                  value={data.completedSessions}
                  prefix={<LineChartOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="admin-stat-card" size="small">
                <Statistic title="Завершено за 30 дней" value={data.last30Completed} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="admin-stat-card" size="small">
                <Statistic
                  title="Средний балл (score)"
                  value={data.avgScore != null ? Number(data.avgScore).toFixed(2) : '—'}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="admin-stat-card" size="small">
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
        </HigGroup>
      )}
    </AdminPageShell>
  );
}
