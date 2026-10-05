// ─────────────────────────────────────────────────────────────────────────────
// Word Wrangler — shared rules engine (browser + server)
//
// Trace any real English word through touching tiles (8 directions). Used tiles
// vanish, the column drops, fresh tiles fall in from the top. Longer words and
// rare letters score more. Special TexasNomad tiles add multipliers and chaos.
//
// Everything here is deterministic from the game seed: the same seed gives the
// same opening board and the same stream of falling letters, so an online race
// is fair ("same tiles, your choices") and the server can replay every move to
// check it. State is plain JSON so it can be stored and sent anywhere.
// ─────────────────────────────────────────────────────────────────────────────

export const SIZE = 7;
export const MIN_LEN = 3;
export const MAX_LEN = 12;
export const ROUND_SECONDS = 150;

export const LETTER_VALUES = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, qu: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10, '*': 0,
};
const BAG = { e: 12, a: 9, i: 8, o: 8, n: 6, r: 6, t: 6, l: 4, s: 5, u: 3, d: 4, g: 3, b: 2, c: 3, m: 2, p: 2, f: 2, h: 3, v: 2, w: 2, y: 2, k: 1, j: 1, x: 1, qu: 1, z: 1 };
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const HARD = new Set(['j', 'qu', 'x', 'z', 'k', 'v']);
const LEN_MULT = [0, 0, 0, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8];

// Special tiles
export const SPECIALS = {
  emerald: { name: 'Emerald', short: '×2', desc: 'Doubles the word' },
  ruby: { name: 'Ruby', short: '×3', desc: 'Triples the word' },
  diamond: { name: 'Diamond', short: '×4', desc: 'Quadruples the word' },
  sapphire: { name: 'Sapphire', short: '+10s', desc: '+10 seconds on the rope (+50 points in a race)' },
  amethyst: { name: 'Amethyst', short: 'WILD', desc: 'Wild gem — counts as any letter' },
  topaz: { name: 'Topaz', short: 'BLAST', desc: 'Blasts its whole row for bonus points' },
  opal: { name: 'Opal', short: 'HINT', desc: 'Reveals the best word on the board' },
  outlaw: { name: 'Outlaw', short: '$', desc: 'Sneaks down each turn — catch him for +50, or he robs 100 points at the bottom' },
};

