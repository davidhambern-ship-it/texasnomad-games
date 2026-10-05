const LIVE_TNG_SERVICE_ORIGIN = 'https://auth.texasnomadgames.com';

function normalizeOrigin(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isRailwayHost() {
  return (
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.up.railway.app')
  );
}

// Browser traffic uses one TNG service origin. Railway preview/staging can stay
// same-origin; the public site uses the first-party auth.texasnomadgames.com
// domain, which is attached to the same TNG server that owns every API/WS route.
export const TNG_SERVICE_ORIGIN =
  normalizeOrigin(import.meta.env.VITE_TNG_SERVICE_ORIGIN) ||
  (isRailwayHost() ? '' : LIVE_TNG_SERVICE_ORIGIN);

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
