// ─────────────────────────────────────────────────────────────────────────────
// BattleSudoku — the game rules (shared by the server and the browser's solo mode)
//
// Everyone solves the SAME Sudoku and hides a fleet of 5 ships on their own 9×9
// grid. The game runs in volleys:
//   SOLVE  (~40s)  correct numbers earn shells; finishing a row/column/box pings
//                  sonar on your rival ("2 ship pieces in row E")
//   BATTLE (~15s)  boards lock; spend shells: fire, torpedo (3 in a line),
//                  repair a damaged piece, or shield a cell. Unspent shells bank.
//   REVEAL (~6s)   every order lands at once — splashes, hits, sinks.
// A hit on a cell you'd already solved blows your number out. Sinking a ship
// freezes its owner for 5s and steals shells. A sunk fleet becomes a Ghost
// (keeps solving and firing, can't be targeted). Win by finishing the Sudoku
// (Admiral's Victory), being the Last Fleet Floating, or points after the last volley.
// The solution never leaves this module's owner (the server), only views do.
//
// FLEET VS FLEET (settings.mode = 'teams'): captains split into Red and Blue
// fleets. You can only fire on the other fleet; teammates see each other's aim,
// share sonar, and can repair/shield each other's ships. A fleet wins when the
// other fleet is fully sunk, when one of its captains finishes the Sudoku, or on
// combined points after the final volley.
// ─────────────────────────────────────────────────────────────────────────────
import { makePuzzle, rng, LINES, ROW, COL } from './sudoku.js';

export const SHIPS = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];
export const DEFAULTS = { mode: 'ffa', difficulty: 'normal', setupSec: 20, solveSec: 40, battleSec: 15, revealSec: 7, volleys: 8 };
export const MAX_SHELLS = 8;
export const START_SHELLS = 2;
export const COST = { fire: 1, torpedo: 3, repair: 1, shield: 1 };
export const SINK_FREEZE_MS = 5000;
export const MISTAKE_LOCK_MS = 1500;
export const POINTS = { cell: 10, hit: 30, sink: 100, finish: 500, survive: 200 };
export const TEAMS = [{ id: 0, name: 'Red Fleet', color: '#ff5f6d' }, { id: 1, name: 'Blue Fleet', color: '#3ec5ff' }];
export const cellName = (c) => `${'ABCDEFGHI'[ROW(c)]}${COL(c) + 1}`;
export const lineName = (t, i) => (t === 'row' ? `row ${'ABCDEFGHI'[i]}` : t === 'col' ? `column ${i + 1}` : `box ${i + 1}`);

