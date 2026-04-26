import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './api/hooks/useAuth';
import { TelegramProvider } from './lib/telegram';
import { LandingPage } from './pages/LandingPage';
import { LandingPageV3 } from './pages/v3/LandingPageV3';
import { HomePage } from './pages/HomePage';
import { ExamPage } from './pages/ExamPage';
import { TestPage } from './pages/TestPage';
import { ReviewPage } from './pages/ReviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { MistakesPage } from './pages/MistakesPage';
import { AdmissionChancePage } from './pages/AdmissionChancePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { ChannelGatePage } from './pages/ChannelGatePage';
import { PaywallPage } from './pages/PaywallPage';
import { Spinner } from './components/common/Spinner';
import { NavBar } from './components/common/NavBar';
import { WhatsAppFab } from './components/common/WhatsAppFab';

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
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/v3" element={<LandingPageV3 />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/channel-gate" element={<ChannelGatePage />} />
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
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TelegramProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TelegramProvider>
    </QueryClientProvider>
  );
}
