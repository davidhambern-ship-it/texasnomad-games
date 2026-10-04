// ─────────────────────────────────────────────────────────────────────────────
// TND — TexasNomad Dominoes engine
// Double-six · 4 players · 2v2 partners (seats 0+2 vs 1+3) · All-Fives scoring
//
// Everything here is pure (no React, no network) so the Host page, the player
// page and the CPU all run the exact same rules.
//
// BOARD MODEL — the board is just the list of plays, in order:
//   { id, a, b, side, inner, outer, seat, n }
//   side  : 'first' | 'left' | 'right' | 'up' | 'down'
//   inner : the pip touching the chain      outer : the pip left exposed
// Positions are NOT stored. layoutBoard() recomputes every tile's position from
// the play order, so tiles always connect pip-to-pip, turn cleanly at the table
// edges, never overlap, and look the same on every screen.
// ─────────────────────────────────────────────────────────────────────────────

export const SEATS = 4;
export const HAND_SIZE = 7;

export const FULL_SET = [];
for (let i = 0; i <= 6; i++)
  for (let j = i; j <= 6; j++)
    FULL_SET.push({ id: `${i}-${j}`, a: i, b: j });

export const isDouble = (d) => d.a === d.b;
export const pips = (d) => d.a + d.b;
export const pipCount = (hand = []) => hand.reduce((s, d) => s + d.a + d.b, 0);
export const getTeam = (seat) => seat % 2; // 0 = Team A (seats 1 & 3), 1 = Team B (seats 2 & 4)
export const partnerOf = (seat) => (seat + 2) % 4;
export const roundTo5 = (n) => Math.round(n / 5) * 5;

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 4 players × 7 tiles uses the whole double-six set, so there is no boneyard:
// if you can't play, you knock (pass).
export function dealHands(rnd = Math.random) {
  const s = shuffle(FULL_SET, rnd);
  return { hands: [0, 1, 2, 3].map(i => s.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE)), boneyard: s.slice(SEATS * HAND_SIZE) };
}

// Round 1: whoever holds the biggest double leads it (in a 4-player deal that's always the 6-6).
export function findStarter(hands) {
  for (let v = 6; v >= 0; v--) {
    const id = `${v}-${v}`;
    const i = hands.findIndex(h => h.some(d => d.id === id));
    if (i >= 0) return { playerIndex: i, dominoId: id };
  }
  let best = -1, bestIdx = 0;
  hands.forEach((h, i) => { const t = pipCount(h); if (t > best) { best = t; bestIdx = i; } });
  return { playerIndex: bestIdx, dominoId: null };
}

// ── Board analysis ──────────────────────────────────────────────────────────
const normSide = (s) => (s === 'top' ? 'up' : s === 'bottom' ? 'down' : s);

function analyze(board = []) {
  const plays = board.map(t => ({ ...t, side: normSide(t.side) }));
  const first = plays[0] || null;
  const arms = { left: [], right: [], up: [], down: [] };
  let spinner = null; // first double played on the main line (first / left / right)
  for (const t of plays) {
    if (t.side !== 'first') arms[t.side].push(t);
    if (!spinner && isDouble(t) && (t.side === 'first' || t.side === 'left' || t.side === 'right')) spinner = t;
  }
  // The spinner's up/down arms open once tiles touch BOTH of its long sides.
  let armsOpen = false;
  if (spinner) {
    if (spinner.side === 'first') armsOpen = arms.left.length > 0 && arms.right.length > 0;
    else { const line = arms[spinner.side]; armsOpen = line.indexOf(line.find(t => t.id === spinner.id)) < line.length - 1; }
  }
  return { plays, first, arms, spinner, armsOpen };
}

const firstPip = (first, side) => (isDouble(first) ? first.a : side === 'left' ? first.a : first.b);

