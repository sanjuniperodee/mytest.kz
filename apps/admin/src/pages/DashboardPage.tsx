import { useQuery } from '@tanstack/react-query';
import { Card, Statistic, Row, Col, Spin, Button, Typography, Divider } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  CrownOutlined,
  BarChartOutlined,
  RocketOutlined,
  LineChartOutlined,
  BookOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get('/admin/analytics/overview')).data,
  });

  const { data: ent, isLoading: loadingEnt } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get('/admin/analytics/ent-trials')).data,
  });

  if (loadingOverview || loadingEnt) {
    return (
      <div className="admin-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AdminPageShell>
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Пользователи"
              value={overview?.totalUsers ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Тесты"
              value={overview?.totalTests ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Вопросы"
              value={overview?.totalQuestions ?? 0}
              prefix={<QuestionCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Подписки"
              value={overview?.activeSubscriptions ?? 0}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#ff9f0a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card size="small" title="Пробные ЕНТ">
            {!ent?.entFound ? (
              <Typography.Text type="secondary">Нет типа экзамена ent в каталоге.</Typography.Text>
            ) : (
              <Row gutter={[12, 8]}>
                <Col span={12}>
                  <Statistic title="Завершено" value={ent.completedSessions} />
                </Col>
                <Col span={12}>
                  <Statistic title="За 30 дн." value={ent.last30Completed} />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Ср. балл"
                    value={ent.avgScore != null ? Number(ent.avgScore).toFixed(1) : '—'}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Ср. % верных"
                    value={ent.avgCorrectPercent != null ? `${ent.avgCorrectPercent.toFixed(1)}%` : '—'}
                  />
                </Col>
              </Row>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <Button type="primary" size="small" icon={<LineChartOutlined />} onClick={() => navigate('/analytics/ent')}>
              Аналитика ЕНТ
            </Button>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" title="Быстрый переход">
            <div className="admin-dash-toolbar">
              <Button className="admin-dash-link" icon={<BarChartOutlined />} onClick={() => navigate('/analytics')}>
                Воронка
              </Button>
              <Button className="admin-dash-link" icon={<RocketOutlined />} onClick={() => navigate('/admission')}>
                Шанс
              </Button>
              <Button className="admin-dash-link" icon={<BookOutlined />} onClick={() => navigate('/analytics/thresholds')}>
                Пороги
              </Button>
              <Button className="admin-dash-link" icon={<ReadOutlined />} onClick={() => navigate('/explanations')}>
                Объяснения
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </AdminPageShell>
  );
}
