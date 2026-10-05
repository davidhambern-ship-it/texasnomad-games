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
