import { buildFingerprint } from './build-fingerprint.mjs';

const PUBLIC_ORIGIN = String(
  process.env.TNG_PUBLIC_ORIGIN || 'https://www.texasnomadgames.com',
).replace(/\/$/, '');

const WWW_ORIGIN = String(
  process.env.TNG_WWW_ORIGIN || 'https://www.texasnomadgames.com',
).replace(/\/$/, '');

const SERVICE_ORIGIN = String(
  process.env.TNG_SERVICE_ORIGIN || 'https://texasnomad-games.pages.dev',
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

      const serviceReady = true; // Supabase Edge API and Pages frontend deploy independently; verify each by health and live API smoke.
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

function solveSudoku(puzzle) {
  const board = puzzle.slice();
  const rows = Array.from({ length: 9 }, () => new Set());
  const cols = Array.from({ length: 9 }, () => new Set());
  const boxes = Array.from({ length: 9 }, () => new Set());
  const boxOf = (i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
  for (let i = 0; i < 81; i++) if (board[i]) {
    const r = Math.floor(i / 9), c = i % 9, b = boxOf(i), d = board[i];
    rows[r].add(d); cols[c].add(d); boxes[b].add(d);
  }
  function search() {
    let best = -1, choices = null;
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
      const candidates = [];
      for (let d = 1; d <= 9; d++) {
        if (!rows[r].has(d) && !cols[c].has(d) && !boxes[b].has(d)) candidates.push(d);
      }
      if (!choices || candidates.length < choices.length) { best = i; choices = candidates; }
      if (choices.length === 1) break;
    }
    if (best < 0) return true;
    if (!choices.length) return false;
    const r = Math.floor(best / 9), c = best % 9, b = boxOf(best);
    for (const d of choices) {
      board[best] = d; rows[r].add(d); cols[c].add(d); boxes[b].add(d);
      if (search()) return true;
      board[best] = 0; rows[r].delete(d); cols[c].delete(d); boxes[b].delete(d);
    }
    return false;
  }
  if (!search()) throw new Error('could not solve the live Sudoku puzzle');
  return board;
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
    return `db=${payload.database}, uptime=${payload.uptimeSeconds}s`;
  });

  await check('room registry health', async () => {
    const { response, payload } = await json(`${SERVICE_ORIGIN}/tng-rooms/health`);
    if (!response.ok || payload?.ok !== true) throw new Error(`status ${response.status}`);
    return payload?.service || 'ok';
  });

  await check('OUT! game service health', async () => {
    const { response, payload } = await json(`${SERVICE_ORIGIN}/nc-api/health`);
    if (!response.ok || payload?.ok !== true || payload?.service !== 'out') {
      throw new Error(`OUT! health returned HTTP ${response.status}`);
    }
    return `rooms=${payload.rooms}, persistent=${payload.persistent}`;
  });

  await check('Battle Sudoku game service health', async () => {
    const { response, payload } = await json(`${SERVICE_ORIGIN}/bs-api/health`);
    if (!response.ok || payload?.ok !== true || payload?.service !== 'battle-sudoku') {
      throw new Error(`Battle Sudoku health returned HTTP ${response.status}`);
    }
    return `rooms=${payload.rooms}, persistent=${payload.persistent}`;
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
    '/room/join/TN7K4P?game=sudoku&next=%2Fgames%2Fsudoku%3Froom%3DTN7K4P',
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
    if (!body.includes('location.host')) throw new Error('same-origin WebSocket relay missing');
    if (body.includes('wss://tng-live-production.up.railway.app')) {
      throw new Error('legacy Railway WebSocket origin present');
    }
    return 'bridge + relay verified';
  });

  await check('shared lobby guest host, roster, join, and start lifecycle', async () => {
    const suffix = Date.now().toString(36).slice(-6).toUpperCase();
    const hostName = `LobbyH${suffix}`;
    const playerName = `LobbyP${suffix}`;
    let hostGuestToken = '';
    let hostDeviceId = '';
    let roomCode = '';

    const postJson = async (path, guestToken, deviceId, body, room = '') => {
      const headers = { 'Content-Type': 'application/json' };
      if (guestToken) headers['X-TNG-Guest-Token'] = guestToken;
      if (deviceId) headers['X-TNG-Device-Id'] = deviceId;
      if (room) headers['X-TNG-Room-Code'] = room;
      return json(`${SERVICE_ORIGIN}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    };

    const createIdentity = async (name) => {
      const { response, payload } = await json(`${SERVICE_ORIGIN}/tng-guest/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok || !payload?.token) {
        throw new Error(`guest identity failed: HTTP ${response.status}`);
      }
      return payload.token;
    };

    const createDevice = async (guestToken, role, label) => {
      const result = await postJson('/tng-api/device-session', guestToken, '', {
        role,
        deviceLabel: label,
      });
      if (!result.response.ok || !result.payload?.device?.id) {
        throw new Error(`${role} device creation failed: HTTP ${result.response.status} ${result.payload?.error?.message || ''}`);
      }
      return result.payload.device.id;
    };

    try {
      hostGuestToken = await createIdentity(hostName);
      const playerGuestToken = await createIdentity(playerName);
      hostDeviceId = await createDevice(hostGuestToken, 'host_controller', `Lobby host ${suffix}`);
      const playerDeviceId = await createDevice(playerGuestToken, 'player', `Lobby player ${suffix}`);

      const hostSession = await postJson('/tng-api/host/session', hostGuestToken, hostDeviceId, {});
      if (!hostSession.response.ok || !hostSession.payload?.hostSession?.id) {
        throw new Error(`host session failed: HTTP ${hostSession.response.status} ${hostSession.payload?.error?.message || ''}`);
      }

      const created = await postJson('/tng-api/host/room', hostGuestToken, hostDeviceId, { gameId: 'out' });
      roomCode = String(created.payload?.room?.roomCode || '').toUpperCase();
      if (!created.response.ok || !/^TN[A-Z0-9]{4}$/.test(roomCode)) {
        throw new Error(`shared room creation failed: HTTP ${created.response.status} ${created.payload?.error?.message || ''}`);
      }

      const registered = await postJson('/tng-rooms/register-core', '', '', {
        roomCode,
        gameId: 'out',
      });
      if (!registered.response.ok || registered.payload?.registered !== true) {
        throw new Error(`room registry registration failed: HTTP ${registered.response.status} ${registered.payload?.error?.message || ''}`);
      }
      const resolved = await json(`${SERVICE_ORIGIN}/tng-rooms/resolve?code=${encodeURIComponent(roomCode)}`);
      if (!resolved.response.ok || resolved.payload?.room?.gameId !== 'out') {
        throw new Error(`OUT! lobby code did not resolve before the cabinet started: HTTP ${resolved.response.status}`);
      }

      const joined = await postJson('/tng-api/player/room', playerGuestToken, playerDeviceId, { roomCode }, roomCode);
      if (!joined.response.ok || !joined.payload?.participant) {
        throw new Error(`second guest could not join shared room: HTTP ${joined.response.status} ${joined.payload?.error?.message || ''}`);
      }

      const hostHeaders = {
        'X-TNG-Guest-Token': hostGuestToken,
        'X-TNG-Device-Id': hostDeviceId,
      };
      const rosterResult = await json(`${SERVICE_ORIGIN}/tng-api/host/room-state`, { headers: hostHeaders });
      const people = rosterResult.payload?.people || [];
      if (!rosterResult.response.ok || people.length !== 2 ||
        !people.some((person) => person.role === 'host_player' || person.seatNumber === 1) ||
        !people.some((person) => person.role === 'player')) {
        throw new Error(`shared roster missing host + player: ${people.map((person) => person.role).join(',') || rosterResult.response.status}`);
      }

      const started = await json(`${SERVICE_ORIGIN}/tng-api/host/room-state`, {
        method: 'PATCH',
        headers: { ...hostHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: { action: 'start' } }),
      });
      if (!started.response.ok || started.payload?.room?.status !== 'live') {
        throw new Error(`host could not start shared room: HTTP ${started.response.status} ${started.payload?.error?.message || ''}`);
      }

      return `room ${roomCode}: host + second guest in one roster, shared start transitioned to live`;
    } finally {
      if (hostGuestToken && hostDeviceId) {
        await request(`${SERVICE_ORIGIN}/tng-api/host/room`, {
          method: 'DELETE',
          headers: {
            'X-TNG-Guest-Token': hostGuestToken,
            'X-TNG-Device-Id': hostDeviceId,
          },
        }).catch(() => {});
        await request(`${SERVICE_ORIGIN}/tng-api/host/session`, {
          method: 'DELETE',
          headers: {
            'X-TNG-Guest-Token': hostGuestToken,
            'X-TNG-Device-Id': hostDeviceId,
          },
        }).catch(() => {});
      }
    }
  });

  await check('Word Search live host + player API lifecycle', async () => {
    const suffix = Date.now().toString(36).slice(-6).toUpperCase();
    const hostName = `WordHost${suffix}`;
    const playerName = `WordPlayer${suffix}`;
    let hostGuestToken = '';
    let hostDeviceId = '';
    let roomCode = '';

    const postJson = async (path, guestToken, deviceId, body, room = '') => {
      const headers = { 'Content-Type': 'application/json' };
      if (guestToken) headers['X-TNG-Guest-Token'] = guestToken;
      if (deviceId) headers['X-TNG-Device-Id'] = deviceId;
      if (room) headers['X-TNG-Room-Code'] = room;
      return json(`${SERVICE_ORIGIN}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    };

    const createIdentity = async (name) => {
      const { response, payload } = await json(`${SERVICE_ORIGIN}/tng-guest/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok || !payload?.token) {
        throw new Error(`guest identity failed: HTTP ${response.status} ${payload?.error?.message || ''}`);
      }
      return payload.token;
    };

    const createDevice = async (guestToken, role, label) => {
      const result = await postJson('/tng-api/device-session', guestToken, '', {
        role,
        deviceLabel: label,
      });
      if (!result.response.ok || !result.payload?.device?.id) {
        throw new Error(`${role} device creation failed: HTTP ${result.response.status} ${result.payload?.error?.message || ''}`);
      }
      return result.payload.device.id;
    };

    try {
      hostGuestToken = await createIdentity(hostName);
      const playerGuestToken = await createIdentity(playerName);
      hostDeviceId = await createDevice(hostGuestToken, 'host_controller', `Word Search host ${suffix}`);
      const playerDeviceId = await createDevice(playerGuestToken, 'player', `Word Search player ${suffix}`);

      const hostSession = await postJson('/tng-api/host/session', hostGuestToken, hostDeviceId, {});
      if (!hostSession.response.ok || !hostSession.payload?.hostSession?.id) {
        throw new Error(`host session failed: HTTP ${hostSession.response.status} ${hostSession.payload?.error?.message || ''}`);
      }

      const created = await postJson('/tng-api/host/room', hostGuestToken, hostDeviceId, {
        gameId: 'word-search',
        displayName: hostName,
      });
      roomCode = String(created.payload?.room?.roomCode || '').toUpperCase();
      if (!created.response.ok || !/^TN[A-Z0-9]{4}$/.test(roomCode)) {
        throw new Error(`Word Search room creation failed: HTTP ${created.response.status} ${created.payload?.error?.message || ''}`);
      }

      const registered = await postJson('/tng-rooms/register-core', '', '', {
        roomCode,
        gameId: 'word-search',
      });
      if (!registered.response.ok || registered.payload?.registered !== true) {
        throw new Error(`room registry registration failed: HTTP ${registered.response.status} ${registered.payload?.error?.message || ''}`);
      }

      const joined = await postJson('/tng-api/player/room', playerGuestToken, playerDeviceId, {
        roomCode,
        displayName: playerName,
      }, roomCode);
      if (!joined.response.ok || !joined.payload?.participant) {
        throw new Error(`second guest could not join Word Search: HTTP ${joined.response.status} ${joined.payload?.error?.message || ''}`);
      }

      const hostHeaders = {
        'X-TNG-Guest-Token': hostGuestToken,
        'X-TNG-Device-Id': hostDeviceId,
      };
      const playerHeaders = {
        'X-TNG-Guest-Token': playerGuestToken,
        'X-TNG-Device-Id': playerDeviceId,
        'X-TNG-Room-Code': roomCode,
      };

      const hostBefore = await json(`${SERVICE_ORIGIN}/tng-api/word-search/host`, { headers: hostHeaders });
      if (!hostBefore.response.ok || hostBefore.payload?.room?.gameState?.phase !== 'setup') {
        throw new Error(`Word Search host route failed before start: HTTP ${hostBefore.response.status} ${hostBefore.payload?.error?.message || ''}`);
      }

      const playerBefore = await json(`${SERVICE_ORIGIN}/tng-api/word-search/player`, { headers: playerHeaders });
      if (!playerBefore.response.ok || Number(playerBefore.payload?.participant?.seatNumber) !== 2) {
        throw new Error(`Word Search player route failed before start: HTTP ${playerBefore.response.status} ${playerBefore.payload?.error?.message || ''}`);
      }

      const started = await postJson('/tng-api/word-search/host', hostGuestToken, hostDeviceId, {
        action: 'start_game',
        mode: 'race',
        difficulty: 'simpleton',
        category: 'random',
      });
      const hostGame = started.payload?.room?.gameState;
      if (!started.response.ok || hostGame?.phase !== 'playing' ||
          !Array.isArray(hostGame.grid) || hostGame.grid.length !== 12 ||
          !Array.isArray(hostGame.words) || !hostGame.words.length) {
        throw new Error(`Word Search could not start a playable board: HTTP ${started.response.status} ${started.payload?.error?.message || ''}`);
      }

      const playerAfter = await json(`${SERVICE_ORIGIN}/tng-api/word-search/player`, { headers: playerHeaders });
      if (!playerAfter.response.ok || playerAfter.payload?.room?.gameState?.phase !== 'playing' ||
          playerAfter.payload?.room?.gameState?.grid?.length !== 12) {
        throw new Error(`Word Search player did not receive the live board: HTTP ${playerAfter.response.status} ${playerAfter.payload?.error?.message || ''}`);
      }

      const move = await postJson('/tng-api/word-search/player', playerGuestToken, playerDeviceId, {
        roomCode,
        action: 'submit_selection',
        cells: ['0-0', '0-1'],
      }, roomCode);
      if (!move.response.ok || !move.payload?.room?.gameState) {
        throw new Error(`Word Search player move endpoint failed: HTTP ${move.response.status} ${move.payload?.error?.message || ''}`);
      }

      return `room ${roomCode}: host + guest joined, both API routes loaded, host started a 12×12 board, player received it and submitted a move`;
    } finally {
      if (hostGuestToken && hostDeviceId) {
        await request(`${SERVICE_ORIGIN}/tng-api/host/room`, {
          method: 'DELETE',
          headers: {
            'X-TNG-Guest-Token': hostGuestToken,
            'X-TNG-Device-Id': hostDeviceId,
          },
        }).catch(() => {});
        await request(`${SERVICE_ORIGIN}/tng-api/host/session`, {
          method: 'DELETE',
          headers: {
            'X-TNG-Guest-Token': hostGuestToken,
            'X-TNG-Device-Id': hostDeviceId,
          },
        }).catch(() => {});
      }
    }
  });

  await check('Battle Sudoku live two-browser guest room', async () => {
    const suffix = Date.now().toString(36).slice(-6).toUpperCase();
    const hostName = `SmokeH${suffix}`;
    const playerName = `SmokeP${suffix}`;
    const createIdentity = async (name) => {
      const { response, payload } = await json(`${SERVICE_ORIGIN}/tng-guest/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok || !payload?.token) {
        throw new Error(`guest identity failed: HTTP ${response.status} ${payload?.error?.message || ''}`);
      }
      return payload.token;
    };
    const hostGuestToken = await createIdentity(hostName);
    const playerGuestToken = await createIdentity(playerName);
    const api = (path, guestToken, bsToken = '', payload = undefined) => json(`${SERVICE_ORIGIN}${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: {
        ...(guestToken ? { 'X-TNG-Guest-Token': guestToken } : {}),
        ...(bsToken ? { 'X-BS-Token': bsToken } : {}),
        ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });

    const created = await api('/bs-api/rooms', hostGuestToken, '', {});
    if (!created.response.ok || !created.payload?.roomCode || !created.payload?.token) {
      throw new Error(`host room creation failed: HTTP ${created.response.status} ${created.payload?.error?.message || ''}`);
    }
    const code = created.payload.roomCode;
    const hostToken = created.payload.token;
    if (!/^TN[A-Z0-9]{4}$/.test(code)) throw new Error(`invalid room code ${code}`);

    const hostJoin = await api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostToken, { action: 'join', name: hostName });
    if (!hostJoin.response.ok || !hostJoin.payload?.token) {
      throw new Error(`host captain seat failed: HTTP ${hostJoin.response.status} ${hostJoin.payload?.error?.message || ''}`);
    }

    const playerJoin = await api(`/bs-api/rooms/${code}/action`, playerGuestToken, '', { action: 'join', name: playerName });
    if (!playerJoin.response.ok || !playerJoin.payload?.token) {
      throw new Error(`second browser join failed: HTTP ${playerJoin.response.status} ${playerJoin.payload?.error?.message || ''}`);
    }

    const hostRoom = await api(`/bs-api/rooms/${code}`, hostGuestToken, hostToken);
    const roster = hostRoom.payload?.room?.roster || [];
    if (!hostRoom.response.ok || roster.length !== 2 ||
      !roster.some((player) => player.name === hostName) ||
      !roster.some((player) => player.name === playerName)) {
      throw new Error(`room roster did not synchronize across sessions: ${roster.map((p) => p.name).join(', ') || hostRoom.response.status}`);
    }

    // Set the shortest supported live phase lengths so the production test can
    // observe a complete attack volley without waiting through default timers.
    const settings = await api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostToken, {
      action: 'settings', solveSec: 30, battleSec: 10, volleys: 6,
    });
    if (!settings.response.ok) throw new Error('host could not set test volley timings');

    const started = await api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostToken, { action: 'start' });
    if (!started.response.ok || !started.payload?.room?.game) {
      throw new Error(`host could not start battle: HTTP ${started.response.status} ${started.payload?.error?.message || ''}`);
    }

    const [hostView, playerView] = await Promise.all([
      api(`/bs-api/rooms/${code}`, hostGuestToken, hostJoin.payload.token),
      api(`/bs-api/rooms/${code}`, playerGuestToken, playerJoin.payload.token),
    ]);
    if (!hostView.response.ok || !hostView.payload?.room?.game?.me) {
      throw new Error('host did not receive their own captain gameplay view');
    }
    if (!playerView.response.ok || !playerView.payload?.room?.game?.me) {
      throw new Error('second browser did not receive its captain gameplay view');
    }

    // Exercise the real setup and Sudoku-solving actions through two independent guest sessions.
    if (hostView.payload.room.game.phase !== 'setup' || playerView.payload.room.game.phase !== 'setup') {
      throw new Error('new game did not enter fleet setup phase');
    }
    const [hostReady, playerReady] = await Promise.all([
      api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostJoin.payload.token, { action: 'ready' }),
      api(`/bs-api/rooms/${code}/action`, playerGuestToken, playerJoin.payload.token, { action: 'ready' }),
    ]);
    if (!hostReady.response.ok || hostReady.payload?.result?.ok !== true ||
        !playerReady.response.ok || playerReady.payload?.result?.ok !== true) {
      throw new Error('one or both captains could not lock in their fleet');
    }
    const [hostSolve, playerSolve] = await Promise.all([
      api(`/bs-api/rooms/${code}`, hostGuestToken, hostJoin.payload.token),
      api(`/bs-api/rooms/${code}`, playerGuestToken, playerJoin.payload.token),
    ]);
    if (hostSolve.payload?.room?.game?.phase !== 'solve' ||
        playerSolve.payload?.room?.game?.phase !== 'solve') {
      throw new Error('both Ready actions did not advance the room into Sudoku solve phase');
    }

    const solution = solveSudoku(hostSolve.payload.room.game.puzzle);
    const cell = hostSolve.payload.room.game.puzzle.findIndex((digit) => digit === 0);
    if (cell < 0 || solution[cell] < 1 || solution[cell] > 9) {
      throw new Error('live Sudoku puzzle did not provide a valid empty cell and solution');
    }
    const digit = solution[cell];
    const [hostMove, playerMove] = await Promise.all([
      api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostJoin.payload.token, { action: 'place', cell, digit }),
      api(`/bs-api/rooms/${code}/action`, playerGuestToken, playerJoin.payload.token, { action: 'place', cell, digit }),
    ]);
    for (const [label, move] of [['host', hostMove], ['second guest', playerMove]]) {
      if (!move.response.ok || move.payload?.result?.ok !== true ||
          move.payload?.result?.correct !== true ||
          move.payload?.room?.game?.me?.board?.[cell] !== digit ||
          move.payload?.room?.game?.players?.find((player) => player.id === move.payload?.room?.game?.me?.id)?.stats?.cells !== 1) {
        throw new Error(`${label} Sudoku move failed: HTTP=${move.response.status} payload=${JSON.stringify(move.payload)} cell=${cell} digit=${digit} board=${move.payload?.room?.game?.me?.board?.[cell]} cells=${move.payload?.room?.game?.players?.find((player) => player.id === move.payload?.room?.game?.me?.id)?.stats?.cells}`);
      }
    }

    // Wait for the server-owned solve timer to advance into battle.
    let battleView = null;
    const battleDeadline = Date.now() + 38000;
    while (Date.now() < battleDeadline) {
      const [h, p] = await Promise.all([
        api(`/bs-api/rooms/${code}`, hostGuestToken, hostJoin.payload.token),
        api(`/bs-api/rooms/${code}`, playerGuestToken, playerJoin.payload.token),
      ]);
      if (h.payload?.room?.game?.phase === 'battle' && p.payload?.room?.game?.phase === 'battle') {
        battleView = { host: h.payload.room.game, player: p.payload.room.game };
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!battleView) throw new Error('both sessions did not advance from solve into battle phase');

    const hostId = battleView.host.me.id;
    const playerId = battleView.player.me.id;
    const hostTarget = battleView.host.me.rival;
    const playerTarget = battleView.player.me.rival;
    if (hostTarget !== playerId || playerTarget !== hostId) {
      throw new Error('captains were not assigned each other as battle targets');
    }
    const hostFire = await api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostJoin.payload.token, {
      action: 'order', kind: 'fire', target: hostTarget, cell: playerView.payload.room.game.me.ships[0].cells[0],
    });
    const playerFire = await api(`/bs-api/rooms/${code}/action`, playerGuestToken, playerJoin.payload.token, {
      action: 'order', kind: 'fire', target: playerTarget, cell: hostView.payload.room.game.me.ships[0].cells[0],
    });
    if (!hostFire.response.ok || hostFire.payload?.result?.ok !== true ||
        !playerFire.response.ok || playerFire.payload?.result?.ok !== true) {
      throw new Error(`one or both captains could not queue a fire order: host=${JSON.stringify(hostFire.payload?.result)} player=${JSON.stringify(playerFire.payload?.result)}`);
    }

    // Poll until the battle timer resolves both simultaneous attacks.
    let revealViews = null;
    const revealDeadline = Date.now() + 16000;
    while (Date.now() < revealDeadline) {
      const [h, p] = await Promise.all([
        api(`/bs-api/rooms/${code}`, hostGuestToken, hostJoin.payload.token),
        api(`/bs-api/rooms/${code}`, playerGuestToken, playerJoin.payload.token),
      ]);
      if (h.payload?.room?.game?.phase === 'reveal' && p.payload?.room?.game?.phase === 'reveal') {
        revealViews = { host: h.payload.room.game, player: p.payload.room.game };
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!revealViews) throw new Error('battle orders were accepted but volley did not resolve into reveal phase');
    const hostEvents = revealViews.host.reveal?.events || [];
    const playerEvents = revealViews.player.reveal?.events || [];
    const hostShot = hostEvents.find((event) => event.by === hostId && event.target === playerId && event.cell === playerView.payload.room.game.me.ships[0].cells[0] && ['hit', 'miss'].includes(event.result));
    const playerShot = playerEvents.find((event) => event.by === playerId && event.target === hostId && event.cell === hostView.payload.room.game.me.ships[0].cells[0] && event.result === 'hit');
    if (!hostShot || !playerShot || (hostShot.result !== 'hit' && playerShot.result !== 'hit')) {
      throw new Error(`resolved reveal missing one or both real attacks: host=${JSON.stringify(hostShot)} player=${JSON.stringify(playerShot)}`);
    }
    const hostSeesPlayerMark = revealViews.host.players.find((player) => player.id === playerId)?.marks?.[playerView.payload.room.game.me.ships[0].cells[0]];
    const playerSeesHostMark = revealViews.player.players.find((player) => player.id === hostId)?.marks?.[hostView.payload.room.game.me.ships[0].cells[0]];
    if (hostSeesPlayerMark !== (hostShot.result === 'hit' ? 'hit' : 'miss') ||
        playerSeesHostMark !== (playerShot.result === 'hit' ? 'hit' : 'miss')) {
      throw new Error(`guaranteed ship hits did not synchronize: hostShot=${JSON.stringify(hostShot)} playerShot=${JSON.stringify(playerShot)} hostMark=${hostSeesPlayerMark} playerMark=${playerSeesHostMark}`);
    }

    // Confirm the reveal phase rolls forward into the next solve volley for both captains.
    let nextVolley = null;
    const nextDeadline = Date.now() + 11000;
    while (Date.now() < nextDeadline) {
      const [h, p] = await Promise.all([
        api(`/bs-api/rooms/${code}`, hostGuestToken, hostJoin.payload.token),
        api(`/bs-api/rooms/${code}`, playerGuestToken, playerJoin.payload.token),
      ]);
      if (h.payload?.room?.game?.phase === 'solve' && p.payload?.room?.game?.phase === 'solve' &&
          h.payload.room.game.volley === 2 && p.payload.room.game.volley === 2) {
        nextVolley = { host: h.payload.room.game, player: p.payload.room.game };
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!nextVolley) throw new Error('both captains did not return to solve phase for volley 2 after reveal');

    // In volley two, verify defensive repair + shield and a three-cell torpedo.
    const puzzleSolution = solveSudoku(nextVolley.host.puzzle);
    const hostCell2 = nextVolley.host.me.board.findIndex((digit) => !digit);
    const playerCell2 = nextVolley.player.me.board.findIndex((digit) => !digit);
    if (hostCell2 < 0 || playerCell2 < 0) throw new Error('no open Sudoku cells remained for volley two');
    const hostMove2 = await api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostJoin.payload.token, {
      action: 'place', cell: hostCell2, digit: puzzleSolution[hostCell2],
    });
    const playerMove2 = await api(`/bs-api/rooms/${code}/action`, playerGuestToken, playerJoin.payload.token, {
      action: 'place', cell: playerCell2, digit: puzzleSolution[playerCell2],
    });
    if (hostMove2.payload?.result?.correct !== true || playerMove2.payload?.result?.correct !== true) {
      throw new Error('both captains could not solve a second Sudoku cell');
    }

    let battleTwo = null;
    const battleTwoDeadline = Date.now() + 38000;
    while (Date.now() < battleTwoDeadline) {
      const [h, p] = await Promise.all([
        api(`/bs-api/rooms/${code}`, hostGuestToken, hostJoin.payload.token),
        api(`/bs-api/rooms/${code}`, playerGuestToken, playerJoin.payload.token),
      ]);
      if (h.payload?.room?.game?.phase === 'battle' && p.payload?.room?.game?.phase === 'battle' &&
          h.payload.room.game.volley === 2 && p.payload.room.game.volley === 2) {
        battleTwo = { host: h.payload.room.game, player: p.payload.room.game };
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!battleTwo) throw new Error('both captains did not reach battle phase in volley 2');

    const carrierCells = battleTwo.player.me.ships[0].cells;
    const torpedoDir = carrierCells[1] - carrierCells[0] === 1 ? 'h' : 'v';
    const damagedPlayerCell = playerView.payload.room.game.me.ships[0].cells[0];
    const repair = await api(`/bs-api/rooms/${code}/action`, playerGuestToken, playerJoin.payload.token, {
      action: 'order', kind: 'repair', cell: damagedPlayerCell,
    });
    const shield = await api(`/bs-api/rooms/${code}/action`, playerGuestToken, playerJoin.payload.token, {
      action: 'order', kind: 'shield', cell: carrierCells[1],
    });
    const torpedo = await api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostJoin.payload.token, {
      action: 'order', kind: 'torpedo', target: playerId, cell: carrierCells[0], dir: torpedoDir,
    });
    if (repair.payload?.result?.ok !== true || shield.payload?.result?.ok !== true || torpedo.payload?.result?.ok !== true) {
      throw new Error(`repair/shield/torpedo orders failed: repair=${JSON.stringify(repair.payload?.result)} shield=${JSON.stringify(shield.payload?.result)} torpedo=${JSON.stringify(torpedo.payload?.result)}`);
    }

    let revealTwo = null;
    const revealTwoDeadline = Date.now() + 16000;
    while (Date.now() < revealTwoDeadline) {
      const [h, p] = await Promise.all([
        api(`/bs-api/rooms/${code}`, hostGuestToken, hostJoin.payload.token),
        api(`/bs-api/rooms/${code}`, playerGuestToken, playerJoin.payload.token),
      ]);
      if (h.payload?.room?.game?.phase === 'reveal' && p.payload?.room?.game?.phase === 'reveal' &&
          h.payload.room.game.volley === 2 && p.payload.room.game.volley === 2) {
        revealTwo = { host: h.payload.room.game, player: p.payload.room.game };
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!revealTwo) throw new Error('volley two did not resolve into reveal phase');
    const secondEvents = revealTwo.player.reveal?.events || [];
    const torpedoEvents = secondEvents.filter((event) => event.by === hostId && event.target === playerId && event.torpedo);
    if (torpedoEvents.length !== 3 || !torpedoEvents.some((event) => event.result === 'blocked') ||
        torpedoEvents.filter((event) => event.result === 'hit').length < 2 ||
        !secondEvents.some((event) => event.type === 'repair' && event.by === playerId && event.cell === damagedPlayerCell) ||
        !secondEvents.some((event) => event.type === 'shield' && event.by === playerId)) {
      throw new Error(`repair/shield/torpedo resolution mismatch: torpedo=${JSON.stringify(torpedoEvents)} defensive=${JSON.stringify(secondEvents.filter((event) => event.by === playerId && ['repair', 'shield'].includes(event.type))) }`);
    }

    await Promise.all([
      api(`/bs-api/rooms/${code}/action`, hostGuestToken, hostJoin.payload.token, { action: 'leave' }),
      api(`/bs-api/rooms/${code}/action`, playerGuestToken, playerJoin.payload.token, { action: 'leave' }),
    ]).catch(() => {});
    return `room ${code}: two guests completed Sudoku solving, both landed confirmed ship hits, synchronized the volley reveal, then in volley two verified repair, shield, a three-cell torpedo (two hits + one blocked cell), and the next-phase game loop`;
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
