import { getNeonAuthToken } from '@/lib/neonAuth';
import { tngServiceUrl } from '@/lib/tngServiceOrigin';

const DISPLAY_TARGET_BASE = tngServiceUrl('/standalone-display');

async function request(method, { gameId = '', roomCode = '', forceRefresh = false } = {}) {
  const token = await getNeonAuthToken({ forceRefresh }).catch(() => '');
  if (!token) return { ok: false, displayAttached: false, reason: 'no-auth' };

  const response = await fetch(DISPLAY_TARGET_BASE, {
    method,
    keepalive: method === 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body:
      method === 'POST'
        ? JSON.stringify({
            gameId: String(gameId || '').trim(),
            roomCode: String(roomCode || '').trim().toUpperCase(),
          })
        : undefined,
  }).catch(() => null);

  if (response?.status === 401 && !forceRefresh) {
    return request(method, { gameId, roomCode, forceRefresh: true });
  }

  if (!response) {
    return { ok: false, displayAttached: false, reason: 'network' };
  }

  const payload = await response.json().catch(() => ({}));
  return {
    ...payload,
    ok: response.ok && payload?.ok !== false,
  };
}

export function claimStandaloneDisplay(gameId, roomCode) {
  const code = String(roomCode || '').trim().toUpperCase();
  const game = String(gameId || '').trim();

  if (!game || !/^[A-Z0-9]{4,8}$/.test(code)) {
    return Promise.resolve({
      ok: false,
      displayAttached: false,
      reason: 'bad-room',
    });
  }

  return request('POST', { gameId: game, roomCode: code });
}

export function releaseStandaloneDisplay() {
  return request('DELETE');
}