// Exposed pip on each open end (null = not open)
export function getOpenEnds(board = []) {
  const A = analyze(board);
  const out = { left: null, right: null, up: null, down: null, hasSpinner: !!A.spinner, armsOpen: A.armsOpen, spinnerId: A.spinner?.id || null };
  if (!A.first) return out;
  for (const side of ['left', 'right']) {
    const arm = A.arms[side];
    out[side] = arm.length ? arm[arm.length - 1].outer : firstPip(A.first, side);
  }
  if (A.armsOpen) for (const side of ['up', 'down']) {
    const arm = A.arms[side];
    out[side] = arm.length ? arm[arm.length - 1].outer : A.spinner.a;
  }
  return out;
}

// All-Fives count: add the open ends (a double on an end counts both halves).
// Empty spinner arms don't count until someone plays on them.
export function boardCount(board = []) {
  const A = analyze(board);
  if (!A.first) return 0;
  const f = A.first;
  if (!A.arms.left.length && !A.arms.right.length) return pips(f);
  let total = 0;
  for (const side of ['left', 'right']) {
    const arm = A.arms[side];
    if (arm.length) { const t = arm[arm.length - 1]; total += isDouble(t) ? t.a * 2 : t.outer; }
    else total += isDouble(f) ? f.a * 2 : firstPip(f, side);
  }
  if (A.armsOpen) for (const side of ['up', 'down']) {
    const arm = A.arms[side];
    if (arm.length) { const t = arm[arm.length - 1]; total += isDouble(t) ? t.a * 2 : t.outer; }
  }
  return total;
}
export const calcEndScore = (board) => { const c = boardCount(board); return c > 0 && c % 5 === 0 ? c : 0; };

export const canFit = (d, v) => v !== null && v !== undefined && (d.a === v || d.b === v);

// Legal (domino, side) pairs. `lead` = the tile that must open the round (6-6 in round 1).
export function getLegalMoves(hand = [], board = [], lead = null) {
  if (!board.length) {
    const forced = lead && hand.find(d => d.id === lead);
    return (forced ? [forced] : hand).map(d => ({ domino: d, side: 'first' }));
  }
  const ends = getOpenEnds(board), moves = [];
  for (const d of hand) for (const side of ['left', 'right', 'up', 'down']) if (canFit(d, ends[side])) moves.push({ domino: d, side });
  return moves;
}
export function getPlayableEnds(domino, board = [], lead = null) {
  return getLegalMoves([domino], board, lead).map(m => m.side);
}

export function buildEntry(domino, side, board = [], seat = null) {
  if (side === 'first' || !board.length) return { id: domino.id, a: domino.a, b: domino.b, side: 'first', inner: domino.a, outer: domino.b, seat, n: 0 };
  const v = getOpenEnds(board)[side];
  const inner = v, outer = domino.a === v ? domino.b : domino.a;
  return { id: domino.id, a: domino.a, b: domino.b, side, inner, outer, seat, n: board.length };
}

// ── Layout ──────────────────────────────────────────────────────────────────
// Units: 1 = the short side of a tile (a tile is 2 × 1). The first tile sits at
// (0,0). Each arm grows outward; when the next tile would leave the soft table
// box or hit another tile it turns 90° (clockwise first), which makes neat
// snakes. Turned tiles hook beside the end tile's outer half, so matching pips
// always touch.
const DIR = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
const CW = { E: 'S', S: 'W', W: 'N', N: 'E' };
const CCW = { E: 'N', N: 'W', W: 'S', S: 'E' };
const add = (p, d, k) => [p[0] + DIR[d][0] * k, p[1] + DIR[d][1] * k];
const horizontalDir = (d) => d === 'E' || d === 'W';

export const LAYOUT_BOX = { halfW: 8, halfH: 5 }; // soft table box in units (fits a ~16:10 table)

function rectOf(center, dir, along, across) {
  const hz = horizontalDir(dir);
  return { cx: center[0], cy: center[1], w: hz ? along : across, h: hz ? across : along };
}
const overlaps = (r, s, eps = 0.04) => Math.abs(r.cx - s.cx) < (r.w + s.w) / 2 - eps && Math.abs(r.cy - s.cy) < (r.h + s.h) / 2 - eps;
const inBox = (r, box) => r.cx - r.w / 2 >= -box.halfW - 1e-6 && r.cx + r.w / 2 <= box.halfW + 1e-6 && r.cy - r.h / 2 >= -box.halfH - 1e-6 && r.cy + r.h / 2 <= box.halfH + 1e-6;

