// ─────────────────────────────────────────────────────────────────────────────
// OUT! — rules engine (shared by the server and solo mode in the browser)
//
// Classic shedding card game: match the top card by colour or by number/symbol.
// 108-card deck: 4 colours × (one 0, two each of 1–9, two Skip, two Reverse, two +2)
// plus 4 Wild and 4 Wild +4. Empty your hand to win the round. Down to one card?
// Hit OUT! — if someone catches you first, you draw 2.
//
// House rules (host toggles): stacking (+2 on +2, +4 on +2/+4) and 7-0 swaps
// (play a 7 to swap hands with someone, a 0 passes every hand along).
// Scoring: the round winner scores everyone else's cards (number = face value,
// Skip/Reverse/+2 = 20, Wilds = 50). Play to a target score, or one round.
// The deck and other players' hands never leave the server — only views do.
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = ['r', 'y', 'g', 'b'];
export const COLOR_NAMES = { r: 'Chili', y: 'Sunset', g: 'Cactus', b: 'Sky' };
export const DEFAULTS = { target: 250, turnSec: 30, stacking: false, sevenZero: false, handSize: 7 };
export const ROUND_PAUSE_MS = 9000;
const CATCH_PENALTY = 2;

export const isWild = (c) => c.c === 'w';
export const points = (c) => (isWild(c) ? 50 : /^\d$/.test(c.v) ? Number(c.v) : 20);
export const cardLabel = (c) => (c.v === 'wild' ? 'Wild' : c.v === 'w4' ? 'Wild +4' : `${COLOR_NAMES[c.c]} ${c.v === 'skip' ? 'Skip' : c.v === 'rev' ? 'Reverse' : c.v === 'd2' ? '+2' : c.v}`);

export function rng(seed) {
  let a = 0; for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 1) | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, R) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

export function makeDeck() {
  const d = []; let id = 0;
  for (const c of COLORS) {
    d.push({ id: id++, c, v: '0' });
    for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'rev', 'd2']) { d.push({ id: id++, c, v }); d.push({ id: id++, c, v }); }
  }
  for (let i = 0; i < 4; i++) { d.push({ id: id++, c: 'w', v: 'wild' }); d.push({ id: id++, c: 'w', v: 'w4' }); }
  return d;
}

export function createGame({ seed = Date.now(), settings = {}, players = [], now = Date.now() } = {}) {
  const S = { ...DEFAULTS, ...settings };
  const g = {
    v: 1, seed: `${seed}`, settings: S, R: null, round: 0, dealer: -1, order: players.map(p => p.id), players: {},
    deck: [], discard: [], color: null, dir: 1, turn: 0, turnEndsAt: 0, drawStack: 0, stackKind: null,
    pending: null, phase: 'play', log: [], seq: 0, roundWinner: null, winner: null, nextAt: 0, roundSummary: null,
  };
  for (const p of players) g.players[p.id] = { id: p.id, name: p.name, color: p.color || '#ffd23f', cpu: p.cpu || 0, hand: [], score: 0, called: false, vulnerable: false, cpuAt: 0, stats: { played: 0, drawn: 0, caught: 0, rounds: 0 } };
  startRound(g, now);
  return g;
}

const R = (g) => (g._r || (g._r = rng(`${g.seed}-${g.round}-${g.seq}`)));
const cur = (g) => g.players[g.order[g.turn]];
const top = (g) => g.discard[g.discard.length - 1];
const nextIdx = (g, from = g.turn, steps = 1) => { const n = g.order.length; return (((from + g.dir * steps) % n) + n) % n; };
function log(g, now, kind, text, extra = {}) { g.seq++; g.log.push({ seq: g.seq, t: now, kind, text, ...extra }); if (g.log.length > 30) g.log.splice(0, g.log.length - 30); }

function draw(g, P, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!g.deck.length) {
      const t = g.discard.pop();
      g.deck = shuffle(g.discard, R(g)); g.discard = [t];
      if (!g.deck.length) break; // every card is in someone's hand
    }
    const c = g.deck.pop(); P.hand.push(c); got.push(c);
  }
  P.stats.drawn += got.length;
  if (P.hand.length > 1) { P.called = false; P.vulnerable = false; }
  return got;
}

