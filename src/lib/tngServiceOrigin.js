const LOCAL_TNG_SERVICE_ORIGIN = 'http://localhost:3000';

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
    host.endsWith('.pages.dev') ||
    host.endsWith('.workers.dev') ||
    host === 'texasnomadgames.com' ||
    host === 'www.texasnomadgames.com'
  );
}

// Production and preview use same-origin API routes. Local development targets
// the local Node API server; no Railway or Neon service is used.
export const TNG_SERVICE_ORIGIN =
  normalizeOrigin(import.meta.env.VITE_TNG_SERVICE_ORIGIN) ||
  (isVercelOrTngHost() ? '' : LOCAL_TNG_SERVICE_ORIGIN);

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