// ── seeded RNG (mulberry32; state is one uint32) ─────────────────────────────
function rngNext(st) {
  let t = (st.rng = (st.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function seedFrom(x) {
  const s = String(x);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

const clone = (o) => JSON.parse(JSON.stringify(o));
export const tileText = (t) => (t.l === '*' ? '★' : t.l === 'qu' ? 'Qu' : t.l.toUpperCase());

// ── letter drawing with board balance ────────────────────────────────────────
function boardCounts(board) {
  let vowels = 0, total = 0, hard = 0;
  const specials = {};
  for (const row of board) for (const t of row) {
    if (!t) continue;
    total++;
    if (VOWELS.has(t.l)) vowels++;
    if (HARD.has(t.l)) hard++;
    if (t.s) specials[t.s] = (specials[t.s] || 0) + 1;
  }
  return { vowels, total, hard, specials };
}
function drawLetter(st, counts) {
  const ratio = counts.total ? counts.vowels / counts.total : 0.4;
  let pool = Object.entries(BAG);
  if (ratio < 0.34) pool = pool.filter(([l]) => VOWELS.has(l));
  else if (ratio > 0.5) pool = pool.filter(([l]) => !VOWELS.has(l));
  if (counts.hard >= 2) pool = pool.filter(([l]) => !HARD.has(l));
  const sum = pool.reduce((a, [, w]) => a + w, 0);
  let r = rngNext(st) * sum;
  for (const [l, w] of pool) { if ((r -= w) < 0) return l; }
  return pool[pool.length - 1][0];
}
function newTile(st, counts) {
  const l = drawLetter(st, counts);
  counts.total++; if (VOWELS.has(l)) counts.vowels++; if (HARD.has(l)) counts.hard++;
  return { id: st.nextId++, l, s: null };
}

// ── create ──────────────────────────────────────────────────────────────────
export function createGame({ seed = Date.now(), mode = 'timed', size = SIZE } = {}) {
  const st = {
    v: 1, size, mode, seed: seedFrom(seed), rng: seedFrom(seed), nextId: 1,
    board: [], score: 0, words: [], moves: 0, timeBonus: 0, caught: 0, escaped: 0, best: null,
  };
  const counts = { vowels: 0, total: 0, hard: 0, specials: {} };
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(newTile(st, counts));
    st.board.push(row);
  }
  // a couple of friendly specials on the opening board
  placeSpecial(st, 'emerald', allCells(st));
  placeSpecial(st, 'sapphire', allCells(st));
  return st;
}
function allCells(st) { const out = []; for (let r = 0; r < st.size; r++) for (let c = 0; c < st.size; c++) out.push([r, c]); return out; }
function placeSpecial(st, kind, cells) {
  const free = cells.filter(([r, c]) => st.board[r][c] && !st.board[r][c].s);
  if (!free.length) return null;
  const [r, c] = free[Math.floor(rngNext(st) * free.length)];
  const t = st.board[r][c];
  t.s = kind;
  if (kind === 'amethyst') t.l = '*';
  if (kind === 'outlaw') t.fresh = true;
  return [r, c];
}

// ── paths & words ───────────────────────────────────────────────────────────
export const isAdjacent = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;

export function validPath(st, path) {
  if (!Array.isArray(path) || path.length < 1 || path.length > MAX_LEN) return false;
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (!Array.isArray(p) || p.length !== 2) return false;
    const [r, c] = p;
    if (!(r >= 0 && r < st.size && c >= 0 && c < st.size) || !st.board[r][c]) return false;
    const k = r * 32 + c;
    if (seen.has(k)) return false;
    seen.add(k);
    if (i && !isAdjacent(path[i - 1], p)) return false;
  }
  return true;
}
export const pathLetters = (st, path) => path.map(([r, c]) => st.board[r][c].l);
export const pathText = (st, path) => path.map(([r, c]) => tileText(st.board[r][c])).join('');

// Resolve wild tiles; returns the real word (lowercase) or null
export function resolveLetters(letters, dict, used = null) {
  const wild = letters.reduce((n, l) => n + (l === '*'), 0);
  const join = (ls) => ls.join('');
  const ok = (w) => dict.has(w) && !(used && used.has(w));
  if (!wild) { const w = join(letters); return dict.has(w) ? w : null; }
  if (wild > 3) return null;
  const AZ = 'abcdefghijklmnopqrstuvwxyz';
  const idx = letters.map((l, i) => (l === '*' ? i : -1)).filter(i => i >= 0);
  let best = null;
  const tryFill = (k, ls) => {
    if (best) return;
    if (k === idx.length) { const w = join(ls); if (ok(w)) best = w; return; }
    for (const ch of AZ) { ls[idx[k]] = ch; tryFill(k + 1, ls); if (best) return; }
  };
  tryFill(0, letters.slice());
  return best;
}

export function scoreFor(st, path, word) {
  const tiles = path.map(([r, c]) => st.board[r][c]);
  const len = Math.min(word.length, MAX_LEN);
  const base = tiles.reduce((a, t) => a + (LETTER_VALUES[t.l] || 0), 0);
  let mult = 1;
  const notes = [];
  for (const t of tiles) {
    if (t.s === 'emerald') { mult *= 2; notes.push('Emerald ×2'); }
    if (t.s === 'ruby') { mult *= 3; notes.push('Ruby ×3'); }
    if (t.s === 'diamond') { mult *= 4; notes.push('Diamond ×4'); }
  }
  const lm = LEN_MULT[len] || 8;
  const points = Math.round(base * lm) * 10 * mult;
  return { base, lenMult: lm, mult, points, notes };
}

// Check a traced path without changing anything
export function checkWord(st, path, dict) {
  if (!validPath(st, path)) return { ok: false, reason: 'path' };
  const letters = pathLetters(st, path);
  const raw = letters.join('');
  if (raw.replace('*', 'x').length < MIN_LEN) return { ok: false, reason: 'short' };
  const used = new Set(st.words.map(w => w.w));
  const word = resolveLetters(letters, dict, used) || (raw.includes('*') ? resolveLetters(letters, dict) : null);
  if (!word) return { ok: false, reason: 'notword', text: raw };
  if (st.words.some(w => w.w === word)) return { ok: false, reason: 'used', word };
  return { ok: true, word, ...scoreFor(st, path, word) };
}

// ── apply a word (pure; returns a new state) ────────────────────────────────
export function applyWord(prev, path, dict) {
  const chk = checkWord(prev, path, dict);
  if (!chk.ok) return { ok: false, ...chk };
  const st = clone(prev);
  const events = [];
  const tiles = path.map(([r, c]) => st.board[r][c]);
  let points = chk.points;

  // tile powers
  const used = new Set(path.map(([r, c]) => r * 32 + c));
  for (const [r, c] of path) {
    const t = st.board[r][c];
    if (t.s === 'sapphire') {
      if (st.mode === 'timed') { st.timeBonus += 10; events.push({ type: 'time', seconds: 10, r, c }); }
      else { points += 50; events.push({ type: 'gemPoints', points: 50, r, c }); }
    }
    if (t.s === 'outlaw') { points += 50; st.caught++; events.push({ type: 'caught', points: 50, r, c }); }
    if (t.s === 'opal') events.push({ type: 'hint', r, c });
  }
  // topaz: blasts the rest of its row
  for (const [r, c] of path) {
    if (st.board[r][c].s !== 'topaz') continue;
    let n = 0;
    for (let cc = 0; cc < st.size; cc++) {
      const k = r * 32 + cc;
      if (used.has(k) || !st.board[r][cc]) continue;
      const t = st.board[r][cc];
      if (t.s === 'outlaw') { points += 50; st.caught++; events.push({ type: 'caught', points: 50, r, c: cc }); }
      used.add(k); n++;
    }
    if (n) { points += n * 20; events.push({ type: 'blast', row: r, cleared: n, points: n * 20, r, c }); }
  }

  // remove, drop, refill
  const cleared = [...used].map(k => [Math.floor(k / 32), k % 32]);
  for (const [r, c] of cleared) st.board[r][c] = null;
  const fresh = dropAndFill(st);

  // new specials, earned by the word
  const len = chk.word.length;
  const wilds = boardCounts(st.board).specials.amethyst || 0;
  if (len >= 7) { placeSpecial(st, 'diamond', fresh); if (wilds < 2) placeSpecial(st, 'amethyst', fresh); events.push({ type: 'spawn', kind: 'diamond' }); }
  else if (len === 6) { placeSpecial(st, 'ruby', fresh); events.push({ type: 'spawn', kind: 'ruby' }); }
  else if (len === 5) { placeSpecial(st, 'emerald', fresh); events.push({ type: 'spawn', kind: 'emerald' }); }
  const counts = boardCounts(st.board);
  if (rngNext(st) < 0.08 && (counts.specials.sapphire || 0) < 2) placeSpecial(st, 'sapphire', fresh);
  if (rngNext(st) < 0.06 && !counts.specials.topaz) placeSpecial(st, 'topaz', fresh);
  if (rngNext(st) < 0.05 && !counts.specials.opal) placeSpecial(st, 'opal', fresh);
  const outlawChance = len === 3 ? 0.45 : len === 4 ? 0.12 : 0;
  if (rngNext(st) < outlawChance && (counts.specials.outlaw || 0) < 2) {
    const top = fresh.filter(([r]) => r <= 1);
    if (placeSpecial(st, 'outlaw', top.length ? top : fresh)) events.push({ type: 'spawn', kind: 'outlaw' });
  }

  // outlaws sneak down one row
  moveOutlaws(st, events);

  st.score = st.score + points;
  st.moves++;
  const rec = { w: chk.word, p: points, t: pathText(prev, path) };
  st.words.push(rec);
  if (!st.best || points > st.best.p) st.best = rec;
  return { ok: true, state: st, word: chk.word, points, base: chk.base, lenMult: chk.lenMult, mult: chk.mult, notes: chk.notes, events, cleared, fresh };
}

function dropAndFill(st) {
  const fresh = [];
  const counts = boardCounts(st.board);
  for (let c = 0; c < st.size; c++) {
    const col = [];
    for (let r = st.size - 1; r >= 0; r--) if (st.board[r][c]) col.push(st.board[r][c]);
    const missing = st.size - col.length;
    for (let r = st.size - 1, i = 0; r >= 0; r--, i++) st.board[r][c] = i < col.length ? col[i] : null;
    for (let r = 0; r < missing; r++) { st.board[r][c] = newTile(st, counts); fresh.push([r, c]); }
  }
  return fresh;
}

function moveOutlaws(st, events) {
  const list = [];
  for (let r = st.size - 1; r >= 0; r--) for (let c = 0; c < st.size; c++) {
    const t = st.board[r][c];
    if (t && t.s === 'outlaw') { if (t.fresh) { delete t.fresh; continue; } list.push([r, c]); }
  }
  for (const [r, c] of list) {
    const t = st.board[r][c];
    if (r === st.size - 1) {
      const loss = Math.min(100, st.score);
      st.score -= loss; st.escaped++;
      t.s = null;
      events.push({ type: 'escape', points: -loss, r, c });
    } else {
      const below = st.board[r + 1][c];
      st.board[r + 1][c] = t; st.board[r][c] = below;
      events.push({ type: 'sneak', from: [r, c], to: [r + 1, c] });
    }
  }
}

// ── shuffle (costs time in solo, points in a race) ──────────────────────────
export const SHUFFLE_COST = { timed: { seconds: 10 }, race: { points: 50 } };
export function shuffleBoard(prev) {
  const st = clone(prev);
  const tiles = [];
  for (const row of st.board) for (const t of row) tiles.push(t);
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rngNext(st) * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  // swap a few hard consonants for fresh letters so a stuck board really changes
  const counts = boardCounts(st.board);
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!t.s && (HARD.has(t.l) || (!VOWELS.has(t.l) && rngNext(st) < 0.25))) {
      counts.total--; if (VOWELS.has(t.l)) counts.vowels--; if (HARD.has(t.l)) counts.hard--;
      tiles[i] = newTile(st, counts);
    }
  }
  let k = 0;
  for (let r = 0; r < st.size; r++) for (let c = 0; c < st.size; c++) st.board[r][c] = tiles[k++];
  if (st.mode === 'timed') st.timeBonus -= SHUFFLE_COST.timed.seconds;
  else st.score = Math.max(0, st.score - SHUFFLE_COST.race.points);
  st.moves++;
  st.shuffles = (st.shuffles || 0) + 1;
  return st;
}