function startRound(g, now) {
  g.round++; g._r = rng(`${g.seed}-r${g.round}`);
  g.deck = shuffle(makeDeck(), g._r); g.discard = []; g.dir = 1; g.drawStack = 0; g.stackKind = null; g.pending = null; g.roundWinner = null; g.roundSummary = null;
  for (const id of g.order) { const P = g.players[id]; P.hand = []; P.called = false; P.vulnerable = false; }
  for (let k = 0; k < g.settings.handSize; k++) for (const id of g.order) g.players[id].hand.push(g.deck.pop());
  g.dealer = (g.dealer + 1) % g.order.length;
  // flip a starter that isn't a Wild +4
  let first;
  for (;;) { first = g.deck.pop(); if (first.v !== 'w4') break; g.deck.unshift(first); }
  g.discard.push(first);
  g.color = isWild(first) ? COLORS[Math.floor(g._r() * 4)] : first.c;
  g.turn = nextIdx(g, g.dealer);
  g.phase = 'play';
  log(g, now, 'round', `Round ${g.round} — ${g.players[g.order[g.turn]].name} starts`, { card: first });
  // starter card effects
  if (first.v === 'skip') { log(g, now, 'skip', `${cur(g).name} is skipped by the starter`); g.turn = nextIdx(g); }
  else if (first.v === 'rev' && g.order.length > 2) { g.dir = -1; g.turn = nextIdx(g, g.dealer); }
  else if (first.v === 'd2') { const P = cur(g); draw(g, P, 2); log(g, now, 'draw', `${P.name} draws 2 from the starter`, { pid: P.id, n: 2 }); g.turn = nextIdx(g); }
  beginTurn(g, now);
}

function beginTurn(g, now) {
  g.turnEndsAt = now + g.settings.turnSec * 1000;
  const P = cur(g);
  if (P.cpu) P.cpuAt = now + 900 + Math.random() * 900 + (10 - P.cpu) * 120;
}

/** can card c be played right now by P? */
export function canPlay(g, P, c) {
  const t = top(g);
  if (g.drawStack > 0) {
    if (!g.settings.stacking) return false;
    if (c.v === 'w4') return true;
    return c.v === 'd2' && g.stackKind === 'd2';
  }
  if (c.v === 'w4') return !P.hand.some(h => h.c === g.color); // only when you have nothing in the current colour
  if (isWild(c)) return true;
  return c.c === g.color || c.v === t.v;
}

function endTurn(g, now, skip = 0) {
  g.turn = nextIdx(g, g.turn, 1 + skip);
  g.pending = null;
  beginTurn(g, now);
}

function winRound(g, P, now) {
  let pts = 0; const lines = [];
  for (const id of g.order) { if (id === P.id) continue; const Q = g.players[id]; const s = Q.hand.reduce((a, c) => a + points(c), 0); pts += s; lines.push({ id, name: Q.name, cards: Q.hand.length, points: s }); }
  P.score += pts; P.stats.rounds++;
  g.roundWinner = P.id; g.roundSummary = { winner: P.id, points: pts, lines };
  log(g, now, 'win', `${P.name} wins round ${g.round} (+${pts})`, { pid: P.id });
  const tgt = g.settings.target;
  if (!tgt || P.score >= tgt) { g.phase = 'final'; g.winner = P.id; log(g, now, 'final', `${P.name} wins the game!`, { pid: P.id }); }
  else { g.phase = 'roundover'; g.nextAt = now + ROUND_PAUSE_MS; }
}

// ── actions ─────────────────────────────────────────────────────────────────
export function act(g, pid, a, now = Date.now()) {
  const P = g.players[pid];
  if (!P) return { ok: false, error: 'You’re not in this game.' };
  if (a.type === 'call') return callNomad(g, P, now);
  if (a.type === 'catch') return catchPlayer(g, P, a.target, now);
  if (g.phase !== 'play') return { ok: false, error: 'Hang on — next round is coming.' };
  if (g.order[g.turn] !== pid) return { ok: false, error: 'Not your turn yet.' };
  switch (a.type) {
    case 'play': return play(g, P, Number(a.card), a.color, a.target, now, !!a.call);
    case 'draw': return drawTurn(g, P, now);
    case 'pass': return keepDrawn(g, P, now);
    default: return { ok: false, error: 'Unknown move.' };
  }
}

