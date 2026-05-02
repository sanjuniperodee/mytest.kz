export const THEME_STORAGE_KEY = 'mytest-theme';
const LEGACY_THEME_KEY = 'bilimland-theme';
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemePreference = 'light' | 'dark' | 'system';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getCookieThemePreference(): ThemePreference | null {
  try {
    const value = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${THEME_STORAGE_KEY}=`))
      ?.split('=')[1];
    const decoded = value ? decodeURIComponent(value) : null;
    return isThemePreference(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function setCookieThemePreference(pref: ThemePreference) {
  try {
    document.cookie = `${THEME_STORAGE_KEY}=${encodeURIComponent(pref)}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function getStoredThemePreference(): ThemePreference {
  try {
    let v = localStorage.getItem(THEME_STORAGE_KEY);
    if (!v) {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (isThemePreference(legacy)) {
        localStorage.setItem(THEME_STORAGE_KEY, legacy);
        v = legacy;
      }
    }
    if (isThemePreference(v)) return v;
  } catch {
    /* ignore */
  }
  const cookiePref = getCookieThemePreference();
  if (cookiePref) return cookiePref;
  return 'dark';
}

export function getEffectiveTheme(preference?: ThemePreference): 'light' | 'dark' {
  const p = preference ?? getStoredThemePreference();
  if (p === 'light') return 'light';
  if (p === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyDocumentTheme() {
  const theme = getEffectiveTheme();
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

function onSystemSchemeChange() {
  if (getStoredThemePreference() === 'system') applyDocumentTheme();
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  setCookieThemePreference(pref);
  applyDocumentTheme();
}

export function initTheme() {
  applyDocumentTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onSystemSchemeChange);
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) applyDocumentTheme();
  });
}
