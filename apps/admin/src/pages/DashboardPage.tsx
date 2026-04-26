import { useQuery } from '@tanstack/react-query';
import { Card, Statistic, Row, Col, Spin, Button, Space } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  CrownOutlined,
  BarChartOutlined,
  RocketOutlined,
  LineChartOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

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
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <div className="admin-dash-hero">
        <h1>Платформа</h1>
        <p>Пользователи, тесты, подписки и быстрые переходы в разделы.</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <Card className="admin-stat-card">
            <Statistic
              title="Пользователей"
              value={overview?.totalUsers ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="admin-stat-card">
            <Statistic
              title="Завершённых тестов"
              value={overview?.totalTests ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="admin-stat-card">
            <Statistic
              title="Вопросов в базе"
              value={overview?.totalQuestions ?? 0}
              prefix={<QuestionCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="admin-stat-card">
            <Statistic
              title="Активных подписок"
              value={overview?.activeSubscriptions ?? 0}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#d48806' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card className="admin-stat-card" title="Пробные ЕНТ (ENT)">
            {!ent?.entFound ? (
              <p style={{ margin: 0, color: '#64748b' }}>Тип экзамена ENT не найден в базе.</p>
            ) : (
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic title="Завершено всего" value={ent.completedSessions} />
                </Col>
                <Col span={12}>
                  <Statistic title="За 30 дней" value={ent.last30Completed} />
                </Col>
                <Col span={12} style={{ marginTop: 12 }}>
                  <Statistic
                    title="Средний балл"
                    value={ent.avgScore != null ? Number(ent.avgScore).toFixed(1) : '—'}
                  />
                </Col>
                <Col span={12} style={{ marginTop: 12 }}>
                  <Statistic
                    title="Ср. % верных"
                    value={
                      ent.avgCorrectPercent != null
                        ? `${ent.avgCorrectPercent.toFixed(1)}%`
                        : '—'
                    }
                  />
                </Col>
              </Row>
            )}
            <Button
              type="primary"
              style={{ marginTop: 16 }}
              icon={<LineChartOutlined />}
              onClick={() => navigate('/analytics/ent')}
            >
              Подробная аналитика ЕНТ
            </Button>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="admin-stat-card" title="Переходы">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Button block type="default" icon={<BarChartOutlined />} onClick={() => navigate('/analytics')}>
                Аналитика
              </Button>
              <Button block type="default" icon={<RocketOutlined />} onClick={() => navigate('/admission')}>
                Калькулятор шанса
              </Button>
              <Button block type="default" icon={<BookOutlined />} onClick={() => navigate('/analytics/thresholds')}>
                Пороги в вузы
              </Button>
              <Button block type="default" icon={<QuestionCircleOutlined />} onClick={() => navigate('/explanations')}>
                Объяснения
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
