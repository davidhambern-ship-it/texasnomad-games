import { readFile, access } from 'node:fs/promises';

const failures = [];
const checks = [];

function ok(name, condition, detail = '') {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) failures.push(detail ? `${name}: ${detail}` : name);
}

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function exists(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

const [
  app,
  games,
  hostPanel,
  wordWrangler,
  battleSudoku,
  dominoHost,
  dominoGame,
  dominoStore,
  tngProfile,
  tngApi,
  main,
  display,
  serviceOrigin,
  server,
  pkgRaw,
  lockRaw,
  viralBridge,
  viralHtml,
] = await Promise.all([
  text('src/App.jsx'),
  text('src/pages/Games.jsx'),
  text('src/pages/PreviewHostPanel.jsx'),
  text('src/pages/WordWranglerGame.jsx'),
  text('src/pages/SudokuGame.jsx'),
  text('src/pages/DominoHost.jsx'),
  text('src/pages/DominoGame.jsx'),
  text('src/api/dominoStore.js'),
  text('src/lib/tngProfile.js'),
  text('src/api/tngApi.js'),
  text('src/main.jsx'),
  text('src/pages/GameDisplay.jsx'),
  text('src/lib/tngServiceOrigin.js'),
  text('server.mjs'),
  text('package.json'),
  text('package-lock.json'),
  text('public/viral/tng-bridge.js'),
  text('public/viral/index.html'),
]);

const pkg = JSON.parse(pkgRaw);

const liveRoutes = [
  '/games/bff',
  '/games/square-biz',
  '/games/hangman',
  '/games/spades',
  '/games/word-search',
  '/games/viral',
  '/games/sudoku',
  '/games/see-that',
  '/games/word-wrangler',
  '/games/dominoes',
];

for (const route of liveRoutes) {
  ok(`route ${route}`, app.includes(`path="${route}"`), 'missing from src/App.jsx');
}

const liveGameIds = [
  'bff',
  'square-biz',
  'hangman',
  'spades',
  'word-search',
  'viral',
  'sudoku',
  'see-that',
  'word-wrangler',
  'dominoes',
];

for (const gameId of liveGameIds) {
  ok(
    `host launch ${gameId}`,
    games.includes(`'${gameId}'`),
    'missing from live Host launch configuration',
  );
}

ok(
  'construction lineup',
  games.includes("const IN_CONSTRUCTION_IDS = ['uno', 'poker', 'bowling', 'snake', 'phase-10'];"),
  'UNO, Poker, Bowling, Snake and Phase 10 must remain the construction lineup',
);

ok(
  'live TNG lineup stays multiplayer-only',
  !wordWrangler.includes('Solo Rush') &&
    !wordWrangler.includes('Vs CPU') &&
    !battleSudoku.includes('Solo vs CPU') &&
    !battleSudoku.includes('CPU skill') &&
    !dominoHost.includes('chooseAIMove') &&
    !dominoHost.includes('addAI(') &&
    !dominoHost.includes('CPU fills empty seats') &&
    games.includes("tags: ['2–8 Players', 'Word Game', 'Online Race']") &&
    games.includes("tags: ['2–8 Players', 'Puzzle', 'Party Battle']") &&
    games.includes("tags: ['4 Players', '2v2 Partners', 'Human Players']"),
  'A live TNG game reintroduced public solo/CPU play or stale CPU arcade copy',
);

ok(
  'Base44 SDK absent',
  !Object.keys(pkg.dependencies || {}).some((name) => name.startsWith('@base44/')) &&
    !Object.keys(pkg.devDependencies || {}).some((name) => name.startsWith('@base44/')),
  'Base44 packages were reintroduced',
);

ok(
  'Base44 lockfile absent',
  !lockRaw.includes('"@base44/sdk"') && !lockRaw.includes('"@base44/vite-plugin"'),
  'Base44 packages remain in package-lock.json',
);

ok(
  'dead Base44 room hook removed',
  !(await exists('src/hooks/useGameRoom.js')),
  'src/hooks/useGameRoom.js should stay retired',
);

ok(
  'legacy Base44 preview/profile layer removed',
  !(await exists('src/lib/previewTngProfile.js')) &&
    !app.includes('isBase44Preview') &&
    !app.includes('previewTngProfile') &&
    tngProfile.includes('getTngProfile') &&
    tngProfile.includes('createTngProfile'),
  'Legacy Base44 preview profile code was reintroduced',
);

ok(
  'Dominoes uses first-party store naming',
  !dominoHost.includes('base44') &&
    !dominoGame.includes('base44') &&
    !dominoStore.includes('Base44'),
  'Dominoes still carries Base44 compatibility naming',
);

ok(
  'legacy Base44 preview origins removed',
  !server.includes('app.base44.com') &&
    !server.includes('.base44.app'),
  'Server still allows legacy Base44 preview origins',
);

ok(
  'Postgres SSL behavior pinned securely',
  server.includes("url.searchParams.set('sslmode', 'verify-full')") &&
    server.includes('normalizePgConnectionString(process.env.DATABASE_URL)'),
  'Postgres connection string is not explicitly pinned to verify-full SSL',
);

ok(
  'browser compatibility data refreshed',
  lockRaw.includes('"node_modules/caniuse-lite"') &&
    lockRaw.includes('"version": "1.0.30001814"'),
  'caniuse-lite browser compatibility data is stale',
);

ok(
  'app recovery boundary enabled',
  main.includes('<AppErrorBoundary>') && main.includes("AppErrorBoundary from '@/components/AppErrorBoundary.jsx'"),
  'React app is not wrapped in the recovery boundary',
);

ok(
  'first-party service origin',
  serviceOrigin.includes("https://auth.texasnomadgames.com"),
  'browser service origin is not the first-party auth.texasnomadgames.com host',
);

const browserFiles = [
  ['src/api/tngApi.js', tngApi],
  ['src/lib/tngServiceOrigin.js', serviceOrigin],
  ['public/viral/tng-bridge.js', viralBridge],
  ['public/viral/index.html', viralHtml],
];

const forbiddenBrowserOrigins = [
  'https://tng-live-production.up.railway.app',
  'wss://tng-live-production.up.railway.app',
  'https://br-spring-moon-avh3z3j8-tngapi.compute.c-11.us-east-1.aws.neon.tech',
];

for (const [path, body] of browserFiles) {
  for (const origin of forbiddenBrowserOrigins) {
    ok(
      `${path} avoids legacy origin`,
      !body.includes(origin),
      `contains ${origin}`,
    );
  }
}

ok(
  'Host Live reconnect backoff',
  tngApi.includes('scheduleHostLiveReconnect') &&
    tngApi.includes('reconnectAttempts') &&
    tngApi.includes('Math.min(10_000'),
  'Host Live reconnect recovery is missing',
);

ok(
  'safe transient API retry',
  tngApi.includes('TRANSIENT_HTTP_STATUSES') &&
    tngApi.includes("const allowRetry = method === 'GET' || method === 'HEAD'"),
  'safe GET/HEAD transient retry guard is missing',
);

ok(
  'Display single-flight polling',
  display.includes('let inFlight = false;') &&
    display.includes("setStatus('reconnecting')"),
  'Display/Spectator recovery polling is missing',
);

ok(
  'Host-only mode separated from legacy test state',
  hostPanel.includes('function readHostDisplayMode()') &&
    hostPanel.includes("localStorage.removeItem('tng_player_test_mode')") &&
    !hostPanel.includes('resumeTestRoom') &&
    !hostPanel.includes('playerTestMode'),
  'Host-only production mode is still coupled to the legacy player-test flag',
);

ok(
  'Safari fullscreen fallback',
  display.includes('webkitRequestFullscreen') &&
    display.includes('webkitExitFullscreen') &&
    display.includes('webkitfullscreenchange'),
  'Safari fullscreen fallbacks are missing',
);

ok(
  'server health endpoint',
  server.includes("=== '/healthz'") &&
    server.includes("database = 'degraded'") &&
    server.includes('RAILWAY_GIT_COMMIT_SHA'),
  '/healthz production health reporting is missing',
);

ok(
  'stale-room maintenance',
  server.includes('ROOM_MAINTENANCE_INTERVAL_MS') &&
    server.includes('runRoomMaintenance'),
  'periodic stale-room cleanup is missing',
);

ok(
  'VIRAL first-party websocket relay',
  viralHtml.includes("wss://auth.texasnomadgames.com"),
  'VIRAL deployed HTML does not point at the first-party websocket relay',
);

ok(
  'VIRAL bridge injected',
  viralHtml.includes('/viral/tng-bridge.js'),
  'VIRAL bridge script is not present',
);

console.log('\nTNG Release Audit');
console.log('=================');
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.name}${check.passed || !check.detail ? '' : ` — ${check.detail}`}`);
}

if (failures.length) {
  console.error(`\nRelease audit failed with ${failures.length} issue(s).\n`);
  process.exit(1);
}

console.log(`\nRelease audit passed: ${checks.length} checks.\n`);