// Candidate placements for a tile on an arm end.
function candidates(st, dbl, crossOK) {
  const list = [];
  // Straight on
  if (dbl && crossOK) {
    const c = add(st.edge, st.dir, 0.5);
    list.push({ dir: st.dir, cross: true, center: c, rect: rectOf(c, st.dir, 1, 2), next: { edge: add(st.edge, st.dir, 1), dir: st.dir, pivot: c, ext: 1 }, inner: c, outer: c });
  } else {
    const c = add(st.edge, st.dir, 1);
    list.push({ dir: st.dir, cross: false, center: c, rect: rectOf(c, st.dir, 2, 1), next: { edge: add(st.edge, st.dir, 2), dir: st.dir, pivot: add(st.edge, st.dir, 1.5), ext: 0.5 }, inner: add(st.edge, st.dir, 0.5), outer: add(st.edge, st.dir, 1.5) });
  }
  // Turns (clockwise preferred → tidy snakes)
  for (const d2 of [CW[st.dir], CCW[st.dir]]) {
    const c = add(st.pivot, d2, st.ext + 1);
    list.push({ dir: d2, cross: false, turned: true, center: c, rect: rectOf(c, d2, 2, 1), next: { edge: add(st.pivot, d2, st.ext + 2), dir: d2, pivot: add(st.pivot, d2, st.ext + 1.5), ext: 0.5 }, inner: add(st.pivot, d2, st.ext + 0.5), outer: add(st.pivot, d2, st.ext + 1.5) });
  }
  return list;
}

// Lays the board out inside the soft box; if the chain can't fit without
// overlapping, the box grows a step and the layout is redone (so tiles never overlap).
export function layoutBoard(board = [], box = LAYOUT_BOX) {
  let b = { ...box };
  for (let k = 0; k < 10; k++) {
    const L = layoutOnce(board, b, false);
    if (L) return { ...L, box: b };
    b = { halfW: b.halfW + 2, halfH: b.halfH + 1.25 };
  }
  return { ...layoutOnce(board, b, true), box: b };
}

