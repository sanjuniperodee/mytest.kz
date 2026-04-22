import axios from 'axios';
import { resolveApiBaseUrl } from '../lib/resolveApiBaseUrl';

const API_BASE = resolveApiBaseUrl({
  viteApiUrl: import.meta.env.VITE_API_URL,
  viteSiteUrl:
    import.meta.env.VITE_SITE_URL ||
    (import.meta.env.PROD ? 'https://my-test.kz' : undefined),
  viteProd: import.meta.env.PROD,
});

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = localStorage.getItem('admin_accessToken');
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  localStorage.setItem('admin_accessToken', access);
  localStorage.setItem('admin_refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem('admin_accessToken');
  localStorage.removeItem('admin_refreshToken');
}

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error?.config;
    if (!originalRequest) return Promise.reject(error);

    const requestUrl = String(originalRequest.url || '');
    const isRefreshCall = requestUrl.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      const refresh = localStorage.getItem('admin_refreshToken');
      if (!refresh) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
        setTokens(data.accessToken, data.refreshToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
