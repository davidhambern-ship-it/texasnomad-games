const DEVELOPMENT_NEON_AUTH_URL =
  'https://ep-hidden-wave-avehvh0z.neonauth.c-11.us-east-1.aws.neon.tech/tng/auth';

const DEVELOPMENT_TNG_API_URL =
  'https://br-polished-glade-avfsrygs-tngapi.compute.c-11.us-east-1.aws.neon.tech/';

function looksLikeBase44Preview(value) {
  if (!value) return false;

  try {
    const url = new URL(value, window.location.origin);
    const host = url.hostname.toLowerCase();

    if (
      host === 'app.base44.com' &&
      url.pathname.includes('/editor/preview')
    ) {
      return true;
    }

    if (
      host.endsWith('.base44.app') &&
      (host.startsWith('preview--') || host.startsWith('preview-sandbox--'))
    ) {
      return true;
    }
  } catch {
    return String(value).includes('/editor/preview');
  }

  return false;
}

function forcedNeonMode() {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const flag = params.get('tng_neon');

  if (flag === '1') {
    window.localStorage.setItem('tng_backend_mode', 'neon');
    return true;
  }

  if (flag === '0') {
    window.localStorage.removeItem('tng_backend_mode');
    return false;
  }

  return window.localStorage.getItem('tng_backend_mode') === 'neon';
}

function isBase44Preview() {
  if (typeof window === 'undefined') return false;

  const candidates = [
    window.location.href,
    document.referrer,
    window.localStorage.getItem('base44_from_url'),
    window.localStorage.getItem('base44_app_base_url'),
    new URLSearchParams(window.location.search).get('from_url'),
    new URLSearchParams(window.location.search).get('app_base_url'),
  ];

  return candidates.some(looksLikeBase44Preview);
}

export const base44Preview = isBase44Preview();
export const forcedNeon = forcedNeonMode();
export const neonTestMode = base44Preview || forcedNeon;

export const backendMigration = Object.freeze({
  tngBackendEnabled:
    import.meta.env.VITE_TNG_BACKEND_ENABLED === 'true' || neonTestMode,
  base44FunctionsEnabled:
    import.meta.env.VITE_ENABLE_BASE44_FUNCTIONS === 'true' && !neonTestMode,
});

export const migrationEndpoints = Object.freeze({
  neonAuthUrl:
    import.meta.env.VITE_NEON_AUTH_URL?.trim() ||
    (neonTestMode ? DEVELOPMENT_NEON_AUTH_URL : ''),
  tngApiUrl:
    import.meta.env.VITE_TNG_API_URL?.trim() ||
    (neonTestMode ? DEVELOPMENT_TNG_API_URL : ''),
});