function callNomad(g, P, now) {
  // allowed with 2 cards on your turn (about to play) or with 1 card before anyone catches you
  if (P.hand.length > 2 || (P.hand.length === 2 && g.order[g.turn] !== P.id)) return { ok: false, error: 'Call OUT! when you’re down to your last card.' };
  if (P.called && !P.vulnerable) return { ok: true };
  P.called = true; P.vulnerable = false;
  log(g, now, 'call', `${P.name}: OUT!`, { pid: P.id });
  return { ok: true };
}

function catchPlayer(g, P, targetId, now) {
  const T = g.players[targetId];
  if (!T || T === P) return { ok: false, error: 'Pick someone to catch.' };
  if (!(T.vulnerable && T.hand.length === 1 && !T.called)) return { ok: false, error: `${T.name} is safe.` };
  draw(g, T, CATCH_PENALTY); T.vulnerable = false; P.stats.caught++;
  log(g, now, 'catch', `${P.name} caught ${T.name}! +${CATCH_PENALTY} cards`, { pid: T.id, by: P.id });
  return { ok: true, caught: true };
}

// once the next player makes a move, anyone who forgot to call OUT! is safe again
const settle = (g, P) => { for (const id of g.order) if (id !== P.id) g.players[id].vulnerable = false; };

function play(g, P, cardId, color, target, now, callNow) {
  const idx = P.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return { ok: false, error: 'That card isn’t in your hand.' };
  const c = P.hand[idx];
  if (g.pending && g.pending.type === 'drawn' && g.pending.card !== c.id) return { ok: false, error: 'Play the card you drew, or keep it.' };
  if (!canPlay(g, P, c)) return { ok: false, error: c.v === 'w4' && g.drawStack === 0 ? 'Wild +4 only works when you have no cards of the current colour.' : g.drawStack ? `Stack a +${g.stackKind === 'w4' ? 4 : 2} or draw ${g.drawStack}.` : 'That card doesn’t match.' };
  if (isWild(c) && !COLORS.includes(color)) return { ok: false, error: 'Pick a colour.', needColor: true };
  const sevenSwap = g.settings.sevenZero && c.v === '7';
  if (sevenSwap && g.order.length > 1 && !(target && target !== P.id && g.players[target])) return { ok: false, error: 'Pick who to swap hands with.', needTarget: true };

  settle(g, P);
  P.hand.splice(idx, 1); g.discard.push(c); P.stats.played++;
  g.color = isWild(c) ? color : c.c;
  if (callNow && P.hand.length === 1) P.called = true;
  if (P.hand.length !== 1) { P.called = false; P.vulnerable = false; }
  else if (!P.called) P.vulnerable = true;
  log(g, now, 'play', `${P.name} played ${cardLabel(c)}${isWild(c) ? ` → ${COLOR_NAMES[color]}` : ''}`, { pid: P.id, card: c, color: g.color });

  // 7-0 swaps
  if (sevenSwap && g.order.length > 1) {
    const T = g.players[target]; const tmp = P.hand; P.hand = T.hand; T.hand = tmp;
    for (const Q of [P, T]) { Q.called = false; Q.vulnerable = false; }
    log(g, now, 'swap', `${P.name} swapped hands with ${T.name}`, { pid: P.id, target: T.id });
  }
  if (g.settings.sevenZero && c.v === '0' && g.order.length > 1) {
    const hands = g.order.map(id => g.players[id].hand);
    g.order.forEach((id, i) => { g.players[id].hand = hands[(((i - g.dir) % hands.length) + hands.length) % hands.length]; g.players[id].called = false; g.players[id].vulnerable = false; });
    log(g, now, 'rotate', `Everybody passes their hand ${g.dir === 1 ? 'left' : 'right'}!`);
  }

  if (P.hand.length === 0) { winRound(g, P, now); return { ok: true, won: true }; }
  // someone else might be holding zero cards after a swap/rotate
  const empty = g.order.map(id => g.players[id]).find(Q => Q.hand.length === 0);
  if (empty) { winRound(g, empty, now); return { ok: true }; }

  // effects
  if (c.v === 'skip') { log(g, now, 'skip', `${g.players[g.order[nextIdx(g)]].name} is skipped`, { pid: g.order[nextIdx(g)] }); endTurn(g, now, 1); }
  else if (c.v === 'rev') {
    g.dir *= -1; log(g, now, 'rev', 'Reverse!');
    if (g.order.length === 2) endTurn(g, now, 1); else endTurn(g, now);
  } else if (c.v === 'd2' || c.v === 'w4') {
    const n = c.v === 'd2' ? 2 : 4;
    if (g.settings.stacking) {
      g.drawStack += n; g.stackKind = c.v;
      const N = g.players[g.order[nextIdx(g)]];
      log(g, now, 'stack', `${N.name} must stack or draw ${g.drawStack}`, { pid: N.id, n: g.drawStack });
      endTurn(g, now);
    } else {
      const N = g.players[g.order[nextIdx(g)]];
      draw(g, N, n); log(g, now, 'draw', `${N.name} draws ${n} and is skipped`, { pid: N.id, n });
      endTurn(g, now, 1);
    }
  } else endTurn(g, now);
  return { ok: true };
}

