import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ConfigProvider,
  Layout,
  Menu,
  theme,
  Spin,
  Avatar,
  Button,
  Typography,
  Drawer,
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  DashboardOutlined,
  LineChartOutlined,
  BookOutlined,
  RocketOutlined,
  FundProjectionScreenOutlined,
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  ReadOutlined,
  FormOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { api, clearTokens } from './api/client';
import { getPageMeta } from './lib/pageMeta';
import { UsersPage } from './pages/UsersPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EntTrialsAnalyticsPage } from './pages/EntTrialsAnalyticsPage';
import { UniversityThresholdsPage } from './pages/UniversityThresholdsPage';
import { AdmissionChancePage } from './pages/AdmissionChancePage';
import { ExplanationsPage } from './pages/ExplanationsPage';
import { ExamCatalogPage } from './pages/ExamCatalogPage';
import { LandingSettingsPage } from './pages/LandingSettingsPage';
import { LoginPage } from './pages/LoginPage';

const { Sider, Content, Header } = Layout;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const MENU_NAV: Record<string, string> = {
  dashboard: '/dashboard',
  'analytics-platform': '/analytics',
  'analytics-ent': '/analytics/ent',
  'analytics-thresholds': '/analytics/thresholds',
  admission: '/admission',
  explanations: '/explanations',
  users: '/users',
  questions: '/questions',
  exams: '/exams',
  subscriptions: '/subscriptions',
  'landing-settings': '/landing-settings',
};