// ── dictionary helpers ──────────────────────────────────────────────────────
export function buildTrie(words) {
  const root = {};
  for (const w of words) {
    let n = root;
    for (const ch of w) n = n[ch] || (n[ch] = {});
    n.$ = 1;
  }
  return root;
}

// All words currently on the board (best path for each), sorted by points
export function findWords(st, trie, { filter = null, limit = 400, exclude = null } = {}) {
  const found = new Map();
  const N = st.size, B = st.board;
  const seen = new Uint8Array(N * N);
  const path = [];
  const step = (node, r, c, word) => {
    const t = B[r][c];
    if (!t) return;
    const chars = t.l === '*' ? null : t.l; // 'qu' is two characters
    const nexts = [];
    if (chars === null) { for (const ch in node) if (ch !== '$') nexts.push([node[ch], ch]); }
    else {
      let n = node;
      for (const ch of chars) { n = n && n[ch]; }
      if (n) nexts.push([n, chars]);
    }
    if (!nexts.length) return;
    seen[r * N + c] = 1; path.push([r, c]);
    for (const [n, ch] of nexts) {
      const w = word + ch;
      if (n.$ && w.length >= MIN_LEN && (!filter || filter(w)) && !(exclude && exclude.has(w))) {
        const prev = found.get(w);
        const sc = scoreFor(st, path, w).points;
        if (!prev || sc > prev.points) found.set(w, { word: w, path: path.map(p => p.slice()), points: sc });
      }
      if (path.length < MAX_LEN) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= N || cc >= N || seen[rr * N + cc]) continue;
          step(n, rr, cc, w);
        }
      }
    }
    seen[r * N + c] = 0; path.pop();
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) step(trie, r, c, '');
  return [...found.values()].sort((a, b) => b.points - a.points || b.word.length - a.word.length).slice(0, limit);
}

