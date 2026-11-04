const LIVE_TNG_SERVICE_ORIGIN = 'https://auth.texasnomadgames.com';

function normalizeOrigin(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function currentHost() {
  return typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
}

function isVercelOrTngHost() {
  const host = currentHost();
  return (
    host.endsWith('.vercel.app') ||
    host === 'texasnomadgames.com' ||
    host === 'www.texasnomadgames.com'
  );
}

// The Vercel deployment serves both the frontend and the TNG API/WebSocket
// function. Use same-origin paths there so browser traffic no longer depends
// on the legacy auth subdomain. Local dev can still target that service.
export const TNG_SERVICE_ORIGIN =
  normalizeOrigin(import.meta.env.VITE_TNG_SERVICE_ORIGIN) ||
  (isVercelOrTngHost() ? '' : LIVE_TNG_SERVICE_ORIGIN);

export function tngServiceUrl(path = '') {
  const suffix = String(path || '').startsWith('/') ? String(path || '') : `/${path}`;
  return `${TNG_SERVICE_ORIGIN}${suffix}`;
}

export function tngWebSocketUrl(path = '') {
  const suffix = String(path || '').startsWith('/') ? String(path || '') : `/${path}`;

  if (TNG_SERVICE_ORIGIN) {
    return `${TNG_SERVICE_ORIGIN.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}${suffix}`;
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${suffix}`;
  }

  return suffix;
}
