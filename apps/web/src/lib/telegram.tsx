import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface TelegramWebApp {
  /** Версия клиента Telegram, напр. "6.0" — в 6+ showPopup/showConfirm могут быть недоступны */
  version?: string;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    enable: () => void;
    disable: () => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  isTelegram: boolean;
}

const TelegramContext = createContext<TelegramContextValue>({
  webApp: null,
  isTelegram: false,
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const isTelegram = !!webApp;

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setWebApp(tg);
    }
  }, []);

  return (
    <TelegramContext.Provider value={{ webApp, isTelegram }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}

/**
 * В обычном браузере часто подгружается telegram-web-app.js, но initData пустой —
 * вызовы showConfirm/showAlert бросают WebAppMethodUnsupported.
 * В WebApp 6.0+ showPopup может быть отключён — тоже не вызываем SDK.
 */
function useNativeDialogInsteadOfTelegramPopup(webApp: TelegramWebApp | null): boolean {
  if (!webApp) return true;
  if (typeof webApp.initData !== 'string' || webApp.initData.length === 0) return true;
  const v = webApp.version;
  if (!v) return false;
  const major = parseInt(v.split('.')[0], 10);
  return Number.isFinite(major) && major >= 6;
}

/**
 * showConfirm/showPopup не поддерживаются в некоторых версиях WebApp (например 6.0) —
 * падают синхронно; в браузере без initData — то же самое. Используем window.confirm.
 */
export function safeShowConfirm(
  webApp: TelegramWebApp | null,
  message: string,
  onResult: (confirmed: boolean) => void,
): void {
  if (!webApp || useNativeDialogInsteadOfTelegramPopup(webApp)) {
    onResult(typeof window !== 'undefined' && window.confirm(message));
    return;
  }
  try {
    webApp.showConfirm(message, onResult);
  } catch {
    onResult(typeof window !== 'undefined' && window.confirm(message));
  }
}

/** Аналогично для showAlert. */
export function safeShowAlert(webApp: TelegramWebApp | null, message: string): void {
  if (!webApp || useNativeDialogInsteadOfTelegramPopup(webApp)) {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  try {
    webApp.showAlert(message);
  } catch {
    if (typeof window !== 'undefined') window.alert(message);
  }
}