function drawTurn(g, P, now) {
  if (g.pending && g.pending.type === 'drawn') return { ok: false, error: 'You already drew — play it or keep it.' };
  settle(g, P);
  if (g.drawStack > 0) {
    const n = g.drawStack; draw(g, P, n); g.drawStack = 0; g.stackKind = null;
    log(g, now, 'draw', `${P.name} draws ${n}`, { pid: P.id, n });
    endTurn(g, now); return { ok: true, drew: n };
  }
  const [c] = draw(g, P, 1);
  if (!c) { log(g, now, 'pass', `${P.name} passes (deck empty)`); endTurn(g, now); return { ok: true }; }
  if (canPlay(g, P, c)) {
    g.pending = { type: 'drawn', pid: P.id, card: c.id };
    g.turnEndsAt = Math.max(g.turnEndsAt, now + 8000);
    log(g, now, 'drew', `${P.name} drew a card`, { pid: P.id, n: 1 });
    return { ok: true, drawn: c, playable: true };
  }
  log(g, now, 'draw', `${P.name} drew and passed`, { pid: P.id, n: 1 });
  endTurn(g, now);
  return { ok: true, drawn: c, playable: false };
}

function keepDrawn(g, P, now) {
  if (!(g.pending && g.pending.type === 'drawn')) return { ok: false, error: 'Nothing to keep.' };
  log(g, now, 'pass', `${P.name} kept it`);
  endTurn(g, now);
  return { ok: true };
}

// ── clock: timeouts, CPU players, next round ────────────────────────────────
export function tick(g, now = Date.now()) {
  for (let guard = 0; guard < 12; guard++) {
    if (g.phase === 'final') return;
    if (g.phase === 'roundover') { if (now >= g.nextAt) { startRound(g, now); continue; } return; }
    // CPUs catch humans who forgot to call
    for (const id of g.order) {
      const Q = g.players[id];
      if (!Q.cpu) continue;
      const T = g.order.map(x => g.players[x]).find(x => x !== Q && x.vulnerable && x.hand.length === 1 && !x.called);
      if (T && Math.random() < 0.03 * Q.cpu) catchPlayer(g, Q, T.id, now);
    }
    const P = cur(g);
    if (P.cpu && now >= P.cpuAt) { cpuMove(g, P, now); continue; }
    if (!P.cpu && now >= g.turnEndsAt) {
      // out of time: auto-play the drawn card if pending, otherwise draw and move on
      if (g.pending && g.pending.type === 'drawn') keepDrawn(g, P, now);
      else { const before = g.turn; drawTurn(g, P, now); if (g.pending && g.turn === before) keepDrawn(g, P, now); }
      log(g, now, 'timeout', `${P.name} ran out of time`, { pid: P.id });
      continue;
    }
    return;
  }
}

