import { API_BASE_URL } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
};

// Lazy import to avoid circular dependency
let _getAccessToken: (() => string | null) | null = null;
let _refreshToken: (() => Promise<void>) | null = null;

export function setAuthHandlers(
  getAccessToken: () => string | null,
  refreshToken: () => Promise<void>,
) {
  _getAccessToken = getAccessToken;
  _refreshToken = refreshToken;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const token = skipAuth ? null : _getAccessToken?.();
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 → refresh token and retry once
  if (res.status === 401 && !skipAuth && _refreshToken) {
    try {
      await _refreshToken();
      const newToken = _getAccessToken?.();
      if (newToken) {
        reqHeaders['Authorization'] = `Bearer ${newToken}`;
        const retryRes = await fetch(`${API_BASE_URL}${path}`, {
          method,
          headers: reqHeaders,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!retryRes.ok) {
          const errBody = await retryRes.json().catch(() => ({})) as any;
          throw new ApiError(retryRes.status, errBody?.code ?? 'ERROR', errBody?.error ?? 'Request failed', errBody?.details);
        }
        return retryRes.json() as Promise<T>;
      }
    } catch (refreshError) {
      if (refreshError instanceof ApiError) throw refreshError;
      // Refresh failed — re-throw 401
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as any;
    throw new ApiError(res.status, errBody?.code ?? 'ERROR', errBody?.error ?? 'Request failed', errBody?.details);
  }

  return res.json() as Promise<T>;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