function menuKeyFromPath(pathname: string): string {
  if (pathname.startsWith('/analytics/ent')) return 'analytics-ent';
  if (pathname.startsWith('/analytics/thresholds')) return 'analytics-thresholds';
  if (pathname.startsWith('/analytics')) return 'analytics-platform';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/admission')) return 'admission';
  if (pathname.startsWith('/explanations')) return 'explanations';
  if (pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/questions')) return 'questions';
  if (pathname.startsWith('/exams')) return 'exams';
  if (pathname.startsWith('/subscriptions')) return 'subscriptions';
  if (pathname.startsWith('/landing-settings')) return 'landing-settings';
  return 'dashboard';
}

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const selectedKey = useMemo(() => menuKeyFromPath(location.pathname), [location.pathname]);
  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);


  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        type: 'group',
        label: 'Старт',
        children: [{ key: 'dashboard', icon: <DashboardOutlined />, label: 'Панель' }],
      },
      {
        type: 'group',
        label: 'Метрики',
        children: [
          { key: 'analytics-platform', icon: <FundProjectionScreenOutlined />, label: 'Воронка' },
          { key: 'analytics-ent', icon: <LineChartOutlined />, label: 'ЕНТ' },
          { key: 'analytics-thresholds', icon: <BookOutlined />, label: 'Пороги' },
        ],
      },
      {
        type: 'group',
        label: 'Каталог',
        children: [
          { key: 'questions', icon: <FormOutlined />, label: 'Вопросы' },
          { key: 'explanations', icon: <ReadOutlined />, label: 'Объяснения' },
          { key: 'exams', icon: <AppstoreOutlined />, label: 'Экзамены' },
          { key: 'landing-settings', icon: <GlobalOutlined />, label: 'Лендинг' },
        ],
      },
      {
        type: 'group',
        label: 'Аккаунты',
        children: [
          { key: 'users', icon: <UserOutlined />, label: 'Пользователи' },
          { key: 'subscriptions', icon: <CrownOutlined />, label: 'Подписки' },
        ],
      },
      {
        type: 'group',
        label: 'Сервис',
        children: [{ key: 'admission', icon: <RocketOutlined />, label: 'Шанс' }],
      },
    ],
    [],
  );

  useEffect(() => {
    setLoadingUser(true);
    api
      .get('/users/me')
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

  if (loadingUser) {
    return (
      <div className="admin-boot">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <Layout className="admin-shell">
      {/* Desktop sidebar */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={256}
        breakpoint="lg"
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true);
        }}
        className="admin-desktop-sider admin-sider"
      >
        <div className="admin-sider-brand">
          <div className="admin-sider-logo">{collapsed ? 'MT' : 'M'}</div>
          {!collapsed && (
            <div className="admin-sider-brand-text">
              <div className="admin-sider-brand-title">MyTest</div>
              <div className="admin-sider-brand-sub">admin</div>
            </div>
          )}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            const path = MENU_NAV[key];
            if (path) navigate(path);
          }}
          className="admin-sider-menu"
          items={menuItems}
        />
      </Sider>

      {/* Mobile drawer sidebar */}
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={260}
        closable={false}
        rootClassName="admin-mobile-drawer"
        styles={{ body: { padding: 0, background: 'var(--admin-sider-bg)' } }}
      >
        <div className="admin-sider-brand">
          <div className="admin-sider-logo">M</div>
          <div className="admin-sider-brand-text">
            <div className="admin-sider-brand-title">MyTest</div>
            <div className="admin-sider-brand-sub">admin</div>
          </div>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            const path = MENU_NAV[key];
            if (path) navigate(path);
            setMobileOpen(false);
          }}
          className="admin-sider-menu"
          items={menuItems}
        />
      </Drawer>

      <Layout>
        <Header className="admin-top-header">
          <Button
            type="text"
            icon={mobileOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => setMobileOpen((v) => !v)}
            className="admin-header-hamburger"
            aria-label="Меню"
          />
          <div className="admin-header-titles">
            <Typography.Title level={4} className="admin-header-title">
              {pageMeta.title}
            </Typography.Title>
          </div>
          <div className="admin-header-user">
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'logout',
                    label: 'Выйти',
                    icon: <LogoutOutlined />,
                    onClick: () => {
                      clearTokens();
                      navigate('/login', { replace: true });
                    },
                  },
                ],
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button type="text" className="admin-header-user-btn">
                <Avatar size="small" className="admin-header-avatar">
                  {(user.firstName || user.telegramUsername || 'A').slice(0, 1).toUpperCase()}
                </Avatar>
                <span className="admin-header-username">
                  {user.firstName} {user.lastName}
                </span>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content className="admin-content-wrap">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/analytics/ent" element={<EntTrialsAnalyticsPage />} />
            <Route path="/analytics/thresholds" element={<UniversityThresholdsPage />} />
            <Route path="/admission" element={<AdmissionChancePage />} />
            <Route path="/explanations" element={<ExplanationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/exams" element={<ExamCatalogPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/landing-settings" element={<LandingSettingsPage />} />
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
          colorPrimary: '#007aff',
          colorInfo: '#007aff',
          colorSuccess: '#34c759',
          colorWarning: '#ff9f0a',
          colorError: '#ff3b30',
          colorText: '#1d1d1f',
          colorTextSecondary: 'rgba(60, 60, 67, 0.72)',
          colorTextTertiary: 'rgba(60, 60, 67, 0.55)',
          colorTextQuaternary: 'rgba(60, 60, 67, 0.4)',
          colorBorder: 'rgba(60, 60, 67, 0.12)',
          colorBorderSecondary: 'rgba(60, 60, 67, 0.06)',
          colorSplit: 'rgba(60, 60, 67, 0.12)',
          colorBgContainer: '#ffffff',
          colorBgLayout: 'transparent',
          colorFillAlter: '#fafafa',
          colorFillSecondary: '#e5e5ea',
          fontSize: 13,
          fontSizeSM: 12,
          fontSizeLG: 15,
          lineHeight: 1.45,
          controlHeight: 32,
          controlHeightSM: 28,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.1)',
        },
        components: {
          Menu: {
            itemHeight: 40,
            itemBorderRadius: 8,
            subMenuItemBorderRadius: 8,
            iconSize: 16,
            collapsedIconSize: 16,
            groupTitleFontSize: 11,
            itemColor: 'rgba(29, 29, 31, 0.9)',
            itemSelectedColor: '#007aff',
            itemActiveBg: 'rgba(0, 122, 255, 0.12)',
            itemHoverBg: 'rgba(0, 0, 0, 0.04)',
            itemSelectedBg: 'rgba(0, 122, 255, 0.12)',
            groupTitleColor: 'rgba(60, 60, 67, 0.55)',
          },
          Card: { paddingLG: 16, boxShadow: 'none' },
          Table: {
            cellPaddingBlock: 8,
            cellPaddingInline: 12,
            fontSize: 13,
            headerColor: 'rgba(60, 60, 67, 0.55)',
            rowHoverBg: 'rgba(0, 0, 0, 0.02)',
          },
          Tabs: {
            cardHeight: 36,
            itemColor: 'rgba(60, 60, 67, 0.55)',
            itemSelectedColor: '#007aff',
            titleFontSize: 13,
            inkBarColor: '#007aff',
          },
          Button: { controlHeight: 32, fontWeight: 500, borderRadius: 10, primaryShadow: 'none' },
          Input: { activeBorderColor: '#007aff', hoverBorderColor: 'rgba(60, 60, 67, 0.28)' },
          Select: { optionSelectedBg: 'rgba(0, 122, 255, 0.1)' },
          Form: { labelFontSize: 12, labelColor: 'rgba(60, 60, 67, 0.75)' },
          Modal: { contentBg: '#ffffff', titleFontSize: 15, titleLineHeight: 1.4 },
          Drawer: { colorBgElevated: '#e8e8ed' },
          Tag: { defaultBg: '#e5e5ea', defaultColor: 'rgba(60, 60, 67, 0.85)', borderRadiusSM: 6 },
          Alert: { borderRadiusLG: 12 },
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
