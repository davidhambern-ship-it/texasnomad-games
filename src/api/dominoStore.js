import { getNeonAuthToken } from '@/lib/neonAuth';

const IS_RAILWAY_TEMP_HOST =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.up.railway.app');

const DOMINO_API_BASE =
  import.meta.env.VITE_DOMINO_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/domino-api'
    : 'https://tng-live-production.up.railway.app/domino-api');

function readLocal(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function writeLocal(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* private mode */ }
}

function hostTokenKey(roomCode) {
  return `dom_host_token_${String(roomCode || '').trim().toUpperCase()}`;
}

function seatTokenKey(roomCode) {
  return `dom_seat_token_${String(roomCode || '').trim().toUpperCase()}`;
}

async function request(path = '', {
  method = 'GET',
  body,
  host = false,
  roomCode = '',
  seatToken = '',
} = {}) {
  const headers = {
    Accept: 'application/json',
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  };

  if (host) {
    const token = await getNeonAuthToken().catch(() => '');
    const deviceId = readLocal('tng_device_id');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (deviceId) headers['X-TNG-Device-ID'] = deviceId;

    const savedHostToken = readLocal(hostTokenKey(roomCode));
    if (savedHostToken) headers['X-Domino-Token'] = savedHostToken;
  } else {
    const token = seatToken || readLocal(seatTokenKey(roomCode));
    if (token) headers['X-Domino-Token'] = token;
  }

  const response = await fetch(`${DOMINO_API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
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
  async filter(query = {}, options = {}) {
    const roomCode = String(query.room_code || '').trim().toUpperCase();
    if (!roomCode) return [];
    const payload = await request(`?room=${encodeURIComponent(roomCode)}`, {
      host: options.host === true,
      roomCode,
      seatToken: options.seatToken || '',
    });
    return Array.isArray(payload?.games) ? payload.games : [];
  },

  async create(data = {}) {
    const roomCode = String(data?.room_code || '').trim().toUpperCase();
    const payload = await request('', {
      method: 'POST',
      body: data,
      host: true,
      roomCode,
    });

    if (payload?.hostToken && roomCode) {
      writeLocal(hostTokenKey(roomCode), payload.hostToken);
    }

    return payload?.game || null;
  },

  async update(id, data = {}, options = {}) {
    const roomCode = String(
      options.roomCode ||
      data?.room_code ||
      ''
    ).trim().toUpperCase();

    const payload = await request('', {
      method: 'PATCH',
      body: { id, data },
      host: true,
      roomCode,
    });
    return payload?.game || null;
  },

  async join(roomCode, seat, name) {
    const code = String(roomCode || '').trim().toUpperCase();
    const payload = await request('/join', {
      method: 'POST',
      body: { roomCode: code, seat, name },
      roomCode: code,
    });

    if (payload?.seatToken) {
      writeLocal(seatTokenKey(code), payload.seatToken);
    }

    return payload || {};
  },

  async action(roomCode, action, payload = {}) {
    const code = String(roomCode || '').trim().toUpperCase();
    return request('/action', {
      method: 'POST',
      body: { roomCode: code, action, ...payload },
      roomCode: code,
    });
  },

  hostToken(roomCode) {
    return readLocal(hostTokenKey(roomCode));
  },

  seatToken(roomCode) {
    return readLocal(seatTokenKey(roomCode));
  },

  clearSeatToken(roomCode) {
    writeLocal(seatTokenKey(roomCode), '');
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
