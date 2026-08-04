const BASE_URL = import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:8080';

const ACCESS_TOKEN_KEY = 'sendagomail_access_token';
const REFRESH_TOKEN_KEY = 'sendagomail_refresh_token';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Mencegah beberapa request 401 memicu banyak panggilan /auth/refresh bersamaan —
// semua request yang gagal saat refresh sedang berjalan menunggu Promise yang sama.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokenStorage.clear();
        return false;
      }
      const body = await res.json();
      tokenStorage.setTokens(body.accessToken, body.refreshToken);
      return true;
    } catch {
      return false;
    }
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false } = options;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!skipAuth) {
      const token = tokenStorage.getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  // Access token kedaluwarsa — coba refresh sekali, lalu ulangi request asli.
  if (res.status === 401 && !skipAuth && tokenStorage.getRefreshToken()) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, errorBody.message ?? 'Terjadi kesalahan');
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

// PUT sungguhan (bukan alias PATCH) — dipakai endpoint yang secara semantik full-replace,
// mis. upsert template. Nama terpisah dari api.put di atas supaya tidak mengubah perilaku
// existing callers.
export async function apiPutJson<T>(path: string, body: unknown): Promise<T> {
  const token = tokenStorage.getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, errorBody.message ?? 'Terjadi kesalahan');
  }
  return res.json() as Promise<T>;
}

// Upload file (multipart/form-data) — TIDAK bisa lewat apiRequest() karena itu selalu
// set Content-Type: application/json. Browser yang menentukan boundary multipart sendiri,
// jadi Content-Type SENGAJA tidak di-set manual di sini.
export async function apiUploadFile<T>(path: string, fieldName: string, file: File): Promise<T> {
  const token = tokenStorage.getAccessToken();
  const formData = new FormData();
  formData.append(fieldName, file);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, errorBody.message ?? 'Terjadi kesalahan');
  }
  return res.json() as Promise<T>;
}

// Ambil response biner (mis. preview logo) sebagai object URL siap dipakai di <img src>.
// Endpoint gambar butuh Authorization header, jadi tidak bisa langsung dipakai sebagai <img src>.
export async function apiGetImageObjectUrl(path: string): Promise<string | null> {
  const token = tokenStorage.getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
