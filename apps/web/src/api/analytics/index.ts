import axios from 'axios';
import { resolveApiBaseUrl } from '../../lib/resolveApiBaseUrl';

const API_BASE = resolveApiBaseUrl({
  viteApiUrl: import.meta.env.VITE_API_URL,
  viteSiteUrl:
    import.meta.env.VITE_SITE_URL ||
    (import.meta.env.PROD ? 'https://my-test.kz' : undefined),
  viteProd: import.meta.env.PROD,
});

const noAuthClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export const analyticsApi = {
  recordVisit: (params: {
    visitorId?: string;
    source?: string;
    medium?: string;
    campaign?: string;
    referrer?: string;
    landingPath?: string;
  }) => noAuthClient.post('/analytics/visit', params),
};
