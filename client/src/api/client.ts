/**
 * Klien HTTP tipis untuk REST API (blueprint bagian 7).
 * Token disimpan di localStorage dan dilampirkan sebagai header Authorization.
 */

const TOKEN_KEY = 'gantt.token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Pesan validasi per field dari server, bila ada. */
  get fieldErrors(): Record<string, string[]> {
    const fields = this.details.fields;
    return fields && typeof fields === 'object' ? (fields as Record<string, string[]>) : {};
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage bisa tidak tersedia (mode privat); aplikasi tetap berjalan tanpa sesi tersimpan.
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('gantt:unauthorized'));
    }

    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Terjadi kesalahan saat menghubungi server.',
      error?.details ?? {},
    );
  }

  return payload as T;
}
