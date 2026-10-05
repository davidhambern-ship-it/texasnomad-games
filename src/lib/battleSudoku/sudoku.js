// BattleSudoku — fast Sudoku generator with a guaranteed unique solution.
// Cells are indexed 0..80 (row * 9 + col). 0 = empty.

export function rng(seed) {
  let s = typeof seed === 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const ROW = (i) => Math.floor(i / 9);
export const COL = (i) => i % 9;
export const BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set();
  for (let k = 0; k < 9; k++) { s.add(ROW(i) * 9 + k); s.add(k * 9 + COL(i)); }
  const br = Math.floor(ROW(i) / 3) * 3, bc = Math.floor(COL(i) / 3) * 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s.add((br + r) * 9 + bc + c);
  s.delete(i); return [...s];
});
export const LINES = [
  ...Array.from({ length: 9 }, (_, r) => ({ type: 'row', idx: r, cells: Array.from({ length: 9 }, (_, c) => r * 9 + c) })),
  ...Array.from({ length: 9 }, (_, c) => ({ type: 'col', idx: c, cells: Array.from({ length: 9 }, (_, r) => r * 9 + c) })),
  ...Array.from({ length: 9 }, (_, b) => ({ type: 'box', idx: b, cells: Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)) })),
];
const bit = (d) => 1 << d;
const ALL = 0b1111111110;
const popc = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

function candidates(g, i) { let used = 0; for (const p of PEERS[i]) used |= bit(g[p]); return ALL & ~used; }

// count solutions up to `limit` (MRV backtracking)
export function countSolutions(grid, limit = 2) {
  const g = grid.slice(); let count = 0;
  const solve = () => {
    let best = -1, bestM = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = candidates(g, i), n = popc(m);
      if (n === 0) return false;
      if (n < bestN) { best = i; bestM = m; bestN = n; if (n === 1) break; }
    }
    if (best < 0) { count++; return count >= limit; }
    for (let d = 1; d <= 9; d++) if (bestM & bit(d)) { g[best] = d; if (solve()) return true; }
    g[best] = 0; return false;
  };
  solve();
  return count;
}

function fullGrid(R) {
  const g = new Array(81).fill(0);
  const fill = () => {
    let best = -1, bestM = 0, bestN = 10;
    for (let i = 0; i < 81; i++) { if (g[i]) continue; const m = candidates(g, i), n = popc(m); if (!n) return false; if (n < bestN) { best = i; bestM = m; bestN = n; } }
    if (best < 0) return true;
    const ds = []; for (let d = 1; d <= 9; d++) if (bestM & bit(d)) ds.push(d);
    for (let k = ds.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [ds[k], ds[j]] = [ds[j], ds[k]]; }
    for (const d of ds) { g[best] = d; if (fill()) return true; }
    g[best] = 0; return false;
  };
  fill();
  return g;
}

export const CLUES = { easy: 38, normal: 32, hard: 27 };

// → { puzzle:[81], solution:[81] }
export function makePuzzle(seed, difficulty = 'normal') {
  const R = rng(seed);
  const solution = fullGrid(R);
  const puzzle = solution.slice();
  const target = CLUES[difficulty] || CLUES.normal;
  // remove cells in symmetric pairs while the solution stays unique
  const order = Array.from({ length: 41 }, (_, i) => i);
  for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  let clues = 81;
  for (const i of order) {
    if (clues <= target) break;
    const j = 80 - i;
    const a = puzzle[i], b = puzzle[j];
    puzzle[i] = 0; puzzle[j] = 0;
    if (countSolutions(puzzle, 2) !== 1) { puzzle[i] = a; puzzle[j] = b; continue; }
    clues -= i === j ? 1 : 2;
  }
  return { puzzle, solution };
}
