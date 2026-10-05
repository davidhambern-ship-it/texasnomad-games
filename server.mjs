import http from 'node:http';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { WebSocket, WebSocketServer } from 'ws';
import { createViralLive } from './server/viralLive.mjs';
import { createSeeThatApi } from './server/seeThatApi.mjs';
import { createWordWranglerApi } from './server/wordWranglerApi.mjs';
import { createBattleSudokuApi } from './server/battleSudokuApi.mjs';
import { applyPass as applyDominoPass, applyPlay as applyDominoPlay } from './src/lib/dominoEngine.js';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function sendFile(res, filePath) {
  const body = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.html'
      ? 'no-store, no-cache, must-revalidate, max-age=0'
      : 'public, max-age=31536000, immutable',
  });
  res.end(body);
}

const TNG_API_ORIGIN =
  process.env.TNG_API_ORIGIN ||
  'https://br-spring-moon-avh3z3j8-tngapi.compute.c-11.us-east-1.aws.neon.tech';

const NEON_AUTH_ORIGIN =
  process.env.NEON_AUTH_ORIGIN ||
  'https://ep-little-base-aveev14q.neonauth.c-11.us-east-1.aws.neon.tech/tng/auth';

const LIVE_BROWSER_ORIGINS = new Set(
  (process.env.TNG_LIVE_ALLOWED_ORIGINS ||
    'https://texasnomadgames.com,https://www.texasnomadgames.com,https://bernaverse.hireberna.app')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

function isAllowedBrowserOrigin(origin) {
  if (!origin) return false;
  if (LIVE_BROWSER_ORIGINS.has(origin)) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (
      host === 'app.base44.com' ||
      (host.endsWith('.base44.app') &&
        (host.startsWith('preview--') || host.startsWith('preview-sandbox--')))
    );
  } catch {
    return false;
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : null;
}

function rewriteAuthCookie(cookie) {
  const raw = String(cookie || '');
  if (!raw) return raw;

  const cookieName = raw.split('=', 1)[0].trim();
  let next = raw
    .replace(/;\s*Domain=[^;]+/ig, '')
    .replace(/;\s*Path=[^;]+/ig, '; Path=/')
    .replace(/;\s*Expires=[^;]+/ig, '')
    .replace(/;\s*Max-Age=[^;]+/ig, '');

  if (!/;\s*Path=/i.test(next)) {
    next += '; Path=/';
  }

  // Safari is strict about cross-origin cookie storage. Scope Neon Auth's
  // session cookie to the shared TNG parent domain so requests from
  // texasnomadgames.com to auth.texasnomadgames.com remain first-party.
  // __Host- cookies are not allowed to carry Domain=, so preserve their
  // host-only semantics if Neon ever emits one.
  if (!cookieName.startsWith('__Host-')) {
    next += '; Domain=texasnomadgames.com';
  }

  return next;
}

function authCookieNames(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim().split('=', 1)[0])
    .filter(Boolean);
}

const AUTH_SESSION_PROXY_CACHE_TTL_MS = 30 * 1000;
const authSessionProxyCache = new Map();

function authSessionProxyKey(req) {
  const cookie = String(req.headers.cookie || '');
  const origin = String(req.headers.origin || req.headers.referer || '');
  return `${origin}\n${cookie}`;
}

function clearAuthSessionProxyCache() {
  authSessionProxyCache.clear();
}

function pruneAuthSessionProxyCache(now = Date.now()) {
  for (const [key, entry] of authSessionProxyCache.entries()) {
    if (now - entry.cachedAt >= AUTH_SESSION_PROXY_CACHE_TTL_MS) {
      authSessionProxyCache.delete(key);
    }
  }
}

function sendCachedAuthSession(res, entry) {
  for (const [name, value] of Object.entries(entry.headers || {})) {
    if (value) res.setHeader(name, value);
  }
  if (entry.setCookies?.length) {
    res.setHeader('Set-Cookie', entry.setCookies);
  }
  res.writeHead(entry.status);
  res.end(entry.payload);
}

async function proxyNeonAuth(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const suffix = sourceUrl.pathname.replace(/^\/neon-auth/, '') || '/';
  const targetUrl = `${NEON_AUTH_ORIGIN}${suffix}${sourceUrl.search}`;

  const method = String(req.method || 'GET').toUpperCase();
  const isSessionRead =
    method === 'GET' && sourceUrl.pathname.endsWith('/get-session');

  // Old/open Host tabs can still contain a high-frequency auth loop. Absorb
  // those repeated session reads at the first-party proxy so they cannot
  // rate-limit Neon Auth. This works immediately without refreshing the Host.
  if (isSessionRead) {
    const now = Date.now();
    pruneAuthSessionProxyCache(now);

    const cacheKey = authSessionProxyKey(req);
    const cached = authSessionProxyCache.get(cacheKey);

    if (cached && now - cached.cachedAt < AUTH_SESSION_PROXY_CACHE_TTL_MS) {
      sendCachedAuthSession(res, cached);
      return;
    }
  } else if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Sign-in/sign-out/account mutations can change the cookie-backed session.
    clearAuthSessionProxyCache();
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    const lower = key.toLowerCase();

    // Neon Auth validates the hostname it is serving. Never forward Railway or
    // TexasNomadGames proxy host metadata upstream; fetch() must present Neon's
    // own hostname while the browser Origin remains texasnomadgames.com for
    // Better Auth trusted-origin validation.
    if ([
      'host',
      'content-length',
      'connection',
      'forwarded',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-forwarded-port',
    ].includes(lower)) continue;

    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  const body =
    ['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase())
      ? undefined
      : await readRawBody(req);

  // BERNAverse is the global signup front door. For the one supported
  // cross-site provisioning call, present TNG's own origin upstream so Neon
  // Auth accepts the request while our proxy still enforces the browser origin.
  const browserOrigin = String(req.headers.origin || '');
  if (
    browserOrigin === 'https://bernaverse.hireberna.app'
    && sourceUrl.pathname.endsWith('/sign-up/email')
  ) {
    headers.set('origin', 'https://texasnomadgames.com');
    headers.set('referer', 'https://texasnomadgames.com/');
  }

  const response = await fetch(targetUrl, {
    method: req.method || 'GET',
    headers,
    body,
    redirect: 'manual',
  });

  const passthroughHeaders = [
    'content-type',
    'cache-control',
    'location',
    'etag',
    'last-modified',
  ];

  for (const name of passthroughHeaders) {
    const value = response.headers.get(name);
    if (value) res.setHeader(name, value);
  }

  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

  if (setCookies.length) {
    const rewrittenCookies = setCookies.map(rewriteAuthCookie);
    res.setHeader('Set-Cookie', rewrittenCookies);

    console.info('[TNG auth proxy] upstream set-cookie', {
      path: sourceUrl.pathname,
      status: response.status,
      cookieNames: rewrittenCookies
        .map((value) => String(value || '').split('=', 1)[0].trim())
        .filter(Boolean),
    });
  }

  if (sourceUrl.pathname.endsWith('/get-session')) {
    console.info('[TNG auth proxy] get-session cookie names', {
      cookieNames: authCookieNames(req),
    });
  }

  const payload = Buffer.from(await response.arrayBuffer());

  if (isSessionRead && response.status === 200) {
    const cacheKey = authSessionProxyKey(req);
    const cachedHeaders = {};

    for (const name of passthroughHeaders) {
      const value = response.headers.get(name);
      if (value) cachedHeaders[name] = value;
    }

    const rewrittenSetCookies = setCookies.length
      ? setCookies.map(rewriteAuthCookie)
      : [];

    authSessionProxyCache.set(cacheKey, {
      cachedAt: Date.now(),
      status: response.status,
      headers: cachedHeaders,
      setCookies: rewrittenSetCookies,
      payload,
    });
  }

  if (sourceUrl.pathname.endsWith('/sign-in/social')) {
    let socialShape = 'non-json';
    let socialKeys = [];
    let redirectHost = null;
    let redirectPath = null;
    let oauthRedirectHost = null;

    try {
      const parsed = JSON.parse(payload.toString('utf8'));
      socialShape = parsed === null
        ? 'null'
        : Array.isArray(parsed)
          ? 'array'
          : typeof parsed;
      socialKeys = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.keys(parsed)
        : [];

      const candidateUrl =
        parsed?.url ||
        parsed?.data?.url ||
        parsed?.redirectURL ||
        parsed?.data?.redirectURL ||
        null;

      if (candidateUrl) {
        const redirect = new URL(candidateUrl);
        redirectHost = redirect.hostname;
        redirectPath = redirect.pathname;

        const redirectUri = redirect.searchParams.get('redirect_uri');
        if (redirectUri) {
          try {
            oauthRedirectHost = new URL(redirectUri).hostname;
          } catch {}
        }
      }
    } catch {}

    console.info('[TNG auth proxy] social sign-in response shape', {
      status: response.status,
      contentType: response.headers.get('content-type') || null,
      socialShape,
      socialKeys,
      redirectHost,
      redirectPath,
      oauthRedirectHost,
    });
  }

  if (sourceUrl.pathname.endsWith('/get-session')) {
    let payloadShape = 'non-json';
    try {
      const parsed = JSON.parse(payload.toString('utf8'));
      if (parsed === null) payloadShape = 'null';
      else if (Array.isArray(parsed)) payloadShape = 'array';
      else if (parsed && typeof parsed === 'object') payloadShape = 'object';
      else payloadShape = typeof parsed;

      console.info('[TNG auth proxy] get-session response keys', {
        topLevelKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? Object.keys(parsed)
          : [],
        hasUser: Boolean(parsed?.user),
        hasSession: Boolean(parsed?.session),
        sessionKeys: parsed?.session && typeof parsed.session === 'object'
          ? Object.keys(parsed.session)
          : [],
      });
    } catch {}

    console.info('[TNG auth proxy] get-session response shape', {
      status: response.status,
      contentType: response.headers.get('content-type') || null,
      payloadShape,
      payloadBytes: payload.length,
    });
  }

  res.writeHead(response.status);
  res.end(payload);
}

const { Pool } = pg;
const bffPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

const BERNAVERSE_BRIDGE_URL =
  process.env.BERNAVERSE_BRIDGE_URL ||
  'https://emexrsuuazbowxxwvalj.supabase.co/functions/v1/bernaverse-bridge';
const BERNAVERSE_SSO_URL =
  process.env.BERNAVERSE_SSO_URL ||
  'https://emexrsuuazbowxxwvalj.supabase.co/functions/v1/bernaverse-sso';
const BERNAVERSE_APP_KEY = String(process.env.BERNAVERSE_APP_KEY || '').trim();
const BERNAVERSE_SSO_LOCAL_SECRET =
  String(process.env.BERNAVERSE_SSO_LOCAL_SECRET || '').trim();
const BERNAVERSE_SSO_ADMIN_EMAIL =
  String(process.env.BERNAVERSE_SSO_ADMIN_EMAIL || '').trim().toLowerCase();
const BERNAVERSE_SSO_ADMIN_PASSWORD =
  String(process.env.BERNAVERSE_SSO_ADMIN_PASSWORD || '').trim();

let bernaverseSsoAdminCookie = '';
let bernaverseSsoAdminCookieAt = 0;
const BERNAVERSE_SSO_ADMIN_COOKIE_TTL_MS = 45 * 60 * 1000;

function safeTngSsoReturn(rawReturn) {
  const fallback = 'https://texasnomadgames.com/login?sso=1';

  try {
    const candidate = new URL(String(rawReturn || fallback));
    const host = candidate.hostname.toLowerCase();

    if (
      candidate.protocol === 'https:' &&
      (host === 'texasnomadgames.com' || host === 'www.texasnomadgames.com')
    ) {
      return candidate.toString();
    }
  } catch {}

  return fallback;
}

function redirectTngSso(res, location, cookies = []) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end();
}

function tngSsoFailureUrl(code) {
  const target = new URL('https://texasnomadgames.com/login');
  target.searchParams.set('sso', String(code || 'error'));
  return target.toString();
}

function deriveTngSsoPassword(memberId) {
  if (!BERNAVERSE_SSO_LOCAL_SECRET) {
    throw new Error('BERNAverse SSO local secret is not configured.');
  }

  const digest = createHmac('sha256', BERNAVERSE_SSO_LOCAL_SECRET)
    .update(`tng:${memberId}`)
    .digest('base64url');

  // Better Auth receives an app-private password that the user never sees.
  // BERNAverse remains the user's authentication authority.
  return `Bv!${digest}9a`;
}

