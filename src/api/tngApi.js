import { getNeonAuthToken } from '@/lib/neonAuth';

const API_BASE =
  import.meta.env.VITE_TNG_API_BASE ||
  'https://br-polished-glade-avfsrygs-tngapi.compute.c-11.us-east-1.aws.neon.tech';

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

  const response = await fetch(`${API_BASE}${path.replace(/^\/api/, '')}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new TngApiError(payload.error?.message || 'The TNG service is unavailable.', {
      code: payload.error?.code, status: response.status, details: payload.error
    });
  }
  return payload;
}

export const tngApi = {
  profile: {
    get: () => request('/api/profile'),
    create: (data) => request('/api/profile', { method:'POST', body:data }),
  },
  devices: {
    create: (data) => request('/api/device-session', { method:'POST', body:data }),
  },
  host: {
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
  display: {
    pair: (code) => request('/api/display/pair', { method:'POST', body:{code}, authenticated:false }),
    getState: (displayId, displayToken) => request('/api/display/state', {
      displayId,
      displayToken,
      authenticated:false,
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
};