function layoutOnce(board, box, force) {
  const A = analyze(board);
  const tiles = [];
  if (!A.first) return { tiles, ends: {}, bbox: { minX: -1, maxX: 1, minY: -1, maxY: 1 } };
  const placed = [];
  const states = {};
  const f = A.first, fd = isDouble(f);
  // First tile: horizontal line; a double sits crosswise (vertical)
  const fr = { cx: 0, cy: 0, w: fd ? 1 : 2, h: fd ? 2 : 1 };
  placed.push(fr);
  tiles.push({ id: f.id, a: f.a, b: f.b, seat: f.seat, n: 0, side: 'first', double: fd, rect: fr, horizontal: !fd,
    halves: fd ? [{ pip: f.a, cx: 0, cy: -0.5 }, { pip: f.a, cx: 0, cy: 0.5 }] : [{ pip: f.a, cx: -0.5, cy: 0 }, { pip: f.b, cx: 0.5, cy: 0 }] });
  const half = fd ? 0.5 : 1;
  states.left = { edge: [-half, 0], dir: 'W', pivot: fd ? [0, 0] : [-0.5, 0], ext: fd ? 1 : 0.5 };
  states.right = { edge: [half, 0], dir: 'E', pivot: fd ? [0, 0] : [0.5, 0], ext: fd ? 1 : 0.5 };
  let spinnerGeom = fd && A.spinner?.id === f.id ? { center: [0, 0], lineDir: 'E', ext: 1 } : null;

  for (const t of A.plays) {
    if (t.side === 'first') continue;
    if ((t.side === 'up' || t.side === 'down') && !states[t.side]) {
      // Open the spinner arms (perpendicular to the spinner's line)
      const g = spinnerGeom || { center: [0, 0], lineDir: 'E', ext: 1 };
      const upDir = CCW[g.lineDir], downDir = CW[g.lineDir];
      const mk = (d) => ({ edge: add(g.center, d, g.ext), dir: d, pivot: g.center, ext: g.ext, straightOnly: false });
      states.up = states.up || mk(upDir);
      states.down = states.down || mk(downDir);
    }
    const st = states[t.side];
    const dbl = isDouble(t);
    const isSpin = A.spinner && A.spinner.id === t.id;
    const cands = candidates(st, dbl, true);
    const ok = (c) => !placed.some(r => overlaps(r, c.rect));
    const fits = (c) => ok(c) && inBox(c.rect, box);
    let pick = cands.find(fits);
    // A spinner sits crosswise (straight on) whenever possible so its arms have room
    if (isSpin && fits(cands[0])) pick = cands[0];
    if (!pick) { if (!force) return null; pick = cands.find(ok) || cands[0]; }
    placed.push(pick.rect);
    const hz = pick.rect.w > pick.rect.h;
    tiles.push({ id: t.id, a: t.a, b: t.b, seat: t.seat, n: t.n, side: t.side, double: dbl, rect: pick.rect, horizontal: hz, turned: !!pick.turned,
      halves: dbl && pick.cross
        ? (horizontalDir(pick.dir) ? [{ pip: t.a, cx: pick.center[0], cy: pick.center[1] - 0.5 }, { pip: t.a, cx: pick.center[0], cy: pick.center[1] + 0.5 }]
                                   : [{ pip: t.a, cx: pick.center[0] - 0.5, cy: pick.center[1] }, { pip: t.a, cx: pick.center[0] + 0.5, cy: pick.center[1] }])
        : [{ pip: t.inner, cx: pick.inner[0], cy: pick.inner[1] }, { pip: t.outer, cx: pick.outer[0], cy: pick.outer[1] }] });
    states[t.side] = pick.next;
    if (isSpin) spinnerGeom = { center: pick.center, lineDir: pick.dir, ext: pick.cross ? 1 : 0.5 };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of placed) { minX = Math.min(minX, r.cx - r.w / 2); maxX = Math.max(maxX, r.cx + r.w / 2); minY = Math.min(minY, r.cy - r.h / 2); maxY = Math.max(maxY, r.cy + r.h / 2); }
  return { tiles, states, bbox: { minX, maxX, minY, maxY } };
}

// Where a tile WOULD land (for ghost previews on the table)
export function previewPlacement(board, domino, side, box = LAYOUT_BOX) {
  const entry = buildEntry(domino, side, board, null);
  // Use the box the CURRENT board was laid out in, so the ghost lines up with the tiles on screen
  const cur = layoutBoard(board, box);
  const L = layoutOnce([...board, entry], cur.box || box, true);
  return L.tiles[L.tiles.length - 1];
}

// ── Game flow (one reducer for Host, players and CPU) ──────────────────────
export const teamScore = (g, team) => (team === 0 ? g.teamScores?.teamA : g.teamScores?.teamB) || 0;
const addScore = (scores, team, pts) => ({ teamA: (scores?.teamA || 0) + (team === 0 ? pts : 0), teamB: (scores?.teamB || 0) + (team === 1 ? pts : 0) });
const pushLog = (g, msg) => [...(g.activityLog || []), msg].slice(-40);
const nameOf = (g, seat) => g.players?.[seat]?.playerName || `Seat ${seat + 1}`;

export function newRound(g, { first = false } = {}) {
  const { hands, boneyard } = dealHands();
  const players = g.players.map((p, i) => ({ ...p, hand: hands[i] }));
  const st = findStarter(hands);
  const starter = first || g.roundWinner?.winnerSeat == null ? st.playerIndex : g.roundWinner.winnerSeat;
  const lead = first ? st.dominoId : null;
  const roundNumber = first ? 1 : (g.roundNumber || 1) + 1;
  return {
    ...g, status: 'active', phase: 'playing', players, board: [], boneyard,
    currentSeat: starter, roundNumber, leadTile: lead, passes: 0, lastPlay: null, roundWinner: null,
    teamScores: first ? { teamA: 0, teamB: 0 } : g.teamScores,
    activityLog: pushLog(first ? { activityLog: [] } : g, `Round ${roundNumber} — ${nameOf(g, starter)} leads${lead ? ` the ${lead}` : ''}.`),
  };
}