function bestColor(P) {
  const n = { r: 0, y: 0, g: 0, b: 0 };
  for (const c of P.hand) if (!isWild(c)) n[c.c] += 1 + (/^\d$/.test(c.v) ? 0 : 0.5);
  return COLORS.reduce((a, b) => (n[b] > n[a] ? b : a), COLORS[Math.floor(Math.random() * 4)]);
}

function cpuMove(g, P, now) {
  const lvl = P.cpu;
  let options = P.hand.filter(c => canPlay(g, P, c));
  if (g.pending && g.pending.type === 'drawn') options = options.filter(c => c.id === g.pending.card);
  if (!options.length) {
    const r = drawTurn(g, P, now);
    if (r.playable && g.pending) return cpuMove(g, P, now);
    return;
  }
  const nextP = g.players[g.order[nextIdx(g)]];
  const danger = nextP.hand.length <= 2;
  const score = (c) => {
    let s = Math.random() * (11 - lvl) * 0.6;
    if (isWild(c)) s -= P.hand.length > 2 ? 6 : -2; // save wilds for later
    if (['skip', 'rev', 'd2', 'w4'].includes(c.v)) s += danger ? 8 : 1;
    if (c.c === g.color) s += 1.5;
    s += points(c) / 25; // shed high cards
    return s;
  };
  options.sort((a, b) => score(b) - score(a));
  const c = options[0];
  const color = isWild(c) ? bestColor({ hand: P.hand.filter(h => h.id !== c.id) }) : undefined;
  let target;
  if (g.settings.sevenZero && c.v === '7') target = g.order.filter(id => id !== P.id).sort((a, b) => g.players[a].hand.length - g.players[b].hand.length)[0];
  const forget = Math.random() < Math.max(0.02, 0.3 - lvl * 0.03);
  play(g, P, c.id, color, target, now, P.hand.length === 2 && !forget);
}

// ── views ───────────────────────────────────────────────────────────────────
export function view(g, pid = null, now = Date.now()) {
  const P = pid && g.players[pid];
  const out = {
    phase: g.phase, round: g.round, settings: g.settings, now, dir: g.dir, color: g.color, top: top(g), discardCount: g.discard.length,
    under: g.discard.slice(-5, -1), deckCount: g.deck.length, turn: g.order[g.turn], turnEndsAt: g.turnEndsAt, drawStack: g.drawStack, stackKind: g.stackKind,
    pending: g.pending ? { type: g.pending.type, pid: g.pending.pid } : null, log: g.log.slice(-12), seq: g.seq,
    roundWinner: g.roundWinner, winner: g.winner, nextAt: g.nextAt, roundSummary: g.roundSummary,
    players: g.order.map(id => { const Q = g.players[id]; return { id, name: Q.name, color: Q.color, cpu: Q.cpu, count: Q.hand.length, score: Q.score, called: Q.called, vulnerable: Q.vulnerable && Q.hand.length === 1 && !Q.called, stats: Q.stats }; }),
  };
  if (P) {
    const order = { r: 0, y: 1, g: 2, b: 3, w: 4 };
    const vOrder = (v) => (/^\d$/.test(v) ? Number(v) : { skip: 10, rev: 11, d2: 12, wild: 13, w4: 14 }[v]);
    const hand = P.hand.slice().sort((a, b) => order[a.c] - order[b.c] || vOrder(a.v) - vOrder(b.v));
    const myTurn = g.phase === 'play' && g.order[g.turn] === pid;
    let playable = myTurn ? hand.filter(c => canPlay(g, P, c)).map(c => c.id) : [];
    if (myTurn && g.pending && g.pending.type === 'drawn') playable = playable.filter(id => id === g.pending.card);
    out.me = { id: P.id, hand, playable, myTurn, drawn: g.pending && g.pending.type === 'drawn' && g.pending.pid === pid ? g.pending.card : null, canCall: P.hand.length <= 2 && !P.called && (P.hand.length === 1 || myTurn), called: P.called };
  }
  return out;
}
