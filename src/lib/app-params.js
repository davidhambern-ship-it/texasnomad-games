const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const PREVIEW_PIN_KEY = 'tng_preview_user_access_token';
const PREVIEW_LOGIN_PENDING_KEY = 'tng_preview_expect_user_login';

const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) return defaultValue;

  const storageKey = `base44_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  if (searchParam) {
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }

  if (defaultValue) {
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }

  const storedValue = storage.getItem(storageKey);
  return storedValue || null;
};

function looksLikeBase44Preview(value) {
  if (!value || isNode) return false;

  try {
    const url = new URL(value, window.location.origin);
    const host = url.hostname.toLowerCase();

    if (
      host.endsWith('.base44.app') &&
      (host.startsWith('preview--') || host.startsWith('preview-sandbox--'))
    ) {
      return true;
    }

    return host === 'app.base44.com' && url.pathname.includes('/editor/preview');
  } catch {
    return false;
  }
}

function isBase44PreviewContext() {
  if (isNode) return false;

  return [
    window.location.href,
    document.referrer,
    storage.getItem('base44_from_url'),
    storage.getItem('base44_app_base_url'),
  ].filter(Boolean).some(looksLikeBase44Preview);
}

function resolveAccessToken() {
  if (isNode) return null;

  const incomingToken = getAppParamValue('access_token', { removeFromUrl: true });
  const previewContext = isBase44PreviewContext();
  const loginPending = storage.getItem(PREVIEW_LOGIN_PENDING_KEY) === '1';

  // A Google sign-in was explicitly launched from TNG Preview. The token on
  // this callback belongs to the chosen test user, so pin it across Preview
  // reloads. This prevents Base44 Editor from silently replacing it with the
  // editor/admin token on refresh.
  if (loginPending && incomingToken) {
    storage.setItem(PREVIEW_PIN_KEY, incomingToken);
    storage.removeItem(PREVIEW_LOGIN_PENDING_KEY);
    return incomingToken;
  }

  if (previewContext) {
    const pinnedToken = storage.getItem(PREVIEW_PIN_KEY);
    if (pinnedToken) return pinnedToken;
  }

  return incomingToken;
}

const getAppParams = () => {
  if (getAppParamValue('clear_access_token') === 'true') {
    storage.removeItem('base44_access_token');
    storage.removeItem('token');
    storage.removeItem(PREVIEW_PIN_KEY);
    storage.removeItem(PREVIEW_LOGIN_PENDING_KEY);
  }

  return {
    appId: getAppParamValue('app_id', { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
    token: resolveAccessToken(),
    fromUrl: getAppParamValue('from_url', { defaultValue: window.location.href }),
    functionsVersion: getAppParamValue('functions_version', { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
    appBaseUrl: getAppParamValue('app_base_url', { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
  };
};

export const appParams = {
  ...getAppParams(),
};
