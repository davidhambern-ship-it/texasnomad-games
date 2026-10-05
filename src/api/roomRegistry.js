const IS_RAILWAY_TEMP_HOST =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.up.railway.app');

const ROOM_REGISTRY_BASE =
  import.meta.env.VITE_TNG_ROOM_REGISTRY_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/tng-rooms'
    : 'https://tng-live-production.up.railway.app/tng-rooms');

export class TngRoomRegistryError extends Error {
  constructor(message, { code = 'ROOM_REGISTRY_ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'TngRoomRegistryError';
    this.code = code;
    this.status = status;
  }
}

export async function resolveTngRoom(roomCode) {
  const code = String(roomCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return null;

  let response;
  try {
    response = await fetch(
      `${ROOM_REGISTRY_BASE}/resolve?code=${encodeURIComponent(code)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      },
    );
  } catch {
    throw new TngRoomRegistryError(
      'TNG could not reach the room registry. Check your connection and try again.',
      { code: 'NETWORK' },
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new TngRoomRegistryError(
      payload?.error?.message || 'TNG could not resolve that room.',
      {
        code: payload?.error?.code || 'ROOM_REGISTRY_ERROR',
        status: response.status,
      },
    );
  }

  return payload?.room || null;
}