async function consumeBernaverseSsoTicket(ticket) {
  if (!BERNAVERSE_APP_KEY) {
    throw new Error('BERNAverse app credential is not configured.');
  }

  const response = await fetch(BERNAVERSE_SSO_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-BERNAverse-Key': BERNAVERSE_APP_KEY,
    },
    body: JSON.stringify({
      action: 'consume',
      ticket,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.data?.email || !payload?.data?.member_id) {
    const error = new Error(
      payload?.error || 'BERNAverse SSO ticket could not be verified.',
    );
    error.status = response.status;
    throw error;
  }

  return payload.data;
}

async function callNeonEmailAuth(path, body) {
  const response = await fetch(`${NEON_AUTH_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: 'https://texasnomadgames.com',
      Referer: 'https://texasnomadgames.com/',
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });

  const payload = await response.json().catch(() => ({}));
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie')]
          : []);

  const rawSetCookies = setCookies.filter(Boolean);

  return {
    response,
    payload,
    rawSetCookies,
    cookieHeader: rawSetCookies
      .map((value) => String(value || '').split(';', 1)[0])
      .filter(Boolean)
      .join('; '),
    setCookies: rawSetCookies.map(rewriteAuthCookie),
  };
}

async function promoteBernaverseSsoAdmin() {
  if (!BERNAVERSE_SSO_ADMIN_EMAIL) {
    throw new Error('BERNAverse SSO admin email is not configured.');
  }

  const { rows: columns } = await bffPool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'neon_auth'
        and table_name = 'user'
    `,
  );

  const names = new Set(columns.map((row) => String(row.column_name || '')));
  if (!names.has('role')) {
    throw new Error('Neon Auth admin role column is unavailable.');
  }

  const assignments = ["role = 'admin'"];
  if (names.has('emailVerified')) assignments.push('"emailVerified" = true');

  const result = await bffPool.query(
    `
      update neon_auth."user"
      set ${assignments.join(', ')}
      where lower(trim(email)) = lower(trim($1))
    `,
    [BERNAVERSE_SSO_ADMIN_EMAIL],
  );

  if (!result.rowCount) {
    throw new Error('BERNAverse SSO admin account could not be found.');
  }
}

async function getBernaverseSsoAdminCookie({ force = false } = {}) {
  if (!BERNAVERSE_SSO_ADMIN_EMAIL || !BERNAVERSE_SSO_ADMIN_PASSWORD) {
    throw new Error('BERNAverse SSO admin credentials are not configured.');
  }

  if (
    !force &&
    bernaverseSsoAdminCookie &&
    Date.now() - bernaverseSsoAdminCookieAt < BERNAVERSE_SSO_ADMIN_COOKIE_TTL_MS
  ) {
    return bernaverseSsoAdminCookie;
  }

  let signIn = await callNeonEmailAuth('/sign-in/email', {
    email: BERNAVERSE_SSO_ADMIN_EMAIL,
    password: BERNAVERSE_SSO_ADMIN_PASSWORD,
  });

  if (!signIn.response.ok) {
    const signUp = await callNeonEmailAuth('/sign-up/email', {
      email: BERNAVERSE_SSO_ADMIN_EMAIL,
      password: BERNAVERSE_SSO_ADMIN_PASSWORD,
      name: 'BERNAverse SSO',
    });

    if (!signUp.response.ok) {
      const message = String(
        signUp.payload?.message ||
        signUp.payload?.error?.message ||
        '',
      );

      if (!/already|exist|registered|email/i.test(message)) {
        throw new Error(
          message || `BERNAverse SSO admin provisioning failed (${signUp.response.status}).`,
        );
      }
    }
  }

  await promoteBernaverseSsoAdmin();

  // Re-authenticate after promotion so the admin plugin sees the current role.
  signIn = await callNeonEmailAuth('/sign-in/email', {
    email: BERNAVERSE_SSO_ADMIN_EMAIL,
    password: BERNAVERSE_SSO_ADMIN_PASSWORD,
  });

  if (!signIn.response.ok || !signIn.cookieHeader) {
    const message = String(
      signIn.payload?.message ||
      signIn.payload?.error?.message ||
      '',
    );
    throw new Error(
      message || `BERNAverse SSO admin sign-in failed (${signIn.response.status}).`,
    );
  }

  bernaverseSsoAdminCookie = signIn.cookieHeader;
  bernaverseSsoAdminCookieAt = Date.now();
  return bernaverseSsoAdminCookie;
}

async function callNeonAdmin(path, body, cookieHeader) {
  const response = await fetch(`${NEON_AUTH_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      Origin: 'https://texasnomadgames.com',
      Referer: 'https://texasnomadgames.com/',
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });

  const payload = await response.json().catch(() => ({}));
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie')]
          : []);

  return {
    response,
    payload,
    setCookies: setCookies.filter(Boolean).map(rewriteAuthCookie),
  };
}

async function impersonateTngAccount(userId) {
  let adminCookie = await getBernaverseSsoAdminCookie();
  let result = await callNeonAdmin(
    '/admin/impersonate-user',
    { userId },
    adminCookie,
  );

  if ([401, 403].includes(result.response.status)) {
    bernaverseSsoAdminCookie = '';
    bernaverseSsoAdminCookieAt = 0;
    adminCookie = await getBernaverseSsoAdminCookie({ force: true });
    result = await callNeonAdmin(
      '/admin/impersonate-user',
      { userId },
      adminCookie,
    );
  }

  if (!result.response.ok || !result.setCookies.length) {
    const message = String(
      result.payload?.message ||
      result.payload?.error?.message ||
      result.payload?.error ||
      '',
    );
    const error = new Error(
      message || `TNG SSO session creation failed (${result.response.status}).`,
    );
    error.status = result.response.status;
    throw error;
  }

  return result;
}

async function findTngAccountByEmail(email) {
  const { rows } = await bffPool.query(
    `
      select
        a.id::text as external_user_id,
        pp.handle as external_handle
      from public.accounts a
      left join public.player_profiles pp
        on pp.account_id = a.id
      where lower(trim(a.email)) = lower(trim($1))
      order by a.created_at asc nulls first
      limit 1
    `,
    [email],
  );

  return rows[0] || null;
}

async function ensureTngSsoIdentity(email) {
  if (!BERNAVERSE_APP_KEY) return;

  let account = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    account = await findTngAccountByEmail(email);
    if (account?.external_user_id) break;
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 200 + attempt * 150));
    }
  }

  if (!account?.external_user_id) return;

  const response = await fetch(BERNAVERSE_BRIDGE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-BERNAverse-Key': BERNAVERSE_APP_KEY,
    },
    body: JSON.stringify({
      action: 'ensure_free',
      payload: {
        external_user_id: account.external_user_id,
        external_handle: account.external_handle || null,
        email,
      },
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload?.error || `BERNAverse TNG identity sync failed (${response.status}).`,
    );
  }
}

async function handleBernaverseSso(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  const url = new URL(req.url || '/bernaverse-sso', 'https://auth.texasnomadgames.com');
  const ticket = String(url.searchParams.get('ticket') || '').trim();
  const returnUrl = safeTngSsoReturn(url.searchParams.get('return'));

  if (!ticket) {
    redirectTngSso(res, tngSsoFailureUrl('invalid'));
    return;
  }

  let identity;
  try {
    identity = await consumeBernaverseSsoTicket(ticket);
  } catch (error) {
    console.warn('[TNG BERNAverse SSO] ticket rejected:', error?.message || error);
    redirectTngSso(res, tngSsoFailureUrl('invalid'));
    return;
  }

  const email = String(identity.email || '').trim().toLowerCase();
  const memberId = String(identity.member_id || '').trim();
  const name = String(identity.display_name || email.split('@')[0] || 'Nomad').slice(0, 120);

  let password;
  try {
    password = deriveTngSsoPassword(memberId);
  } catch (error) {
    console.error('[TNG BERNAverse SSO] configuration error:', error?.message || error);
    redirectTngSso(res, tngSsoFailureUrl('unavailable'));
    return;
  }

  // First try the app-private credential. This succeeds for accounts created
  // by BERNAverse SSO on prior visits.
  let signIn = await callNeonEmailAuth('/sign-in/email', { email, password });

  if (!signIn.response.ok) {
    // Existing pre-SSO accounts keep their original password untouched.
    // BERNAverse creates a short-lived TNG session through Neon Auth's Admin
    // impersonation API, so legacy credentials remain valid while SSO works.
    const existingAccount = await findTngAccountByEmail(email).catch(() => null);
    if (existingAccount?.external_user_id) {
      try {
        const impersonation = await impersonateTngAccount(
          existingAccount.external_user_id,
        );

        clearAuthSessionProxyCache();

        try {
          await ensureTngSsoIdentity(email);
        } catch (identityError) {
          console.warn(
            '[TNG BERNAverse SSO] existing identity sync deferred:',
            identityError?.message || identityError,
          );
        }

        redirectTngSso(res, returnUrl, impersonation.setCookies);
        return;
      } catch (impersonationError) {
        console.error(
          '[TNG BERNAverse SSO] existing-account handoff failed:',
          impersonationError?.message || impersonationError,
        );
        redirectTngSso(res, tngSsoFailureUrl('legacy'));
        return;
      }
    }

    const signUp = await callNeonEmailAuth('/sign-up/email', {
      email,
      password,
      name,
    });

    if (!signUp.response.ok) {
      const message = String(
        signUp.payload?.message ||
        signUp.payload?.error?.message ||
        '',
      );

      console.warn('[TNG BERNAverse SSO] account creation failed:', {
        status: signUp.response.status,
        message: message.slice(0, 180),
      });

      redirectTngSso(
        res,
        tngSsoFailureUrl(/already|exist|registered|email/i.test(message) ? 'legacy' : 'setup'),
      );
      return;
    }

    // Sign in after provisioning so the browser receives a normal TNG session
    // cookie scoped to texasnomadgames.com.
    signIn = await callNeonEmailAuth('/sign-in/email', { email, password });
  }

  if (!signIn.response.ok) {
    console.warn('[TNG BERNAverse SSO] internal sign-in failed:', {
      status: signIn.response.status,
    });
    redirectTngSso(res, tngSsoFailureUrl('setup'));
    return;
  }

  clearAuthSessionProxyCache();

  try {
    await ensureTngSsoIdentity(email);
  } catch (error) {
    // Identity linking is idempotent and can retry at normal TNG login.
    console.warn('[TNG BERNAverse SSO] identity sync deferred:', error?.message || error);
  }

  redirectTngSso(res, returnUrl, signIn.setCookies);
}

async function syncTngAccountsToBernaverseFree() {
  if (!BERNAVERSE_APP_KEY) {
    console.info('[BERNAverse sync] skipped: app credential is not configured');
    return;
  }

  const { rows } = await bffPool.query(
    `
      select
        a.id::text as external_user_id,
        lower(trim(a.email)) as email,
        pp.handle as external_handle
      from public.accounts a
      left join public.player_profiles pp
        on pp.account_id = a.id
      where nullif(trim(a.email), '') is not null
        and (
          $1 = ''
          or lower(trim(a.email)) <> lower(trim($1))
        )
      order by a.created_at asc nulls first, a.id
    `,
    [BERNAVERSE_SSO_ADMIN_EMAIL],
  );

  let synced = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index += 5) {
    const batch = rows.slice(index, index + 5);

    const results = await Promise.allSettled(
      batch.map(async (account) => {
        const response = await fetch(BERNAVERSE_BRIDGE_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-BERNAverse-Key': BERNAVERSE_APP_KEY,
          },
          body: JSON.stringify({
            action: 'ensure_free',
            payload: {
              external_user_id: account.external_user_id,
              external_handle: account.external_handle || null,
              email: account.email,
            },
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || `BERNAverse sync failed (${response.status}).`);
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') synced += 1;
      else failed += 1;
    }
  }

  console.info('[BERNAverse sync] TNG FREE membership pass complete', {
    accounts: rows.length,
    synced,
    failed,
  });
}

// Spectators intentionally do not take a room_participants seat. Track their
// authenticated read-only presence separately so the Host can still see who
// is actually watching the room. tng-staging runs one replica, so a short
// in-memory heartbeat is enough for live presence without changing the DB.
const tngSpectatorPresence = new Map();
const TNG_SPECTATOR_TTL_MS = 8000;

function spectatorPresenceKey(roomCode) {
  return String(roomCode || '').trim().toUpperCase();
}

function recordSpectatorPresence(roomCode, profilePayload = {}) {
  const roomKey = spectatorPresenceKey(roomCode);
  if (!roomKey) return;

  const profile = profilePayload?.profile || {};
  const handle = String(
    profile.handle ||
    profile.normalizedHandle ||
    profile.normalized_handle ||
    ''
  ).replace(/^@/, '').trim();

  const accountKey = String(
    profile.accountId ||
    profile.account_id ||
    profile.id ||
    handle ||
    ''
  ).trim();

  if (!accountKey) return;

  if (!tngSpectatorPresence.has(roomKey)) {
    tngSpectatorPresence.set(roomKey, new Map());
  }

  tngSpectatorPresence.get(roomKey).set(accountKey, {
    accountId:
      profile.accountId ||
      profile.account_id ||
      profile.id ||
      null,
    displayName:
      profile.displayName ||
      profile.display_name ||
      profile.fullName ||
      profile.full_name ||
      handle ||
      'Spectator',
    handle: handle || null,
    role: 'spectator',
    seatNumber: null,
    lastSeenAt: Date.now(),
  });
}

function getLiveSpectators(roomCode) {
  const roomKey = spectatorPresenceKey(roomCode);
  const roomPresence = tngSpectatorPresence.get(roomKey);
  if (!roomPresence) return [];

  const cutoff = Date.now() - TNG_SPECTATOR_TTL_MS;
  const live = [];

  for (const [key, spectator] of roomPresence.entries()) {
    if (Number(spectator.lastSeenAt || 0) < cutoff) {
      roomPresence.delete(key);
      continue;
    }
    live.push(spectator);
  }

  if (roomPresence.size === 0) {
    tngSpectatorPresence.delete(roomKey);
  }

  return live;
}

const hostLiveWss = new WebSocketServer({ noServer: true });

async function verifyViralHostAuthorization({ token, deviceId }) {
  const cleanToken = String(token || '').trim();
  const cleanDeviceId = String(deviceId || '').trim();

  if (!cleanToken || !isUuid(cleanDeviceId)) return null;

  const resolved = await resolveAuthenticatedTngAccount({
    headers: {
      authorization: `Bearer ${cleanToken}`,
    },
  });

  if (!resolved.ok) return null;

  const { rows } = await bffPool.query(
    `select
       hs.id,
       hs.host_account_id,
       hs.controller_device_id
     from public.host_sessions hs
     join public.device_sessions ds
       on ds.id = hs.controller_device_id
     where hs.host_account_id = $1::uuid
       and hs.controller_device_id = $2::uuid
       and hs.ended_at is null
       and hs.status::text in ('pairing', 'ready', 'live')
       and ds.status::text in ('connected', 'active')
       and ds.last_heartbeat_at > now() - interval '30 minutes'
       and (ds.expires_at is null or ds.expires_at > now())
     order by hs.updated_at desc
     limit 1`,
    [resolved.account.id, cleanDeviceId],
  );

  const session = rows[0] || null;
  if (!session) return null;

  return {
    accountId: String(resolved.account.id),
    hostSessionId: String(session.id),
    controllerDeviceId: String(session.controller_device_id),
  };
}

// VIRAL! online rooms (WebSocket relay at /viral-live)
const viralLive = createViralLive({
  isAllowedOrigin: (origin) => isAllowedBrowserOrigin(origin),
  verifyHostAuthorization: verifyViralHostAuthorization,
});

const VIRAL_DISPLAY_TARGET_TTL_MS = 90000; // survives background-tab timer throttling (timers can slow to ~1/min)
const viralDisplayTargets = new Map();
const seeThatDisplayTargets = new Map();

function getViralDisplayTarget(displayDeviceId) {
  const key = String(displayDeviceId || '').trim();
  if (!key) return null;

  const target = viralDisplayTargets.get(key);
  if (!target) return null;

  if (Date.now() - Number(target.updatedAt || 0) > VIRAL_DISPLAY_TARGET_TTL_MS) {
    viralDisplayTargets.delete(key);
    return null;
  }

  return target;
}

function getSeeThatDisplayTarget(displayDeviceId) {
  const key = String(displayDeviceId || '').trim();
  if (!key) return null;

  const target = seeThatDisplayTargets.get(key);
  if (!target) return null;

  if (Date.now() - Number(target.updatedAt || 0) > VIRAL_DISPLAY_TARGET_TTL_MS) {
    seeThatDisplayTargets.delete(key);
    return null;
  }

  return target;
}

async function handleViralDisplayTarget(req, res) {
  if (!['POST', 'DELETE'].includes(req.method || '')) {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST or DELETE required.' },
    });
    return;
  }

  const resolved = await resolveAuthenticatedTngAccount(req);
  if (!resolved.ok) {
    sendJson(res, resolved.status, resolved.payload);
    return;
  }

  const { rows } = await bffPool.query(
    `select display_device_id
     from public.host_sessions
     where host_account_id = $1::uuid
       and ended_at is null
       and status::text in ('pairing', 'ready', 'live')
       and display_device_id is not null
     order by updated_at desc
     limit 1`,
    [resolved.account.id],
  );

  const displayDeviceId = rows[0]?.display_device_id || null;
  if (!displayDeviceId) {
    sendJson(res, 200, {
      ok: true,
      displayAttached: false,
      roomCode: null,
    });
    return;
  }

  if (req.method === 'DELETE') {
    viralDisplayTargets.delete(String(displayDeviceId));
    sendJson(res, 200, { ok: true, displayAttached: true, cleared: true });
    return;
  }

  const body = await readJsonBody(req).catch(() => ({}));
  const requestedCode = String(body?.roomCode || '').trim().toUpperCase();
  const incoming = /^[A-Z]{4}$/.test(requestedCode) ? requestedCode : null;
  // Sticky claim: a heartbeat without a readable code keeps the current room on screen.
  const roomCode = incoming || viralDisplayTargets.get(String(displayDeviceId))?.roomCode || null;
  // A paired screen can be owned by only one standalone game at a time.
  seeThatDisplayTargets.delete(String(displayDeviceId));
  viralDisplayTargets.set(String(displayDeviceId), { accountId: resolved.account.id, roomCode, updatedAt: Date.now() });

  sendJson(res, 200, {
    ok: true,
    displayAttached: true,
    roomCode,
  });
}

async function handleSeeThatDisplayTarget(req, res) {
  if (!['POST', 'DELETE'].includes(req.method || '')) {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST or DELETE required.' },
    });
    return;
  }

  const resolved = await resolveAuthenticatedTngAccount(req);
  if (!resolved.ok) {
    sendJson(res, resolved.status, resolved.payload);
    return;
  }

  const { rows } = await bffPool.query(
    `select display_device_id
     from public.host_sessions
     where host_account_id = $1::uuid
       and ended_at is null
       and status::text in ('pairing', 'ready', 'live')
       and display_device_id is not null
     order by updated_at desc
     limit 1`,
    [resolved.account.id],
  );

  const displayDeviceId = rows[0]?.display_device_id || null;
  if (!displayDeviceId) {
    sendJson(res, 200, {
      ok: true,
      displayAttached: false,
      roomCode: null,
    });
    return;
  }

  const displayKey = String(displayDeviceId);

  if (req.method === 'DELETE') {
    seeThatDisplayTargets.delete(displayKey);
    sendJson(res, 200, { ok: true, displayAttached: true, cleared: true });
    return;
  }

  const body = await readJsonBody(req).catch(() => ({}));
  const requestedCode = String(body?.roomCode || '').trim().toUpperCase();
  const incoming = /^[A-Z]{5}$/.test(requestedCode) ? requestedCode : null;
  const roomCode = incoming || seeThatDisplayTargets.get(displayKey)?.roomCode || null;

  // A paired screen can be owned by only one standalone game at a time.
  viralDisplayTargets.delete(displayKey);
  seeThatDisplayTargets.set(displayKey, {
    accountId: resolved.account.id,
    roomCode,
    updatedAt: Date.now(),
  });

  sendJson(res, 200, {
    ok: true,
    displayAttached: true,
    roomCode,
  });
}

// See That?! party rooms (/st-api)
const handleSeeThatApi = createSeeThatApi();

// Word Wrangler online races (/ww-api)
const handleWordWranglerApi = createWordWranglerApi();
// BattleSudoku party rooms (/bs-api)
const handleBattleSudokuApi = createBattleSudokuApi();

const HOST_LIVE_GAME_PATHS = {
  spades: '/spades/host',
  hangman: '/hangman/host',
  'word-search': '/word-search/host',
  'square-biz': '/square-biz/host',
};

async function fetchHostLiveJson(url, token, controllerId) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-TNG-Device-Id': controllerId,
    },
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function loadHostLiveRoom(token, controllerId) {
  return fetchHostLiveJson(
    `${TNG_API_ORIGIN}/host/room-state`,
    token,
    controllerId,
  );
}

async function loadHostLiveGame(token, controllerId, gameId) {
  if (!gameId) return null;

  if (gameId === 'bff') {
    return fetchHostLiveJson(
      `http://127.0.0.1:${port}/bff-api/host`,
      token,
      controllerId,
    );
  }

  const path = HOST_LIVE_GAME_PATHS[gameId];
  if (!path) return null;

  return fetchHostLiveJson(
    `${TNG_API_ORIGIN}${path}`,
    token,
    controllerId,
  );
}

function hostLiveSend(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

hostLiveWss.on('connection', (ws) => {
  let token = null;
  let controllerId = null;
  let activeGameId = null;
  let pollTimer = null;
  let pollBusy = false;
  let roomTick = 0;
  let authenticated = false;

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const poll = async ({ forceRoom = false } = {}) => {
    if (!authenticated || !token || !controllerId || pollBusy) return;
    pollBusy = true;

    try {
      roomTick += 1;
      const shouldLoadRoom = forceRoom || roomTick % 2 === 1 || !activeGameId;

      if (shouldLoadRoom) {
        const { response, payload } = await loadHostLiveRoom(token, controllerId);

        if ([401, 403].includes(response.status)) {
          authenticated = false;
          stopPolling();
          hostLiveSend(ws, { type: 'reauth-required' });
          return;
        }

        if (!response.ok) {
          hostLiveSend(ws, {
            type: 'host-live-warning',
            scope: 'room',
            status: response.status,
          });
        } else {
          const room = payload?.room || null;
          activeGameId = room?.gameId || room?.game_id || null;
          hostLiveSend(ws, { type: 'room-state', room });
        }
      }

      if (activeGameId) {
        const gameResult = await loadHostLiveGame(token, controllerId, activeGameId);

        if (gameResult) {
          const { response, payload } = gameResult;

          if ([401, 403].includes(response.status)) {
            authenticated = false;
            stopPolling();
            hostLiveSend(ws, { type: 'reauth-required' });
            return;
          }

          if (!response.ok) {
            hostLiveSend(ws, {
              type: 'host-live-warning',
              scope: 'game',
              gameId: activeGameId,
              status: response.status,
            });
          } else {
            hostLiveSend(ws, {
              type: 'game-state',
              gameId: activeGameId,
              payload,
            });
          }
        }
      }
    } catch (error) {
      console.warn('[TNG Host Live] poll failed:', error?.message || error);
      hostLiveSend(ws, { type: 'host-live-warning', scope: 'transport' });
    } finally {
      pollBusy = false;
    }
  };

  const authenticate = async (message) => {
    const nextToken = String(message?.token || '');
    const nextControllerId = String(message?.controllerId || '');

    if (!nextToken || !isUuid(nextControllerId)) {
      hostLiveSend(ws, { type: 'auth-failed' });
      return;
    }

    try {
      const { response, payload } = await loadHostLiveRoom(nextToken, nextControllerId);

      if (!response.ok) {
        hostLiveSend(ws, {
          type: response.status === 401 || response.status === 403
            ? 'reauth-required'
            : 'auth-failed',
          status: response.status,
        });
        return;
      }

      token = nextToken;
      controllerId = nextControllerId;
      authenticated = true;
      const room = payload?.room || null;
      activeGameId = room?.gameId || room?.game_id || null;

      hostLiveSend(ws, {
        type: 'host-live-ready',
        room,
      });

      stopPolling();
      await poll({ forceRoom: true });
      pollTimer = setInterval(() => {
        poll().catch(() => {});
      }, 800);
    } catch (error) {
      console.warn('[TNG Host Live] auth failed:', error?.message || error);
      hostLiveSend(ws, { type: 'auth-failed' });
    }
  };

  const authTimeout = setTimeout(() => {
    if (!authenticated && ws.readyState === WebSocket.OPEN) {
      ws.close(4001, 'Host live auth timeout');
    }
  }, 8000);

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;

    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }

    if (message?.type === 'auth') {
      authenticate(message).catch(() => {});
      return;
    }

    if (message?.type === 'refresh') {
      poll({ forceRoom: true }).catch(() => {});
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimeout);
    stopPolling();
  });

  ws.on('error', () => {});
});

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function resolveAuthenticatedTngAccount(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth) {
    return {
      ok: false,
      status: 401,
      payload: { error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' } },
    };
  }

  const response = await fetch(`${TNG_API_ORIGIN}/profile`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      payload: payload?.error
        ? payload
        : { error: { code: 'PROFILE_LOOKUP_FAILED', message: 'TNG could not identify this signed-in account.' } },
    };
  }

  const profile = payload?.profile || {};
  let accountId =
    profile.id ||
    profile.accountId ||
    profile.account_id ||
    payload.accountId ||
    payload.account_id ||
    null;

  if (!accountId) {
    const handle = String(
      profile.handle ||
      profile.normalizedHandle ||
      profile.normalized_handle ||
      ''
    ).replace(/^@/, '').trim().toLowerCase();

    if (handle) {
      const { rows } = await bffPool.query(
        `select account_id from public.player_profiles
         where normalized_handle = $1 or lower(handle) = $1
         limit 1`,
        [handle],
      );
      accountId = rows[0]?.account_id || null;
    }
  }

  if (!accountId || !isUuid(accountId)) {
    return {
      ok: false,
      status: 404,
      payload: { error: { code: 'TNG_ACCOUNT_NOT_FOUND', message: 'Create your TNG profile first.' } },
    };
  }

  const { rows } = await bffPool.query(
    `select id, lower(email) as email
     from public.accounts
     where id = $1::uuid
     limit 1`,
    [accountId],
  );

  const account = rows[0] || null;
  if (!account) {
    return {
      ok: false,
      status: 404,
      payload: { error: { code: 'TNG_ACCOUNT_NOT_FOUND', message: 'TNG account record was not found.' } },
    };
  }

  return { ok: true, account };
}

