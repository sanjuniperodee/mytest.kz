export const THEME_STORAGE_KEY = 'bilimland-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

export function getStoredThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function getEffectiveTheme(preference?: ThemePreference): 'light' | 'dark' {
  const p = preference ?? getStoredThemePreference();
  if (p === 'light') return 'light';
  if (p === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyDocumentTheme() {
  document.documentElement.setAttribute('data-theme', getEffectiveTheme());
}

function onSystemSchemeChange() {
  if (getStoredThemePreference() === 'system') applyDocumentTheme();
}

export function setThemePreference(pref: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, pref);
  applyDocumentTheme();
}

export function initTheme() {
  applyDocumentTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onSystemSchemeChange);
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) applyDocumentTheme();
  });
}