export const isGameOver = (g) => teamScore(g, 0) >= (g.scoreLimit || 100) || teamScore(g, 1) >= (g.scoreLimit || 100);
export const winningTeam = (g) => (teamScore(g, 0) === teamScore(g, 1) ? null : teamScore(g, 0) > teamScore(g, 1) ? 0 : 1);

function finishIfOver(g) {
  return isGameOver(g) ? { ...g, phase: 'game_over', status: 'finished' } : g;
}

// Play a tile. Returns the new game, or { error } if illegal.
export function applyPlay(g, seat, dominoId, side) {
  if (g.phase !== 'playing') return { error: 'Not playing' };
  if (g.currentSeat !== seat) return { error: "It's not your turn" };
  const hand = g.players[seat].hand || [];
  const domino = hand.find(d => d.id === dominoId);
  if (!domino) return { error: 'You don’t have that tile' };
  const board = g.board || [];
  const legal = getLegalMoves([domino], board, g.leadTile);
  if (!legal.some(m => m.side === side)) return { error: board.length ? 'That tile doesn’t fit there' : `Lead with the ${g.leadTile}` };
  const entry = buildEntry(domino, side, board, seat);
  const newBoard = [...board, entry];
  const newHand = hand.filter(d => d.id !== dominoId);
  const players = g.players.map((p, i) => (i === seat ? { ...p, hand: newHand } : p));
  const team = getTeam(seat);
  const pts = calcEndScore(newBoard);
  let scores = addScore(g.teamScores, team, pts);
  let log = pushLog(g, `${nameOf(g, seat)} played ${domino.id}${pts ? ` · +${pts}` : ''}`);
  const lastPlay = { seat, id: domino.id, side, points: pts, count: boardCount(newBoard), n: entry.n };
  let ng = { ...g, board: newBoard, players, teamScores: scores, passes: 0, leadTile: null, lastPlay, activityLog: log };
  // Reaching the target with a scoring play ends the game on the spot
  if (pts && isGameOver(ng) && newHand.length > 0) {
    return { ...ng, phase: 'game_over', status: 'finished',
      roundWinner: { team, points: pts, winnerSeat: seat, reason: 'score', playerName: nameOf(g, seat), teamPips: [0, 1].map(tm => players.filter((_, i) => getTeam(i) === tm).reduce((s2, p) => s2 + pipCount(p.hand), 0)) },
      activityLog: pushLog(ng, `${nameOf(g, seat)} scores ${pts} and reaches ${g.scoreLimit || 100}!`) };
  }
  if (newHand.length === 0) {
    const opp = players.filter((_, i) => getTeam(i) !== team).reduce((s, p) => s + pipCount(p.hand), 0);
    const bonus = roundTo5(opp);
    scores = addScore(scores, team, bonus);
    ng = { ...ng, teamScores: scores, phase: 'round_over',
      roundWinner: { team, points: bonus, playPoints: pts, playerName: nameOf(g, seat), winnerSeat: seat, reason: 'domino', teamPips: [0, 1].map(tm => players.filter((_, i) => getTeam(i) === tm).reduce((s, p) => s + pipCount(p.hand), 0)) },
      activityLog: pushLog(ng, `${nameOf(g, seat)} dominoes! +${bonus} for ${team === 0 ? 'Team A' : 'Team B'}`) };
    return finishIfOver(ng);
  }
  return { ...ng, currentSeat: (seat + 1) % SEATS };
}

// Knock (pass). Only allowed with no legal move. Four knocks in a row = blocked round.
export function applyPass(g, seat) {
  if (g.phase !== 'playing' || g.currentSeat !== seat) return { error: "It's not your turn" };
  if (getLegalMoves(g.players[seat].hand, g.board, g.leadTile).length) return { error: 'You have a tile that plays' };
  const passes = (g.passes || 0) + 1;
  let ng = { ...g, passes, lastPlay: { seat, pass: true, n: (g.board || []).length }, activityLog: pushLog(g, `${nameOf(g, seat)} knocks`) };
  if (passes >= SEATS || g.players.every(p => getLegalMoves(p.hand, g.board, g.leadTile).length === 0)) return resolveBlocked(ng);
  return { ...ng, currentSeat: (seat + 1) % SEATS };
}