// ── CPU rival ───────────────────────────────────────────────────────────────
// level 1–10. Higher levels spot longer, richer words and play faster.
export function cpuPickWord(st, trie, level, { common = null, rand = Math.random } = {}) {
  const used = new Set(st.words.map(w => w.w));
  const maxLen = Math.min(9, 4 + Math.ceil(level / 2));
  let list = findWords(st, trie, { filter: (w) => w.length <= maxLen && (!common || common.has(w)), exclude: used, limit: 300 });
  if (!list.length) return null;
  // lower levels settle for ordinary words; higher levels hunt the big ones
  const k = level / 2.6;
  const i = Math.floor(Math.pow(rand(), k) * list.length);
  return list[Math.min(list.length - 1, i)];
}
export function cpuDelayMs(level, rand = Math.random) {
  const base = 14500 - level * 850; // avg ≈ lvl 3: 13.7s · lvl 6: 11s · lvl 9: 8.4s per word
  return Math.max(3000, base + rand() * 3500);
}

// Readable summary of a finished game
export function summary(st) {
  const words = st.words.slice();
  const longest = words.reduce((a, w) => (!a || w.w.length > a.w.length ? w : a), null);
  return { score: st.score, words: words.length, best: st.best, longest, caught: st.caught, escaped: st.escaped };
}
