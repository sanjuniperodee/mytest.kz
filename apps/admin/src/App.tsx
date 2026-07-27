import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ConfigProvider,
  Layout,
  theme,
  Spin,
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Grid,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { api, clearTokens, revokeCurrentSession } from './api/client';
import {
  buildMenuItems,
  navKeyFromPath,
  pageMetaFromPath,
  pathForKey,
} from './lib/navigation';
import { SiderNav } from './components/SiderNav';
import { LoginPage } from './pages/LoginPage';

// Каждая страница — отдельный чанк: вместо одного бандла на ~2 МБ грузим только
// открытый раздел, остальное подтягивается по мере навигации.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const EntTrialsAnalyticsPage = lazy(() => import('./pages/EntTrialsAnalyticsPage').then((m) => ({ default: m.EntTrialsAnalyticsPage })));
const UniversityThresholdsPage = lazy(() => import('./pages/UniversityThresholdsPage').then((m) => ({ default: m.UniversityThresholdsPage })));
const AdmissionChancePage = lazy(() => import('./pages/AdmissionChancePage').then((m) => ({ default: m.AdmissionChancePage })));
const ExplanationsPage = lazy(() => import('./pages/ExplanationsPage').then((m) => ({ default: m.ExplanationsPage })));
const QuestionAppealsPage = lazy(() => import('./pages/QuestionAppealsPage').then((m) => ({ default: m.QuestionAppealsPage })));
const AiLessonNotesPage = lazy(() => import('./pages/AiLessonNotesPage').then((m) => ({ default: m.AiLessonNotesPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const UserDetailPage = lazy(() => import('./pages/UserDetailPage').then((m) => ({ default: m.UserDetailPage })));
const QuestionsPage = lazy(() => import('./pages/QuestionsPage').then((m) => ({ default: m.QuestionsPage })));
const ExamCatalogPage = lazy(() => import('./pages/ExamCatalogPage').then((m) => ({ default: m.ExamCatalogPage })));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage })));
const FinancePage = lazy(() => import('./pages/FinancePage').then((m) => ({ default: m.FinancePage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const LandingSettingsPage = lazy(() => import('./pages/LandingSettingsPage').then((m) => ({ default: m.LandingSettingsPage })));
const LeadsPage = lazy(() => import('./pages/LeadsPage').then((m) => ({ default: m.LeadsPage })));

const { Sider, Content, Header } = Layout;
const { useBreakpoint } = Grid;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

interface AdminUser {
  isAdmin: boolean;
  firstName?: string | null;
  lastName?: string | null;
  telegramUsername?: string | null;
  phone?: string | null;
}

function RouteFallback() {
  return (
    <div className="admin-route-loading">
      <Spin />
    </div>
  );
}

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const isMobile = !screens.lg;
  const selectedKey = useMemo(() => navKeyFromPath(location.pathname), [location.pathname]);
  const pageMeta = useMemo(() => pageMetaFromPath(location.pathname), [location.pathname]);
  const menuItems = useMemo(() => buildMenuItems(), []);
  const userDisplayName = useMemo(() => {
    if (!user) return 'Администратор';
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.telegramUsername || 'Администратор';
  }, [user]);
  const userMetaLine = useMemo(() => {
    if (!user) return 'Команда MyTest';
    if (user.telegramUsername) return `@${user.telegramUsername}`;
    if (user.phone) return `+${user.phone}`;
    return 'Команда MyTest';
  }, [user]);

  const goTo = (key: string) => {
    const path = pathForKey(key);
    if (path) navigate(path);
  };

  const userMenuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'site',
        label: 'Открыть my-test.kz',
        icon: <ExportOutlined />,
        onClick: () => {
          window.open('https://my-test.kz', '_blank', 'noopener,noreferrer');
        },
      },
      {
        key: 'logout',
        label: 'Выйти',
        icon: <LogoutOutlined />,
        onClick: () => {
          void revokeCurrentSession();
          clearTokens();
          navigate('/login', { replace: true });
        },
      },
    ],
    [navigate],
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
        setUser(data as AdminUser);
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
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsedWidth={92}
        width={292}
        breakpoint="lg"
        onBreakpoint={(broken) => {
          if (broken) {
            setCollapsed(true);
            setMobileOpen(false);
          }
        }}
        className="admin-desktop-sider admin-sider"
      >
        <SiderNav
          variant="desktop"
          collapsed={collapsed}
          selectedKey={selectedKey}
          menuItems={menuItems}
          onSelect={goTo}
          userDisplayName={userDisplayName}
          userMetaLine={userMetaLine}
        />
      </Sider>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={296}
        closable={false}
        rootClassName="admin-mobile-drawer"
        styles={{ body: { padding: 0, background: 'var(--admin-sider-bg)' } }}
      >
        <SiderNav
          variant="mobile"
          selectedKey={selectedKey}
          menuItems={menuItems}
          onSelect={(key) => {
            goTo(key);
            setMobileOpen(false);
          }}
          userDisplayName={userDisplayName}
          userMetaLine={userMetaLine}
        />
      </Drawer>

      <Layout>
        <Header className="admin-top-header">
          <div className="admin-header-main">
            <Button
              type="text"
              icon={mobileOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={() => setMobileOpen((v) => !v)}
              className="admin-header-hamburger"
              aria-label="Меню"
            />
            <nav className="admin-header-crumbs" aria-label="Раздел">
              <span className="admin-header-crumb-section">{pageMeta.section}</span>
              <span className="admin-header-crumb-sep" aria-hidden>
                /
              </span>
              <span className="admin-header-crumb-page">{pageMeta.title}</span>
            </nav>
          </div>
          <div className="admin-header-actions">
            <a
              className="admin-header-link"
              href="https://my-test.kz"
              target="_blank"
              rel="noreferrer"
            >
              my-test.kz
              <ExportOutlined />
            </a>
            {!isMobile && <span className="admin-header-badge">Production</span>}
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button type="text" className="admin-header-user-btn">
                <Avatar size="small" className="admin-header-avatar">
                  {userDisplayName.slice(0, 1).toUpperCase()}
                </Avatar>
                <span className="admin-header-usercopy">
                  <strong className="admin-header-username">{userDisplayName}</strong>
                  {!isMobile && <span className="admin-header-usersub">{userMetaLine}</span>}
                </span>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content className="admin-content-wrap">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/analytics/ent" element={<EntTrialsAnalyticsPage />} />
              <Route path="/analytics/thresholds" element={<UniversityThresholdsPage />} />
              <Route path="/admission" element={<AdmissionChancePage />} />
              <Route path="/explanations" element={<ExplanationsPage />} />
              <Route path="/appeals" element={<QuestionAppealsPage />} />
              <Route path="/ai-lesson-notes" element={<AiLessonNotesPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
              <Route path="/questions" element={<QuestionsPage />} />
              <Route path="/exams" element={<ExamCatalogPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/landing-settings" element={<LandingSettingsPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
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
          borderRadius: 14,
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
          colorFillAlter: '#f5f1ea',
          colorFillSecondary: '#ece6dc',
          fontSize: 14,
          fontSizeSM: 12,
          fontSizeLG: 16,
          lineHeight: 1.45,
          controlHeight: 38,
          controlHeightSM: 32,
          fontFamily: '"Manrope", "SF Pro Text", "Segoe UI", system-ui, sans-serif',
          boxShadow: '0 8px 24px rgba(41, 51, 61, 0.08)',
          boxShadowSecondary: '0 24px 60px rgba(28, 33, 40, 0.16)',
        },
        components: {
          Menu: {
            itemHeight: 44,
            itemBorderRadius: 12,
            subMenuItemBorderRadius: 12,
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
          Card: { paddingLG: 18, boxShadow: 'none' },
          Table: {
            cellPaddingBlock: 10,
            cellPaddingInline: 14,
            fontSize: 14,
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
          Button: { controlHeight: 38, fontWeight: 600, borderRadius: 12, primaryShadow: 'none' },
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
          <Suspense fallback={<div className="admin-boot"><Spin size="large" /></div>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*" element={<AdminLayout />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
