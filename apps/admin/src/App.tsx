import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, Layout, Menu, theme, Spin, Avatar, Button, Typography } from 'antd';
import { UserOutlined, QuestionCircleOutlined, CrownOutlined, BarChartOutlined } from '@ant-design/icons';
import { api, clearTokens } from './api/client';
import { UsersPage } from './pages/UsersPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LoginPage } from './pages/LoginPage';

const { Sider, Content, Header } = Layout;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const menuItems = [
    { key: 'users', icon: <UserOutlined />, label: 'Пользователи' },
    { key: 'questions', icon: <QuestionCircleOutlined />, label: 'Вопросы' },
    { key: 'subscriptions', icon: <CrownOutlined />, label: 'Подписки' },
    { key: 'analytics', icon: <BarChartOutlined />, label: 'Аналитика' },
  ];

  useEffect(() => {
    setLoadingUser(true);
    api.get('/users/me')
      .then(({ data }) => {
        if (!data.isAdmin) {
          clearTokens();
          navigate('/login', { replace: true });
          return;
        }
        setUser(data);
      })
      .catch(() => {
        clearTokens();
        navigate('/login', { replace: true });
      })
      .finally(() => setLoadingUser(false));
  }, [navigate]);

  const selectedKey = menuItems.find((item) => location.pathname.startsWith(`/${item.key}`))?.key || 'users';

  if (loadingUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f4f6fb' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ boxShadow: '2px 0 12px rgba(15, 23, 42, 0.08)' }}
      >
        <div style={{ padding: '16px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: collapsed ? 14 : 18 }}>
          {collapsed ? 'BL' : 'BilimLand'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(`/${key}`)}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eef1f6' }}>
          <Typography.Text strong style={{ fontSize: 15, color: '#0f172a' }}>
            Панель администратора
          </Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size="small">
              {(user.firstName || user.telegramUsername || 'A').slice(0, 1).toUpperCase()}
            </Avatar>
            <span>{user.firstName} {user.lastName}</span>
            <Button
              type="link"
              onClick={() => { clearTokens(); navigate('/login', { replace: true }); }}
            >
              Выйти
            </Button>
          </div>
        </Header>
        <Content style={{ margin: '20px', background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 10,
          colorPrimary: '#1677ff',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AdminLayout />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
