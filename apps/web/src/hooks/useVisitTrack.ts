import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';

const CONSENT_KEY = 'blm_cookie_consent';
const CONSENT_EVENT = 'blm_cookie_consent_changed';

export function useVisitTrack() {
  const location = useLocation();
  const [hasConsent, setHasConsent] = useState(() => getCookieConsent());

  useEffect(() => {
    const syncConsent = () => setHasConsent(getCookieConsent());
    window.addEventListener('storage', syncConsent);
    window.addEventListener(CONSENT_EVENT, syncConsent);
    return () => {
      window.removeEventListener('storage', syncConsent);
      window.removeEventListener(CONSENT_EVENT, syncConsent);
    };
  }, []);

  useEffect(() => {
    if (!hasConsent) return;

    const landingPath = `${location.pathname}${location.search}`;
    const trackedKey = `blm_visit_tracked:${landingPath}`;
    if (sessionStorage.getItem(trackedKey) === 'true') return;
    sessionStorage.setItem(trackedKey, 'true');

    const query = new URLSearchParams(location.search);

    analyticsApi.recordVisit({
      source: query.get('utm_source') || undefined,
      medium: query.get('utm_medium') || undefined,
      campaign: query.get('utm_campaign') || undefined,
      landingPath,
      referrer: document.referrer || undefined,
    }).catch(() => {
      sessionStorage.removeItem(trackedKey);
    });
  }, [hasConsent, location.pathname, location.search]);
}

export function getCookieConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'true';
}

export function setCookieConsent(granted: boolean) {
  localStorage.setItem(CONSENT_KEY, granted ? 'true' : 'false');
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
