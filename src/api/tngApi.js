import { appParams } from '@/lib/app-params';

const API_BASE = 'https://br-polished-glade-avfsrygs-tngapi.compute.c-11.us-east-1.aws.neon.tech';

export class TngApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 500, details = null } = {}) {
    super(message);
    this.name = 'TngApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method='GET', body, deviceId, authenticated=true } = {}) {
  const headers = { Accept: 'application/json' };
  if (authenticated) {
    if (!appParams.token) throw new TngApiError('Your TNG session is missing.', { code:'AUTH_REQUIRED', status:401 });
    headers.Authorization = `Bearer ${appParams.token}`;
  }
  if (deviceId) headers['X-TNG-Device-Id'] = deviceId;
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
    startSession: (deviceId) => request('/api/host/session', { method:'POST', deviceId }),
    endSession: (deviceId) => request('/api/host/session', { method:'DELETE', deviceId }),
    createPairing: (deviceId) => request('/api/host/pairing', { method:'POST', deviceId }),
    createRoom: (deviceId, gameId) => request('/api/host/room', { method:'POST', deviceId, body:{gameId} }),
    endRoom: (deviceId) => request('/api/host/room', { method:'DELETE', deviceId }),
  },
  display: {
    pair: (code) => request('/api/display/pair', { method:'POST', body:{code}, authenticated:false }),
  },
};
