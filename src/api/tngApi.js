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


const HOST_LIVE_WS_URL =
  import.meta.env.VITE_TNG_HOST_LIVE_WS_URL ||
  (typeof window !== 'undefined' && window.location.hostname.endsWith('.up.railway.app')
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/host-live`
    : 'wss://tng-live-production.up.railway.app/host-live');

const hostLive = {
  socket: null,
  controllerId: null,
  connecting: null,
  reconnectTimer: null,
  intentionallyClosed: false,
  roomReceived: false,
  room: null,
  games: new Map(),
  waiters: new Map(),
};

function hostLiveKey(kind, gameId = '') {
  return gameId ? `${kind}:${gameId}` : kind;
}

function resolveHostLiveWaiters(key, value) {
  const waiters = hostLive.waiters.get(key);
  if (!waiters?.length) return;

  hostLive.waiters.delete(key);
  for (const waiter of waiters) {
    window.clearTimeout(waiter.timer);
    waiter.resolve(value);
  }
}

function rejectAllHostLiveWaiters(error) {
  for (const waiters of hostLive.waiters.values()) {
    for (const waiter of waiters) {
      window.clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
  hostLive.waiters.clear();
}

function waitForHostLiveValue(key, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const list = hostLive.waiters.get(key) || [];
    const waiter = {
      resolve,
      reject,
      timer: window.setTimeout(() => {
        const current = hostLive.waiters.get(key) || [];
        hostLive.waiters.set(
          key,
          current.filter((entry) => entry !== waiter),
        );
        reject(new TngApiError('The Host live connection did not return state in time.', {
          code: 'HOST_LIVE_TIMEOUT',
          status: 504,
        }));
      }, timeoutMs),
    };

    list.push(waiter);
    hostLive.waiters.set(key, list);
  });
}

function requestHostLiveRefresh() {
  if (hostLive.socket?.readyState === WebSocket.OPEN) {
    hostLive.socket.send(JSON.stringify({ type: 'refresh' }));
  }
}

function closeHostLiveConnection() {
  hostLive.intentionallyClosed = true;

  if (hostLive.reconnectTimer) {
    window.clearTimeout(hostLive.reconnectTimer);
    hostLive.reconnectTimer = null;
  }

  if (hostLive.socket) {
    try { hostLive.socket.close(1000, 'Host session ended'); } catch {}
  }

  hostLive.socket = null;
  hostLive.controllerId = null;
  hostLive.connecting = null;
  hostLive.roomReceived = false;
  hostLive.room = null;
  hostLive.games.clear();
  rejectAllHostLiveWaiters(new TngApiError('The Host live connection was closed.', {
    code: 'HOST_LIVE_CLOSED',
    status: 499,
  }));
}

async function ensureHostLiveConnection(deviceId) {
  if (!deviceId) {
    throw new TngApiError('The Host Controller device is missing.', {
      code: 'CONTROLLER_REQUIRED',
      status: 400,
    });
  }

  if (
    hostLive.controllerId === deviceId &&
    hostLive.socket?.readyState === WebSocket.OPEN &&
    !hostLive.connecting
  ) {
    return;
  }

  if (hostLive.controllerId === deviceId && hostLive.connecting) {
    return hostLive.connecting;
  }

  if (hostLive.controllerId && hostLive.controllerId !== deviceId) {
    closeHostLiveConnection();
  }

  hostLive.controllerId = deviceId;
  hostLive.intentionallyClosed = false;

  hostLive.connecting = (async () => {
    const token = await getNeonAuthToken();
    if (!token) {
      throw new TngApiError('Your TNG session is missing.', {
        code: 'AUTH_REQUIRED',
        status: 401,
      });
    }

    await new Promise((resolve, reject) => {
      const socket = new WebSocket(HOST_LIVE_WS_URL);
      hostLive.socket = socket;

      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({
          type: 'auth',
          token,
          controllerId: deviceId,
        }));
      });

      socket.addEventListener('message', async (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message?.type === 'host-live-ready') {
          hostLive.roomReceived = true;
          hostLive.room = message.room ?? null;
          resolveHostLiveWaiters(hostLiveKey('room'), { room: hostLive.room });

          if (!settled) {
            settled = true;
            resolve();
          }
          return;
        }

        if (message?.type === 'room-state') {
          hostLive.roomReceived = true;
          hostLive.room = message.room ?? null;
          resolveHostLiveWaiters(hostLiveKey('room'), { room: hostLive.room });
          return;
        }

        if (message?.type === 'game-state' && message.gameId) {
          hostLive.games.set(message.gameId, message.payload);
          resolveHostLiveWaiters(
            hostLiveKey('game', message.gameId),
            message.payload,
          );
          return;
        }

        if (message?.type === 'reauth-required') {
          try {
            const freshToken = await getNeonAuthToken({ forceRefresh: true });
            if (freshToken && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'auth',
                token: freshToken,
                controllerId: deviceId,
              }));
            }
          } catch (error) {
            console.warn('[TNG Host Live] silent re-auth failed:', error);
          }
          return;
        }

        if (message?.type === 'auth-failed') {
          fail(new TngApiError('The Host live connection could not authenticate.', {
            code: 'AUTH_REQUIRED',
            status: message.status || 401,
          }));
        }
      });

      socket.addEventListener('error', () => {
        fail(new TngApiError('The Host live connection could not start.', {
          code: 'HOST_LIVE_UNAVAILABLE',
          status: 503,
        }));
      });

      socket.addEventListener('close', () => {
        if (hostLive.socket === socket) {
          hostLive.socket = null;
        }

        if (!settled) {
          fail(new TngApiError('The Host live connection closed while starting.', {
            code: 'HOST_LIVE_UNAVAILABLE',
            status: 503,
          }));
        }

        if (
          !hostLive.intentionallyClosed &&
          hostLive.controllerId === deviceId &&
          !hostLive.reconnectTimer
        ) {
          hostLive.reconnectTimer = window.setTimeout(() => {
            hostLive.reconnectTimer = null;
            hostLive.connecting = null;
            ensureHostLiveConnection(deviceId).catch((error) => {
              console.warn('[TNG Host Live] reconnect failed:', error);
            });
          }, 1000);
        }
      });
    });
  })();

  try {
    await hostLive.connecting;
  } finally {
    hostLive.connecting = null;
  }
}

async function getHostLiveRoomState(deviceId) {
  if (hostLive.controllerId === deviceId && hostLive.roomReceived) {
    ensureHostLiveConnection(deviceId).catch(() => {});
    return { room: hostLive.room };
  }

  await ensureHostLiveConnection(deviceId);

  if (hostLive.roomReceived) {
    return { room: hostLive.room };
  }

  return waitForHostLiveValue(hostLiveKey('room'));
}

async function getHostLiveGameState(deviceId, gameId) {
  if (hostLive.controllerId === deviceId && hostLive.games.has(gameId)) {
    ensureHostLiveConnection(deviceId).catch(() => {});
    return hostLive.games.get(gameId);
  }

  await ensureHostLiveConnection(deviceId);

  if (hostLive.games.has(gameId)) {
    return hostLive.games.get(gameId);
  }

  return waitForHostLiveValue(hostLiveKey('game', gameId));
}

async function hostActionAndRefresh(path, deviceId, action, payload = {}, options = {}) {
  const result = await request(path, {
    method: 'POST',
    deviceId,
    body: { action, ...payload },
    ...options,
  });
  requestHostLiveRefresh();
  return result;
}

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
    endSession: async (deviceId) => {
      const result = await request('/api/host/session', { method:'DELETE', deviceId });
      closeHostLiveConnection();
      return result;
    },
    createPairing: (deviceId, replaceDisplay = false) => request('/api/host/pairing', {
      method:'POST',
      deviceId,
      body:{ replaceDisplay },
    }),
    createRoom: async (deviceId, gameId) => {
      const result = await request('/api/host/room', {
        method:'POST',
        deviceId,
        body:{ gameId },
      });
      requestHostLiveRefresh();
      return result;
    },
    endRoom: async (deviceId) => {
      const result = await request('/api/host/room', { method:'DELETE', deviceId });
      hostLive.games.clear();
      requestHostLiveRefresh();
      return result;
    },
    getRoomState: (deviceId) => getHostLiveRoomState(deviceId),
    updateRoomState: async (deviceId, statePatch) => {
      const result = await request('/api/host/room-state', {
        method:'PATCH',
        deviceId,
        body:{ statePatch },
      });
      requestHostLiveRefresh();
      return result;
    },
    sendRoomCommand: async (deviceId, command) => {
      const result = await request('/api/host/room-state', {
        method:'PATCH',
        deviceId,
        body:{ command },
      });
      requestHostLiveRefresh();
      return result;
    },
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
    getHostState: (deviceId) => getHostLiveGameState(deviceId, 'spades'),
    hostAction: (deviceId, action, payload = {}) =>
      hostActionAndRefresh('/api/spades/host', deviceId, action, payload),
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
    getHostState: (deviceId) => getHostLiveGameState(deviceId, 'hangman'),
    hostAction: (deviceId, action, payload = {}) =>
      hostActionAndRefresh('/api/hangman/host', deviceId, action, payload),
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
    getHostState: (deviceId) => getHostLiveGameState(deviceId, 'word-search'),
    hostAction: (deviceId, action, payload = {}) =>
      hostActionAndRefresh('/api/word-search/host', deviceId, action, payload),
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
    getHostState: (deviceId) => getHostLiveGameState(deviceId, 'bff'),
    hostAction: (deviceId, action, payload = {}) =>
      hostActionAndRefresh('/host', deviceId, action, payload, { apiBase:BFF_API_BASE }),
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
    getHostState: (deviceId) => getHostLiveGameState(deviceId, 'square-biz'),
    hostAction: (deviceId, action, payload = {}) =>
      hostActionAndRefresh('/api/square-biz/host', deviceId, action, payload),
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
