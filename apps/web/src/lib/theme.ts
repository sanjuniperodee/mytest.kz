export const THEME_STORAGE_KEY = 'mytest-theme';
const LEGACY_THEME_KEY = 'bilimland-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

export function getStoredThemePreference(): ThemePreference {
  try {
    let v = localStorage.getItem(THEME_STORAGE_KEY);
    if (!v) {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
        localStorage.setItem(THEME_STORAGE_KEY, legacy);
        v = legacy;
      }
    }
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
