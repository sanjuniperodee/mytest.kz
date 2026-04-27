import { useEffect } from 'react';
import { analyticsApi } from '../api/analytics';

const CONSENT_KEY = 'blm_cookie_consent';

export function useVisitTrack() {
  useEffect(() => {
    // Check if already consented
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent !== 'true') return;

    // Check for existing visitor ID
    const existingVid = document.cookie.match(/blm_vid=([^;]+)/)?.[1];

    analyticsApi.recordVisit({
      visitorId: existingVid,
      source: 'web',
      landingPath: window.location.pathname,
      referrer: document.referrer || undefined,
    }).catch(() => {
      // Silently ignore errors
    });
  }, []);
}

export function getCookieConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'true';
}

export function setCookieConsent(granted: boolean) {
  localStorage.setItem(CONSENT_KEY, granted ? 'true' : 'false');
}