async function claimLegacyPlayerStats(accountId, email) {
  const client = await bffPool.connect();
  try {
    await client.query('begin');

    const legacy = await client.query(
      `select email, game_id, games_played, wins, losses, quit_games, total_score, best_score
       from public.legacy_player_stats
       where lower(email) = lower($1)
         and claimed_at is null
       for update`,
      [email],
    );

    for (const row of legacy.rows) {
      await client.query(
        `insert into public.player_game_stats
          (account_id, game_id, games_played, wins, losses, quit_games, total_score, best_score, updated_at)
         values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, now())
         on conflict (account_id, game_id) do update set
           games_played = public.player_game_stats.games_played + excluded.games_played,
           wins = public.player_game_stats.wins + excluded.wins,
           losses = public.player_game_stats.losses + excluded.losses,
           quit_games = public.player_game_stats.quit_games + excluded.quit_games,
           total_score = public.player_game_stats.total_score + excluded.total_score,
           best_score = greatest(public.player_game_stats.best_score, excluded.best_score),
           updated_at = now()`,
        [
          accountId,
          row.game_id,
          Number(row.games_played || 0),
          Number(row.wins || 0),
          Number(row.losses || 0),
          Number(row.quit_games || 0),
          Number(row.total_score || 0),
          Number(row.best_score || 0),
        ],
      );
    }

    if (legacy.rows.length > 0) {
      await client.query(
        `update public.legacy_player_stats
         set claimed_at = now(), updated_at = now()
         where lower(email) = lower($1)
           and claimed_at is null`,
        [email],
      );
    }

    await client.query('commit');
    return legacy.rows.length;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function handleTngStats(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const path = sourceUrl.pathname.replace(/^\/tng-stats/, '') || '/';

  const resolved = await resolveAuthenticatedTngAccount(req);
  if (!resolved.ok) {
    sendJson(res, resolved.status, resolved.payload);
    return;
  }

  const { account } = resolved;

  if (req.method === 'GET' && path === '/profile') {
    await claimLegacyPlayerStats(account.id, account.email);

    const { rows } = await bffPool.query(
      `select game_id, games_played, wins, losses, quit_games, total_score, best_score, updated_at
       from public.player_game_stats
       where account_id = $1::uuid
       order by game_id`,
      [account.id],
    );

    sendJson(res, 200, {
      playerStats: rows.map((row) => ({
        gameId: row.game_id,
        gamesPlayed: Number(row.games_played || 0),
        wins: Number(row.wins || 0),
        losses: Number(row.losses || 0),
        quitGames: Number(row.quit_games || 0),
        totalScore: Number(row.total_score || 0),
        bestScore: Number(row.best_score || 0),
        updatedAt: row.updated_at || null,
      })),
    });
    return;
  }

  if (req.method === 'POST' && path === '/quit') {
    const body = await readJsonBody(req).catch(() => ({}));
    const roomCode = String(body?.roomCode || req.headers['x-tng-room-code'] || '')
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9]{4,8}$/.test(roomCode)) {
      sendJson(res, 400, {
        error: { code: 'INVALID_ROOM_CODE', message: 'A valid TNG room code is required.' },
      });
      return;
    }

    const client = await bffPool.connect();
    try {
      await client.query('begin');

      const roomResult = await client.query(
        `select id, game_id, status::text as status, started_at, completed_at, display_state
         from public.game_rooms
         where room_code = $1
         order by created_at desc
         limit 1
         for update`,
        [roomCode],
      );
      const room = roomResult.rows[0] || null;

      if (!room) {
        await client.query('rollback');
        sendJson(res, 404, {
          error: { code: 'ROOM_NOT_FOUND', message: 'That TNG room was not found.' },
        });
        return;
      }

      const participantResult = await client.query(
        `select id, role::text as role, left_at
         from public.room_participants
         where room_id = $1::uuid
           and account_id = $2::uuid
         limit 1
         for update`,
        [room.id, account.id],
      );
      const participant = participantResult.rows[0] || null;

      if (!participant) {
        await client.query('rollback');
        sendJson(res, 404, {
          error: { code: 'PLAYER_NOT_IN_ROOM', message: 'This TNG account is not in that room.' },
        });
        return;
      }

      let countedQuit = false;

      if (!participant.left_at) {
        const state = room.display_state?.gameState || room.display_state || {};
        const phase = String(state?.phase || state?.round_stage || '').toLowerCase();
        const stateCompleted =
          state?.match_complete === true ||
          state?.matchComplete === true ||
          ['finished', 'complete', 'completed', 'game_over', 'game-over'].includes(phase);
        const roomCompleted =
          Boolean(room.completed_at) ||
          room.status === 'completed' ||
          stateCompleted;

        const qualifies =
          participant.role === 'player' &&
          Boolean(room.started_at) &&
          !roomCompleted;

        if (qualifies) {
          const quitEvent = await client.query(
            `insert into public.player_quit_events (room_id, account_id, game_id)
             values ($1::uuid, $2::uuid, $3)
             on conflict (room_id, account_id) do nothing
             returning room_id`,
            [room.id, account.id, room.game_id],
          );

          if (quitEvent.rowCount > 0) {
            countedQuit = true;
            await client.query(
              `insert into public.player_game_stats
                (account_id, game_id, games_played, wins, losses, quit_games, total_score, best_score, updated_at)
               values ($1::uuid, $2, 0, 0, 0, 1, 0, 0, now())
               on conflict (account_id, game_id) do update set
                 quit_games = public.player_game_stats.quit_games + 1,
                 updated_at = now()`,
              [account.id, room.game_id],
            );
          }
        }

        await client.query(
          `update public.room_participants
           set left_at = now(), last_heartbeat_at = now()
           where id = $1::uuid`,
          [participant.id],
        );
      }

      await client.query('commit');
      sendJson(res, 200, {
        leftRoom: true,
        countedQuit,
        gameId: room.game_id,
        roomCode,
      });
      return;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  sendJson(res, 405, {
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported TNG stats operation.' },
  });
}

async function handleTngSessionLifecycle(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required.' },
    });
    return;
  }

  const resolved = await resolveAuthenticatedTngAccount(req);
  if (!resolved.ok) {
    sendJson(res, resolved.status, resolved.payload);
    return;
  }

  const body = await readJsonBody(req).catch(() => ({}));
  const action = String(body?.action || '').toLowerCase();
  const deviceIds = Array.from(new Set(
    (Array.isArray(body?.deviceIds) ? body.deviceIds : [])
      .map((value) => String(value || '').trim())
      .filter((value) => isUuid(value)),
  ));

  if (!['heartbeat', 'disconnect', 'logout'].includes(action)) {
    sendJson(res, 400, {
      error: { code: 'INVALID_SESSION_ACTION', message: 'Invalid TNG session action.' },
    });
    return;
  }

  if (deviceIds.length === 0) {
    sendJson(res, 200, { ok: true, action, devices: 0 });
    return;
  }

  const client = await bffPool.connect();

  try {
    await client.query('begin');

    if (action === 'heartbeat') {
      const result = await client.query(
        `update public.device_sessions
         set status = 'connected',
             last_heartbeat_at = now(),
             updated_at = now()
         where account_id = $1::uuid
           and id = any($2::uuid[])
           and role::text <> 'game_display'
         returning id`,
        [resolved.account.id, deviceIds],
      );

      await client.query('commit');
      sendJson(res, 200, {
        ok: true,
        action,
        devices: result.rowCount || 0,
      });
      return;
    }

    const hostResult = await client.query(
      `select id, display_device_id
       from public.host_sessions
       where host_account_id = $1::uuid
         and controller_device_id = any($2::uuid[])
         and ended_at is null
         and status::text in ('pairing', 'ready', 'live')
       for update`,
      [resolved.account.id, deviceIds],
    );

    await client.query(
      `update public.device_sessions
       set status = 'disconnected',
           last_heartbeat_at = now(),
           updated_at = now()
       where account_id = $1::uuid
         and id = any($2::uuid[])`,
      [resolved.account.id, deviceIds],
    );

    if (action === 'logout') {
      await client.query(
        `update public.room_participants
         set left_at = coalesce(left_at, now()),
             last_heartbeat_at = now()
         where account_id = $1::uuid
           and device_session_id = any($2::uuid[])
           and left_at is null`,
        [resolved.account.id, deviceIds],
      );

      const hostSessionIds = hostResult.rows
        .map((row) => row.id)
        .filter((value) => isUuid(value));
      const displayDeviceIds = hostResult.rows
        .map((row) => row.display_device_id)
        .filter((value) => isUuid(value));

      if (hostSessionIds.length) {
        await client.query(
          `update public.game_rooms
           set status = 'abandoned',
               updated_at = now()
           where host_session_id = any($1::uuid[])
             and status::text in ('lobby', 'live', 'paused')`,
          [hostSessionIds],
        );

        await client.query(
          `update public.display_pairings
           set consumed_at = coalesce(consumed_at, now())
           where host_session_id = any($1::uuid[])
             and consumed_at is null`,
          [hostSessionIds],
        );

        await client.query(
          `update public.host_sessions
           set status = 'ended',
               ended_at = now(),
               updated_at = now()
           where id = any($1::uuid[])`,
          [hostSessionIds],
        );
      }

      if (displayDeviceIds.length) {
        await client.query(
          `update public.device_sessions
           set status = 'disconnected',
               updated_at = now()
           where id = any($1::uuid[])`,
          [displayDeviceIds],
        );
      }
    }

    await client.query('commit');
    sendJson(res, 200, {
      ok: true,
      action,
      devices: deviceIds.length,
      hostsEnded: action === 'logout' ? hostResult.rows.length : 0,
    });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}


const WORD_SEARCH_DISPLAY_COLORS = {
  1: '#BC13FE',
  2: '#FF5F1F',
  3: '#FFD700',
  4: '#22D3EE',
};

function projectWordSearchDisplayState(rawState = {}, participants = []) {
  const scores = rawState?.scores && typeof rawState.scores === 'object'
    ? rawState.scores
    : {};

  return {
    phase: rawState.phase || 'setup',
    mode: rawState.mode || 'race',
    difficulty: rawState.difficulty || 'simpleton',
    category: rawState.category || 'random',
    grid: Array.isArray(rawState.grid) ? rawState.grid : [],
    words: Array.isArray(rawState.words)
      ? rawState.words.map((word) => ({
          word: word.word,
          found: word.found === true,
          foundBy: word.foundBy ?? null,
          foundAt: word.foundAt ?? null,
          cells: word.found === true && Array.isArray(word.cells) ? word.cells : [],
          points: word.found === true ? (word.points ?? null) : null,
          directionLabel: word.found === true ? (word.directionLabel ?? null) : null,
          revealed: word.revealed === true,
        }))
      : [],
    scores: { ...scores },
    activeSeat: Number(rawState.active_seat || 0),
    timeEnd: rawState.time_end || null,
    paused: rawState.paused === true,
    message: rawState.message || null,
    winnerSeat: rawState.winner_seat || null,
    lastAction: rawState.last_action || null,
    roundNumber: Number(rawState.round_number || 0),
    players: participants.map((player) => {
      const seat = Number(player.seat_number || 0);
      return {
        playerId: player.account_id,
        accountId: player.account_id,
        seatNumber: seat,
        role: player.role || 'player',
        name: player.display_name || player.handle || (seat ? `Seat ${seat}` : 'Player'),
        handle: player.handle || null,
        color: WORD_SEARCH_DISPLAY_COLORS[seat] || '#FFFFFF',
        score: Number(scores[String(seat)] || 0),
      };
    }),
  };
}

async function handleTngDisplayState(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required.' },
    });
    return;
  }

  const displayId = String(req.headers['x-tng-display-id'] || '');
  const displayToken = String(req.headers['x-tng-display-token'] || '');

  const upstream = await fetch(`${TNG_API_ORIGIN}/display/state`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(displayId ? { 'X-TNG-Display-Id': displayId } : {}),
      ...(displayToken ? { 'X-TNG-Display-Token': displayToken } : {}),
    },
  });

  const payload = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    sendJson(res, upstream.status, payload);
    return;
  }

  const room = payload?.room || null;

  if (!room) {
    const viralTarget = getViralDisplayTarget(displayId);
    const seeThatTarget = getSeeThatDisplayTarget(displayId);
    const standaloneTarget = [
      viralTarget ? { ...viralTarget, gameId: 'viral' } : null,
      seeThatTarget ? { ...seeThatTarget, gameId: 'see-that' } : null,
    ]
      .filter(Boolean)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];

    if (standaloneTarget) {
      const gameId = standaloneTarget.gameId;
      const roomCode = standaloneTarget.roomCode || '';
      sendJson(res, 200, {
        ...payload,
        status: roomCode ? 'connected' : 'waiting_for_room',
        room: {
          id: `${gameId}-display-${displayId}`,
          gameId,
          roomCode,
          status: roomCode ? 'live' : 'lobby',
          gameState: {
            displayOnly: true,
          },
        },
      });
      return;
    }
  }

  if (!room || room.gameId !== 'word-search' || !isUuid(room.id)) {
    sendJson(res, 200, payload);
    return;
  }

  const { rows: roomRows } = await bffPool.query(`
    select id, display_state
    from public.game_rooms
    where id = $1::uuid
      and game_id = 'word-search'
      and status::text in ('lobby', 'live', 'paused')
    limit 1
  `, [room.id]);

  const liveRoom = roomRows[0] || null;
  if (!liveRoom) {
    sendJson(res, 200, payload);
    return;
  }

  const { rows: participants } = await bffPool.query(`
    select
      rp.account_id,
      rp.role::text as role,
      rp.seat_number,
      pp.display_name,
      pp.handle
    from public.room_participants rp
    left join public.player_profiles pp
      on pp.account_id = rp.account_id
    where rp.room_id = $1::uuid
      and rp.left_at is null
      and rp.seat_number in (1, 2, 3, 4)
    order by rp.seat_number
  `, [room.id]);

  const rawState =
    liveRoom.display_state?.gameState ||
    liveRoom.display_state?.game_state ||
    {};

  sendJson(res, 200, {
    ...payload,
    room: {
      ...room,
      state: projectWordSearchDisplayState(rawState, participants),
    },
  });
}

async function handleTngAccountRoute(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required.' },
    });
    return;
  }

  const auth = String(req.headers.authorization || '');
  if (!auth) {
    sendJson(res, 401, {
      error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' },
    });
    return;
  }

  const profileResponse = await fetch(`${TNG_API_ORIGIN}/profile`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
    },
  });

  if (!profileResponse.ok) {
    const payload = await profileResponse.json().catch(() => ({}));
    sendJson(res, profileResponse.status, payload?.error
      ? payload
      : {
          error: {
            code: 'PROFILE_LOOKUP_FAILED',
            message: 'TNG could not identify this signed-in account.',
          },
        });
    return;
  }

  const payload = await profileResponse.json().catch(() => ({}));
  const profile = payload?.profile || {};
  let accountId =
    profile.accountId ||
    profile.account_id ||
    payload.accountId ||
    payload.account_id ||
    null;

  if (!accountId) {
    const handle = String(
      profile.handle ||
      profile.normalizedHandle ||
      profile.normalized_handle ||
      ''
    ).replace(/^@/, '').trim().toLowerCase();

    if (handle) {
      const { rows } = await bffPool.query(`
        select account_id
        from public.player_profiles
        where normalized_handle = $1
           or lower(handle) = $1
        limit 1
      `, [handle]);
      accountId = rows[0]?.account_id || null;
    }
  }

  if (!accountId) {
    const email = String(
      profile.email ||
      payload.email ||
      ''
    ).trim().toLowerCase();

    if (email) {
      const { rows } = await bffPool.query(`
        select id
        from public.accounts
        where lower(email) = $1
        limit 1
      `, [email]);
      accountId = rows[0]?.id || null;
    }
  }

  if (!accountId || !isUuid(accountId)) {
    sendJson(res, 200, {
      route: 'default',
      activeHost: false,
    });
    return;
  }

  const currentDeviceId = String(req.headers['x-tng-device-id'] || '');

  const { rows } = await bffPool.query(`
    select
      hs.id,
      hs.status::text as status,
      hs.controller_device_id,
      hs.display_device_id,
      hs.updated_at
    from public.host_sessions hs
    join public.device_sessions ds
      on ds.id = hs.controller_device_id
    where hs.host_account_id = $1::uuid
      and hs.ended_at is null
      and hs.status::text in ('pairing', 'ready', 'live')
      and ds.status::text in ('connected', 'active')
      and ds.last_heartbeat_at > now() - interval '30 minutes'
      and (ds.expires_at is null or ds.expires_at > now())
    order by hs.updated_at desc
    limit 1
  `, [accountId]);

  const session = rows[0] || null;
  if (!session) {
    sendJson(res, 200, {
      route: 'default',
      activeHost: false,
    });
    return;
  }

  const sameController =
    isUuid(currentDeviceId) &&
    String(session.controller_device_id) === currentDeviceId;

  sendJson(res, 200, {
    route: sameController ? 'host' : 'display',
    activeHost: true,
    sameController,
    displayPaired: Boolean(session.display_device_id),
  });
}

