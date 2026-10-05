// Client for See That?! party rooms (server.mjs → server/seeThatApi.mjs)
import { getNeonAuthToken } from '@/lib/neonAuth';

const IS_RAILWAY_TEMP_HOST =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.up.railway.app');

const ST_SERVICE_ORIGIN =
  import.meta.env.VITE_ST_SERVICE_ORIGIN ||
  (IS_RAILWAY_TEMP_HOST ? '' : 'https://tng-live-production.up.railway.app');

export const ST_API_BASE =
  import.meta.env.VITE_ST_API_BASE ||
  `${ST_SERVICE_ORIGIN}/st-api`;

export class STApiError extends Error {
  constructor(message, status = 0, code = 'ERROR') { super(message); this.name = 'STApiError'; this.status = status; this.code = code; }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-ST-Token'] = token;
  let res;
  try {
    res = await fetch(`${ST_API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch {
    throw new STApiError('Can’t reach the See That server. Check your connection.', 0, 'NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new STApiError(data?.error?.message || 'Something went wrong.', res.status, data?.error?.code || 'ERROR');
  return data;
}

export const stApi = {
  scenes: () => call('/scenes'),
  createRoom: () => call('/rooms', { method: 'POST', body: {} }),
  getRoom: (code, token) => call(`/rooms/${encodeURIComponent(code)}`, { token }),
  action: (code, token, action, payload = {}) => call(`/rooms/${encodeURIComponent(code)}/action`, { method: 'POST', token, body: { action, ...payload } }),
};

// Scene list: ask the server (it reads the scenes folder); fall back to the static index.
export async function loadSceneList() {
  try { const d = await stApi.scenes(); if (d?.scenes?.length) return d.scenes; } catch { /* offline → static list */ }
  const r = await fetch('/see-that/scenes/index.json', { cache: 'no-store' });
  const ids = r.ok ? await r.json() : [];
  const out = [];
  for (const id of ids) {
    try { const s = await (await fetch(`/see-that/scenes/${id}.json`)).json(); out.push({ id: s.id, title: s.title, image: `/see-that/scenes/${s.image}`, width: s.width, height: s.height, count: s.objects.length }); } catch { /* skip */ }
  }
  return out;
}
export async function loadScene(id) {
  const r = await fetch(`/see-that/scenes/${encodeURIComponent(id)}.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Scene not found');
  return r.json();
}

async function displayClaimRequest(method, roomCode = '', forceRefresh = false) {
  const token = await getNeonAuthToken({ forceRefresh }).catch(() => '');
  if (!token) return { ok: false, displayAttached: false, reason: 'no-auth' };

  const response = await fetch(`${ST_SERVICE_ORIGIN}/see-that-display`, {
    method,
    keepalive: method === 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify({ roomCode }) : undefined,
  }).catch(() => null);

  if (response?.status === 401 && !forceRefresh) {
    return displayClaimRequest(method, roomCode, true);
  }

  if (!response) return { ok: false, displayAttached: false, reason: 'network' };
  const payload = await response.json().catch(() => ({}));
  return { ...payload, ok: response.ok && payload?.ok !== false };
}

export function claimSeeThatDisplay(roomCode) {
  const code = String(roomCode || '').trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(code)) {
    return Promise.resolve({ ok: false, displayAttached: false, reason: 'bad-code' });
  }
  return displayClaimRequest('POST', code);
}

export function releaseSeeThatDisplay() {
  return displayClaimRequest('DELETE');
}

export const stSeat = {
  get(code) { try { return JSON.parse(localStorage.getItem(`st_seat_${code}`) || 'null'); } catch { return null; } },
  set(code, v) { try { localStorage.setItem(`st_seat_${code}`, JSON.stringify(v)); } catch { /* private mode */ } },
  clear(code) { try { localStorage.removeItem(`st_seat_${code}`); } catch { /* ignore */ } },
};

export async function resolveSeeThatRoom(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(c)) return null;
  try { const d = await stApi.getRoom(c); return d?.room ? d.room : null; } catch { return null; }
}
