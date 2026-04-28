import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './api/hooks/useAuth';
import { TelegramProvider } from './lib/telegram';
import { Spinner } from './components/common/Spinner';
import { NavBar } from './components/common/NavBar';
import { WhatsAppFab } from './components/common/WhatsAppFab';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LandingPageV3 = lazy(() => import('./pages/v3/LandingPageV3').then(m => ({ default: m.LandingPageV3 })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ExamPage = lazy(() => import('./pages/ExamPage').then(m => ({ default: m.ExamPage })));
const TestPage = lazy(() => import('./pages/TestPage').then(m => ({ default: m.TestPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const MistakesPage = lazy(() => import('./pages/MistakesPage').then(m => ({ default: m.MistakesPage })));
const AdmissionChancePage = lazy(() => import('./pages/AdmissionChancePage').then(m => ({ default: m.AdmissionChancePage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ChannelGatePage = lazy(() => import('./pages/ChannelGatePage').then(m => ({ default: m.ChannelGatePage })));
const PaywallPage = lazy(() => import('./pages/PaywallPage').then(m => ({ default: m.PaywallPage })));
const AdminPanelRedirect = lazy(() => import('./pages/AdminPanelRedirect').then(m => ({ default: m.AdminPanelRedirect })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isChannelMember) return <Navigate to="/channel-gate" replace />;

  return (
    <>
      {children}
      <WhatsAppFab />
    </>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner fullScreen />;
  if (!user || !user.isAdmin) return <Navigate to="/app" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  function TabsLayout() {
    return (
      <div className="app-shell">
        <NavBar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <Suspense fallback={<Spinner fullScreen />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/v3" element={<LandingPageV3 />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/channel-gate" element={<ChannelGatePage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPanelRedirect />
            </AdminRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <TabsLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/app" element={<HomePage />} />
          <Route
            path="/profile"
            element={<ProfilePage />}
          />
          <Route
            path="/settings"
            element={<SettingsPage />}
          />
          <Route path="/admission-chance" element={<AdmissionChancePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="/paywall" element={<PaywallPage />} />
        </Route>
        <Route
          path="/exam/:examId"
          element={
            <ProtectedRoute>
              <ExamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test/:sessionId"
          element={
            <ProtectedRoute>
              <TestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test/:sessionId/review"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TelegramProvider>
        <AuthProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </TelegramProvider>
    </QueryClientProvider>
  );
}
