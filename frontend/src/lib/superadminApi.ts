const BASE = '/api/admin';

// The CSRF token is handed back by /auth/login and /auth/me — held in memory only (never
// localStorage/sessionStorage), matching the "no readable token in JS-accessible storage" spirit of
// the session cookie itself (which is HttpOnly and never touches this module at all).
let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export class SuperadminApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (init?.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD' && csrfToken) headers['x-superadmin-csrf'] = csrfToken;

  const res = await fetch(`${BASE}${path}`, { ...init, credentials: 'include', headers });
  const isCsv = res.headers.get('content-type')?.includes('text/csv');
  if (isCsv) return (await res.blob()) as unknown as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A previously-valid session that has since idle/absolute-expired — distinct from a cold,
    // never-authenticated visit (code 'unauthenticated', handled by the route guard's redirect to
    // /login instead). Dispatched as a DOM event rather than threaded through every call site, since
    // this can happen from any page's background fetch, not just a user-initiated action.
    if (res.status === 401 && data.code === 'session_expired') {
      window.dispatchEvent(new CustomEvent('superadmin:session-expired'));
    }
    throw new SuperadminApiError(data.error || `Sorğu uğursuz oldu (${res.status})`, res.status, data.code);
  }
  return data as T;
}

// ---------- auth ----------
export interface SuperadminMe {
  email: string;
  lastLoginAt: string | null;
  passwordChangedAt: string;
  csrfToken: string;
}

export function login(email: string, password: string) {
  return req<{ email: string; csrfToken: string; lastLoginAt: string | null }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return req<{ ok: true }>('/auth/logout', { method: 'POST' });
}

export function fetchMe() {
  return req<SuperadminMe>('/auth/me');
}

export function changePassword(currentPassword: string, newPassword: string) {
  return req<{ ok: true; revokedSessions: number }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export interface SuperadminSessionRow {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  userAgentSummary: string | null;
  current: boolean;
}

export function fetchSessions() {
  return req<SuperadminSessionRow[]>('/auth/sessions');
}

export function revokeOtherSessions() {
  return req<{ ok: true; revokedSessions: number }>('/auth/sessions/revoke-others', { method: 'POST' });
}

// ---------- data pages ----------
function qs(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') usp.set(k, String(v));
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export function fetchOverview(params: Record<string, string | number | undefined>) {
  return req<any>(`/overview${qs(params)}`);
}
export function fetchTraffic(params: Record<string, string | number | undefined>) {
  return req<any>(`/traffic${qs(params)}`);
}
export function fetchFunnel(params: Record<string, string | number | undefined>) {
  return req<any>(`/funnel${qs(params)}`);
}
export function fetchSales(params: Record<string, string | number | undefined>) {
  return req<any>(`/sales${qs(params)}`);
}
export function fetchPackages(params: Record<string, string | number | undefined>) {
  return req<any>(`/packages${qs(params)}`);
}
export function fetchPayments(params: Record<string, string | number | undefined>) {
  return req<any>(`/payments${qs(params)}`);
}
export function fetchPaymentDetail(reference: string) {
  return req<any>(`/payments/${encodeURIComponent(reference)}`);
}
export function fetchAnalysisActivity(params: Record<string, string | number | undefined>) {
  return req<any>(`/analysis-activity${qs(params)}`);
}
export function fetchHealth(params: Record<string, string | number | undefined>) {
  return req<any>(`/health${qs(params)}`);
}
export function fetchSettings() {
  return req<any>('/settings');
}
export function fetchAudit(page: number) {
  return req<any>(`/audit${qs({ page })}`);
}

export function exportUrl(kind: 'sales' | 'payments', params: Record<string, string | number | undefined>): string {
  return `${BASE}/export/${kind}.csv${qs(params)}`;
}

export async function downloadCsv(kind: 'sales' | 'payments', params: Record<string, string | number | undefined>, filename: string) {
  const blob = await req<Blob>(`/export/${kind}.csv${qs(params)}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
