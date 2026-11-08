const INVITE = /^\/dashboard\/community\/invite\/[0-9a-f-]{36}$/i;
const KEY = 'mytest-pending-invite';
const NEXT_KEY = 'mytest-login-next';
/** Куда можно вернуть после входа: только свои страницы кабинета и экзамена. */
const NEXT_ALLOWED = /^\/(dashboard|exam)(\/[A-Za-z0-9._~\-/]*)?(\?[A-Za-z0-9._~\-=&%+]*)?$/;
const NEXT_TTL_MS = 60 * 60 * 1000;

export function rememberInvite(path: string) {
  if (INVITE.test(path)) sessionStorage.setItem(KEY, path);
}

/** Безопасный путь возврата или null (чужой домен, `//`, логин и т.п. отбрасываются). */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value.length > 300 || value.startsWith('//')) return null;
  return NEXT_ALLOWED.test(value) ? value : null;
}

/**
 * Запоминает, куда человек шёл до входа: тест, тариф, разбор. Без этого все
 * кнопки «Пробный ЕНТ бесплатно» и «Оплатить» после логина вели на общий дашборд.
 */
export function rememberLoginNext(raw: string | null | undefined) {
  if (typeof window === 'undefined') return;
  const path = safeNextPath(raw);
  if (!path) return;
  try {
    localStorage.setItem(NEXT_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Private mode etc. — просто вернёмся на дашборд.
  }
}

function readLoginNext(): string | null {
  try {
    const raw = localStorage.getItem(NEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path?: string; at?: number };
    if (!parsed.at || Date.now() - parsed.at > NEXT_TTL_MS) return null;
    return safeNextPath(parsed.path);
  } catch {
    return null;
  }
}

export function clearLoginNext() {
  try {
    localStorage.removeItem(NEXT_KEY);
  } catch {
    // ignore
  }
}

/**
 * После входа несколько мест зовут loginDestination() почти одновременно
 * (кнопка входа и эффект страницы логина). Сохранённый путь одноразовый, поэтому
 * держим выданный ответ несколько секунд, чтобы второй вызов не увёл на дашборд.
 */
let consumed: { path: string; at: number } | null = null;
const CONSUMED_WINDOW_MS = 15_000;

export function loginDestination() {
  if (typeof window === 'undefined') return '/dashboard';
  const invite = sessionStorage.getItem(KEY);
  if (invite && INVITE.test(invite)) return invite;
  if (consumed && Date.now() - consumed.at < CONSUMED_WINDOW_MS) return consumed.path;
  const next = readLoginNext();
  if (next) {
    clearLoginNext();
    consumed = { path: next, at: Date.now() };
    return next;
  }
  return '/dashboard';
}

export function clearInviteDestination() { sessionStorage.removeItem(KEY); }

/** Ссылка на вход, после которого человек попадёт на `next`. */
export function loginHref(next: string, source?: string): string {
  const params = new URLSearchParams();
  if (source) params.set('source', source);
  params.set('next', next);
  return `/login?${params.toString()}`;
}

/** Старт бесплатного пробного ЕНТ: страница сама находит ЕНТ и открывает выбор профиля. */
export const START_ENT_PATH = '/dashboard/start';
