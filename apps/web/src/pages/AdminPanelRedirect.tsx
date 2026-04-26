import { useEffect } from 'react';
import { Spinner } from '../components/common/Spinner';

const adminPanelBase = () => {
  const fromEnv = import.meta.env.VITE_ADMIN_PANEL_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5174';
  return 'https://admin.my-test.kz';
};

export function AdminPanelRedirect() {
  useEffect(() => {
    window.location.replace(`${adminPanelBase()}/analytics`);
  }, []);

  return <Spinner fullScreen />;
}
