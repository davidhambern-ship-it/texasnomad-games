const IS_RAILWAY_TEMP_HOST =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.up.railway.app');

const DOMINO_API_BASE =
  import.meta.env.VITE_DOMINO_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/domino-api'
    : 'https://tng-live-production.up.railway.app/domino-api');

async function request(path = '', { method = 'GET', body } = {}) {
  const response = await fetch(`${DOMINO_API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
      payload?.error ||
      `Dominoes request failed (${response.status}).`,
    );
    error.status = response.status;
    error.code = payload?.error?.code || 'DOMINO_API_ERROR';
    throw error;
  }

  return payload;
}

const DominoGame = {
  async filter(query = {}) {
    const roomCode = String(query.room_code || '').trim().toUpperCase();
    if (!roomCode) return [];
    const payload = await request(`?room=${encodeURIComponent(roomCode)}`);
    return Array.isArray(payload?.games) ? payload.games : [];
  },

  async create(data = {}) {
    const payload = await request('', { method: 'POST', body: data });
    return payload?.game || null;
  },

  async update(id, data = {}) {
    const payload = await request('', {
      method: 'PATCH',
      body: { id, data },
    });
    return payload?.game || null;
  },

  // DominoHost/DominoGame already poll every 2–3 seconds. Keep the old
  // subscription call shape so the proven game flow does not need a rewrite.
  subscribe() {
    return () => {};
  },
};

// Drop-in compatibility surface for the old Base44 DominoGame calls.
// This intentionally mirrors only the methods Dominoes actually uses.
export const dominoStore = {
  entities: {
    DominoGame,
  },
};
