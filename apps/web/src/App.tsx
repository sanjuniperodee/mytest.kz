import { lazy, Suspense, useState, type ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './api/hooks/useAuth';
import { TelegramProvider } from './lib/telegram';
import { Spinner } from './components/common/Spinner';
import { NavBar } from './components/common/NavBar';
import { WhatsAppFab } from './components/common/WhatsAppFab';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { getCookieConsent, setCookieConsent, useVisitTrack } from './hooks/useVisitTrack';

const CHUNK_RELOAD_PREFIX = 'mytest:chunk-reload:';

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

function lazyPage<T extends ComponentType<Record<string, never>>>(
  key: string,
  loader: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await loader();
      sessionStorage.removeItem(`${CHUNK_RELOAD_PREFIX}${key}`);
      return module;
    } catch (error) {
      const storageKey = `${CHUNK_RELOAD_PREFIX}${key}`;
      if (isChunkLoadError(error) && sessionStorage.getItem(storageKey) !== '1') {
        sessionStorage.setItem(storageKey, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

const LandingPage = lazyPage('landing', () => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LandingPageV3 = lazyPage('landing-v3', () =>
  import('./pages/v3/LandingPageV3').then(m => ({ default: m.LandingPageV3 })),
);
const HomePage = lazyPage('home', () => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ExamPage = lazyPage('exam', () => import('./pages/ExamPage').then(m => ({ default: m.ExamPage })));
const TestPage = lazyPage('test', () => import('./pages/TestPage').then(m => ({ default: m.TestPage })));
const ReviewPage = lazyPage('review', () => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })));
const ProfilePage = lazyPage('profile', () => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const StatsPage = lazyPage('stats', () => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const MistakesPage = lazyPage('mistakes', () => import('./pages/MistakesPage').then(m => ({ default: m.MistakesPage })));
const AdmissionChancePage = lazyPage('admission-chance', () =>
  import('./pages/AdmissionChancePage').then(m => ({ default: m.AdmissionChancePage })),
);
const LeaderboardPage = lazyPage('leaderboard', () =>
  import('./pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })),
);
const SettingsPage = lazyPage('settings', () => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const LoginPage = lazyPage('login', () => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ChannelGatePage = lazyPage('channel-gate', () =>
  import('./pages/ChannelGatePage').then(m => ({ default: m.ChannelGatePage })),
);
const PaywallPage = lazyPage('paywall', () => import('./pages/PaywallPage').then(m => ({ default: m.PaywallPage })));
const AdminPanelRedirect = lazyPage('admin-redirect', () =>
  import('./pages/AdminPanelRedirect').then(m => ({ default: m.AdminPanelRedirect })),
);

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
  useVisitTrack();

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
          <Route path="/stats" element={<StatsPage />} />
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
      <CookieConsentBanner />
    </Suspense>
  );
}

function CookieConsentBanner() {
  const { i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(() => localStorage.getItem('blm_cookie_consent') == null);

  if (!isVisible || getCookieConsent()) return null;

  const text =
    i18n.language === 'kk'
      ? 'Біз келулерді есептеу және тәжірибені жақсарту үшін cookie пайдаланамыз. Ешқандай жеке деректер бақыланбайды.'
      : i18n.language === 'en'
      ? 'We use cookies to count visits and improve your experience. No personal data is tracked.'
      : 'Мы используем cookies для учёта посещений и улучшения опыта. Никакие персональные данные не отслеживаются.';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white/95 px-4 py-3 text-sm shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-4xl text-slate-700 dark:text-slate-200">{text}</p>
        <button
          type="button"
          onClick={() => {
            setCookieConsent(true);
            setIsVisible(false);
          }}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-slate-900 px-5 font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          OK
        </button>
      </div>
    </div>
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
