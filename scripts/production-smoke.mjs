import { buildFingerprint } from './build-fingerprint.mjs';

const PUBLIC_ORIGIN = String(
  process.env.TNG_PUBLIC_ORIGIN || 'https://texasnomadgames.com',
).replace(/\/$/, '');

const WWW_ORIGIN = String(
  process.env.TNG_WWW_ORIGIN || 'https://www.texasnomadgames.com',
).replace(/\/$/, '');

const SERVICE_ORIGIN = String(
  process.env.TNG_SERVICE_ORIGIN || 'https://auth.texasnomadgames.com',
).replace(/\/$/, '');

const EXPECTED_COMMIT = String(process.env.EXPECTED_COMMIT || '').trim();
const WAIT_MS = Math.max(30_000, Number(process.env.RELEASE_WAIT_MS || 6 * 60 * 1000));
const POLL_MS = Math.max(2_000, Number(process.env.RELEASE_POLL_MS || 8_000));
const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.REQUEST_TIMEOUT_MS || 15_000));

const failures = [];
const passes = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      redirect: 'follow',
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'TNG-Release-Certification/1.0',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function json(url, options = {}) {
  const response = await request(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function pass(name, detail = '') {
  passes.push({ name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failures.push({ name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function check(name, task) {
  try {
    const detail = await task();
    pass(name, detail || '');
  } catch (error) {
    fail(name, error?.message || String(error));
  }
}

async function waitForExactProduction(expectedFingerprint) {
  const deadline = Date.now() + WAIT_MS;
  let serviceSeen = '';
  let publicSeen = '';
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const [healthResult, buildResult] = await Promise.all([
        json(`${SERVICE_ORIGIN}/healthz`),
        json(`${PUBLIC_ORIGIN}/build-meta.json?fp=${encodeURIComponent(expectedFingerprint)}`),
      ]);

      if (healthResult.response.ok) {
        serviceSeen = String(healthResult.payload?.commit || '');
      }

      if (buildResult.response.ok) {
        publicSeen = String(buildResult.payload?.fingerprint || '');
      } else {
        publicSeen = `http-${buildResult.response.status}`;
      }

      const serviceReady = !EXPECTED_COMMIT || serviceSeen === EXPECTED_COMMIT;
      const publicReady = publicSeen === expectedFingerprint;

      if (serviceReady && publicReady) {
        pass(
          'exact production build active',
          `${EXPECTED_COMMIT ? EXPECTED_COMMIT.slice(0, 12) : 'service-ready'} / ${expectedFingerprint.slice(0, 12)}`,
        );
        return;
      }

      lastError =
        `service=${serviceSeen || 'unknown'} public=${publicSeen || 'unknown'} expected-fp=${expectedFingerprint.slice(0, 12)}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }

    console.log(`WAIT  production deploy: ${lastError}`);
    await sleep(POLL_MS);
  }

  throw new Error(
    `Production did not converge on the expected build. Last state: ${lastError}`,
  );
}

async function expectHtml(origin, path) {
  const response = await request(`${origin}${path}`);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  if (!/text\/html/i.test(response.headers.get('content-type') || '')) {
    throw new Error(`unexpected content-type ${response.headers.get('content-type') || 'missing'}`);
  }

  if (!body.includes('id="root"')) {
    throw new Error('SPA root element missing');
  }

  return body;
}

async function main() {
  console.log('\nTNG Production Release Certification');
  console.log('====================================');
  console.log(`Public:  ${PUBLIC_ORIGIN}`);
  console.log(`Service: ${SERVICE_ORIGIN}`);
  if (EXPECTED_COMMIT) console.log(`Commit:  ${EXPECTED_COMMIT}`);
  console.log('');

  const { fingerprint: expectedFingerprint, files: fingerprintFiles } = await buildFingerprint();
  console.log(`Source fingerprint: ${expectedFingerprint} (${fingerprintFiles} files)`);
  console.log('');

  try {
    await waitForExactProduction(expectedFingerprint);
  } catch (error) {
    fail('exact production build active', error?.message || String(error));
    process.exit(1);
  }

  await check('service health + database', async () => {
    const { response, payload } = await json(`${SERVICE_ORIGIN}/healthz`);
    if (!response.ok || payload?.ok !== true) {
      throw new Error(`healthz returned ${response.status}`);
    }
    if (payload?.database !== 'ok') {
      throw new Error(`database is ${payload?.database || 'unknown'}`);
    }
    if (EXPECTED_COMMIT && payload?.commit !== EXPECTED_COMMIT) {
      throw new Error(`commit mismatch: ${payload?.commit || 'missing'}`);
    }
    return `db=${payload.database}, uptime=${payload.uptimeSeconds}s`;
  });

  await check('room registry health', async () => {
    const { response, payload } = await json(`${SERVICE_ORIGIN}/tng-rooms/health`);
    if (!response.ok || payload?.ok !== true) throw new Error(`status ${response.status}`);
    return payload?.service || 'ok';
  });

  await check('VIRAL relay health', async () => {
    const { response, payload } = await json(`${SERVICE_ORIGIN}/viral-live/health`);
    if (!response.ok || payload?.ok !== true) throw new Error(`status ${response.status}`);
    return 'relay responding';
  });

  await check('Rodeo Rumble relay health', async () => {
    const { response, payload } = await json(`${SERVICE_ORIGIN}/rr-api/health`);
    if (!response.ok || payload?.ok !== true) throw new Error(`status ${response.status}`);
    return 'relay responding';
  });

  const publicRoutes = [
    '/',
    '/welcome',
    '/login',
    '/register',
    '/display',
    '/forgot-password',
    '/reset-password',
    '/games',
    '/games/bff',
    '/games/square-biz',
    '/games/hangman',
    '/games/spades',
    '/games/word-search',
    '/games/viral',
    '/games/sudoku',
    '/games/rodeo-rumble',
    '/games/see-that',
    '/games/word-wrangler',
    '/games/dominoes',
    '/host',
  ];

  let loginHtml = '';
  for (const path of publicRoutes) {
    await check(`frontend route ${path}`, async () => {
      const body = await expectHtml(PUBLIC_ORIGIN, path);
      if (path === '/login') loginHtml = body;
      return '200 HTML';
    });
  }

  await check('www hostname', async () => {
    await expectHtml(WWW_ORIGIN, '/login');
    return '200 HTML';
  });

  await check('frontend build metadata', async () => {
    const { response, payload } = await json(`${PUBLIC_ORIGIN}/build-meta.json`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    if (payload?.app !== 'texasnomad-games') throw new Error('wrong build metadata payload');
    if (payload?.fingerprint !== expectedFingerprint) {
      throw new Error(`fingerprint mismatch: ${payload?.fingerprint || 'missing'}`);
    }
    return expectedFingerprint.slice(0, 12);
  });

  await check('entry assets load', async () => {
    if (!loginHtml) loginHtml = await expectHtml(PUBLIC_ORIGIN, '/login');

    const matches = [
      ...loginHtml.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi),
    ].map((match) => match[1]);

    const assets = [...new Set(matches)].filter((value) => value.startsWith('/'));
    if (!assets.length) throw new Error('no JS/CSS entry assets found');

    for (const asset of assets) {
      const response = await request(`${PUBLIC_ORIGIN}${asset}`);
      if (!response.ok) throw new Error(`${asset} returned ${response.status}`);
      const type = response.headers.get('content-type') || '';
      if (!/(javascript|css)/i.test(type)) {
        throw new Error(`${asset} has unexpected content-type ${type || 'missing'}`);
      }
    }

    return `${assets.length} entry asset(s)`;
  });

  await check('VIRAL deployed bridge + first-party relay', async () => {
    const response = await request(`${PUBLIC_ORIGIN}/viral/index.html`);
    const body = await response.text();
    if (!response.ok) throw new Error(`status ${response.status}`);
    if (!body.includes('/viral/tng-bridge.js')) throw new Error('TNG bridge injection missing');
    if (!body.includes('wss://auth.texasnomadgames.com')) throw new Error('first-party WebSocket relay missing');
    if (body.includes('wss://tng-live-production.up.railway.app')) {
      throw new Error('legacy Railway WebSocket origin present');
    }
    return 'bridge + relay verified';
  });

  await check('unauthenticated API rejects protected profile', async () => {
    const { response } = await json(`${SERVICE_ORIGIN}/tng-api/profile`);
    if (![401, 403].includes(response.status)) {
      throw new Error(`expected 401/403, got ${response.status}`);
    }
    return String(response.status);
  });

  await check('CORS allows TNG production origin', async () => {
    const response = await request(`${SERVICE_ORIGIN}/tng-api/profile`, {
      method: 'OPTIONS',
      headers: {
        Origin: PUBLIC_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });

    if (response.status !== 204) throw new Error(`expected 204, got ${response.status}`);
    if (response.headers.get('access-control-allow-origin') !== PUBLIC_ORIGIN) {
      throw new Error('production origin not echoed by CORS');
    }
    return '204 + origin allowed';
  });

  await check('CORS rejects unknown origin preflight', async () => {
    const response = await request(`${SERVICE_ORIGIN}/tng-api/profile`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://not-tng.invalid',
        'Access-Control-Request-Method': 'GET',
      },
    });

    if (response.status !== 403) throw new Error(`expected 403, got ${response.status}`);
    return '403';
  });

  console.log('');
  console.log(`Production certification: ${passes.length} passed, ${failures.length} failed.`);

  if (failures.length) {
    process.exit(1);
  }
}

await main();
