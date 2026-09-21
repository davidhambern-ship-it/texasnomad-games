import { getTngAccessToken } from '@/api/neonAuthClient';

/**
 * @typedef {object} RequestOptions
 * @property {string} [method]
 * @property {unknown} [body]
 * @property {string} [deviceId]
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
 * @param {RequestOptions} [options]
 */
async function request(path, { method = 'GET', body, deviceId, authenticated = true } = {}) {
  const headers = { Accept: 'application/json' };

  if (authenticated) {
    headers.Authorization = `Bearer ${await getTngAccessToken()}`;
  }
  if (deviceId) headers['X-TNG-Device-Id'] = deviceId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, {
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
    startSession: (deviceId) => request('/api/host/session', { method: 'POST', deviceId }),
    endSession: (deviceId) => request('/api/host/session', { method: 'DELETE', deviceId }),
    createPairing: (deviceId) => request('/api/host/pairing', { method: 'POST', deviceId }),
    createRoom: (deviceId, gameId) => request('/api/host/room', {
      method: 'POST',
      deviceId,
      body: { gameId },
    }),
    endRoom: (deviceId) => request('/api/host/room', { method: 'DELETE', deviceId }),
  },
  display: {
    pair: (code) => request('/api/display/pair', {
      method: 'POST',
      body: { code },
      authenticated: false,
    }),
  },
});
