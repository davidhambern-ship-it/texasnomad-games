import { getNeonAuthToken } from '@/lib/neonAuth';
import { tngServiceUrl } from '@/lib/tngServiceOrigin';
// Client for Word Wrangler online races (server.mjs → server/wordWranglerApi.mjs)
export const WW_API_BASE = tngServiceUrl('/ww-api');

export class WWApiError extends Error {
  constructor(message, status = 0, code = 'ERROR') { super(message); this.name = 'WWApiError'; this.status = status; this.code = code; }
}

async function call(path, { method = 'GET', body, token, forceRefresh = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-WW-Token'] = token;

  const authToken = await getNeonAuthToken({ forceRefresh }).catch(() => '');
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${WW_API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch {
    throw new WWApiError('Can’t reach the Word Wrangler server. Check your connection.', 0, 'NETWORK');
  }

  if (res.status === 401 && authToken && !forceRefresh) {
    return call(path, { method, body, token, forceRefresh: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new WWApiError(data?.error?.message || 'Something went wrong.', res.status, data?.error?.code || 'ERROR');
  return data;
}

export const wwApi = {
  createRoom: (name) => call('/rooms', { method: 'POST', body: { name } }),
  getRoom: (code, token, full = false) => call(`/rooms/${encodeURIComponent(code)}${full ? '?full=1' : ''}`, { token }),
  action: (code, token, action, payload = {}) => call(`/rooms/${encodeURIComponent(code)}/action`, { method: 'POST', token, body: { action, ...payload } }),
};

export const wwSeat = {
  get(code) { try { return JSON.parse(localStorage.getItem(`ww_seat_${code}`) || 'null'); } catch { return null; } },
  set(code, v) { try { localStorage.setItem(`ww_seat_${code}`, JSON.stringify(v)); } catch { /* private mode */ } },
  clear(code) { try { localStorage.removeItem(`ww_seat_${code}`); } catch { /* ignore */ } },
};

// Used by the central Join page: is this an open Word Wrangler room?
export async function resolveWordWranglerRoom(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(c)) return null;
  try { const d = await wwApi.getRoom(c); return d?.room ? d.room : null; } catch { return null; }
}
