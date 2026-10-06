// Rodeo Rumble — client side of the /rr-live party relay.
import { getNeonAuthToken } from '@/lib/neonAuth';
import { tngServiceUrl, tngWebSocketUrl } from '@/lib/tngServiceOrigin';

const WS_URL = () => (import.meta.env && import.meta.env.VITE_RR_LIVE_URL) || tngWebSocketUrl('/rr-live');

export function rrConnect({ hello, onMessage, onStatus }) {
  let ws = null;
  let closed = false;
  let retry = 0;
  let timer = null;

  const schedule = () => {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(open, Math.min(5000, 400 * 2 ** retry++));
  };

  const open = () => {
    if (closed) return;
    onStatus?.('connecting');
    try { ws = new WebSocket(WS_URL()); } catch { schedule(); return; }
    ws.onopen = async () => {
      retry = 0;
      onStatus?.('open');
      try {
        const authToken = await getNeonAuthToken().catch(() => '');
        const first = await hello?.({ authToken });
        if (first && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(first));
      } catch {
        try { ws?.close(); } catch { /* ignore */ }
      }
    };
    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      onMessage?.(msg);
    };
    ws.onclose = (event) => {
      onStatus?.('closed');
      if (!closed && event.code !== 4000) schedule();
    };
    ws.onerror = () => { /* onclose follows */ };
  };

  open();
  return {
    send(msg) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
        return true;
      }
      return false;
    },
    close() {
      closed = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* ignore */ }
    },
    get open() { return !!ws && ws.readyState === WebSocket.OPEN; },
  };
}

export async function resolveRodeoRumbleRoom(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(c)) return null;
  try {
    const response = await fetch(tngServiceUrl(`/rr-api/resolve?code=${encodeURIComponent(c)}`), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json();
    return data?.live ? data : null;
  } catch {
    return null;
  }
}

export async function setRodeoDisplayTarget(roomCode) {
  const authToken = await getNeonAuthToken().catch(() => '');
  if (!authToken) return { displayAttached: false };
  const response = await fetch(tngServiceUrl('/standalone-display'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ gameId: 'rodeo-rumble', roomCode }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Could not attach the Rodeo Rumble Game Display.');
  return data;
}

export async function clearRodeoDisplayTarget() {
  const authToken = await getNeonAuthToken().catch(() => '');
  if (!authToken) return;
  await fetch(tngServiceUrl('/standalone-display'), {
    method: 'DELETE',
    headers: { Accept: 'application/json', Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  }).catch(() => {});
}

export const rrSeat = {
  get(code) { try { return JSON.parse(localStorage.getItem(`rr_seat_${code}`) || 'null'); } catch { return null; } },
  set(code, value) { try { localStorage.setItem(`rr_seat_${code}`, JSON.stringify(value)); } catch { /* ignore */ } },
  clear(code) { try { localStorage.removeItem(`rr_seat_${code}`); } catch { /* ignore */ } },
};

export const BITS = { jump: 1, light: 2, heavy: 4, dodge: 8 };
export const packInput = (state) => ({
  t: 'i',
  b: (state.jump ? 1 : 0) | (state.light ? 2 : 0) | (state.heavy ? 4 : 0) | (state.dodge ? 8 : 0),
  x: Math.round(state.x * 100),
  y: Math.round(state.y * 100),
});