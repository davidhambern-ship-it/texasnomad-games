import { getNeonAuthToken } from '@/lib/neonAuth';

const IS_RAILWAY_TEMP_HOST =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.up.railway.app');

const API_BASE =
  import.meta.env.VITE_TNG_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/tng-api'
    : 'https://br-spring-moon-avh3z3j8-tngapi.compute.c-11.us-east-1.aws.neon.tech');

const BFF_API_BASE =
  import.meta.env.VITE_BFF_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/bff-api'
    : 'https://tng-live-production.up.railway.app/bff-api');

const STATS_API_BASE =
  import.meta.env.VITE_TNG_STATS_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/tng-stats'
    : 'https://tng-live-production.up.railway.app/tng-stats');

const ACCOUNT_ROUTE_API_BASE =
  import.meta.env.VITE_TNG_ACCOUNT_ROUTE_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/tng-api'
    : 'https://tng-live-production.up.railway.app/tng-api');

const DISPLAY_STATE_API_BASE =
  import.meta.env.VITE_TNG_DISPLAY_STATE_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? '/tng-display'
    : 'https://tng-live-production.up.railway.app/tng-display');

export class TngApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 500, details = null } = {}) {
    super(message);
    this.name = 'TngApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request(path, {
  method='GET',
  body,
  deviceId,
  displayId,
  displayToken,
  roomCode,
  authenticated=true,
  apiBase=API_BASE,
} = {}) {
  const headers = { Accept: 'application/json' };
  if (authenticated) {
    const token = await getNeonAuthToken();
    if (!token) {
      throw new TngApiError('Your TNG session is missing.', {
        code: 'AUTH_REQUIRED',
        status: 401,
      });
    }
    headers.Authorization = `Bearer ${token}`;
  }
  if (deviceId) headers['X-TNG-Device-Id'] = deviceId;
  if (displayId) headers['X-TNG-Display-Id'] = displayId;
  if (displayToken) headers['X-TNG-Display-Token'] = displayToken;
  if (roomCode) headers['X-TNG-Room-Code'] = roomCode;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const url = `${apiBase}${path.replace(/^\/api/, '')}`;
  const requestBody = body === undefined ? undefined : JSON.stringify(body);

  let response = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  // Neon Auth JWTs are intentionally short-lived. If a request happens on the
  // edge of a token refresh, fetch one fresh token and retry once before
  // treating the user as signed out.
  if (authenticated && response.status === 401) {
    const freshToken = await getNeonAuthToken({ forceRefresh: true }).catch(() => null);
    if (freshToken) {
      headers.Authorization = `Bearer ${freshToken}`;
      response = await fetch(url, {
        method,
        headers,
        body: requestBody,
      });
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new TngApiError(payload.error?.message || 'The TNG service is unavailable.', {
      code: payload.error?.code, status: response.status, details: payload.error
    });
  }
  return payload;
}

const BERNAVERSE_BRIDGE_URL =
  import.meta.env.VITE_BERNAVERSE_BRIDGE_URL ||
  'https://emexrsuuazbowxxwvalj.supabase.co/functions/v1/bernaverse-bridge';

async function bernaverseRequest(action, payload = {}) {
  const token = await getNeonAuthToken();
  if (!token) {
    throw new TngApiError('Your TNG session is missing.', {
      code: 'AUTH_REQUIRED',
      status: 401,
    });
  }

  const response = await fetch(BERNAVERSE_BRIDGE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-TNG-Session': token,
    },
    body: JSON.stringify({
      app: 'tng',
      action,
      ...payload,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new TngApiError(result?.error || 'BERNAverse is unavailable.', {
      code: 'BERNAVERSE_ERROR',
      status: response.status,
      details: result,
    });
  }

  return result?.data || {};
}

export const tngApi = {
  public: {
    liveRooms: () => request('/api/public/live-rooms', { authenticated:false }),
  },
  profile: {
    get: () => request('/api/profile'),
    create: (data) => request('/api/profile', { method:'POST', body:data }),
  },
  stats: {
    getProfile: () => request('/profile', { apiBase:STATS_API_BASE }),
    quitGame: (roomCode) => request('/quit', {
      method:'POST',
      roomCode,
      apiBase:STATS_API_BASE,
      body:{ roomCode },
    }),
  },
  devices: {
    create: (data) => request('/api/device-session', { method:'POST', body:data }),
  },
  host: {
    getAccountRoute: (deviceId) => request('/api/account-route', {
      deviceId: deviceId || undefined,
      apiBase: ACCOUNT_ROUTE_API_BASE,
    }),
    startSession: (deviceId, reclaimController = false, resumeTestRoom = false) => request('/api/host/session', {
      method:'POST',
      deviceId,
      body:{ reclaimController, resumeTestRoom },
    }),
    endSession: (deviceId) => request('/api/host/session', { method:'DELETE', deviceId }),
    createPairing: (deviceId, replaceDisplay = false) => request('/api/host/pairing', {
      method:'POST',
      deviceId,
      body:{ replaceDisplay },
    }),
    createRoom: (deviceId, gameId) => request('/api/host/room', {
      method:'POST',
      deviceId,
      body:{ gameId },
    }),
    endRoom: (deviceId) => request('/api/host/room', { method:'DELETE', deviceId }),
    getRoomState: (deviceId) => request('/api/host/room-state', { deviceId }),
    updateRoomState: (deviceId, statePatch) => request('/api/host/room-state', {
      method:'PATCH',
      deviceId,
      body:{ statePatch },
    }),
    sendRoomCommand: (deviceId, command) => request('/api/host/room-state', {
      method:'PATCH',
      deviceId,
      body:{ command },
    }),
  },
  player: {
    joinRoom: (deviceId, roomCode) => request('/api/player/room', {
      method:'POST',
      deviceId,
      roomCode,
      body:{ roomCode },
    }),
    getRoom: (deviceId, roomCode) => request('/api/player/room', {
      deviceId,
      roomCode,
    }),
  },
  social: {
    get: () => request('/api/social'),
    action: (action, payload = {}) => request('/api/social', {
      method:'POST',
      body:{ action, ...payload },
    }),
  },
  bernaverse: {
    status: () => bernaverseRequest('status'),
    link: (code) => bernaverseRequest('link', { code }),
  },
  display: {
    pair: (code) => request('/api/display/pair', { method:'POST', body:{code}, authenticated:false }),
    getState: (displayId, displayToken) => request('/state', {
      displayId,
      displayToken,
      authenticated:false,
      apiBase: DISPLAY_STATE_API_BASE,
    }),
  },
  spades: {
    getHostState: (deviceId) => request('/api/spades/host', { deviceId }),
    hostAction: (deviceId, action, payload = {}) => request('/api/spades/host', {
      method:'POST',
      deviceId,
      body:{ action, ...payload },
    }),
    getPlayerState: (deviceId, roomCode) => request('/api/spades/player', {
      deviceId,
      roomCode,
    }),
    playerAction: (deviceId, roomCode, action, payload = {}) => request('/api/spades/player', {
      method:'POST',
      deviceId,
      roomCode,
      body:{ roomCode, action, ...payload },
    }),
  },
  hangman: {
    getHostState: (deviceId) => request('/api/hangman/host', {
      deviceId,
    }),
    hostAction: (deviceId, action, payload = {}) => request('/api/hangman/host', {
      method:'POST',
      deviceId,
      body:{ action, ...payload },
    }),
    getPlayerState: (deviceId, roomCode) => request('/api/hangman/player', {
      deviceId,
      roomCode,
    }),
    playerAction: (deviceId, roomCode, action, payload = {}) => request('/api/hangman/player', {
      method:'POST',
      deviceId,
      roomCode,
      body:{ roomCode, action, ...payload },
    }),
  },
  wordSearch: {
    getHostState: (deviceId) => request('/api/word-search/host', {
      deviceId,
    }),
    hostAction: (deviceId, action, payload = {}) => request('/api/word-search/host', {
      method:'POST',
      deviceId,
      body:{ action, ...payload },
    }),
    getPlayerState: (deviceId, roomCode) => request('/api/word-search/player', {
      deviceId,
      roomCode,
    }),
    playerAction: (deviceId, roomCode, action, payload = {}) => request('/api/word-search/player', {
      method:'POST',
      deviceId,
      roomCode,
      body:{ roomCode, action, ...payload },
    }),
  },
  bff: {
    getHostState: (deviceId) => request('/host', {
      deviceId,
      apiBase: BFF_API_BASE,
    }),
    hostAction: (deviceId, action, payload = {}) => request('/host', {
      method:'POST',
      deviceId,
      apiBase:BFF_API_BASE,
      body:{ action, ...payload },
    }),
    getPlayerState: (deviceId, roomCode) => request('/player', {
      deviceId,
      roomCode,
      apiBase:BFF_API_BASE,
    }),
    getDisplayState: (roomCode) => request(`/display?room=${encodeURIComponent(roomCode)}`, {
      authenticated:false,
      apiBase:BFF_API_BASE,
    }),
    playerAction: (deviceId, roomCode, action, payload = {}) => request('/player', {
      method:'POST',
      deviceId,
      roomCode,
      apiBase:BFF_API_BASE,
      body:{ action, ...payload },
    }),
  },
  squareBiz: {
    getHostState: (deviceId) => request('/api/square-biz/host', {
      deviceId,
    }),
    hostAction: (deviceId, action, payload = {}) => request('/api/square-biz/host', {
      method:'POST',
      deviceId,
      body:{ action, ...payload },
    }),
    getPlayerState: (deviceId, roomCode) => request('/api/square-biz/player', {
      deviceId,
      roomCode,
    }),
    playerAction: (deviceId, roomCode, action, payload = {}) => request('/api/square-biz/player', {
      method:'POST',
      deviceId,
      roomCode,
      body:{ roomCode, action, ...payload },
    }),
    questions: {
      list: (deviceId) => request('/api/square-biz/questions', { deviceId }),
      create: (deviceId, payload) => request('/api/square-biz/questions', {
        method:'POST',
        deviceId,
        body:{ action:'create', ...payload },
      }),
      bulkImport: (deviceId, questions) => request('/api/square-biz/questions', {
        method:'POST',
        deviceId,
        body:{ action:'bulk_import', questions },
      }),
      update: (deviceId, payload) => request('/api/square-biz/questions', {
        method:'PATCH',
        deviceId,
        body:payload,
      }),
    },
  },
};
