const DEVELOPMENT_NEON_AUTH_URL =
  'https://ep-hidden-wave-avehvh0z.neonauth.c-11.us-east-1.aws.neon.tech/tng/auth';

const DEVELOPMENT_TNG_API_URL =
  'https://br-polished-glade-avfsrygs-tngapi.compute.c-11.us-east-1.aws.neon.tech/';

function isBase44Preview() {
  if (typeof window === 'undefined') return false;

  const currentUrl = window.location.href;
  if (
    window.location.hostname === 'app.base44.com' &&
    window.location.pathname.includes('/editor/preview')
  ) {
    return true;
  }

  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (
      referrer?.hostname === 'app.base44.com' &&
      referrer.pathname.includes('/editor/preview')
    ) {
      return true;
    }
  } catch {
    // Ignore malformed/blocked referrers.
  }

  return currentUrl.includes('app.base44.com') && currentUrl.includes('/editor/preview');
}

export const base44Preview = isBase44Preview();

export const backendMigration = Object.freeze({
  tngBackendEnabled:
    import.meta.env.VITE_TNG_BACKEND_ENABLED === 'true' || base44Preview,
  base44FunctionsEnabled:
    import.meta.env.VITE_ENABLE_BASE44_FUNCTIONS === 'true' && !base44Preview,
});

export const migrationEndpoints = Object.freeze({
  neonAuthUrl:
    import.meta.env.VITE_NEON_AUTH_URL?.trim() ||
    (base44Preview ? DEVELOPMENT_NEON_AUTH_URL : ''),
  tngApiUrl:
    import.meta.env.VITE_TNG_API_URL?.trim() ||
    (base44Preview ? DEVELOPMENT_TNG_API_URL : ''),
});