export function randomFleet(R = Math.random) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const used = new Set(); const ships = [];
    let ok = true;
    for (const s of SHIPS) {
      let placed = false;
      for (let t = 0; t < 100 && !placed; t++) {
        const h = R() < 0.5;
        const r = Math.floor(R() * (h ? 9 : 10 - s.size)), c = Math.floor(R() * (h ? 10 - s.size : 9));
        const cells = Array.from({ length: s.size }, (_, k) => (h ? r * 9 + c + k : (r + k) * 9 + c));
        if (cells.some(x => used.has(x))) continue;
        cells.forEach(x => used.add(x)); ships.push({ ...s, cells, hits: [] }); placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
  throw new Error('fleet');
}

const newPlayer = (p, puzzle, teams) => ({
  id: p.id, name: p.name, color: p.color || '#ffc85c', cpu: p.cpu || 0, team: teams ? (Number(p.team) === 1 ? 1 : 0) : null,
  board: puzzle.slice(), scorched: [], mistakes: 0, streak: 0, shells: START_SHELLS,
  ships: randomFleet(), shields: [], frozenUntil: 0, lockUntil: 0, freezeNext: false, ghost: false, ready: !!p.cpu,
  orders: [], intel: [], linesDone: [], score: 0, bounty: 0, nextCpuAt: 0, cpuOrdered: false,
  stats: { cells: 0, shots: 0, hits: 0, sinks: 0 },
});

export function createGame({ seed = Date.now(), settings = {}, players = [], now = Date.now() } = {}) {
  const S = { ...DEFAULTS, ...settings };
  const { puzzle, solution } = makePuzzle(`${seed}`, S.difficulty);
  const g = {
    v: 1, seed: `${seed}`, settings: S, puzzle, solution, phase: 'setup', phaseEndsAt: now + S.setupSec * 1000,
    volley: 0, players: {}, order: [], marks: {}, rivals: {}, leader: null, feed: [], reveal: null, winner: null, winReason: null, nextOrderId: 1,
  };
  for (const p of players) addPlayer(g, p);
  return g;
}
// in Fleet vs Fleet every captain wears a shade of their fleet's colour
const TEAM_SHADES = [['#ff5f6d', '#ff9a5c', '#ff4fa3', '#ffb3a1'], ['#3ec5ff', '#6c8cff', '#3ef0d0', '#a8dcff']];
export function addPlayer(g, p) {
  if (g.players[p.id]) return g.players[p.id];
  if (isTeams(g)) {
    const t = Number(p.team) === 1 ? 1 : 0;
    const k = g.order.filter(id => g.players[id].team === t).length;
    p = { ...p, color: TEAM_SHADES[t][k % 4] };
  }
  g.players[p.id] = newPlayer(p, g.puzzle, isTeams(g)); g.order.push(p.id); g.marks[p.id] = {};
  return g.players[p.id];
}

const living = (g) => g.order.filter(id => !g.players[id].ghost);
export const isTeams = (g) => g.settings.mode === 'teams';
const sameTeam = (g, a, b) => isTeams(g) && g.players[a] && g.players[b] && g.players[a].team === g.players[b].team;
const enemiesOf = (g, id) => living(g).filter(x => x !== id && !sameTeam(g, x, id));
const teammatesOf = (g, id) => (isTeams(g) ? g.order.filter(x => x !== id && sameTeam(g, x, id)) : []);
const isBounty = (g, id) => (g.bounties || []).includes(id);
function teamTotals(g) {
  return TEAMS.map(t => {
    const ids = g.order.filter(id => g.players[id].team === t.id);
    return { ...t, score: ids.reduce((n, id) => n + g.players[id].score, 0),
      shipsLeft: ids.reduce((n, id) => n + g.players[id].ships.filter(s => s.hits.length < s.size).length, 0),
      captains: ids.length, alive: ids.filter(id => !g.players[id].ghost).length };
  });
}
const solvedCount = (g, P) => P.board.reduce((n, v, i) => n + (v && !g.puzzle[i] ? 1 : 0), 0);
const toFill = (g) => g.puzzle.filter(v => !v).length;
function feed(g, now, text, kind = 'info', extra = {}) { g.feed.push({ t: now, kind, text, ...extra }); if (g.feed.length > 40) g.feed.splice(0, g.feed.length - 40); }

function assignRivals(g) {
  const live = living(g); g.rivals = {};
  if (isTeams(g)) {
    // each captain's sonar locks onto one enemy captain, rotating every volley
    for (const id of g.order) {
      const foes = enemiesOf(g, id); if (!foes.length) continue;
      const mates = g.order.filter(x => g.players[x].team === g.players[id].team);
      g.rivals[id] = foes[(mates.indexOf(id) + g.volley) % foes.length];
    }
    return;
  }
  if (live.length < 2) return;
  const off = 1 + ((g.volley - 1) % (live.length - 1));
  live.forEach((id, i) => { g.rivals[id] = live[(i + off) % live.length]; });
  for (const id of g.order) if (g.players[id].ghost) g.rivals[id] = live[Math.floor(Math.random() * live.length)];
}

function startSolve(g, now) {
  g.volley++; g.phase = 'solve'; g.phaseEndsAt = now + g.settings.solveSec * 1000; g.reveal = null;
  assignRivals(g);
  for (const id of g.order) {
    const P = g.players[id];
    if (P.freezeNext) { P.frozenUntil = now + SINK_FREEZE_MS; P.freezeNext = false; }
    P.nextCpuAt = now + cpuDelay(P.cpu) * (0.5 + Math.random());
  }
  feed(g, now, `Volley ${g.volley} — solve!`, 'phase');
}
function startBattle(g, now) {
  g.phase = 'battle'; g.phaseEndsAt = now + g.settings.battleSec * 1000;
  // bounty: whoever has solved the most cells (no ties) glows — hits on them pay double
  const live = living(g).map(id => [id, solvedCount(g, g.players[id])]).sort((a, b) => b[1] - a[1]);
  g.leader = live.length > 1 && live[0][1] > live[1][1] ? live[0][0] : null;
  if (isTeams(g)) {
    // one bounty per fleet: its top solver
    g.leader = null; g.bounties = [];
    for (const t of TEAMS) {
      const tl = live.filter(([id]) => g.players[id].team === t.id);
      if (tl.length && tl[0][1] > 0 && (tl.length === 1 || tl[0][1] > tl[1][1])) g.bounties.push(tl[0][0]);
    }
  } else g.bounties = g.leader ? [g.leader] : [];
  for (const id of g.order) { const P = g.players[id]; P.orders = []; P.cpuOrdered = false; P.nextCpuAt = now + 1500 + Math.random() * 4000; }
  feed(g, now, g.bounties.length ? `Battle stations! Bounty on ${g.bounties.map(id => g.players[id].name).join(' & ')}` : 'Battle stations!', 'phase');
}

export function finish(g, now, winner, reason) {
  if (g.phase === 'final') return;
  for (const id of living(g)) g.players[id].score += POINTS.survive;
  if (isTeams(g)) {
    let team = winner && g.players[winner] ? g.players[winner].team : null;
    if (reason === 'fleet' && winner == null) team = null;
    if (team == null) {
      const T = teamTotals(g);
      const alive = T.filter(t => t.alive > 0);
      if (reason === 'fleet' && alive.length === 1) team = alive[0].id;
      else { T.sort((a, b) => b.score - a.score || b.shipsLeft - a.shipsLeft); team = T[0].id; reason = reason === 'fleet' ? 'points' : (reason || 'points'); }
    }
    // the winning fleet's top scorer is its MVP
    const mvp = g.order.filter(id => g.players[id].team === team).sort((a, b) => g.players[b].score - g.players[a].score)[0] || null;
    g.winner = winner && g.players[winner]?.team === team ? winner : mvp; g.winnerTeam = team; g.winReason = reason; g.phase = 'final'; g.phaseEndsAt = now;
    feed(g, now, `${TEAMS[team].name} wins — ${reason === 'admiral' ? `${g.players[g.winner].name} finished the Sudoku!` : reason === 'fleet' ? 'enemy fleet sunk!' : 'most combined points'}`, 'win');
    return;
  }
  if (!winner) {
    const ranked = g.order.slice().sort((a, b) => g.players[b].score - g.players[a].score);
    winner = ranked[0] || null; reason = reason || 'points';
  }
  g.winner = winner; g.winReason = reason; g.phase = 'final'; g.phaseEndsAt = now;
  feed(g, now, winner ? `${g.players[winner].name} wins — ${reason === 'admiral' ? "Admiral's Victory!" : reason === 'last' ? 'Last Fleet Floating!' : 'most points'}` : 'Game over', 'win');
}

// ── actions ─────────────────────────────────────────────────────────────────
export function act(g, pid, a, now = Date.now()) {
  const P = g.players[pid];
  if (!P) return { ok: false, error: 'Not in this game.' };
  switch (a.type) {
    case 'shuffle':
      if (g.phase !== 'setup') return { ok: false, error: 'Fleet is locked in.' };
      P.ships = randomFleet(); P.ready = false; return { ok: true };
    case 'ready':
      if (g.phase !== 'setup') return { ok: false };
      P.ready = true; return { ok: true };
    case 'place': return place(g, P, Number(a.cell), Number(a.digit), now);
    case 'order': return order(g, P, a);
    case 'cancel':
      if (g.phase !== 'battle') return { ok: false };
      P.orders = P.orders.filter(o => o.id !== a.orderId); return { ok: true };
    default: return { ok: false, error: 'Unknown action.' };
  }
}

function place(g, P, cell, digit, now) {
  if (g.phase !== 'solve') return { ok: false, error: 'Boards are locked — battle phase!' };
  if (!(cell >= 0 && cell < 81) || !(digit >= 1 && digit <= 9)) return { ok: false, error: 'Bad move.' };
  if (g.puzzle[cell] || P.board[cell]) return { ok: false, error: 'Already filled.' };
  if (now < P.frozenUntil) return { ok: false, error: 'Your board is frozen!', frozen: true };
  if (now < P.lockUntil) return { ok: false, error: 'Easy — wait a moment.', locked: true };
  if (g.solution[cell] !== digit) {
    P.mistakes++; P.streak = 0; P.shells = Math.max(0, P.shells - 1); P.lockUntil = now + MISTAKE_LOCK_MS;
    return { ok: true, correct: false, lost: 1 };
  }
  P.board[cell] = digit; P.stats.cells++;
  const wasScorched = P.scorched.includes(cell);
  let earned = 0;
  if (!wasScorched) {
    P.score += POINTS.cell; P.streak++;
    earned = 1 + (P.streak % 4 === 0 ? 1 : 0);
    P.shells = Math.min(MAX_SHELLS, P.shells + earned);
  } else P.scorched = P.scorched.filter(x => x !== cell);
  // sonar: newly completed rows / columns / boxes ping your rival
  const pings = [];
  for (const L of LINES) {
    if (!L.cells.includes(cell)) continue;
    const key = `${L.type}${L.idx}`;
    if (P.linesDone.includes(key) || !L.cells.every(c => P.board[c])) continue;
    P.linesDone.push(key);
    const rid = g.rivals[P.id];
    if (rid && g.players[rid]) {
      const R = g.players[rid];
      const count = R.ships.reduce((n, s) => n + (s.hits.length < s.size ? s.cells.filter(c => L.cells.includes(c) && !s.hits.includes(c)).length : 0), 0);
      const ping = { target: rid, type: L.type, idx: L.idx, count, volley: g.volley, from: P.id };
      P.intel.push(ping); pings.push(ping);
      for (const mid of teammatesOf(g, P.id)) { const M = g.players[mid]; M.intel.push(ping); if (M.intel.length > 60) M.intel.splice(0, M.intel.length - 60); }
    }
  }
  if (P.board.every(Boolean)) { P.score += POINTS.finish; finish(g, now, P.id, 'admiral'); }
  return { ok: true, correct: true, earned, pings, streak: P.streak };
}

function order(g, P, a) {
  if (g.phase !== 'battle') return { ok: false, error: 'Wait for the battle phase.' };
  const kind = a.kind; const cost = COST[kind];
  if (!cost) return { ok: false, error: 'Unknown order.' };
  const spent = P.orders.reduce((n, o) => n + COST[o.kind], 0);
  if (spent + cost > P.shells) return { ok: false, error: 'Not enough shells.' };
  const cell = Number(a.cell);
  if (!(cell >= 0 && cell < 81)) return { ok: false, error: 'Pick a cell.' };
  const o = { id: g.nextOrderId++, kind, cell };
  if (kind === 'fire' || kind === 'torpedo') {
    const T = g.players[a.target];
    if (!T || T.id === P.id) return { ok: false, error: 'Pick a target.' };
    if (sameTeam(g, T.id, P.id)) return { ok: false, error: `${T.name} is on your fleet!` };
    if (T.ghost) return { ok: false, error: `${T.name}'s fleet is already sunk.` };
    o.target = T.id;
    if (kind === 'torpedo') {
      const dir = a.dir === 'v' ? 'v' : 'h';
      const cells = [0, 1, 2].map(k => (dir === 'h' ? cell + k : cell + 9 * k));
      if (dir === 'h' && COL(cell) > 6) return { ok: false, error: 'Torpedo runs off the grid.' };
      if (dir === 'v' && ROW(cell) > 6) return { ok: false, error: 'Torpedo runs off the grid.' };
      o.dir = dir; o.cells = cells;
    }
  } else {
    // defend your own fleet — or, in Fleet vs Fleet, a teammate's
    const O = a.owner && a.owner !== P.id ? g.players[a.owner] : P;
    if (!O || (O !== P && !sameTeam(g, O.id, P.id))) return { ok: false, error: 'You can only defend your own fleet.' };
    if (O.ghost) return { ok: false, error: O === P ? 'Your fleet is gone — fire instead.' : `${O.name}'s fleet is already sunk.` };
    const ship = O.ships.find(s => s.cells.includes(cell));
    if (!ship) return { ok: false, error: 'Pick a ship cell.' };
    if (ship.hits.length >= ship.size) return { ok: false, error: 'That ship is sunk.' };
    if (kind === 'repair' && !ship.hits.includes(cell)) return { ok: false, error: 'That piece isn’t damaged.' };
    if (kind === 'shield' && (ship.hits.includes(cell) || O.shields.includes(cell))) return { ok: false, error: 'Can’t shield that cell.' };
    if (P.orders.some(q => q.kind === kind && q.cell === cell && (q.owner || P.id) === O.id)) return { ok: false, error: 'Already ordered.' };
    if (O !== P) o.owner = O.id;
  }
  P.orders.push(o);
  return { ok: true, order: o };
}

// ── resolve a volley: every order lands at once ─────────────────────────────
function resolve(g, now) {
  const events = [];
  const R = rng(`${g.seed}-v${g.volley}`);
  // defensive orders first
  for (const id of g.order) {
    for (const o of g.players[id].orders) {
      const O = g.players[o.owner || id]; if (!O) continue;
      if (o.kind === 'repair') { const s = O.ships.find(x => x.cells.includes(o.cell)); if (s && s.hits.length < s.size && s.hits.includes(o.cell)) { s.hits = s.hits.filter(c => c !== o.cell); delete g.marks[O.id][o.cell]; events.push({ type: 'repair', by: id, owner: O.id, cell: o.cell }); } }
      if (o.kind === 'shield' && !O.shields.includes(o.cell)) { O.shields.push(o.cell); events.push({ type: 'shield', by: id, owner: O.id }); }
    }
  }
  // all shots, in a shuffled order
  const shots = [];
  for (const id of g.order) for (const o of g.players[id].orders) {
    if (o.kind === 'fire') shots.push({ by: id, target: o.target, cell: o.cell, torpedo: false });
    if (o.kind === 'torpedo') for (const c of o.cells) shots.push({ by: id, target: o.target, cell: c, torpedo: true });
  }
  for (let i = shots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [shots[i], shots[j]] = [shots[j], shots[i]]; }
  for (const s of shots) {
    const A = g.players[s.by], T = g.players[s.target];
    A.stats.shots++;
    if (T.shields.includes(s.cell)) { T.shields = T.shields.filter(c => c !== s.cell); events.push({ ...s, result: 'blocked' }); continue; }
    const ship = T.ships.find(x => x.cells.includes(s.cell));
    if (ship && !ship.hits.includes(s.cell)) {
      ship.hits.push(s.cell); g.marks[T.id][s.cell] = 'hit';
      // the blast blows out the solved numbers in that cell and the cells right next to it
      const blast = [s.cell, ...[-9, 9, -1, 1].map(d => s.cell + d).filter(n => n >= 0 && n < 81 && (Math.abs(n - s.cell) === 9 || ROW(n) === ROW(s.cell)))];
      const blownCells = blast.filter(c => T.board[c] && !g.puzzle[c]);
      for (const c of blownCells) { T.board[c] = 0; if (!T.scorched.includes(c)) T.scorched.push(c); }
      if (blownCells.length) T.linesDone = T.linesDone.filter(k => !LINES.find(L => `${L.type}${L.idx}` === k).cells.some(c => blownCells.includes(c)));
      const blown = blownCells.length;
      A.score += POINTS.hit; A.stats.hits++;
      if (isBounty(g, T.id)) A.bounty++;
      const ev = { ...s, result: 'hit', blown, blownCells };
      if (ship.hits.length >= ship.size) {
        ev.sunk = ship.id; ev.shipName = ship.name; ev.shipCells = ship.cells.slice();
        A.score += POINTS.sink; A.stats.sinks++;
        const steal = Math.min(2, T.shells); T.shells -= steal; A.shells = Math.min(MAX_SHELLS, A.shells + steal); ev.stole = steal;
        T.freezeNext = true;
        if (T.ships.every(x => x.hits.length >= x.size)) { T.ghost = true; ev.ghost = true; }
      }
      events.push(ev);
    } else if (ship) events.push({ ...s, result: 'repeat' });
    else { if (g.marks[T.id][s.cell] !== 'hit') g.marks[T.id][s.cell] = 'miss'; events.push({ ...s, result: 'miss' }); }
  }
  // bounty pays out; orders spent; leftover shells bank (capped)
  for (const id of g.order) {
    const P = g.players[id];
    const spent = P.orders.reduce((n, o) => n + COST[o.kind], 0);
    P.shells = Math.min(MAX_SHELLS, Math.max(0, P.shells - spent) + P.bounty);
    P.bounty = 0; P.orders = [];
  }
  for (const e of events) {
    if (e.sunk) feed(g, now, `${g.players[e.by].name} sank ${g.players[e.target].name}'s ${e.shipName}!`, 'sink', { by: e.by, target: e.target });
    if (e.ghost) feed(g, now, `${g.players[e.target].name}'s fleet is gone — they're a Ghost now`, 'ghost', { target: e.target });
  }
  const hits = events.filter(e => e.result === 'hit').length, misses = events.filter(e => e.result === 'miss').length;
  feed(g, now, `Volley ${g.volley}: ${hits} hit${hits === 1 ? '' : 's'}, ${misses} splash${misses === 1 ? '' : 'es'}`, 'volley');
  g.reveal = { volley: g.volley, events };
  g.phase = 'reveal'; g.phaseEndsAt = now + g.settings.revealSec * 1000;
}

// ── clock: advance phases + CPU captains ────────────────────────────────────
export function tick(g, now = Date.now()) {
  for (let guard = 0; guard < 6; guard++) {
    if (g.phase === 'final') return;
    cpuStep(g, now);
    if (g.phase === 'setup' && (now >= g.phaseEndsAt || (g.order.length > 0 && g.order.every(id => g.players[id].ready)))) { startSolve(g, now); continue; }
    if (g.phase === 'solve' && now >= g.phaseEndsAt) { startBattle(g, g.phaseEndsAt); continue; }
    if (g.phase === 'battle' && now >= g.phaseEndsAt) { cpuStep(g, now, true); resolve(g, g.phaseEndsAt); continue; }
    if (g.phase === 'reveal' && now >= g.phaseEndsAt) {
      const live = living(g);
      if (isTeams(g)) {
        const aliveTeams = new Set(live.map(id => g.players[id].team));
        if (aliveTeams.size <= 1) { finish(g, now, null, 'fleet'); return; }
        if (g.volley >= g.settings.volleys) { finish(g, now, null, 'points'); return; }
        startSolve(g, g.phaseEndsAt); continue;
      }
      if (g.order.length > 1 && live.length <= 1) { finish(g, now, live[0] || null, live.length ? 'last' : 'points'); return; }
      if (g.volley >= g.settings.volleys) { finish(g, now, null, 'points'); return; }
      startSolve(g, g.phaseEndsAt); continue;
    }
    return;
  }
}

const cpuDelay = (lvl) => (lvl ? 60000 / (4 + lvl * 1.1) : 1e12); // lvl 5 ≈ 9.5 cells/min, lvl 10 ≈ 15
function cpuStep(g, now, force = false) {
  for (const id of g.order) {
    const P = g.players[id];
    if (!P.cpu) continue;
    if (g.phase === 'solve') {
      let n = 0;
      while (now >= P.nextCpuAt && n++ < 5 && g.phase === 'solve') {
        const t = P.nextCpuAt;
        P.nextCpuAt += cpuDelay(P.cpu) * (0.5 + Math.random());
        if (t < P.frozenUntil || t < P.lockUntil) continue;
        const empty = []; for (let i = 0; i < 81; i++) if (!P.board[i]) empty.push(i);
        if (!empty.length) break;
        const c = empty[Math.floor(Math.random() * empty.length)];
        const wrong = Math.random() < Math.max(0.03, 0.16 - P.cpu * 0.014);
        place(g, P, c, wrong ? (g.solution[c] % 9) + 1 : g.solution[c], t);
      }
    }
    if (g.phase === 'battle' && !P.cpuOrdered && (force || now >= P.nextCpuAt)) { P.cpuOrdered = true; cpuOrders(g, P); }
  }
}

function cpuOrders(g, P) {
  const foes = enemiesOf(g, P.id);
  if (!foes.length) return;
  const mates = teammatesOf(g, P.id);
  const keep = P.cpu >= 6 && Math.random() < 0.3 ? 1 : 0;
  // repair a damaged ship now and then
  if (!P.ghost && P.cpu >= 4 && Math.random() < 0.35) {
    const s = P.ships.find(x => x.hits.length && x.hits.length < x.size);
    if (s) act(g, P.id, { type: 'order', kind: 'repair', cell: s.hits[0] });
  }
  let guard = 0;
  while (guard++ < 12) {
    const spent = P.orders.reduce((n, o) => n + COST[o.kind], 0);
    const left = P.shells - spent - keep;
    if (left < 1) break;
    const bty = foes.filter(id => isBounty(g, id));
    const tid = bty.length && Math.random() < 0.5 ? bty[Math.floor(Math.random() * bty.length)] : foes[Math.floor(Math.random() * foes.length)];
    const marks = g.marks[tid], T = g.players[tid];
    const sunkCells = new Set(T.ships.filter(s => s.hits.length >= s.size).flatMap(s => s.cells));
    // don't double up on squares you or a teammate already aimed at
    const ordered = new Set([P.id, ...mates].flatMap(id => g.players[id].orders.filter(o => o.target === tid).flatMap(o => o.cells || [o.cell])));
    const tried = (c) => marks[c] || ordered.has(c);
    // target mode: next to open hits
    const open = Object.keys(marks).map(Number).filter(c => marks[c] === 'hit' && !sunkCells.has(c));
    let pickCell = null;
    if (open.length && P.cpu >= 3) {
      const nb = []; for (const c of open) for (const d of [-9, 9, -1, 1]) { const n = c + d; if (n < 0 || n > 80) continue; if ((d === -1 || d === 1) && ROW(n) !== ROW(c)) continue; if (!tried(n)) nb.push(n); }
      if (nb.length) pickCell = nb[Math.floor(Math.random() * nb.length)];
    }
    if (pickCell == null) {
      // hunt mode: weight by sonar intel, checkerboard parity for smarter captains
      const cands = []; const intel = P.intel.filter(x => x.target === tid && x.count > 0).slice(-12);
      for (let c = 0; c < 81; c++) {
        if (tried(c)) continue;
        let w = P.cpu >= 5 && (ROW(c) + COL(c)) % 2 ? 0.4 : 1;
        for (const it of intel) if (LINES.find(L => L.type === it.type && L.idx === it.idx).cells.includes(c)) w += it.count;
        cands.push([c, w]);
      }
      if (!cands.length) break;
      let t = Math.random() * cands.reduce((a, b) => a + b[1], 0), k = 0;
      while (k < cands.length - 1 && (t -= cands[k][1]) > 0) k++;
      pickCell = cands[k][0];
    }
    if (left >= 3 && P.cpu >= 6 && Math.random() < 0.35) {
      const h = COL(pickCell) <= 6, v = ROW(pickCell) <= 6;
      if (h || v) { const r = act(g, P.id, { type: 'order', kind: 'torpedo', target: tid, cell: pickCell, dir: h ? 'h' : 'v' }); if (r.ok) continue; }
    }
    act(g, P.id, { type: 'order', kind: 'fire', target: tid, cell: pickCell });
  }
}

// ── what each player (or the big screen) may see ────────────────────────────
export function view(g, pid = null, now = Date.now()) {
  const pub = (P) => ({
    id: P.id, name: P.name, color: P.color, cpu: P.cpu, team: P.team, ghost: P.ghost, ready: P.ready, score: P.score,
    solved: solvedCount(g, P), toSolve: toFill(g), shipsLeft: P.ships.filter(s => s.hits.length < s.size).length,
    shells: P.shells, frozen: now < P.frozenUntil, mistakes: P.mistakes, stats: P.stats,
    ordersIn: g.phase === 'battle' ? P.orders.length : 0, rival: g.rivals[P.id] || null,
    marks: g.marks[P.id],
    sunk: P.ships.filter(s => s.hits.length >= s.size).map(s => ({ id: s.id, name: s.name, cells: s.cells })),
  });
  const out = {
    phase: g.phase, phaseEndsAt: g.phaseEndsAt, now, volley: g.volley, settings: g.settings, puzzle: g.puzzle,
    leader: g.leader, bounties: g.bounties || [], winner: g.winner, winReason: g.winReason,
    mode: g.settings.mode || 'ffa', teams: isTeams(g) ? teamTotals(g) : null, winnerTeam: g.winnerTeam ?? null,
    players: g.order.map(id => pub(g.players[id])), feed: g.feed.slice(-12), reveal: g.reveal,
  };
  const P = pid && g.players[pid];
  if (P) {
    out.me = {
      id: P.id, board: P.board, scorched: P.scorched, shells: P.shells, streak: P.streak, mistakes: P.mistakes,
      frozenUntil: P.frozenUntil, lockUntil: P.lockUntil, ghost: P.ghost, ready: P.ready, rival: g.rivals[P.id] || null,
      ships: P.ships.map(s => ({ id: s.id, name: s.name, size: s.size, cells: s.cells, hits: s.hits })), shields: P.shields,
      orders: P.orders, intel: P.intel.slice(-30), team: P.team,
    };
    if (isTeams(g)) {
      // teammates share fleets (to defend them) and see each other's aim
      const mates = teammatesOf(g, P.id).map(id => g.players[id]);
      out.me.allies = mates.map(M => ({ id: M.id, ghost: M.ghost, ships: M.ships.map(s => ({ id: s.id, name: s.name, size: s.size, cells: s.cells, hits: s.hits })), shields: M.shields }));
      out.me.allyOrders = g.phase === 'battle' ? mates.flatMap(M => M.orders.map(o => ({ by: M.id, kind: o.kind, target: o.target || null, owner: o.owner || M.id, cells: o.cells || [o.cell] }))) : [];
    }
  }
  return out;
}