// Blocked: the team with the lighter hands wins the other team's pips (rounded to 5). Tie = no points.
export function resolveBlocked(g) {
  const teamPips = [0, 1].map(tm => g.players.filter((_, i) => getTeam(i) === tm).reduce((s, p) => s + pipCount(p.hand), 0));
  let team = null, points = 0, winnerSeat = null;
  if (teamPips[0] !== teamPips[1]) {
    team = teamPips[0] < teamPips[1] ? 0 : 1;
    points = roundTo5(teamPips[1 - team]);
    const seats = [0, 1, 2, 3].filter(i => getTeam(i) === team);
    winnerSeat = seats.reduce((a, b) => (pipCount(g.players[b].hand) < pipCount(g.players[a].hand) ? b : a));
  } else winnerSeat = g.lastPlay?.seat ?? g.currentSeat;
  const ng = { ...g, phase: 'round_over', teamScores: team == null ? g.teamScores : addScore(g.teamScores, team, points),
    roundWinner: { team, points, winnerSeat, reason: 'blocked', teamPips, playerName: team == null ? null : nameOf(g, winnerSeat) },
    activityLog: pushLog(g, team == null ? 'Blocked — tie, no points' : `Blocked! ${team === 0 ? 'Team A' : 'Team B'} has the light hands · +${points}`) };
  return finishIfOver(ng);
}

// ── CPU ────────────────────────────────────────────────────────────────────
// level 1–10. Higher levels score more, set up partners, avoid gifting points
// to the next opponent and keep pips that are hard to block.
export function chooseAIMove(g, seat, level = 6) {
  const hand = g.players[seat].hand || [];
  const board = g.board || [];
  const moves = getLegalMoves(hand, board, g.leadTile);
  if (!moves.length) return null;
  if (moves.length === 1 || level <= 1) return moves[0];
  const myTeam = getTeam(seat);
  const nextOpp = (seat + 1) % SEATS;
  const unseen = FULL_SET.filter(d => !board.some(b => b.id === d.id) && !hand.some(h => h.id === d.id));
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const nb = [...board, buildEntry(m.domino, m.side, board, seat)];
    const pts = calcEndScore(nb);
    let s = pts * 3;
    s += pips(m.domino) * 0.6; // dump heavy tiles
    if (isDouble(m.domino)) s += 2.5; // doubles are hard to play later
    if (level >= 4) {
      // What could the next opponent score off this board? (expected over unseen tiles)
      const ends = getOpenEnds(nb);
      let threat = 0, cnt = 0;
      for (const d of unseen) for (const side of ['left', 'right', 'up', 'down']) {
        if (!canFit(d, ends[side])) continue;
        cnt++; threat = Math.max(threat, calcEndScore([...nb, buildEntry(d, side, nb, nextOpp)]));
      }
      s -= threat * (level >= 7 ? 1.4 : 0.8);
    }
    if (level >= 6) {
      // Keep variety: prefer leaving ends we can still match
      const rest = hand.filter(d => d.id !== m.domino.id);
      const ends = getOpenEnds(nb);
      const follow = rest.filter(d => ['left', 'right', 'up', 'down'].some(side => canFit(d, ends[side]))).length;
      s += follow * 1.2;
    }
    s += (Math.random() - 0.5) * (11 - level) * 1.5; // personality / mistakes
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

// Back-compat helpers some older code imports
export const isBlocked = (players, board) => players.every(p => getLegalMoves(p.hand || [], board).length === 0);
export function calcRoundPoints(players, winnerSeat) {
  const losing = 1 - getTeam(winnerSeat);
  return roundTo5(players.filter((_, i) => getTeam(i) === losing).reduce((s, p) => s + pipCount(p.hand || []), 0));
}
