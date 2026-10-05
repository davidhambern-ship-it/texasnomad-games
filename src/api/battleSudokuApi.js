import { getNeonAuthToken } from '@/lib/neonAuth';
import { tngServiceUrl } from '@/lib/tngServiceOrigin';
// Client for BattleSudoku party rooms (server.mjs → server/battleSudokuApi.mjs)
export const BS_API_BASE = tngServiceUrl('/bs-api');

export class BSApiError extends Error {
  constructor(message, status = 0, code = 'ERROR') { super(message); this.name = 'BSApiError'; this.status = status; this.code = code; }
}
async function call(path, { method = 'GET', body, token, forceRefresh = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-BS-Token'] = token;

  const authToken = await getNeonAuthToken({ forceRefresh }).catch(() => '');
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try { res = await fetch(`${BS_API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); }
  catch { throw new BSApiError('Can’t reach the BattleSudoku server. Check your connection.', 0, 'NETWORK'); }

  if (res.status === 401 && authToken && !forceRefresh) {
    return call(path, { method, body, token, forceRefresh: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BSApiError(data?.error?.message || 'Something went wrong.', res.status, data?.error?.code || 'ERROR');
  return data;
}
export const bsApi = {
  createRoom: () => call('/rooms', { method: 'POST', body: {} }),
  getRoom: (code, token) => call(`/rooms/${encodeURIComponent(code)}`, { token }),
  action: (code, token, action, payload = {}) => call(`/rooms/${encodeURIComponent(code)}/action`, { method: 'POST', token, body: { action, ...payload } }),
};
export const bsSeat = {
  get(code) { try { return JSON.parse(localStorage.getItem(`bs_seat_${code}`) || 'null'); } catch { return null; } },
  set(code, v) { try { localStorage.setItem(`bs_seat_${code}`, JSON.stringify(v)); } catch { /* private mode */ } },
  clear(code) { try { localStorage.removeItem(`bs_seat_${code}`); } catch { /* ignore */ } },
};
export async function resolveBattleSudokuRoom(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(c)) return null;
  try { const d = await bsApi.getRoom(c); return d?.room || null; } catch { return null; }
}
