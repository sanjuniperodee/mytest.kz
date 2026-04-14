import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { useUpdateProfile } from '../api/hooks/useProfile';
import {
  getStoredThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../lib/theme';

const LANGUAGES = [
  { code: 'kk', label: 'Қазақша', flag: '🇰🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function IconSystem() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

const THEME_OPTIONS: { value: ThemePreference; labelKey: string; Icon: typeof IconSun }[] = [
  { value: 'light', labelKey: 'settings.themeLight', Icon: IconSun },
  { value: 'dark', labelKey: 'settings.themeDark', Icon: IconMoon },
  { value: 'system', labelKey: 'settings.themeAuto', Icon: IconSystem },
];

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { logout, refreshUser } = useAuth();
  const updateProfile = useUpdateProfile();
  const [themePref, setThemePref] = useState<ThemePreference>(getStoredThemePreference);

  const handleThemeChange = (pref: ThemePreference) => {
    setThemePreference(pref);
    setThemePref(pref);
  };

  const handleLanguageChange = async (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    try {
      await updateProfile.mutateAsync({ preferredLanguage: lang });
      await refreshUser();
    } catch {
      /* noop */
    }
  };

  return (
    <div className="page">
      {/* Title */}
      <div className="page-hero" style={{ padding: '20px 22px', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          {t('settings.title')}
        </h1>
      </div>

      {/* Theme */}
      <div className="section">
        <div className="section-title">{t('settings.theme')}</div>

        <div className="surface" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {THEME_OPTIONS.map((opt, i) => {
            const isActive = themePref === opt.value;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleThemeChange(opt.value)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: isActive ? 'var(--accent-surface)' : 'transparent',
                  borderBottom: i < THEME_OPTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 150ms var(--ease)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)', display: 'flex' }}>
                    <Icon />
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--accent-light)' : 'var(--text-primary)',
                    transition: 'color 150ms var(--ease)',
                  }}>
                    {t(opt.labelKey)}
                  </span>
                </div>
                {isActive && (
                  <div style={{
                    width: 22, height: 22, borderRadius: 'var(--r-full)',
                    background: 'var(--accent)', color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px var(--accent-glow)',
                  }}>
                    <CheckIcon />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Language */}
      <div className="section">
        <div className="section-title">{t('settings.language')}</div>

        <div className="surface" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {LANGUAGES.map((lang, i) => {
            const isActive = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: isActive ? 'var(--accent-surface)' : 'transparent',
                  borderBottom: i < LANGUAGES.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 150ms var(--ease)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{lang.flag}</span>
                  <span style={{
                    fontSize: 14, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--accent-light)' : 'var(--text-primary)',
                    transition: 'color 150ms var(--ease)',
                  }}>
                    {lang.label}
                  </span>
                </div>
                {isActive && (
                  <div style={{
                    width: 22, height: 22, borderRadius: 'var(--r-full)',
                    background: 'var(--accent)', color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px var(--accent-glow)',
                  }}>
                    <CheckIcon />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* About */}
      <div className="section">
        <div className="section-title">{t('settings.about')}</div>

        <div className="surface" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px',
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t('settings.version')}</span>
            <span className="badge badge-neutral">1.0.0</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={() => { logout(); window.location.href = '/login'; }}
        className="btn btn-danger"
        style={{ marginTop: 8 }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {t('settings.logout')}
      </button>
    </div>
  );
}
