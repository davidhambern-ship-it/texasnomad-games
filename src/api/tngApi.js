import { getTngAccessToken } from '@/api/neonAuthClient';
import { migrationEndpoints } from '@/config/backendMigration';

/**
 * @typedef {object} RequestOptions
 * @property {string} [method]
 * @property {unknown} [body]
 * @property {string} [deviceId]
 * @property {string} [displayId]
 * @property {string} [displayToken]
 * @property {boolean} [authenticated]
 */

export class TngApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 500, details = null } = {}) {
    super(message);
    this.name = 'TngApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * @param {string} path
 */
function apiUrl(path) {
  const base = migrationEndpoints.tngApiUrl;
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path.replace(/^\/api/, '')}`;
}

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 */
async function request(
  path,
  {
    method = 'GET',
    body,
    deviceId,
    displayId,
    displayToken,
    authenticated = true,
  } = {},
) {
  const headers = { Accept: 'application/json' };

  if (authenticated) {
    headers.Authorization = `Bearer ${await getTngAccessToken()}`;
  }
  if (deviceId) headers['X-TNG-Device-Id'] = deviceId;
  if (displayId) headers['X-TNG-Display-Id'] = displayId;
  if (displayToken) headers['X-TNG-Display-Token'] = displayToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(apiUrl(path), {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new TngApiError(payload.error?.message || 'The TNG service is unavailable.', {
      code: payload.error?.code,
      status: response.status,
      details: payload.error,
    });
  }

  return payload;
}

export const tngApi = Object.freeze({
  profile: {
    get: () => request('/api/profile'),
    create: ({ displayName, handle }) => request('/api/profile', {
      method: 'POST',
      body: { displayName, handle },
    }),
  },

  devices: {
    create: ({ role, deviceLabel }) => request('/api/device-session', {
      method: 'POST',
      body: { role, deviceLabel },
    }),
  },

  host: {
    startSession: (deviceId) => request('/api/host/session', {
      method: 'POST',
      deviceId,
    }),

    endSession: (deviceId) => request('/api/host/session', {
      method: 'DELETE',
      deviceId,
    }),

    createPairing: (deviceId) => request('/api/host/pairing', {
      method: 'POST',
      deviceId,
    }),

    createRoom: (deviceId, gameId) => request('/api/host/room', {
      method: 'POST',
      deviceId,
      body: { gameId },
    }),

    endRoom: (deviceId) => request('/api/host/room', {
      method: 'DELETE',
      deviceId,
    }),

    roomState: {
      get: (deviceId) => request('/api/host/room-state', {
        deviceId,
      }),

      update: (deviceId, { statePatch, command } = {}) => request('/api/host/room-state', {
        method: 'PATCH',
        deviceId,
        body: {
          ...(statePatch ? { statePatch } : {}),
          ...(command ? { command } : {}),
        },
      }),
    },
  },

  display: {
    pair: (code) => request('/api/display/pair', {
      method: 'POST',
      body: { code },
      authenticated: false,
    }),

    state: ({ displayId, displayToken }) => request('/api/display/state', {
      displayId,
      displayToken,
      authenticated: false,
    }),
  },

  spades: {
    host: {
      get: (deviceId) => request('/api/spades/host', {
        deviceId,
      }),

      action: (deviceId, action, payload = {}) => request('/api/spades/host', {
        method: 'POST',
        deviceId,
        body: { action, ...payload },
      }),
    },
  },
});