async function proxyTngApi(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const targetPath = sourceUrl.pathname.replace(/^\/tng-api/, '') || '/';
  const targetUrl = `${TNG_API_ORIGIN}${targetPath}${sourceUrl.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (
      value !== undefined &&
      !['host', 'connection', 'content-length'].includes(key.toLowerCase())
    ) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body,
    redirect: 'manual',
  });

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  const responseBody = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, responseHeaders);
  res.end(responseBody);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function verifyBffHostWithTngApi(req, controllerId) {
  const auth = String(req.headers.authorization || '');
  if (!auth) return { ok: false, status: 401, payload: { error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' } } };

  const response = await fetch(`${TNG_API_ORIGIN}/host/room-state`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
      'X-TNG-Device-Id': controllerId,
    },
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function loadRailwayBffHostRoom(controllerId) {
  const { rows } = await bffPool.query(`
    select gr.id, gr.room_code, gr.game_id, gr.status, gr.revision, gr.display_state,
           gr.created_at, gr.updated_at, hs.id as host_session_id
    from public.host_sessions hs
    join public.game_rooms gr on gr.host_session_id = hs.id
    where hs.controller_device_id = $1::uuid
      and hs.status in ('pairing','ready','live')
      and gr.status in ('lobby','live','paused')
      and gr.game_id = 'bff'
    order by gr.updated_at desc
    limit 1
  `, [controllerId]);

  return rows[0] || null;
}

async function assignBffSeats(roomId) {
  const client = await bffPool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`
      select id, seat_number
      from public.room_participants
      where room_id = $1::uuid and left_at is null
      order by joined_at asc
      for update
    `, [roomId]);

    const used = new Set(rows.filter((row) => row.seat_number != null).map((row) => Number(row.seat_number)));
    used.add(1);

    let nextSeat = 2;
    for (const row of rows) {
      if (row.seat_number != null) continue;
      while (used.has(nextSeat)) nextSeat += 1;
      await client.query(
        'update public.room_participants set seat_number = $1, last_heartbeat_at = now() where id = $2::uuid',
        [nextSeat, row.id],
      );
      used.add(nextSeat);
      nextSeat += 1;
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function loadBffParticipants(roomId, gameState = {}) {
  const { rows } = await bffPool.query(`
    select rp.id, rp.account_id, rp.device_session_id, rp.role::text as role, rp.seat_number,
           rp.joined_at, rp.last_heartbeat_at,
           pp.display_name, pp.handle, a.email
    from public.room_participants rp
    join public.accounts a on a.id = rp.account_id
    left join public.player_profiles pp on pp.account_id = rp.account_id
    where rp.room_id = $1::uuid
      and rp.left_at is null
    order by rp.seat_number nulls last, rp.joined_at
  `, [roomId]);

  const teamMap = gameState?.playerTeams || {};
  return rows.map((row) => ({
    playerId: row.account_id,
    accountId: row.account_id,
    participantId: row.id,
    deviceSessionId: row.device_session_id,
    role: row.role || 'player',
    seatNumber: row.seat_number,
    familyTeam: teamMap[row.account_id] ?? null,
    playerName: row.display_name || row.handle || row.email.split('@')[0],
    name: row.display_name || row.handle || row.email.split('@')[0],
    handle: row.handle || null,
    connected: true,
    active: true,
    joinedAt: row.joined_at ? new Date(row.joined_at).getTime() : Date.now(),
    lastActionAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : Date.now(),
  }));
}

async function ensureBffTeamAssignments(room, gameState = {}, players = []) {
  const teamMap = { ...(gameState.playerTeams || {}) };
  let team1Count = Object.values(teamMap).filter((value) => Number(value) === 1).length;
  let team2Count = Object.values(teamMap).filter((value) => Number(value) === 2).length;
  let changed = false;

  for (const player of players) {
    const playerId = String(player.playerId || '');
    if (!playerId || Object.prototype.hasOwnProperty.call(teamMap, playerId)) continue;

    let team = null;
    if (team1Count < 6 && team2Count < 6) {
      team = team1Count <= team2Count ? 1 : 2;
    } else if (team1Count < 6) {
      team = 1;
    } else if (team2Count < 6) {
      team = 2;
    }

    if (!team) {
      teamMap[playerId] = 0;
      changed = true;
      continue;
    }

    teamMap[playerId] = team;
    if (team === 1) team1Count += 1;
    else team2Count += 1;
    changed = true;
  }

  if (!changed) {
    return { gameState, room };
  }

  const nextGameState = {
    ...gameState,
    playerTeams: teamMap,
  };

  const savedRoom = await saveBffGameState(room.id, room.display_state || {}, nextGameState);
  return {
    gameState: nextGameState,
    room: savedRoom ? { ...room, ...savedRoom } : room,
  };
}


const WORD_SEARCH_SPECTATOR_COLORS = {
  1: '#BC13FE',
  2: '#FF5F1F',
  3: '#FFD700',
  4: '#22D3EE',
};

function projectWordSearchSpectatorState(rawState = {}, participants = []) {
  const scores = rawState?.scores && typeof rawState.scores === 'object'
    ? rawState.scores
    : {};

  return {
    phase: rawState.phase || 'setup',
    mode: rawState.mode || 'race',
    difficulty: rawState.difficulty || 'simpleton',
    category: rawState.category || 'random',
    grid: Array.isArray(rawState.grid) ? rawState.grid : [],
    words: Array.isArray(rawState.words)
      ? rawState.words.map((word) => ({
          word: word.word,
          found: word.found === true,
          foundBy: word.foundBy ?? null,
          foundAt: word.foundAt ?? null,
          cells: word.found === true && Array.isArray(word.cells) ? word.cells : [],
          points: word.found === true ? (word.points ?? null) : null,
          directionLabel: word.found === true ? (word.directionLabel ?? null) : null,
          revealed: word.revealed === true,
        }))
      : [],
    scores: { ...scores },
    activeSeat: Number(rawState.active_seat || rawState.activeSeat || 0),
    timeEnd: rawState.time_end || rawState.timeEnd || null,
    paused: rawState.paused === true,
    message: rawState.message || null,
    winnerSeat: rawState.winner_seat || rawState.winnerSeat || null,
    lastAction: rawState.last_action || rawState.lastAction || null,
    roundNumber: Number(rawState.round_number || rawState.roundNumber || 0),
    players: participants.map((player) => {
      const seat = Number(player.seat_number || 0);
      return {
        playerId: player.account_id,
        accountId: player.account_id,
        seatNumber: seat,
        role: player.role || 'player',
        name: player.display_name || player.handle || (seat ? `Seat ${seat}` : 'Player'),
        handle: player.handle || null,
        color: WORD_SEARCH_SPECTATOR_COLORS[seat] || '#FFFFFF',
        score: Number(scores[String(seat)] || 0),
      };
    }),
  };
}

function sanitizeGenericSpectatorState(gameId, displayState = {}) {
  const source =
    displayState?.state ||
    displayState?.gameState ||
    displayState?.game_state ||
    displayState ||
    {};

  let state;
  try {
    state = JSON.parse(JSON.stringify(source));
  } catch {
    state = { ...source };
  }

  if (gameId === 'hangman') {
    delete state.word;
    delete state.secretWord;
    delete state.secret_word;
    delete state.answer;
    delete state.normalizedWord;
    delete state.normalized_word;
  }

  if (gameId === 'spades') {
    delete state.deck;
    delete state.hands;
    delete state.privateHands;
    delete state.private_hands;

    if (Array.isArray(state.players)) {
      state.players = state.players.map((player) => {
        const next = { ...player };
        const hiddenCards =
          (Array.isArray(next.hand) && next.hand) ||
          (Array.isArray(next.cards) && next.cards) ||
          (Array.isArray(next.privateHand) && next.privateHand) ||
          [];
        if (next.cardCount == null && hiddenCards.length) {
          next.cardCount = hiddenCards.length;
        }
        delete next.hand;
        delete next.cards;
        delete next.privateHand;
        delete next.private_hand;
        return next;
      });
    }
  }

  if (gameId === 'square-biz') {
    const revealAnswer = ['result', 'finished'].includes(String(state.phase || ''));
    if (!revealAnswer) {
      delete state.correctAnswer;
      delete state.correct_answer;
    }

    if (state.currentQuestion && typeof state.currentQuestion === 'object') {
      state.currentQuestion = { ...state.currentQuestion };
      if (!revealAnswer) {
        delete state.currentQuestion.answer;
        delete state.currentQuestion.correctAnswer;
        delete state.currentQuestion.correct_answer;
      }
    }
  }

  return state;
}

async function handleTngSpectator(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const path = sourceUrl.pathname.replace(/^\/tng-spectator/, '') || '/';

  if (req.method !== 'GET' || path !== '/state') {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'GET /state required.' },
    });
    return;
  }

  const auth = String(req.headers.authorization || '');
  if (!auth) {
    sendJson(res, 401, {
      error: { code: 'AUTH_REQUIRED', message: 'Sign in to spectate.' },
    });
    return;
  }

  const profileResponse = await fetch(`${TNG_API_ORIGIN}/profile`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
    },
  });

  if (!profileResponse.ok) {
    const payload = await profileResponse.json().catch(() => ({}));
    sendJson(res, profileResponse.status, payload?.error
      ? payload
      : {
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Your TNG session could not be verified.',
          },
        });
    return;
  }

  const profilePayload = await profileResponse.json().catch(() => ({}));

  const roomCode = String(
    sourceUrl.searchParams.get('room') ||
    req.headers['x-tng-room-code'] ||
    ''
  ).trim().toUpperCase();

  if (!roomCode) {
    sendJson(res, 400, {
      error: { code: 'ROOM_REQUIRED', message: 'Enter a live room code to spectate.' },
    });
    return;
  }

  const { rows } = await bffPool.query(`
    select id, room_code, game_id, status::text as status, revision, display_state,
           created_at, updated_at
    from public.game_rooms
    where upper(room_code) = upper($1)
      and status::text in ('lobby', 'live', 'paused')
    order by updated_at desc
    limit 1
  `, [roomCode]);

  let room = rows[0] || null;
  if (!room) {
    sendJson(res, 404, {
      error: { code: 'ROOM_NOT_FOUND', message: `Room "${roomCode}" is not live.` },
    });
    return;
  }

  recordSpectatorPresence(room.room_code, profilePayload);

  let state = {};

  if (room.game_id === 'bff') {
    room = await reconcileBffTimers(room);
    const internalState = extractBffGameState(room.display_state || {});
    const players = await loadBffParticipants(room.id, internalState);
    state = sanitizeBffPlayerState(internalState, players, null);
  } else if (room.game_id === 'word-search') {
    const { rows: participants } = await bffPool.query(`
      select
        rp.account_id,
        rp.role::text as role,
        rp.seat_number,
        pp.display_name,
        pp.handle
      from public.room_participants rp
      left join public.player_profiles pp
        on pp.account_id = rp.account_id
      where rp.room_id = $1::uuid
        and rp.left_at is null
        and rp.seat_number in (1, 2, 3, 4)
      order by rp.seat_number
    `, [room.id]);

    const rawState =
      room.display_state?.gameState ||
      room.display_state?.game_state ||
      {};

    state = projectWordSearchSpectatorState(rawState, participants);
  } else {
    state = sanitizeGenericSpectatorState(room.game_id, room.display_state || {});
  }

  sendJson(res, 200, {
    status: 'spectating',
    room: {
      id: room.id,
      roomCode: room.room_code,
      gameId: room.game_id,
      status: room.status,
      revision: room.revision,
      state,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
      spectator: true,
    },
  });
}


async function handleTngHostRoster(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required.' },
    });
    return;
  }

  const controllerId = String(req.headers['x-tng-device-id'] || '');
  if (!isUuid(controllerId)) {
    sendJson(res, 400, {
      error: { code: 'CONTROLLER_REQUIRED', message: 'Host Controller is required.' },
    });
    return;
  }

  const auth = String(req.headers.authorization || '');
  if (!auth) {
    sendJson(res, 401, {
      error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' },
    });
    return;
  }

  // Let the authoritative TNG API verify this signed-in Host/controller pair.
  const verified = await fetch(`${TNG_API_ORIGIN}/host/room-state`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
      'X-TNG-Device-Id': controllerId,
    },
  });

  if (!verified.ok) {
    const payload = await verified.json().catch(() => ({}));
    sendJson(res, verified.status, payload?.error
      ? payload
      : {
          error: {
            code: 'HOST_SESSION_INVALID',
            message: 'TNG could not verify this Host session.',
          },
        });
    return;
  }

  const { rows: roomRows } = await bffPool.query(`
    select gr.id, gr.room_code, gr.game_id, gr.status::text as status
    from public.host_sessions hs
    join public.game_rooms gr on gr.host_session_id = hs.id
    where hs.controller_device_id = $1::uuid
      and hs.ended_at is null
      and gr.status::text in ('lobby', 'live', 'paused')
    order by gr.updated_at desc
    limit 1
  `, [controllerId]);

  const room = roomRows[0] || null;
  if (!room) {
    sendJson(res, 200, {
      room: null,
      people: [],
      players: [],
      spectators: [],
      counts: { people: 0, players: 0, spectators: 0 },
    });
    return;
  }

  const { rows: participantRows } = await bffPool.query(`
    select
      rp.account_id,
      rp.role::text as role,
      rp.seat_number,
      rp.joined_at,
      pp.display_name,
      pp.handle
    from public.room_participants rp
    left join public.player_profiles pp
      on pp.account_id = rp.account_id
    where rp.room_id = $1::uuid
      and rp.left_at is null
    order by
      case when rp.role::text = 'host_player' then 0 else 1 end,
      rp.seat_number nulls last,
      rp.joined_at
  `, [room.id]);

  const players = participantRows.map((row) => ({
    accountId: row.account_id,
    displayName:
      row.display_name ||
      row.handle ||
      (row.role === 'host_player' ? 'Host' : 'Player'),
    handle: row.handle || null,
    role: row.role === 'host_player' ? 'host' : 'player',
    seatNumber: row.seat_number == null ? null : Number(row.seat_number),
    joinedAt: row.joined_at,
  }));

  const playerAccountIds = new Set(
    players
      .map((player) => String(player.accountId || ''))
      .filter(Boolean),
  );
  const playerHandles = new Set(
    players
      .map((player) => String(player.handle || '').toLowerCase())
      .filter(Boolean),
  );

  const spectators = getLiveSpectators(room.room_code).filter((spectator) => {
    const accountId = String(spectator.accountId || '');
    const handle = String(spectator.handle || '').toLowerCase();
    return !(
      (accountId && playerAccountIds.has(accountId)) ||
      (handle && playerHandles.has(handle))
    );
  });

  const people = [...players, ...spectators];

  sendJson(res, 200, {
    room: {
      id: room.id,
      roomCode: room.room_code,
      gameId: room.game_id,
      status: room.status,
    },
    people,
    players,
    spectators,
    counts: {
      people: people.length,
      players: players.filter((player) => player.role === 'player').length,
      spectators: spectators.length,
    },
  });
}

function extractBffGameState(displayState = {}) {
  if (
    displayState &&
    typeof displayState === 'object' &&
    displayState.gameState &&
    typeof displayState.gameState === 'object'
  ) {
    return { ...displayState.gameState };
  }

  return displayState && typeof displayState === 'object'
    ? { ...displayState }
    : {};
}

function wrapBffGameState(displayState = {}, gameState = {}) {
  const base = displayState && typeof displayState === 'object'
    ? { ...displayState }
    : {};

  if (base.gameState && typeof base.gameState === 'object') {
    return {
      ...base,
      gameId: base.gameId || 'bff',
      screen: base.screen || 'game',
      gameState,
    };
  }

  return {
    ...base,
    ...gameState,
    gameId: 'bff',
  };
}

function getBffAnswers(gameState = {}) {
  const raw = Array.isArray(gameState.answers) ? gameState.answers : [];
  return raw.map((answer, index) => {
    if (typeof answer === 'string') {
      return {
        text: answer,
        points: 0,
        revealed: false,
        index,
      };
    }

    return {
      ...answer,
      index,
      revealed: Boolean(answer?.revealed),
      points: Number(answer?.points) || 0,
    };
  });
}

function sanitizeBffHostState(gameState = {}, players = []) {
  const answers = getBffAnswers(gameState);
  const answerCount = Math.max(
    answers.length,
    Number(gameState.answer_count || gameState.answerCount || 0),
  );

  const safeAnswers = Array.from({ length: answerCount }, (_, index) => {
    const answer = answers[index] || {};
    return {
      index,
      text: String(answer.text || answer.answer || ''),
      revealed: Boolean(answer.revealed),
      points: Number(answer.points) || 0,
    };
  });

  return {
    phase: gameState.phase || 'waiting',
    family1: gameState.family1 || 'Family 1',
    family2: gameState.family2 || 'Family 2',
    score1: Number(gameState.score1) || 0,
    score2: Number(gameState.score2) || 0,
    round_number: Number(gameState.round_number || gameState.roundNumber || 1),
    round_bank: Number(gameState.round_bank || gameState.roundBank || 0),
    current_question:
      gameState.current_question ||
      gameState.currentQuestion ||
      gameState.question ||
      '',
    control_team: Number(gameState.control_team || gameState.active_turn || 1),
    active_turn: Number(gameState.active_turn || gameState.control_team || 1),
    steal_mode: Boolean(gameState.steal_mode),
    bye_count: Math.max(0, Math.min(3, Number(gameState.bye_count) || 0)),
    buzzer_phase: gameState.buzzer_phase || null,
    buzzer_open: Boolean(gameState.buzzer_open || gameState.buzzer_phase === 'buzzer_active'),
    buzz_winner: gameState.buzz_winner || null,
    family_names_set: bffFamilyNamesReady(gameState),
    round_stage: gameState.round_stage || 'setup',
    faceoff_players: gameState.faceoff_players || {},
    faceoff_results: gameState.faceoff_results || {},
    faceoff_attempted: gameState.faceoff_attempted || { 1: [], 2: [] },
    faceoff_winner_id: gameState.faceoff_winner_id || null,
    faceoff_winner_team: Number(gameState.faceoff_winner_team) || null,
    faceoff_x_event: gameState.faceoff_x_event || null,
    play_pass_choice: gameState.play_pass_choice || null,
    active_player_id: gameState.active_player_id || null,
    answer_deadline_at: Number(gameState.answer_deadline_at) || null,
    consecutive_timeouts: Number(gameState.consecutive_timeouts) || 0,
    original_playing_team: Number(gameState.original_playing_team) || null,
    steal_team: Number(gameState.steal_team) || null,
    match_complete: Boolean(gameState.match_complete),
    match_tied: Boolean(gameState.match_tied),
    winning_team: Number(gameState.winning_team) || null,
    is_tiebreak: Boolean(gameState.is_tiebreak),
    dysfunction: gameState.dysfunction || null,
    playerTeams: gameState.playerTeams || {},
    sound_cue: gameState.sound_cue || null,
    answers: safeAnswers,
    players,
  };
}

async function saveBffGameState(roomId, originalDisplayState, nextGameState) {
  const nextDisplayState = wrapBffGameState(originalDisplayState, nextGameState);

  const { rows } = await bffPool.query(`
    update public.game_rooms
    set display_state = $2::jsonb,
        revision = revision + 1,
        updated_at = now()
    where id = $1::uuid
    returning id, room_code, game_id, status, revision, display_state, created_at, updated_at
  `, [roomId, JSON.stringify(nextDisplayState)]);

  const saved = rows[0] || null;
  return saved;
}

function ensureBffAnswerSlot(answers, index) {
  const next = answers.map((answer) => ({ ...answer }));
  while (next.length <= index) {
    next.push({
      text: '',
      answer: '',
      points: 0,
      revealed: false,
    });
  }
  return next;
}

function bffUndoSnapshot(gameState = {}) {
  const snapshot = JSON.parse(JSON.stringify(gameState || {}));
  delete snapshot._hostUndo;
  return snapshot;
}


function bffRankPoints(answerCount, index) {
  const scales = {
    1: [100],
    2: [65, 35],
    3: [50, 30, 20],
    4: [40, 30, 20, 10],
    5: [35, 25, 18, 13, 9],
    6: [30, 23, 18, 13, 9, 7],
    7: [28, 22, 17, 13, 9, 6, 5],
    8: [25, 20, 16, 13, 10, 7, 5, 4],
  };

  const scale = scales[Math.max(1, Math.min(8, Number(answerCount) || 1))] || scales[8];
  return Number(scale[index] ?? 0);
}

function normalizeBffRankedAnswers(rawAnswers = []) {
  const answers = Array.isArray(rawAnswers) ? rawAnswers.slice(0, 8) : [];

  return answers.map((answer, index) => ({
    ...answer,
    text: String(answer?.text || answer?.answer || ''),
    points: bffRankPoints(answers.length, index),
    revealed: false,
  }));
}

async function pickBffSurvey(gameState = {}) {
  const used = Array.isArray(gameState.used_survey_ids)
    ? gameState.used_survey_ids.map((id) => Number(id)).filter(Number.isFinite)
    : [];

  let query = `
    select id, question, answers
    from public.bff_surveys
    where active = true
      and not (id = any($1::bigint[]))
    order by random()
    limit 1
  `;
  let params = [used];

  let { rows } = await bffPool.query(query, params);

  if (!rows.length) {
    const reset = await bffPool.query(`
      select id, question, answers
      from public.bff_surveys
      where active = true
      order by random()
      limit 1
    `);
    rows = reset.rows;
  }

  const survey = rows[0] || null;
  if (!survey) return null;

  const answers = Array.isArray(survey.answers)
    ? survey.answers
    : [];

  return {
    id: Number(survey.id),
    question: String(survey.question || ''),
    answers: normalizeBffRankedAnswers(answers),
  };
}


function bffFamilyNamesReady(gameState = {}) {
  const family1 = String(gameState.family1 || '').trim();
  const family2 = String(gameState.family2 || '').trim();

  return Boolean(
    family1 &&
    family2 &&
    family1.toLowerCase() !== 'family 1' &&
    family2.toLowerCase() !== 'family 2'
  );
}

function bffTeamForPlayer(gameState = {}, playerId) {
  return Number((gameState.playerTeams || {})[String(playerId)] || 0) || null;
}

function bffTeamRoster(players = [], gameState = {}, team) {
  return players
    .filter((player) => bffTeamForPlayer(gameState, player.playerId) === Number(team))
    .slice()
    .sort((a, b) =>
      Number(a.seatNumber || 999) - Number(b.seatNumber || 999)
      || Number(a.joinedAt || 0) - Number(b.joinedAt || 0)
    );
}

function bffNextPlayerId(players = [], gameState = {}, team, currentPlayerId) {
  const roster = bffTeamRoster(players, gameState, team);
  if (!roster.length) return null;

  const currentIndex = roster.findIndex(
    (player) => String(player.playerId) === String(currentPlayerId || ''),
  );

  if (currentIndex < 0) return roster[0].playerId;
  return roster[(currentIndex + 1) % roster.length]?.playerId || roster[0].playerId;
}

function bffAssignedPlayers(players = [], gameState = {}) {
  return players.filter((player) => [1, 2].includes(bffTeamForPlayer(gameState, player.playerId)));
}

function bffFaceoffAttempted(gameState = {}, team) {
  const attempted = gameState.faceoff_attempted || {};
  return Array.isArray(attempted[String(team)])
    ? attempted[String(team)].map(String)
    : [];
}

function bffMarkFaceoffAttempt(gameState, playerId) {
  const team = bffTeamForPlayer(gameState, playerId);
  if (!team) return;

  const attempted = {
    ...(gameState.faceoff_attempted || {}),
    [String(team)]: bffFaceoffAttempted(gameState, team),
  };
  const id = String(playerId);
  if (!attempted[String(team)].includes(id)) attempted[String(team)].push(id);
  gameState.faceoff_attempted = attempted;
}

function bffNextUnattemptedPlayer(players, gameState, team, currentPlayerId) {
  const roster = bffTeamRoster(players, gameState, team);
  if (!roster.length) return null;

  const attempted = new Set(bffFaceoffAttempted(gameState, team));
  const currentIndex = Math.max(
    0,
    roster.findIndex((player) => String(player.playerId) === String(currentPlayerId || '')),
  );

  for (let offset = 1; offset <= roster.length; offset += 1) {
    const player = roster[(currentIndex + offset) % roster.length];
    if (player && !attempted.has(String(player.playerId))) return player.playerId;
  }

  return null;
}

function bffStartFamilyTurn(gameState, playerId) {
  gameState.active_player_id = playerId || null;
  gameState.answer_deadline_at = playerId ? Date.now() + 20000 : null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.round_stage = playerId ? 'family_play' : gameState.round_stage;
}

function bffEnterSteal(gameState) {
  const originalTeam = Number(gameState.control_team || gameState.active_turn || 1) === 2 ? 2 : 1;
  const stealTeam = originalTeam === 1 ? 2 : 1;

  gameState.original_playing_team = originalTeam;
  gameState.steal_team = stealTeam;
  gameState.steal_mode = true;
  gameState.consecutive_timeouts = 0;
  gameState.round_stage = 'steal_ready';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.buzz_winner = null;
}

function bffApplyMatchCompletion(gameState) {
  if (Number(gameState.round_number || 1) < 5) return;

  const score1 = Number(gameState.score1 || 0);
  const score2 = Number(gameState.score2 || 0);

  gameState.match_complete = score1 !== score2;
  gameState.match_tied = score1 === score2;
  gameState.winning_team = score1 > score2 ? 1 : score2 > score1 ? 2 : null;
  gameState.round_stage = score1 === score2 ? 'match_tie' : 'match_complete';
}

function bffCompleteRound(gameState, awardedTeam = null) {
  const bank = Math.max(0, Number(gameState.round_bank || 0));

  if ([1, 2].includes(Number(awardedTeam))) {
    const scoreKey = Number(awardedTeam) === 2 ? 'score2' : 'score1';
    gameState[scoreKey] = Math.max(0, Number(gameState[scoreKey] || 0) + bank);
  }

  gameState.round_bank = 0;
  gameState.phase = 'round_over';
  gameState.round_stage = 'round_complete';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.buzz_winner = null;
  gameState.steal_mode = false;
  gameState.consecutive_timeouts = 0;
  gameState.original_playing_team = null;
  gameState.steal_team = null;

  bffApplyMatchCompletion(gameState);
}

function bffFamilyTimeout(gameState, players) {
  if (gameState.round_stage !== 'family_play' || !gameState.active_player_id) return;

  const team = bffTeamForPlayer(gameState, gameState.active_player_id) || gameState.control_team;
  let streak = Number(gameState.consecutive_timeouts || 0) + 1;

  if (streak >= 2) {
    gameState.bye_count = Math.min(3, Number(gameState.bye_count || 0) + 1);
    gameState.sound_cue = { name: 'wrong_awww', at: Date.now() };
    streak = 0;
  }

  gameState.consecutive_timeouts = streak;

  if (Number(gameState.bye_count || 0) >= 3) {
    bffEnterSteal(gameState);
    return;
  }

  const nextPlayer = bffNextPlayerId(
    players,
    gameState,
    team,
    gameState.active_player_id,
  );
  bffStartFamilyTurn(gameState, nextPlayer);
}

function bffFaceoffPlayerIds(gameState = {}) {
  const pair = gameState.faceoff_players || {};
  return [pair['1'] || pair[1] || null, pair['2'] || pair[2] || null].filter(Boolean);
}

function bffOtherFaceoffPlayerId(gameState = {}, playerId) {
  return bffFaceoffPlayerIds(gameState).find(
    (id) => String(id) !== String(playerId || ''),
  ) || null;
}

function bffStartAnswerClock(gameState, playerId) {
  gameState.active_player_id = playerId || null;
  gameState.answer_deadline_at = playerId ? Date.now() + 15000 : null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = playerId ? 'answering' : 'board_shown';
  gameState.round_stage = playerId ? 'faceoff_answer' : gameState.round_stage;
}

function bffResolveFaceoffControl(gameState, players, winnerPlayerId) {
  const team = bffTeamForPlayer(gameState, winnerPlayerId);
  if (!team) return;

  gameState.control_team = team;
  gameState.active_turn = team;
  gameState.faceoff_winner_id = winnerPlayerId;
  gameState.faceoff_winner_team = team;
  gameState.steal_mode = false;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.answer_deadline_at = null;
  gameState.active_player_id = winnerPlayerId;

  if (gameState.is_tiebreak) {
    gameState.match_complete = true;
    gameState.match_tied = false;
    gameState.winning_team = team;
    gameState.phase = 'round_over';
    gameState.round_stage = 'match_complete';
    gameState.active_player_id = null;
    return;
  }

  gameState.round_stage = 'play_pass';
}

function bffFaceoffResults(gameState = {}) {
  return { ...(gameState.faceoff_results || {}) };
}

function bffChooseBestFaceoffResult(gameState) {
  const results = bffFaceoffResults(gameState);
  const pair = bffFaceoffPlayerIds(gameState);

  return pair
    .map((id) => ({ id, result: results[String(id)] }))
    .filter((entry) => entry.result && !entry.result.wrong)
    .sort((a, b) =>
      Number(b.result.points || 0) - Number(a.result.points || 0)
      || Number(a.result.answerIndex ?? 99) - Number(b.result.answerIndex ?? 99)
    )[0]?.id || null;
}

function bffFaceoffNoWinner(gameState) {
  gameState.score1 = Number(gameState.score1 || 0) - 5;
  gameState.score2 = Number(gameState.score2 || 0) - 5;
  gameState.round_bank = 0;
  gameState.sound_cue = { name: 'wrong_awww', at: Date.now() };
  bffCompleteRound(gameState, null);
}

function bffAdvanceFaceoffPair(gameState, players) {
  const pair = gameState.faceoff_players || {};
  const current1 = pair['1'] || pair[1] || null;
  const current2 = pair['2'] || pair[2] || null;
  const next1 = bffNextUnattemptedPlayer(players, gameState, 1, current1);
  const next2 = bffNextUnattemptedPlayer(players, gameState, 2, current2);

  gameState.faceoff_results = {};
  gameState.buzz_winner = null;
  gameState.faceoff_x_event = null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;

  if (!next1 && !next2) {
    bffFaceoffNoWinner(gameState);
    return;
  }

  gameState.faceoff_players = {
    1: next1 || current1,
    2: next2 || current2,
  };

  if (next1 && next2) {
    gameState.round_stage = 'faceoff_ready';
    gameState.active_player_id = null;
    gameState.answer_deadline_at = null;
    return;
  }

  bffStartAnswerClock(gameState, next1 || next2);
}

function bffResolveFaceoffAfterAttempt(gameState, players, playerId) {
  const results = bffFaceoffResults(gameState);
  const thisResult = results[String(playerId)] || null;
  const otherPlayerId = bffOtherFaceoffPlayerId(gameState, playerId);
  const otherResult = otherPlayerId ? results[String(otherPlayerId)] : null;

  if (thisResult && !thisResult.wrong && Number(thisResult.answerIndex) === 0) {
    bffResolveFaceoffControl(gameState, players, playerId);
    return;
  }

  if (otherPlayerId && !otherResult) {
    bffStartAnswerClock(gameState, otherPlayerId);
    return;
  }

  const winner = bffChooseBestFaceoffResult(gameState);
  if (winner) {
    bffResolveFaceoffControl(gameState, players, winner);
    return;
  }

  bffAdvanceFaceoffPair(gameState, players);
}

function bffAdvanceFaceoffAfterMiss(gameState, players, playerId, { showX = false } = {}) {
  const results = bffFaceoffResults(gameState);
  results[String(playerId)] = {
    ...(results[String(playerId)] || {}),
    wrong: true,
    at: Date.now(),
  };
  gameState.faceoff_results = results;
  bffMarkFaceoffAttempt(gameState, playerId);

  if (showX) {
    gameState.faceoff_x_event = {
      playerId,
      at: Date.now(),
    };
    gameState.sound_cue = {
      name: 'faceoff_wrong',
      at: Date.now(),
    };
  }

  bffResolveFaceoffAfterAttempt(gameState, players, playerId);
}


async function pickBffDysfunctionPrompt(usedIds = []) {
  const used = Array.isArray(usedIds)
    ? usedIds.map((id) => Number(id)).filter(Number.isFinite)
    : [];

  let result = await bffPool.query(
    'select id, prompt from public.bff_dysfunction_prompts where active = true and not (id = any($1::bigint[])) order by random() limit 1',
    [used],
  );

  if (!result.rows.length) {
    result = await bffPool.query(
      'select id, prompt from public.bff_dysfunction_prompts where active = true order by random() limit 1',
    );
  }

  const prompt = result.rows[0] || null;
  return prompt
    ? { id: Number(prompt.id), prompt: String(prompt.prompt || '') }
    : null;
}

function bffDysfunctionSideMembers(dysfunction = {}, side) {
  return Object.entries(dysfunction.side_assignments || {})
    .filter(([, value]) => value === side)
    .map(([playerId]) => playerId);
}

function bffDysfunctionPoints(voterIds, votes) {
  const targets = voterIds.map((id) => votes[String(id)]).filter(Boolean);
  if (!targets.length) return 0;

  const counts = new Map();
  targets.forEach((target) => counts.set(target, (counts.get(target) || 0) + 1));
  const max = Math.max(...counts.values());

  if (targets.length >= 3) {
    if (max === targets.length) return 3;
    if (max >= 2) return 2;
    return 0;
  }

  if (targets.length === 2) return max === 2 ? 3 : 0;
  return 1;
}

function bffDysfunctionUnanimous(voterIds, votes) {
  if (!voterIds.length) return false;
  const targets = voterIds.map((id) => votes[String(id)]).filter(Boolean);
  return targets.length === voterIds.length && new Set(targets).size === 1;
}

function bffDysfunctionDefensePlayer(votes = {}) {
  const counts = new Map();
  Object.values(votes).forEach((target) => {
    if (!target) return;
    counts.set(String(target), (counts.get(String(target)) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || null;
}

async function bffLoadNextDysfunctionPrompt(gameState) {
  const dysfunction = { ...(gameState.dysfunction || {}) };
  const prompt = await pickBffDysfunctionPrompt(dysfunction.used_prompt_ids || []);
  if (!prompt) throw new Error('No Family Dysfunction prompts are available.');

  const used = Array.isArray(dysfunction.used_prompt_ids)
    ? dysfunction.used_prompt_ids.slice()
    : [];

  dysfunction.prompt_id = prompt.id;
  dysfunction.prompt = prompt.prompt;
  dysfunction.used_prompt_ids = used.includes(prompt.id) ? [prompt.id] : [...used, prompt.id];
  dysfunction.votes = {};
  dysfunction.votes_revealed = false;
  dysfunction.defense_player_id = null;

  gameState.dysfunction = dysfunction;
  gameState.round_stage = 'dysfunction_vote';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;
}

async function bffAdvanceDysfunctionAfterDefense(gameState) {
  const dysfunction = { ...(gameState.dysfunction || {}) };

  if (Number(dysfunction.prompt_number || 1) >= 5) {
    const scoreA = Number(dysfunction.scoreA || 0);
    const scoreB = Number(dysfunction.scoreB || 0);

    if (scoreA !== scoreB) {
      dysfunction.completed = true;
      dysfunction.winner_side = scoreA > scoreB ? 'A' : 'B';
      gameState.dysfunction = dysfunction;
      gameState.round_stage = 'dysfunction_complete';
      gameState.phase = 'finale_complete';
      gameState.active_player_id = null;
      gameState.answer_deadline_at = null;
      return;
    }

    dysfunction.sudden_death = true;
  }

  dysfunction.prompt_number = Number(dysfunction.prompt_number || 1) + 1;
  gameState.dysfunction = dysfunction;
  await bffLoadNextDysfunctionPrompt(gameState);
}

async function applyBffHostAction(room, body = {}, players = []) {
  const action = String(body.action || '').trim();
  const current = extractBffGameState(room.display_state || {});

  if (action === 'undo_last_action') {
    if (!current._hostUndo) return current;
    const restored = JSON.parse(JSON.stringify(current._hostUndo));
    restored._hostUndo = bffUndoSnapshot(current);
    return restored;
  }

  const next = {
    ...current,
    _hostUndo: bffUndoSnapshot(current),
  };

  if (action === 'set_family_names') {
    const family1 = String(body.family1 || '').trim();
    const family2 = String(body.family2 || '').trim();

    if (!family1 || !family2) {
      throw new Error('Both family names are required before the round can start.');
    }

    next.family1 = family1;
    next.family2 = family2;
    next.family_names_set = bffFamilyNamesReady(next);
    return next;
  }

  if (action === 'assign_player') {
    const playerId = String(body.playerId || '');
    const team = body.team == null ? null : Number(body.team);
    const map = { ...(next.playerTeams || {}) };
    if (!playerId) return next;

    if (team === 1 || team === 2) {
      const alreadyOnTeam = Number(map[playerId] || 0) === team;
      const teamCount = Object.entries(map)
        .filter(([id, value]) => String(id) !== playerId && Number(value) === team)
        .length;

      if (!alreadyOnTeam && teamCount >= 6) {
        throw new Error(`Family ${team} already has the maximum of six players.`);
      }
      map[playerId] = team;
    } else {
      map[playerId] = 0;
    }

    next.playerTeams = map;
    return next;
  }

  if (action === 'set_faceoff_player') {
    const team = Number(body.team);
    const playerId = String(body.playerId || '');

    if (![1, 2].includes(team) || !playerId) return next;
    if (bffTeamForPlayer(next, playerId) !== team) {
      throw new Error('That player is not assigned to this family.');
    }

    next.faceoff_players = {
      ...(next.faceoff_players || {}),
      [team]: playerId,
    };
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_results = {};
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';

    if (next.current_question) next.round_stage = 'faceoff_ready';
    return next;
  }

  if (action === 'start_round') {
    if (!bffFamilyNamesReady(next)) {
      throw new Error('Enter both family names before starting the round.');
    }

    const survey = await pickBffSurvey(next);
    if (!survey) throw new Error('No active BFF surveys are available.');

    const previousUsed = Array.isArray(next.used_survey_ids)
      ? next.used_survey_ids.map((id) => Number(id)).filter(Number.isFinite)
      : [];

    next.phase = 'playing';
    next.is_tiebreak = false;
    next.family_names_set = true;

    next.round_stage = 'faceoff_setup';
    next.round_number = Math.max(1, Number(next.round_number || next.roundNumber || 1));
    next.round_bank = 0;
    next.bye_count = 0;
    next.consecutive_timeouts = 0;
    next.steal_mode = false;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_players = {};
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.faceoff_winner_id = null;
    next.faceoff_winner_team = null;
    next.play_pass_choice = null;
    next.current_survey_id = survey.id;
    next.used_survey_ids = previousUsed.includes(survey.id)
      ? [survey.id]
      : [...previousUsed, survey.id];
    next.current_question = survey.question;
    next.answers = survey.answers;
    next.answer_count = survey.answers.length;
    next.sound_cue = { name: 'round_start', at: Date.now() };
    return next;
  }

  if (action === 'reset_game') {
    // Preserve room membership, family setup, and assignments.
    // Reset the actual match so this room can immediately run a fresh game.
    next.phase = 'waiting';
    next.round_stage = 'setup';
    next.round_number = 1;
    next.score1 = 0;
    next.score2 = 0;
    next.round_bank = 0;
    next.bye_count = 0;
    next.consecutive_timeouts = 0;

    next.current_question = '';
    next.current_survey_id = null;
    next.answers = [];
    next.answer_count = 0;
    next.used_survey_ids = [];

    next.faceoff_players = {};
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.faceoff_winner_id = null;
    next.faceoff_winner_team = null;
    next.play_pass_choice = null;

    next.buzzer_open = false;
    next.buzzer_scope = null;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;

    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.control_team = null;
    next.active_turn = null;

    next.steal_mode = false;
    next.steal_team = null;
    next.original_playing_team = null;

    next.match_complete = false;
    next.match_tied = false;
    next.winning_team = null;
    next.is_tiebreak = false;
    next.dysfunction = null;

    next.sound_cue = null;
    delete next._hostUndo;

    return next;
  }

  if (action === 'reset_round') {
    next.phase = 'playing';
    next.is_tiebreak = false;
    next.round_stage = 'faceoff_setup';
    next.round_bank = 0;
    next.bye_count = 0;
    next.consecutive_timeouts = 0;
    next.steal_mode = false;
    next.steal_team = null;
    next.original_playing_team = null;
    next.buzzer_open = false;
    next.buzzer_scope = null;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_players = {};
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.faceoff_winner_id = null;
    next.faceoff_winner_team = null;
    next.play_pass_choice = null;
    next.control_team = null;
    next.active_turn = null;
    next.answers = normalizeBffRankedAnswers(getBffAnswers(next));
    next.answer_count = next.answers.length;
    next.sound_cue = null;
    delete next._hostUndo;
    return next;
  }

  if (action === 'next_question') {
    if (Number(next.round_number || 1) >= 5) return next;

    next.phase = 'waiting';
    next.is_tiebreak = false;
    next.round_number = Math.max(1, Number(next.round_number || next.roundNumber || 1) + 1);
    next.round_bank = 0;
    next.bye_count = 0;
    next.consecutive_timeouts = 0;
    next.steal_mode = false;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.round_stage = 'setup';
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.faceoff_winner_id = null;
    next.faceoff_winner_team = null;
    next.play_pass_choice = null;
    next.current_question = '';
    next.answers = [];
    next.answer_count = 0;
    next.current_survey_id = null;
    next.sound_cue = null;
    return next;
  }

  if (action === 'start_tiebreak') {
    if (next.round_stage !== 'match_tie') return next;

    const survey = await pickBffSurvey(next);
    if (!survey) throw new Error('No active BFF surveys are available.');

    next.is_tiebreak = true;
    next.phase = 'playing';
    next.round_stage = 'faceoff_setup';
    next.faceoff_players = {};
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.current_question = survey.question;
    next.answers = survey.answers;
    next.answer_count = survey.answers.length;
    next.current_survey_id = survey.id;
    return next;
  }

  if (action === 'faceoff_timeout') {
    if (next.round_stage !== 'faceoff_answer' || !next.active_player_id) return next;
    bffAdvanceFaceoffAfterMiss(next, players, next.active_player_id, { showX: false });
    return next;
  }

  if (action === 'faceoff_wrong') {
    if (next.round_stage !== 'faceoff_answer' || !next.active_player_id) return next;
    bffAdvanceFaceoffAfterMiss(next, players, next.active_player_id, { showX: true });
    return next;
  }

  if (action === 'family_timeout') {
    bffFamilyTimeout(next, players);
    return next;
  }

  if (action === 'steal_miss') {
    if (next.round_stage !== 'steal_answer') return next;
    next.sound_cue = { name: 'wrong_awww', at: Date.now() };
    bffCompleteRound(next, Number(next.original_playing_team || 0));
    return next;
  }

  if (action === 'reveal_answer' || action === 'hide_answer') {
    const index = Math.max(0, Number(body.index) || 0);
    const answers = ensureBffAnswerSlot(getBffAnswers(next), index);
    const answer = answers[index];
    const reveal = action === 'reveal_answer';
    const wasRevealed = Boolean(answer.revealed);

    answers[index] = { ...answer, revealed: reveal };
    next.answers = answers;

    if (reveal && !wasRevealed) {
      next.round_bank = Math.max(0, Number(next.round_bank || 0) + Number(answer.points || 0));
      next.sound_cue = { name: 'correct_applause', at: Date.now() };

      if (next.round_stage === 'faceoff_answer' && next.active_player_id) {
        const playerId = String(next.active_player_id);
        const results = bffFaceoffResults(next);

        results[playerId] = {
          answerIndex: index,
          points: Number(answer.points || 0),
          wrong: false,
          at: Date.now(),
        };

        next.faceoff_results = results;
        bffMarkFaceoffAttempt(next, playerId);
        bffResolveFaceoffAfterAttempt(next, players, playerId);
      } else if (next.round_stage === 'family_play' && next.active_player_id) {
        const team = bffTeamForPlayer(next, next.active_player_id) || next.control_team;
        next.consecutive_timeouts = 0;

        const clearedBoard = getBffAnswers(next).length > 0
          && getBffAnswers(next).every((item) => Boolean(item.revealed));

        if (clearedBoard) {
          bffCompleteRound(next, Number(team));
        } else {
          const nextPlayer = bffNextPlayerId(players, next, team, next.active_player_id);
          bffStartFamilyTurn(next, nextPlayer);
        }
      } else if (next.round_stage === 'steal_answer') {
        bffCompleteRound(next, Number(next.steal_team || 0));
      }
    }

    if (!reveal && wasRevealed) {
      next.round_bank = Math.max(0, Number(next.round_bank || 0) - Number(answer.points || 0));
    }

    return next;
  }

  if (action === 'add_points') {
    const amount = Number(body.amount) || 0;
    next.round_bank = Math.max(0, Number(next.round_bank || 0) + amount);
    return next;
  }

  if (action === 'add_bye') {
    if (next.round_stage !== 'family_play') return next;

    next.bye_count = Math.min(3, Number(next.bye_count || 0) + 1);
    next.consecutive_timeouts = 0;
    next.sound_cue = { name: 'wrong_awww', at: Date.now() };

    if (next.bye_count >= 3) {
      bffEnterSteal(next);
      return next;
    }

    const team = bffTeamForPlayer(next, next.active_player_id) || next.control_team;
    const nextPlayer = bffNextPlayerId(players, next, team, next.active_player_id);
    bffStartFamilyTurn(next, nextPlayer);
    return next;
  }

  if (action === 'undo_bye') {
    next.bye_count = Math.max(0, Number(next.bye_count || 0) - 1);
    return next;
  }

  if (action === 'set_control_team') {
    const team = Number(body.team) === 2 ? 2 : 1;
    next.control_team = team;
    next.active_turn = team;
    return next;
  }

  if (action === 'toggle_steal') {
    next.steal_mode = !Boolean(next.steal_mode);
    return next;
  }

  if (action === 'award_bank') {
    const team = Number(body.team) === 2 ? 2 : 1;
    if (!['family_play', 'steal_ready', 'steal_buzz', 'steal_answer', 'round_complete'].includes(next.round_stage)) {
      return next;
    }
    bffCompleteRound(next, team);
    return next;
  }

  if (action === 'open_buzzers') {
    if (next.round_stage === 'steal_ready') {
      next.round_stage = 'steal_buzz';
      next.buzzer_scope = 'steal';
      next.buzzer_open = true;
      next.buzzer_phase = 'buzzer_active';
      next.buzz_winner = null;
      return next;
    }

    const pair = next.faceoff_players || {};
    const team1Player = pair['1'] || pair[1];
    const team2Player = pair['2'] || pair[2];

    if (!team1Player || !team2Player) {
      throw new Error('Choose one faceoff player from each family first.');
    }

    next.round_stage = 'faceoff_buzz';
    next.buzzer_scope = 'faceoff';
    next.buzzer_open = true;
    next.buzzer_phase = 'buzzer_active';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_results = {};
    return next;
  }

  if (action === 'hide_buzzers') {
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    if (next.round_stage === 'faceoff_buzz') next.round_stage = 'faceoff_ready';
    if (next.round_stage === 'steal_buzz') next.round_stage = 'steal_ready';
    return next;
  }

  if (action === 'reset_buzzers') {
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    return next;
  }

  if (action === 'start_dysfunction') {
    if (!next.match_complete || ![1, 2].includes(Number(next.winning_team))) {
      throw new Error('Finish the five-round match before starting Family Dysfunction.');
    }

    const roster = bffTeamRoster(players, next, Number(next.winning_team)).slice(0, 6);
    if (roster.length < 4) {
      throw new Error('Family Dysfunction needs at least four connected members from the winning family for a 2v2 finale.');
    }


    const sideAssignments = {};
    roster.forEach((player, index) => {
      sideAssignments[String(player.playerId)] = index % 2 === 0 ? 'A' : 'B';
    });

    next.phase = 'dysfunction';
    next.round_stage = 'dysfunction_vote';
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.buzzer_open = false;
    next.buzz_winner = null;
    next.dysfunction = {
      family_team: Number(next.winning_team),
      family_name: Number(next.winning_team) === 2 ? next.family2 : next.family1,
      side_assignments: sideAssignments,
      scoreA: 0,
      scoreB: 0,
      prompt_number: 1,
      used_prompt_ids: [],
      votes: {},
      votes_revealed: false,
      sudden_death: false,
      completed: false,
      winner_side: null,
    };

    await bffLoadNextDysfunctionPrompt(next);
    return next;
  }


  if (action === 'sound') {
    next.sound_cue = {
      name: String(body.name || 'correct'),
      at: Date.now(),
    };
    return next;
  }

  return next;
}


async function verifyBffPlayerWithTngApi(req, deviceId, roomCode) {
  const auth = String(req.headers.authorization || '');
  if (!auth) {
    return {
      ok: false,
      status: 401,
      payload: { error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' } },
    };
  }

  const response = await fetch(`${TNG_API_ORIGIN}/player/room`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
      'X-TNG-Device-Id': deviceId,
      'X-TNG-Room-Code': roomCode,
    },
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function loadRailwayBffPlayerRoom(roomCode) {
  const { rows } = await bffPool.query(`
    select gr.id, gr.room_code, gr.game_id, gr.status, gr.revision, gr.display_state,
           gr.created_at, gr.updated_at
    from public.game_rooms gr
    where upper(gr.room_code) = upper($1)
      and gr.game_id = 'bff'
      and gr.status in ('lobby','live','paused')
    order by gr.updated_at desc
    limit 1
  `, [roomCode]);

  return rows[0] || null;
}

function sanitizeBffPlayerState(gameState = {}, players = [], participant = null) {
  const answers = getBffAnswers(gameState);
  const answerCount = Math.max(
    answers.length,
    Number(gameState.answer_count || gameState.answerCount || 0),
  );

  const safeAnswers = Array.from({ length: answerCount }, (_, index) => {
    const answer = answers[index] || {};
    const revealed = Boolean(answer.revealed);
    return {
      index,
      revealed,
      points: revealed ? Number(answer.points) || 0 : 0,
      ...(revealed
        ? { text: String(answer.text || answer.answer || '') }
        : {}),
    };
  });

  return {
    phase: gameState.phase || 'waiting',
    family1: gameState.family1 || 'Family 1',
    family2: gameState.family2 || 'Family 2',
    score1: Number(gameState.score1) || 0,
    score2: Number(gameState.score2) || 0,
    round_number: Number(gameState.round_number || gameState.roundNumber || 1),
    round_bank: Number(gameState.round_bank || gameState.roundBank || 0),
    current_question:
      gameState.current_question ||
      gameState.currentQuestion ||
      gameState.question ||
      '',
    control_team: Number(gameState.control_team || gameState.active_turn || 1),
    active_turn: Number(gameState.active_turn || gameState.control_team || 1),
    steal_mode: Boolean(gameState.steal_mode),
    bye_count: Math.max(0, Math.min(3, Number(gameState.bye_count) || 0)),
    buzzer_phase: gameState.buzzer_phase || null,
    buzzer_open: Boolean(gameState.buzzer_open || gameState.buzzer_phase === 'buzzer_active'),
    buzz_winner: gameState.buzz_winner || null,
    round_stage: gameState.round_stage || 'setup',
    faceoff_players: gameState.faceoff_players || {},
    faceoff_winner_id: gameState.faceoff_winner_id || null,
    faceoff_winner_team: Number(gameState.faceoff_winner_team) || null,
    faceoff_x_event: gameState.faceoff_x_event || null,
    play_pass_choice: gameState.play_pass_choice || null,
    active_player_id: gameState.active_player_id || null,
    answer_deadline_at: Number(gameState.answer_deadline_at) || null,
    consecutive_timeouts: Number(gameState.consecutive_timeouts) || 0,
    original_playing_team: Number(gameState.original_playing_team) || null,
    steal_team: Number(gameState.steal_team) || null,
    match_complete: Boolean(gameState.match_complete),
    match_tied: Boolean(gameState.match_tied),
    winning_team: Number(gameState.winning_team) || null,
    is_tiebreak: Boolean(gameState.is_tiebreak),
    dysfunction: gameState.dysfunction
      ? {
          ...gameState.dysfunction,
          votes:
            gameState.dysfunction.votes_revealed
              ? gameState.dysfunction.votes || {}
              : {},
          my_vote: participant
            ? (gameState.dysfunction.votes || {})[participant.accountId || participant.playerId] || null
            : null,
        }
      : null,
    playerTeams: gameState.playerTeams || {},
    sound_cue: gameState.sound_cue || null,
    answers: safeAnswers,
    players,
  };
}

async function claimBffBuzz(room, participant) {
  const client = await bffPool.connect();

  try {
    await client.query('begin');

    const locked = await client.query(
      'select id, room_code, game_id, status, revision, display_state, created_at, updated_at from public.game_rooms where id = $1::uuid for update',
      [room.id],
    );

    const lockedRoom = locked.rows[0];
    if (!lockedRoom) {
      await client.query('rollback');
      return { gameState: extractBffGameState(room.display_state || {}), room };
    }

    const current = extractBffGameState(lockedRoom.display_state || {});

    if (
      !(current.buzzer_open || current.buzzer_phase === 'buzzer_active')
      || current.buzz_winner
    ) {
      await client.query('commit');
      return { gameState: current, room: lockedRoom };
    }

    const familyTeam =
      Number((current.playerTeams || {})[participant.accountId] || participant.familyTeam || 0)
      || null;
    const playerId = String(participant.accountId || participant.playerId || '');
    const scope = current.buzzer_scope || (current.round_stage === 'steal_buzz' ? 'steal' : 'faceoff');

    let allowed = false;
    let nextStage = 'faceoff_answer';
    let deadlineMs = 15000;

    if (scope === 'steal') {
      allowed = familyTeam === Number(current.steal_team || 0);
      nextStage = 'steal_answer';
      deadlineMs = 20000;
    } else {
      const allowedFaceoffId =
        (current.faceoff_players || {})[String(familyTeam)]
        || (current.faceoff_players || {})[familyTeam];
      allowed = Boolean(
        familyTeam
        && String(allowedFaceoffId || '') === playerId
      );
    }

    if (!allowed) {
      await client.query('commit');
      return { gameState: current, room: lockedRoom };
    }

    const now = Date.now();
    const nextGameState = {
      ...current,
      round_stage: nextStage,
      buzzer_open: false,
      buzzer_phase: 'answering',
      control_team: scope === 'steal'
        ? Number(current.steal_team || familyTeam || current.control_team || 1)
        : familyTeam || current.control_team || 1,
      active_turn: scope === 'steal'
        ? Number(current.steal_team || familyTeam || current.active_turn || 1)
        : familyTeam || current.active_turn || 1,
      active_player_id: participant.accountId,
      answer_deadline_at: now + deadlineMs,
      sound_cue: { name: 'buzz', at: now },
      buzz_winner: {
        playerId: participant.accountId,
        playerName: participant.playerName || participant.name || 'Player',
        seatNumber: participant.seatNumber,
        familyTeam,
        teamName:
          familyTeam === 2
            ? (current.family2 || 'Family 2')
            : (current.family1 || 'Family 1'),
        timestamp: now,
      },
    };

    const nextDisplayState = wrapBffGameState(
      lockedRoom.display_state || {},
      nextGameState,
    );

    const updated = await client.query(
      'update public.game_rooms set display_state = $2::jsonb, revision = revision + 1, updated_at = now() where id = $1::uuid returning id, room_code, game_id, status, revision, display_state, created_at, updated_at',
      [room.id, JSON.stringify(nextDisplayState)],
    );

    await client.query('commit');

    return {
      gameState: nextGameState,
      room: updated.rows[0] || lockedRoom,
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}


async function applyBffPlayerAction(room, participant, body = {}, players = []) {
  const action = String(body.action || '').trim();
  const current = extractBffGameState(room.display_state || {});
  const playerId = String(participant.accountId || participant.playerId || '');

  if (action === 'buzz') {
    return current;
  }

  if (action === 'play_pass') {
    if (
      current.round_stage !== 'play_pass'
      || String(current.faceoff_winner_id || '') !== playerId
    ) {
      return current;
    }

    const choice = String(body.choice || '').toLowerCase();
    if (!['play', 'pass'].includes(choice)) return current;

    const winnerTeam = Number(current.faceoff_winner_team || bffTeamForPlayer(current, playerId) || 0);
    if (![1, 2].includes(winnerTeam)) return current;

    const controlTeam = choice === 'play'
      ? winnerTeam
      : winnerTeam === 1 ? 2 : 1;
    const faceoffPlayerId =
      (current.faceoff_players || {})[String(controlTeam)]
      || (current.faceoff_players || {})[controlTeam]
      || null;
    const firstPlayer = bffNextPlayerId(players, current, controlTeam, faceoffPlayerId);

    const next = {
      ...current,
      play_pass_choice: choice,
      control_team: controlTeam,
      active_turn: controlTeam,
      consecutive_timeouts: 0,
      steal_mode: false,
      buzzer_open: false,
      buzzer_phase: 'board_shown',
      buzz_winner: null,
    };

    bffStartFamilyTurn(next, firstPlayer);
    return next;
  }

  if (action === 'dysfunction_vote') {
    if (current.round_stage !== 'dysfunction_vote' || !current.dysfunction) return current;

    const dysfunction = {
      ...current.dysfunction,
      votes: { ...(current.dysfunction.votes || {}) },
    };
    const side = dysfunction.side_assignments?.[playerId] || null;
    const targetId = String(body.targetPlayerId || '');
    if (!side || !targetId) return current;

    const targetSide = dysfunction.side_assignments?.[targetId] || null;
    if (!targetSide || targetSide === side) return current;

    dysfunction.votes[playerId] = targetId;

    const allVoters = Object.keys(dysfunction.side_assignments || {});
    const allVoted = allVoters.every((id) => Boolean(dysfunction.votes[String(id)]));

    const next = {
      ...current,
      dysfunction,
    };

    if (!allVoted) return next;

    const sideA = bffDysfunctionSideMembers(dysfunction, 'A');
    const sideB = bffDysfunctionSideMembers(dysfunction, 'B');
    const pointsA = bffDysfunctionPoints(sideA, dysfunction.votes);
    const pointsB = bffDysfunctionPoints(sideB, dysfunction.votes);

    dysfunction.scoreA = Number(dysfunction.scoreA || 0) + pointsA;
    dysfunction.scoreB = Number(dysfunction.scoreB || 0) + pointsB;
    dysfunction.last_pointsA = pointsA;
    dysfunction.last_pointsB = pointsB;
    dysfunction.votes_revealed = true;

    if (pointsA === 0 || pointsB === 0) {
      next.sound_cue = { name: 'awww', at: Date.now() };
    }

    if (dysfunction.sudden_death) {
      const unanimousA = bffDysfunctionUnanimous(sideA, dysfunction.votes);
      const unanimousB = bffDysfunctionUnanimous(sideB, dysfunction.votes);

      if (unanimousA !== unanimousB) {
        dysfunction.completed = true;
        dysfunction.winner_side = unanimousA ? 'A' : 'B';
        next.phase = 'finale_complete';
        next.round_stage = 'dysfunction_complete';
        next.active_player_id = null;
        next.answer_deadline_at = null;
        return next;
      }

      dysfunction.prompt_number = Number(dysfunction.prompt_number || 5) + 1;
      next.dysfunction = dysfunction;
      await bffLoadNextDysfunctionPrompt(next);
      return next;
    }

    const defensePlayerId = bffDysfunctionDefensePlayer(dysfunction.votes);
    dysfunction.defense_player_id = defensePlayerId;
    next.dysfunction = dysfunction;
    next.round_stage = 'dysfunction_defense';
    next.active_player_id = defensePlayerId;
    next.answer_deadline_at = defensePlayerId ? Date.now() + 10000 : null;
    return next;
  }


  return current;
}


async function reconcileBffTimers(room) {
  if (!room?.id) return room;

  const client = await bffPool.connect();

  try {
    await client.query('begin');

    const locked = await client.query(
      'select id, room_code, game_id, status, revision, display_state, created_at, updated_at from public.game_rooms where id = $1::uuid for update',
      [room.id],
    );

    const lockedRoom = locked.rows[0] || room;
    const current = extractBffGameState(lockedRoom.display_state || {});
    const deadline = Number(current.answer_deadline_at || 0);

    if (!deadline || Date.now() < deadline) {
      await client.query('commit');
      return lockedRoom;
    }

    const players = await loadBffParticipants(room.id, current);
    let changed = false;

    if (current.round_stage === 'faceoff_answer' && current.active_player_id) {
      bffAdvanceFaceoffAfterMiss(current, players, current.active_player_id, { showX: false });
      changed = true;
    } else if (current.round_stage === 'family_play' && current.active_player_id) {
      bffFamilyTimeout(current, players);
      changed = true;
    } else if (current.round_stage === 'steal_answer') {
      current.sound_cue = { name: 'wrong_awww', at: Date.now() };
      bffCompleteRound(current, Number(current.original_playing_team || 0));
      changed = true;
    } else if (current.round_stage === 'dysfunction_defense') {
      await bffAdvanceDysfunctionAfterDefense(current);
      changed = true;
    }

    if (!changed) {
      await client.query('commit');
      return lockedRoom;
    }

    const nextDisplayState = wrapBffGameState(
      lockedRoom.display_state || {},
      current,
    );

    const updated = await client.query(
      'update public.game_rooms set display_state = $2::jsonb, revision = revision + 1, updated_at = now() where id = $1::uuid returning id, room_code, game_id, status, revision, display_state, created_at, updated_at',
      [room.id, JSON.stringify(nextDisplayState)],
    );

    await client.query('commit');
    return updated.rows[0] || lockedRoom;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function handleBffApi(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const path = sourceUrl.pathname.replace(/^\/bff-api/, '') || '/';

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true, service: 'railway-bff-api' });
    return;
  }

  if (req.method === 'GET' && path === '/display') {
    const roomCode = String(sourceUrl.searchParams.get('room') || '').toUpperCase();
    if (!roomCode) {
      sendJson(res, 400, {
        error: { code: 'ROOM_REQUIRED', message: 'BFF display room code is required.' },
      });
      return;
    }

    let room = await loadRailwayBffPlayerRoom(roomCode);
    if (!room) {
      sendJson(res, 404, {
        error: { code: 'ROOM_NOT_FOUND', message: 'This BFF room is no longer active.' },
      });
      return;
    }

    room = await reconcileBffTimers(room);
    const internalState = extractBffGameState(room.display_state || {});
    const players = await loadBffParticipants(room.id, internalState);
    const gameState = sanitizeBffPlayerState(internalState, players, null);

    sendJson(res, 200, {
      room: {
        id: room.id,
        roomCode: room.room_code,
        gameId: room.game_id,
        status: room.status,
        revision: room.revision,
        gameState,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
      },
    });
    return;
  }

  if (req.method === 'GET' && path === '/player') {
    const deviceId = String(req.headers['x-tng-device-id'] || '');
    const roomCode = String(req.headers['x-tng-room-code'] || '').toUpperCase();

    if (!deviceId || !roomCode) {
      sendJson(res, 400, {
        error: {
          code: 'PLAYER_ROOM_REQUIRED',
          message: 'Player device and room code are required.',
        },
      });
      return;
    }

    const verified = await verifyBffPlayerWithTngApi(req, deviceId, roomCode);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'PLAYER_SESSION_INVALID', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    let room = await loadRailwayBffPlayerRoom(roomCode);
    if (!room) {
      sendJson(res, 404, {
        error: { code: 'ROOM_NOT_FOUND', message: 'This BFF room is no longer active.' },
      });
      return;
    }

    room = await reconcileBffTimers(room);
    let internalState = extractBffGameState(room.display_state || {});
    let players = await loadBffParticipants(room.id, internalState);

    const assignmentResult = await ensureBffTeamAssignments(room, internalState, players);
    internalState = assignmentResult.gameState;
    const effectiveRoom = assignmentResult.room || room;
    players = await loadBffParticipants(room.id, internalState);

    const verifiedParticipant = verified.payload?.participant || null;
    const participant = players.find((player) =>
      String(player.deviceSessionId || '') === String(deviceId)
      || String(player.accountId || '') === String(verifiedParticipant?.accountId || '')
    ) || verifiedParticipant;

    if (!participant) {
      sendJson(res, 404, {
        error: { code: 'PLAYER_NOT_IN_ROOM', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    const gameState = sanitizeBffPlayerState(internalState, players, participant);

    sendJson(res, 200, {
      room: {
        id: effectiveRoom.id || room.id,
        roomCode: effectiveRoom.room_code || room.room_code,
        gameId: effectiveRoom.game_id || room.game_id,
        status: effectiveRoom.status || room.status,
        revision: effectiveRoom.revision || room.revision,
        gameState,
        createdAt: effectiveRoom.created_at || room.created_at,
        updatedAt: effectiveRoom.updated_at || room.updated_at,
      },
      participant,
    });
    return;
  }

  if (req.method === 'POST' && path === '/player') {
    const deviceId = String(req.headers['x-tng-device-id'] || '');
    const roomCode = String(req.headers['x-tng-room-code'] || '').toUpperCase();

    if (!deviceId || !roomCode) {
      sendJson(res, 400, {
        error: {
          code: 'PLAYER_ROOM_REQUIRED',
          message: 'Player device and room code are required.',
        },
      });
      return;
    }

    const verified = await verifyBffPlayerWithTngApi(req, deviceId, roomCode);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'PLAYER_SESSION_INVALID', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    let room = await loadRailwayBffPlayerRoom(roomCode);
    if (!room) {
      sendJson(res, 404, {
        error: { code: 'ROOM_NOT_FOUND', message: 'This BFF room is no longer active.' },
      });
      return;
    }

    let internalState = extractBffGameState(room.display_state || {});
    let players = await loadBffParticipants(room.id, internalState);
    const verifiedParticipant = verified.payload?.participant || null;
    const participant = players.find((player) =>
      String(player.deviceSessionId || '') === String(deviceId)
      || String(player.accountId || '') === String(verifiedParticipant?.accountId || '')
    ) || verifiedParticipant;

    if (!participant) {
      sendJson(res, 404, {
        error: { code: 'PLAYER_NOT_IN_ROOM', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    const body = await readJsonBody(req).catch(() => ({}));

    let nextGameState;
    let savedRoom;

    if (String(body?.action || '') === 'buzz') {
      const claim = await claimBffBuzz(room, participant);
      nextGameState = claim.gameState;
      savedRoom = claim.room;
    } else {
      nextGameState = await applyBffPlayerAction(room, participant, body || {}, players);
      savedRoom = await saveBffGameState(
        room.id,
        room.display_state || {},
        nextGameState,
      );
    }

    players = await loadBffParticipants(room.id, nextGameState);
    const gameState = sanitizeBffPlayerState(nextGameState, players, participant);

    sendJson(res, 200, {
      room: {
        id: savedRoom?.id || room.id,
        roomCode: savedRoom?.room_code || room.room_code,
        gameId: savedRoom?.game_id || room.game_id,
        status: savedRoom?.status || room.status,
        revision: savedRoom?.revision || room.revision,
        gameState,
        createdAt: savedRoom?.created_at || room.created_at,
        updatedAt: savedRoom?.updated_at || room.updated_at,
      },
      participant,
    });
    return;
  }

  if (req.method === 'GET' && path === '/host') {
    const controllerId = String(req.headers['x-tng-device-id'] || '');
    if (!controllerId) {
      sendJson(res, 400, { error: { code: 'CONTROLLER_REQUIRED', message: 'Host controller is missing.' } });
      return;
    }

    const verified = await verifyBffHostWithTngApi(req, controllerId);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' },
      });
      return;
    }

    let room = await loadRailwayBffHostRoom(controllerId);
    if (!room) {
      sendJson(res, 404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active BFF room is attached to this Host Controller.',
        },
      });
      return;
    }

    room = await reconcileBffTimers(room);
    await assignBffSeats(room.id);
    let internalState = extractBffGameState(room.display_state || {});
    let players = await loadBffParticipants(room.id, internalState);

    const assignmentResult = await ensureBffTeamAssignments(room, internalState, players);
    internalState = assignmentResult.gameState;
    const effectiveRoom = assignmentResult.room || room;
    players = await loadBffParticipants(room.id, internalState);

    const gameState = sanitizeBffHostState(internalState, players);

    sendJson(res, 200, {
      room: {
        id: effectiveRoom.id || room.id,
        roomCode: effectiveRoom.room_code || room.room_code,
        gameId: effectiveRoom.game_id || room.game_id,
        status: effectiveRoom.status || room.status,
        revision: effectiveRoom.revision || room.revision,
        gameState,
        players,
        createdAt: effectiveRoom.created_at || room.created_at,
        updatedAt: effectiveRoom.updated_at || room.updated_at,
      },
    });
    return;
  }

  if (req.method === 'POST' && path === '/host') {
    const controllerId = String(req.headers['x-tng-device-id'] || '');
    if (!controllerId) {
      sendJson(res, 400, { error: { code: 'CONTROLLER_REQUIRED', message: 'Host controller is missing.' } });
      return;
    }

    const verified = await verifyBffHostWithTngApi(req, controllerId);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' },
      });
      return;
    }

    let room = await loadRailwayBffHostRoom(controllerId);
    if (!room) {
      sendJson(res, 404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active BFF room is attached to this Host Controller.',
        },
      });
      return;
    }

    room = await reconcileBffTimers(room);
    const body = await readJsonBody(req).catch(() => ({}));
    await assignBffSeats(room.id);
    const actionPlayers = await loadBffParticipants(
      room.id,
      extractBffGameState(room.display_state || {}),
    );
    const nextGameState = await applyBffHostAction(room, body || {}, actionPlayers);
    const savedRoom = await saveBffGameState(room.id, room.display_state || {}, nextGameState);
    const players = await loadBffParticipants(room.id, nextGameState);
    const gameState = sanitizeBffHostState(nextGameState, players);

    sendJson(res, 200, {
      room: {
        id: savedRoom?.id || room.id,
        roomCode: savedRoom?.room_code || room.room_code,
        gameId: savedRoom?.game_id || room.game_id,
        status: savedRoom?.status || room.status,
        revision: savedRoom?.revision || room.revision,
        gameState,
        players,
        createdAt: savedRoom?.created_at || room.created_at,
        updatedAt: savedRoom?.updated_at || room.updated_at,
      },
    });
    return;
  }

  sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'BFF route not found.' } });
}


let dominoSchemaReady = null;

async function ensureDominoSchema() {
  if (!dominoSchemaReady) {
    dominoSchemaReady = bffPool.query(\`
      create table if not exists public.tng_domino_games (
        id text primary key,
        room_code text not null unique,
        game_state jsonb not null,
        host_account_id uuid,
        host_token_hash text,
        seat_tokens jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      alter table public.tng_domino_games
        add column if not exists host_account_id uuid,
        add column if not exists host_token_hash text,
        add column if not exists seat_tokens jsonb not null default '{}'::jsonb;
    \`).catch((error) => {
      dominoSchemaReady = null;
      throw error;
    });
  }
  await dominoSchemaReady;
}

function dominoToken() {
  return randomBytes(32).toString('base64url');
}

function hashDominoToken(token) {
  const clean = String(token || '');
  return clean
    ? createHash('sha256').update(clean).digest('hex')
    : '';
}

function readDominoToken(req) {
  return String(req.headers['x-domino-token'] || '').trim();
}

function cleanDominoGameState(data, roomCode) {
  const source =
    data && typeof data === 'object' && !Array.isArray(data)
      ? data
      : {};

  const {
    id,
    room_code,
    created_date,
    updated_date,
    createdAt,
    updatedAt,
    ...state
  } = source;

  return {
    ...state,
    room_code: String(roomCode || room_code || '').trim().toUpperCase(),
  };
}

function serializeDominoRow(row, stateOverride = null) {
  if (!row) return null;
  const state =
    stateOverride ||
    (row.game_state && typeof row.game_state === 'object'
      ? row.game_state
      : {});

  return {
    ...state,
    id: row.id,
    room_code: row.room_code,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function dominoSeatAccess(row, token) {
  const tokenHash = hashDominoToken(token);
  if (!tokenHash) return null;

  if (row.host_token_hash && row.host_token_hash === tokenHash) {
    return { role: 'host', seat: 0, playerId: row.game_state?.players?.[0]?.playerId || null };
  }

  const seatTokens =
    row.seat_tokens && typeof row.seat_tokens === 'object'
      ? row.seat_tokens
      : {};

  for (const [seatKey, record] of Object.entries(seatTokens)) {
    if (!record || typeof record !== 'object') continue;
    if (String(record.hash || '') !== tokenHash) continue;

    const seat = Number(seatKey);
    if (!Number.isInteger(seat) || seat < 1 || seat > 3) continue;

    const player = row.game_state?.players?.[seat];
    if (!player || String(player.playerId || '') !== String(record.playerId || '')) continue;

    return {
      role: 'player',
      seat,
      playerId: String(record.playerId || ''),
    };
  }

  return null;
}

function sanitizeDominoStateForViewer(state, access = null) {
  const source =
    state && typeof state === 'object'
      ? state
      : {};

  const revealAll =
    access?.role === 'host' ||
    source.phase === 'round_over' ||
    source.phase === 'game_over' ||
    source.status === 'finished';

  const players = Array.isArray(source.players)
    ? source.players.map((player, seat) => {
        const hand = Array.isArray(player?.hand) ? player.hand : [];
        const canSeeHand =
          revealAll ||
          (access?.role === 'player' && access.seat === seat);

        return {
          ...player,
          hand: canSeeHand
            ? hand
            : hand.map((_, index) => ({
                id: \`hidden-\${seat}-\${index}\`,
                hidden: true,
              })),
        };
      })
    : [];

  return {
    ...source,
    players,
  };
}

async function loadDominoRowByRoom(roomCode, client = bffPool, forUpdate = false) {
  const result = await client.query(
    \`
      select
        id,
        room_code,
        game_state,
        host_account_id,
        host_token_hash,
        seat_tokens,
        created_at,
        updated_at
      from public.tng_domino_games
      where room_code = $1
      limit 1
      \${forUpdate ? 'for update' : ''}
    \`,
    [roomCode],
  );
  return result.rows[0] || null;
}

async function verifyDominoHostRequest(req, row = null) {
  const auth = String(req.headers.authorization || '');
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const deviceId = String(req.headers['x-tng-device-id'] || '').trim();

  const verified = await verifyViralHostAuthorization({
    token,
    deviceId,
  }).catch(() => null);

  if (!verified) return null;

  if (
    row?.host_account_id &&
    String(row.host_account_id) !== String(verified.accountId)
  ) {
    return null;
  }

  return verified;
}

function reconcileDominoSeatTokens(state, seatTokens) {
  const current =
    seatTokens && typeof seatTokens === 'object'
      ? { ...seatTokens }
      : {};

  for (const [seatKey, record] of Object.entries(current)) {
    const seat = Number(seatKey);
    const player = state?.players?.[seat];

    if (
      !Number.isInteger(seat) ||
      seat < 1 ||
      seat > 3 ||
      !player ||
      player.isAI ||
      !player.playerId ||
      String(player.playerId) !== String(record?.playerId || '')
    ) {
      delete current[seatKey];
    }
  }

  return current;
}

async function handleDominoApi(req, res) {
  await ensureDominoSchema();

  const url = new URL(req.url || '/domino-api', 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/domino-api';

  if (req.method === 'GET' && pathname === '/domino-api') {
    const roomCode = String(url.searchParams.get('room') || '').trim().toUpperCase();
    if (!roomCode) {
      sendJson(res, 400, {
        error: { code: 'ROOM_REQUIRED', message: 'Domino room code is required.' },
      });
      return;
    }

    const row = await loadDominoRowByRoom(roomCode);
    if (!row) {
      sendJson(res, 200, { games: [] });
      return;
    }

    const access = dominoSeatAccess(row, readDominoToken(req));
    const safeState = sanitizeDominoStateForViewer(row.game_state, access);

    sendJson(res, 200, {
      games: [serializeDominoRow(row, safeState)],
      access: access
        ? { role: access.role, seat: access.seat }
        : { role: 'spectator', seat: null },
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/domino-api') {
    const verifiedHost = await verifyDominoHostRequest(req);
    if (!verifiedHost) {
      sendJson(res, 403, {
        error: {
          code: 'HOST_AUTH_REQUIRED',
          message: 'Open Dominoes from the TNG Host Controller to create a live table.',
        },
      });
      return;
    }

    const data = await readJsonBody(req).catch(() => null);
    const roomCode = String(data?.room_code || '').trim().toUpperCase();

    if (!data || !/^[A-Z0-9]{5,8}$/.test(roomCode)) {
      sendJson(res, 400, {
        error: { code: 'ROOM_REQUIRED', message: 'A valid Domino room code is required.' },
      });
      return;
    }

    const id = \`dom_\${Date.now()}_\${randomBytes(5).toString('hex')}\`;
    const hostToken = dominoToken();
    const gameState = cleanDominoGameState(data, roomCode);

    try {
      const result = await bffPool.query(
        \`
          insert into public.tng_domino_games
            (id, room_code, game_state, host_account_id, host_token_hash, seat_tokens)
          values ($1, $2, $3::jsonb, $4::uuid, $5, '{}'::jsonb)
          returning
            id, room_code, game_state, host_account_id, host_token_hash,
            seat_tokens, created_at, updated_at
        \`,
        [
          id,
          roomCode,
          JSON.stringify(gameState),
          verifiedHost.accountId,
          hashDominoToken(hostToken),
        ],
      );

      sendJson(res, 201, {
        game: serializeDominoRow(result.rows[0]),
        hostToken,
      });
    } catch (error) {
      if (error?.code === '23505') {
        sendJson(res, 409, {
          error: {
            code: 'ROOM_EXISTS',
            message: 'That Domino room code is already in use. Create another room.',
          },
        });
        return;
      }
      throw error;
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/domino-api/join') {
    const body = await readJsonBody(req).catch(() => null);
    const roomCode = String(body?.roomCode || '').trim().toUpperCase();
    const seat = Number(body?.seat);
    const name = String(body?.name || '').trim().slice(0, 20);

    if (
      !roomCode ||
      !Number.isInteger(seat) ||
      seat < 1 ||
      seat > 3 ||
      !name
    ) {
      sendJson(res, 400, {
        error: {
          code: 'INVALID_JOIN',
          message: 'Choose an open seat and enter your name.',
        },
      });
      return;
    }

    const client = await bffPool.connect();
    try {
      await client.query('begin');
      const row = await loadDominoRowByRoom(roomCode, client, true);

      if (!row) {
        await client.query('rollback');
        sendJson(res, 404, {
          error: { code: 'ROOM_NOT_FOUND', message: 'That Domino room was not found.' },
        });
        return;
      }

      const state = cleanDominoGameState(row.game_state, row.room_code);
      if (state.phase !== 'waiting') {
        await client.query('rollback');
        sendJson(res, 409, {
          error: {
            code: 'GAME_STARTED',
            message: 'That Domino game has already started. You can still watch.',
          },
        });
        return;
      }

      const target = state.players?.[seat];
      if (!target || target.playerId) {
        await client.query('rollback');
        sendJson(res, 409, {
          error: {
            code: 'SEAT_TAKEN',
            message: 'Someone just took that seat. Pick another one.',
          },
        });
        return;
      }

      const playerId = \`p_\${randomBytes(10).toString('base64url')}\`;
      const seatToken = dominoToken();
      const players = state.players.map((player, index) =>
        index === seat
          ? {
              ...player,
              playerId,
              playerName: name,
              isAI: false,
              connected: true,
              isHost: false,
            }
          : player,
      );

      const nextState = { ...state, players };
      const nextSeatTokens = {
        ...(row.seat_tokens || {}),
        [String(seat)]: {
          hash: hashDominoToken(seatToken),
          playerId,
        },
      };

      const updated = await client.query(
        \`
          update public.tng_domino_games
          set game_state = $2::jsonb,
              seat_tokens = $3::jsonb,
              updated_at = now()
          where id = $1
          returning
            id, room_code, game_state, host_account_id, host_token_hash,
            seat_tokens, created_at, updated_at
        \`,
        [row.id, JSON.stringify(nextState), JSON.stringify(nextSeatTokens)],
      );

      await client.query('commit');

      const access = { role: 'player', seat, playerId };
      sendJson(res, 200, {
        game: serializeDominoRow(
          updated.rows[0],
          sanitizeDominoStateForViewer(updated.rows[0].game_state, access),
        ),
        seat,
        playerId,
        seatToken,
      });
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/domino-api/action') {
    const body = await readJsonBody(req).catch(() => null);
    const roomCode = String(body?.roomCode || '').trim().toUpperCase();
    const action = String(body?.action || '').trim().toLowerCase();

    if (!roomCode || !['play', 'pass'].includes(action)) {
      sendJson(res, 400, {
        error: { code: 'INVALID_ACTION', message: 'That Domino move is not valid.' },
      });
      return;
    }

    const client = await bffPool.connect();
    try {
      await client.query('begin');
      const row = await loadDominoRowByRoom(roomCode, client, true);

      if (!row) {
        await client.query('rollback');
        sendJson(res, 404, {
          error: { code: 'ROOM_NOT_FOUND', message: 'That Domino room was not found.' },
        });
        return;
      }

      const access = dominoSeatAccess(row, readDominoToken(req));
      if (!access || access.role !== 'player') {
        await client.query('rollback');
        sendJson(res, 403, {
          error: {
            code: 'PLAYER_AUTH_REQUIRED',
            message: 'Your Domino seat is no longer authorized. Rejoin the table.',
          },
        });
        return;
      }

      const state = cleanDominoGameState(row.game_state, row.room_code);
      const player = state.players?.[access.seat];
      if (
        !player ||
        player.isAI ||
        String(player.playerId || '') !== String(access.playerId || '')
      ) {
        await client.query('rollback');
        sendJson(res, 403, {
          error: {
            code: 'SEAT_CHANGED',
            message: 'That seat is no longer yours.',
          },
        });
        return;
      }

      const next =
        action === 'play'
          ? applyDominoPlay(
              state,
              access.seat,
              String(body?.dominoId || ''),
              String(body?.side || ''),
            )
          : applyDominoPass(state, access.seat);

      if (next?.error) {
        await client.query('rollback');
        sendJson(res, 409, {
          error: { code: 'ILLEGAL_MOVE', message: String(next.error) },
        });
        return;
      }

      const updated = await client.query(
        \`
          update public.tng_domino_games
          set game_state = $2::jsonb,
              updated_at = now()
          where id = $1
          returning
            id, room_code, game_state, host_account_id, host_token_hash,
            seat_tokens, created_at, updated_at
        \`,
        [row.id, JSON.stringify(cleanDominoGameState(next, row.room_code))],
      );

      await client.query('commit');

      sendJson(res, 200, {
        game: serializeDominoRow(
          updated.rows[0],
          sanitizeDominoStateForViewer(updated.rows[0].game_state, access),
        ),
      });
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  if (req.method === 'PATCH' && pathname === '/domino-api') {
    const body = await readJsonBody(req).catch(() => null);
    const id = String(body?.id || '').trim();
    const data = body?.data;

    if (!id || !data || typeof data !== 'object' || Array.isArray(data)) {
      sendJson(res, 400, {
        error: { code: 'GAME_REQUIRED', message: 'Domino game state is required.' },
      });
      return;
    }

    const current = await bffPool.query(
      \`
        select
          id, room_code, game_state, host_account_id, host_token_hash,
          seat_tokens, created_at, updated_at
        from public.tng_domino_games
        where id = $1
        limit 1
      \`,
      [id],
    );
    const row = current.rows[0] || null;

    if (!row) {
      sendJson(res, 404, {
        error: { code: 'ROOM_NOT_FOUND', message: 'This Domino room no longer exists.' },
      });
      return;
    }

    const access = dominoSeatAccess(row, readDominoToken(req));
    const verifiedHost = await verifyDominoHostRequest(req, row);

    if (!access || access.role !== 'host' || !verifiedHost) {
      sendJson(res, 403, {
        error: {
          code: 'HOST_AUTH_REQUIRED',
          message: 'Only the active TNG Host can change the Domino table.',
        },
      });
      return;
    }

    const nextState = cleanDominoGameState(data, row.room_code);
    const nextSeatTokens = reconcileDominoSeatTokens(nextState, row.seat_tokens);

    const result = await bffPool.query(
      \`
        update public.tng_domino_games
        set game_state = $2::jsonb,
            seat_tokens = $3::jsonb,
            updated_at = now()
        where id = $1
        returning
          id, room_code, game_state, host_account_id, host_token_hash,
          seat_tokens, created_at, updated_at
      \`,
      [id, JSON.stringify(nextState), JSON.stringify(nextSeatTokens)],
    );

    sendJson(res, 200, {
      game: serializeDominoRow(result.rows[0]),
    });
    return;
  }

  sendJson(res, 405, {
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported Domino API method.' },
  });
}


let testFeedbackSchemaReady = null;

async function ensureTestFeedbackSchema() {
  if (!testFeedbackSchemaReady) {
    testFeedbackSchemaReady = bffPool.query(`
      create table if not exists public.tng_test_feedback (
        id bigserial primary key,
        game_id text not null,
        room_code text,
        report_type text not null,
        message text not null,
        tester_name text,
        page_url text,
        user_agent text,
        created_at timestamptz not null default now()
      )
    `).catch((error) => {
      testFeedbackSchemaReady = null;
      throw error;
    });
  }
  await testFeedbackSchemaReady;
}

async function handleTestFeedback(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Feedback only accepts POST.' },
    });
    return;
  }

  await ensureTestFeedbackSchema();

  const body = await readJsonBody(req).catch(() => null);
  const gameId = String(body?.gameId || '').trim().slice(0, 64);
  const roomCode = String(body?.roomCode || '').trim().toUpperCase().slice(0, 16) || null;
  const reportType = String(body?.reportType || 'feedback').trim().toLowerCase().slice(0, 32);
  const message = String(body?.message || '').trim().slice(0, 3000);
  const testerName = String(body?.testerName || '').trim().slice(0, 80) || null;
  const pageUrl = String(body?.pageUrl || '').trim().slice(0, 1000) || null;
  const userAgent = String(body?.userAgent || req.headers['user-agent'] || '').trim().slice(0, 500) || null;

  if (!gameId || message.length < 3) {
    sendJson(res, 400, {
      error: { code: 'INVALID_FEEDBACK', message: 'Choose a game and enter a short report.' },
    });
    return;
  }

  const allowedTypes = new Set(['bug', 'confusing', 'feedback', 'idea', 'other']);
  const cleanType = allowedTypes.has(reportType) ? reportType : 'other';

  const result = await bffPool.query(
    `
      insert into public.tng_test_feedback
        (game_id, room_code, report_type, message, tester_name, page_url, user_agent)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, created_at
    `,
    [gameId, roomCode, cleanType, message, testerName, pageUrl, userAgent],
  );

  sendJson(res, 201, {
    ok: true,
    report: {
      id: result.rows[0]?.id || null,
      createdAt: result.rows[0]?.created_at || null,
    },
  });
}

const server = http.createServer(async (req, res) => {
  const origin = String(req.headers.origin || '');
  if (isAllowedBrowserOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Headers',
      String(req.headers['access-control-request-headers'] ||
        'authorization, content-type, x-tng-device-id, x-tng-display-id, x-tng-display-token, x-tng-room-code, x-ww-token, x-st-token, x-bs-token, x-domino-token'),
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    if (origin && !isAllowedBrowserOrigin(origin)) {
      res.writeHead(403);
    } else {
      res.writeHead(204);
    }
    res.end();
    return;
  }

  try {
    if ((req.url || '').startsWith('/bernaverse-sso')) {
      await handleBernaverseSso(req, res);
      return;
    }

    if ((req.url || '').startsWith('/neon-auth')) {
      await proxyNeonAuth(req, res);
      return;
    }

    if ((req.url || '').startsWith('/tng-session')) {
      await handleTngSessionLifecycle(req, res);
      return;
    }

    if ((req.url || '').startsWith('/tng-display/state')) {
      await handleTngDisplayState(req, res);
      return;
    }

    if ((req.url || '').startsWith('/tng-spectator')) {
      await handleTngSpectator(req, res);
      return;
    }

    if ((req.url || '').startsWith('/tng-host-stage/roster')) {
      await handleTngHostRoster(req, res);
      return;
    }

    if ((req.url || '').startsWith('/tng-api/account-route')) {
      await handleTngAccountRoute(req, res);
      return;
    }

    if ((req.url || '').startsWith('/tng-api')) {
      await proxyTngApi(req, res);
      return;
    }

    if ((req.url || '').startsWith('/tng-stats')) {
      await handleTngStats(req, res);
      return;
    }

    if ((req.url || '').split('?')[0] === '/viral-live/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, service: 'viral-live', ...viralLive.stats() }));
      return;
    }

    if ((req.url || '').startsWith('/viral-display')) {
      await handleViralDisplayTarget(req, res);
      return;
    }

    if ((req.url || '').startsWith('/see-that-display')) {
      await handleSeeThatDisplayTarget(req, res);
      return;
    }

    if ((req.url || '').split('?')[0] === '/viral-live/resolve' && req.method === 'GET') {
      const url = new URL(req.url || '/viral-live/resolve', 'http://localhost');
      const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
      const room = viralLive.resolveRoom(code);
      sendJson(res, 200, { ok: true, gameId: 'viral', ...room });
      return;
    }

    if ((req.url || '').startsWith('/test-feedback')) {
      await handleTestFeedback(req, res);
      return;
    }

    if ((req.url || '').startsWith('/bff-api')) {
      await handleBffApi(req, res);
      return;
    }

    if ((req.url || '').startsWith('/bs-api')) {
      await handleBattleSudokuApi(req, res);
      return;
    }

    if ((req.url || '').startsWith('/st-api')) {
      await handleSeeThatApi(req, res);
      return;
    }

    if ((req.url || '').startsWith('/ww-api')) {
      await handleWordWranglerApi(req, res);
      return;
    }

    if ((req.url || '').startsWith('/domino-api')) {
      await handleDominoApi(req, res);
      return;
    }

    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safePath = normalize(rawPath).replace(/^([.][.][/\\])+/, '');
    let filePath = join(root, safePath === '/' ? 'index.html' : safePath);

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');
      await sendFile(res, filePath);
      return;
    } catch {}

    // React Router SPA fallback for /host, /join/:roomCode, /games/*, etc.
    await sendFile(res, join(root, 'index.html'));
  } catch (error) {
    console.error('[TNG temp host] request failed', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('TNG host error');
  }
});

server.on('upgrade', async (request, socket, head) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');

    if (viralLive.handleUpgrade(request, socket, head)) return;

    if (url.pathname === '/host-live') {
      const origin = String(request.headers.origin || '');

      if (origin && !isAllowedBrowserOrigin(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      hostLiveWss.handleUpgrade(request, socket, head, (ws) => {
        hostLiveWss.emit('connection', ws, request);
      });
      return;
    }

    socket.destroy();
    return;
  } catch (error) {
    console.error('[TNG WebSocket] upgrade failed', error);
    socket.destroy();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`TNG frontend listening on port ${port}`);

  // Idempotent production backfill: every existing TNG account gets a
  // BERNAverse FREE membership. Future sign-ins also call ensure_free.
  windowlessTimeout(syncTngAccountsToBernaverseFree, 1500);
});

function windowlessTimeout(task, delayMs) {
  setTimeout(() => {
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error('[BERNAverse sync] TNG FREE membership pass failed', error);
      });
  }, delayMs);
}