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
  outGame,
  hostPanel,
  wordWrangler,
  battleSudoku,
  rodeoRumble,
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
  login,
  register,
  guestIdentity,
  joinRoom,
  rodeoClient,
  viralLiveModule,
  rodeoLiveModule,
  pagesProxy,
  welcome,
  seeThatClient,
  wordWranglerClient,
  battleSudokuClient,
  seeThatServer,
  wordWranglerServer,
  battleSudokuServer,
  tngDispatcher,
  guestAuth,
  guestAccount,
  dbSchema,
  pairing,
  dbClient,
] = await Promise.all([
  text('src/App.jsx'),
  text('src/pages/Games.jsx'),
  text('src/pages/OutGame.jsx'),
  text('src/pages/PreviewHostPanel.jsx'),
  text('src/pages/WordWranglerGame.jsx'),
  text('src/pages/SudokuGame.jsx'),
  text('src/pages/RodeoRumbleGame.jsx'),
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
  text('src/pages/Login.jsx'),
  text('src/pages/Register.jsx'),
  text('src/lib/guestIdentity.js'),
  text('src/pages/JoinRoom.jsx'),
  text('src/api/rodeoRumbleLive.js'),
  text('server/viralLive.mjs'),
  text('server/rodeoRumbleLive.mjs'),
  text('functions/[[path]].js'),
  text('src/pages/Welcome.jsx'),
  text('src/api/seeThatApi.js'),
  text('src/api/wordWranglerApi.js'),
  text('src/api/battleSudokuApi.js'),
  text('server/seeThatApi.mjs'),
  text('server/wordWranglerApi.mjs'),
  text('server/battleSudokuApi.mjs'),
  text('server/tngApi.mjs'),
  text('server/auth/require-user.js'),
  text('server/auth/require-account.js'),
  text('server/db/schema.js'),
  text('server/pairing.js'),
  text('server/db/client.js'),
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
  '/games/rodeo-rumble',
  '/games/see-that',
  '/games/word-wrangler',
  '/games/dominoes',
  '/games/out',
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
  'rodeo-rumble',
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
  games.includes("const IN_CONSTRUCTION_IDS = ['poker', 'bowling', 'snake', 'phase-10'];"),
  'Poker, Bowling, Snake and Phase 10 must remain the construction lineup',
);

ok(
  'OUT! is the 12th playable game',
  games.includes("id: 'out'") &&
    games.includes("title: 'OUT!'") &&
    games.includes("path: '/games/out'") &&
    app.includes('path="/games/out"') &&
    outGame.includes('export default function NomadCardsGame') &&
    outGame.includes('NCSolo') &&
    outGame.includes('NCHost') &&
    outGame.includes('NCPlayer') &&
    server.includes('createNomadCardsApi') &&
    server.includes("startsWith('/nc-api')"),
  'OUT! must be listed as available, routed, and implemented',
);

ok(
  'live TNG lineup stays multiplayer-only',
  !wordWrangler.includes('Solo Rush') &&
    !wordWrangler.includes('Vs CPU') &&
    !battleSudoku.includes('Solo vs CPU') &&
    !battleSudoku.includes('CPU skill') &&
    !rodeoRumble.includes('Practice') &&
    !rodeoRumble.includes('CPU Fill') &&
    !dominoHost.includes('chooseAIMove') &&
    !dominoHost.includes('addAI(') &&
    !dominoHost.includes('CPU fills empty seats') &&
    games.includes("tags: ['2–8 Players', 'Word Game', 'Online Race']") &&
    games.includes("tags: ['2–8 Players', 'Puzzle', 'Party Battle']") &&
    games.includes("tags: ['2–8 Players', 'Fighting', 'Party']") &&
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
  'BERNAverse integration removed',
  !server.toLowerCase().includes('bernaverse') &&
    !tngApi.toLowerCase().includes('bernaverse') &&
    !login.toLowerCase().includes('bernaverse') &&
    !register.toLowerCase().includes('bernaverse'),
  'TNG server or authentication pages still depend on BERNAverse',
);

ok(
  'guest identity entry and token transport',
  guestIdentity.includes('tng_guest_token') &&
    joinRoom.includes('createGuestIdentity') &&
    tngApi.includes("X-TNG-Guest-Token") &&
    viralBridge.includes("tng_guest_token") &&
    rodeoClient.includes('getStoredGuestIdentity'),
  'Guest names/tokens are not connected across room entry and standalone games',
);

ok(
  'guest player cannot claim host privileges',
  server.includes('async function verifyViralHostAuthorization') &&
    server.includes('if (!resolved.ok) return null;') &&
    viralLiveModule.includes('if (!accountId || roomOwnedByAnotherAccount)') &&
    rodeoLiveModule.includes('if (!hostIdentity?.accountId && !hostIdentity?.guestId)') &&
    rodeoLiveModule.includes('savedRoom.hostGuestId'),
  'A guest player identity can reach a host authorization path',
);

ok(
  'public guest onboarding',
  welcome.includes('createGuestIdentity(guestName)') &&
    app.includes("'/welcome'") &&
    app.includes("location.pathname === '/games'") && app.includes("location.pathname.startsWith('/games/')") && app.includes('hasGuestIdentity'),
  'Guests must be able to create a temporary identity before opening game pages',
);

ok(
  'guest tokens reach See That, Word Wrangler, and Battle Sudoku',
  seeThatClient.includes("headers['X-TNG-Guest-Token']") &&
    wordWranglerClient.includes("headers['X-TNG-Guest-Token']") &&
    battleSudokuClient.includes("headers['X-TNG-Guest-Token']") &&
    seeThatServer.includes('hostGuestId') &&
    seeThatServer.includes('identity.guestId') &&
    wordWranglerServer.includes('identity.guestId') &&
    battleSudokuServer.includes('hostGuestId') &&
    battleSudokuServer.includes('identity.guestId'),
  'Standalone guest identities are not accepted consistently by all room APIs',
);

ok(
  'guest-hosted Dominoes',
  dominoStore.includes("headers['X-TNG-Guest-Token']") &&
    server.includes('const guest = await resolveStandaloneGameIdentity(req)') &&
    server.includes('guestId: verifiedHost.guestId || null') &&
    games.includes("dominoes: '/games/dominoes/host'"),
  'Dominoes guest host identity is not wired end to end',
);

ok(
  'Base44 lockfile absent',
  !lockRaw.includes('"@base44/sdk"') && !lockRaw.includes('"@base44/vite-plugin"'),
  'Base44 packages remain in package-lock.json',
);

ok(
  'retired template dependencies removed',
  !pkg.dependencies?.['react-quill'] &&
    !pkg.dependencies?.moment &&
    !pkg.dependencies?.lodash &&
    !pkg.dependencies?.['tailwindcss-animate'] &&
    Boolean(pkg.devDependencies?.['tailwindcss-animate']),
  'Unused editor/date/direct-lodash dependencies or runtime Tailwind tooling were reintroduced',
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
  dbClient.includes("url.searchParams.set('sslmode', 'verify-full')") &&
    dbClient.includes('connectionString: normalizePgConnectionString(process.env.DATABASE_URL)'),
  'Postgres connection string is not explicitly pinned to verify-full SSL',
);


ok(
  'app recovery boundary enabled',
  main.includes('<AppErrorBoundary>') && main.includes("AppErrorBoundary from '@/components/AppErrorBoundary.jsx'"),
  'React app is not wrapped in the recovery boundary',
);

ok(
  'first-party service origin',
  serviceOrigin.includes("http://localhost:3000") && !serviceOrigin.includes('auth.texasnomadgames.com'),
  'local development must target the local API server, never the retired auth subdomain',
);

ok(
  'Neon and Railway runtime dependencies removed',
  !server.includes('TNG_API_ORIGIN') &&
    !server.includes('.neon.tech') &&
    !server.includes('neon_auth.') &&
    !server.includes('NEON_AUTH_ORIGIN') &&
    !serviceOrigin.includes('auth.texasnomadgames.com'),
  'Runtime code still calls Neon or the retired auth service',
);

ok(
  'guest-only core TNG API is routed through the Supabase Edge gateway',
  tngDispatcher.includes("['/word-search/host', wordSearchHost]") &&
    tngDispatcher.includes("['/word-search/player', wordSearchPlayer]") &&
    pagesProxy.includes('EDGE_API') &&
    pagesProxy.includes('tng-api') &&
    pagesProxy.includes('tng-guest') &&
    guestAuth.includes('verifyGuestIdentity') &&
    guestAuth.includes('public.tng_guest_sessions') &&
    guestAccount.includes("provider !== 'guest'") &&
    guestAccount.includes('guest_'),
  'Core game routes must use the Cloudflare Pages proxy and verified guest identity',
);

ok(
  'guest session persistence and API signing',
  server.includes('insert into public.tng_guest_sessions') &&
    server.includes('token_hash') &&
    pairing.includes('process.env.TNG_GUEST_TOKEN_SECRET'),
  'Guest tokens are not persisted or room pairing lacks a guest-safe signing secret',
);

ok(
  'Neon Auth schema removed',
  !dbSchema.includes('neon_auth') &&
    !dbSchema.includes('neonAuthSchema'),
  'Database schema still defines Neon Auth tables',
);

ok(
  'Cloudflare Pages single API proxy',
  await exists('functions/[[path]].js') &&
    pagesProxy.includes('path === "/tng-api"') &&
    pagesProxy.includes('path.startsWith("/tng-api/")') &&
    pagesProxy.includes('path.startsWith("/tng-rooms/")') &&
    pagesProxy.includes('path.startsWith("/tng-guest/")'),
  'Cloudflare Pages must proxy guest, room-registry, and game API requests to the TNG Edge gateway',
);

ok(
  'Cloudflare Pages request-body forwarding',
  pagesProxy.includes('await request.arrayBuffer()') &&
    pagesProxy.includes('new Request(upstreamUrl') &&
    pagesProxy.includes('redirect: "manual"'),
  'The Pages proxy must preserve request bodies and avoid unsafe upstream redirects',
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
  'https://tng-live-production.up.railway.app',
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
  'Vercel-compatible Host Live REST polling',
  tngApi.includes("return request('/api/host/room-state'") &&
    tngApi.includes("spades: '/api/spades/host'") &&
    tngApi.includes("hangman: '/api/hangman/host'") &&
    !tngApi.includes('new WebSocket('),
  'Host state still depends on persistent WebSocket upgrades unsupported by Vercel Functions',
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
    server.includes('VERCEL_GIT_COMMIT_SHA') && !server.toLowerCase().includes('railway'),
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
  viralHtml.includes('location.host') && !viralHtml.includes('wss://auth.texasnomadgames.com'),
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
