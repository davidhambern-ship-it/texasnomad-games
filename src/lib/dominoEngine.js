// ─────────────────────────────────────────────────────────────────────────────
// Draw Dominoes Engine  —  Double-Six, 2v2 Partners
// ─────────────────────────────────────────────────────────────────────────────

export const FULL_SET = [];
for (let i = 0; i <= 6; i++)
  for (let j = i; j <= 6; j++)
    FULL_SET.push({ id: `${i}-${j}`, a: i, b: j });

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deal 7 tiles to each of 4 players
export function dealHands() {
  const shuffled = shuffle(FULL_SET);
  return {
    hands: [
      shuffled.slice(0, 7),
      shuffled.slice(7, 14),
      shuffled.slice(14, 21),
      shuffled.slice(21, 28),
    ],
    boneyard: [], // all 28 go to players in a 4-player game
  };
}

// Partners: seats 0&2 vs seats 1&3
export function getTeam(seatIndex) {
  return seatIndex % 2; // 0 = Team A, 1 = Team B
}

// Find who holds the highest double (goes first in round 1)
export function findStarter(hands) {
  const doubles = ['6-6','5-5','4-4','3-3','2-2','1-1','0-0'];
  for (const id of doubles) {
    for (let i = 0; i < hands.length; i++) {
      if (hands[i].some(d => d.id === id)) return { playerIndex: i, dominoId: id };
    }
  }
  // No doubles — player with highest total pip goes first
  let best = -1, bestIdx = 0;
  hands.forEach((h, i) => {
    const total = h.reduce((s, d) => s + d.a + d.b, 0);
    if (total > best) { best = total; bestIdx = i; }
  });
  return { playerIndex: bestIdx, dominoId: null };
}

// Find the player who dominoed out (won the last round) — they start next round
export function findRoundWinnerSeat(players, winnerSeat) {
  return winnerSeat;
}

// ── Bounded table placement ─────────────────────────────────────────────────
// Coordinates are percentages (0-100) inside a fixed square board layer.
// The renderer maps this square into the table; branches turn at the bounds.
const TBL = { minX: 12, maxX: 88, minY: 14, maxY: 86 };
const DOMINO_NARROW = 4.5;  // narrow dimension of a domino (coord units)
const DOMINO_LONG = 9;      // long dimension of a domino (coord units)

const DIRS = {
  left:   { sx: -1, sy: 0,  rot: 90, orient: 'h' },
  right:  { sx:  1, sy: 0,  rot: 90, orient: 'h' },
  top:    { sx:  0, sy: -1, rot: 0,  orient: 'v' },
  bottom: { sx:  0, sy:  1, rot: 0,  orient: 'v' },
};

function insideTable(x, y) {
  return x >= TBL.minX && x <= TBL.maxX && y >= TBL.minY && y <= TBL.maxY;
}

function isOccupied(board, x, y) {
  return board.some(t => {
    if (t.x == null) return false;
    const horiz = t.rot === 90;
    const halfW = (horiz ? DOMINO_LONG : DOMINO_NARROW) / 2;
    const halfH = (horiz ? DOMINO_NARROW : DOMINO_LONG) / 2;
    return Math.abs(t.x - x) < halfW + 0.6 && Math.abs(t.y - y) < halfH + 0.6;
  });
}

// Half the extent of a tile along a given chain direction.
function halfLenAlong(orientation, dir) {
  const horiz = dir === 'left' || dir === 'right';
  if (horiz) return orientation === 'h' ? DOMINO_LONG / 2 : DOMINO_NARROW / 2;
  return orientation === 'v' ? DOMINO_LONG / 2 : DOMINO_NARROW / 2;
}

// Turn a branch inward when it would cross a table edge.
function turnDirection(dir, x, y) {
  if (dir === 'left' || dir === 'right') return y < 50 ? 'bottom' : 'top';
  return x < 50 ? 'right' : 'left';
}

// Find the next growth direction (after any turn) for a domino extending from (ex,ey).
// Probes with the maximum possible step so smaller real steps also fit.
function findNextDirection(board, ex, ey, edir) {
  const probe = (dir) => {
    const d = DIRS[dir];
    return { x: ex + d.sx * DOMINO_LONG, y: ey + d.sy * DOMINO_LONG };
  };
  let p = probe(edir);
  if (insideTable(p.x, p.y) && !isOccupied(board, p.x, p.y)) return edir;
  const td = turnDirection(edir, ex, ey);
  p = probe(td);
  if (insideTable(p.x, p.y) && !isOccupied(board, p.x, p.y)) return td;
  for (const name of ['right', 'bottom', 'left', 'top']) {
    if (name === edir || name === td) continue;
    p = probe(name);
    if (insideTable(p.x, p.y) && !isOccupied(board, p.x, p.y)) return name;
  }
  return edir;
}

// ── Board state ────────────────────────────────────────────────────────────

// A board entry: { id, a, b, side, orientation, leftPip, rightPip }
// orientation: 'h' (horizontal) or 'v' (vertical, for doubles)
// leftPip / rightPip: the pip exposed at each end of THIS tile in the chain direction

export function getOpenEnds(board) {
  if (board.length === 0) return { left: null, right: null, top: null, bottom: null };

  // Spinner = first double played anywhere in the chain (including as the opening tile)
  const spinnerIdx = board.findIndex(t => t.isSpinner);
  const spinner    = spinnerIdx >= 0 ? board[spinnerIdx] : null;

  // Left end: last tile played to the left (or the first tile if none)
  const leftTiles  = board.filter(t => t.side === 'left');
  const rightTiles = board.filter(t => t.side === 'right');
  const firstTile  = board[0];
  const leftTile   = leftTiles.length  ? leftTiles[leftTiles.length - 1]   : firstTile;
  const rightTile  = rightTiles.length ? rightTiles[rightTiles.length - 1] : firstTile;

  // Top/bottom ends: last tile played on each arm
  const topTiles    = board.filter(t => t.side === 'top');
  const bottomTiles = board.filter(t => t.side === 'bottom');
  const topTile    = topTiles.length    ? topTiles[topTiles.length - 1]       : null;
  const bottomTile = bottomTiles.length ? bottomTiles[bottomTiles.length - 1] : null;

  // Top/bottom arms open only after the spinner has tiles on both left AND right
  const spinnerPlayedOn = { left: false, right: false };
  if (spinner) {
    board.forEach(t => {
      if (t.side === 'left')  spinnerPlayedOn.left  = true;
      if (t.side === 'right') spinnerPlayedOn.right = true;
    });
    if (spinner.side === 'first') {
      spinnerPlayedOn.left  = board.some(t => t.side === 'left');
      spinnerPlayedOn.right = board.some(t => t.side === 'right');
    }
  }
  const armsOpen = spinner && spinnerPlayedOn.left && spinnerPlayedOn.right;

  // Returns the actual pip value exposed at an open end (used for matching).
  const endPip = (tile, side) => {
    if (!tile) return null;
    if (tile.isSpinner && armsOpen) return null;
    if (tile.a === tile.b) return tile.a;
    if (side === 'left')   return tile.leftPip;
    if (side === 'right')  return tile.rightPip;
    if (side === 'top')    return tile.topPip;
    if (side === 'bottom') return tile.botPip;
    return null;
  };

  // Returns the SCORING value for an end (doubles count both pips).
  const endScore = (tile, side) => {
    if (!tile) return null;
    const pip = endPip(tile, side);
    if (pip === null) return null;
    const isDouble = tile.a === tile.b;
    if (!isDouble) return pip;
    if (tile.isSpinner) {
      const bothSidesOpen = !spinnerPlayedOn.left && !spinnerPlayedOn.right;
      return bothSidesOpen ? pip : pip * 2;
    }
    return pip * 2;
  };

  // Empty arms still expose the spinner pip for MATCHING (you can play on them),
  // but they do NOT count toward the board score until a tile is placed there.
  const armPip  = (tile, side) => tile ? endPip(tile, side)   : (spinner ? spinner.a : null);
  const armScore = (tile, side) => tile ? endScore(tile, side) : null;

  // Position (x,y in 0-100 coords + growth direction) for each open end
  const posOf = (tile, fallbackDir) => ({ x: tile.x ?? 50, y: tile.y ?? 50, dir: tile.dir ?? fallbackDir, orientation: tile.orientation });
  const leftPos  = leftTiles.length  ? posOf(leftTile, 'left')   : posOf(firstTile, 'left');
  const rightPos = rightTiles.length ? posOf(rightTile, 'right') : posOf(firstTile, 'right');
  let topPos = null, bottomPos = null;
  if (armsOpen) {
    topPos    = topTile    ? posOf(topTile, 'top')        : posOf(spinner, 'top');
    bottomPos = bottomTile ? posOf(bottomTile, 'bottom') : posOf(spinner, 'bottom');
  }

  // Drop-zone positions: offset just past the end tile's edge so the indicator
  // never sits on top of the end tile (e.g. the spinner when a side is empty).
  const DROP_GAP = 3.5; // ~half the drop-zone size in coord units
  const dropPos = (tile, fallbackDir) => {
    const dir = tile.dir ?? fallbackDir;
    const half = halfLenAlong(tile.orientation, dir);
    const d = DIRS[dir];
    return { x: (tile.x ?? 50) + d.sx * (half + DROP_GAP), y: (tile.y ?? 50) + d.sy * (half + DROP_GAP) };
  };
  const leftDrop  = leftTiles.length  ? dropPos(leftTile, 'left')   : dropPos(firstTile, 'left');
  const rightDrop = rightTiles.length ? dropPos(rightTile, 'right') : dropPos(firstTile, 'right');
  let topDrop = null, bottomDrop = null;
  if (armsOpen) {
    topDrop    = topTile    ? dropPos(topTile, 'top')        : dropPos(spinner, 'top');
    bottomDrop = bottomTile ? dropPos(bottomTile, 'bottom') : dropPos(spinner, 'bottom');
  }

  return {
    left:       endPip(leftTile, 'left'),
    right:      endPip(rightTile, 'right'),
    top:        armsOpen ? armPip(topTile, 'top')         : null,
    bottom:     armsOpen ? armPip(bottomTile, 'bottom')   : null,
    leftScore:  endScore(leftTile, 'left'),
    rightScore: endScore(rightTile, 'right'),
    topScore:   armsOpen ? armScore(topTile, 'top')       : null,
    bottomScore:armsOpen ? armScore(bottomTile, 'bottom') : null,
    leftPos, rightPos, topPos, bottomPos,
    leftDrop, rightDrop, topDrop, bottomDrop,
    hasSpinner: !!spinner,
    armsOpen,
  };
}

// Can this domino play on this end value?
export function canFit(domino, endValue) {
  return domino.a === endValue || domino.b === endValue;
}

// Get all legal (domino, side) pairs for a hand — deduplicated by (id, side)
export function getLegalMoves(hand, board) {
  const ends = getOpenEnds(board);
  if (board.length === 0) {
    return hand.map(d => ({ domino: d, side: 'first' }));
  }
  const seen = new Set();
  const moves = [];
  hand.forEach(domino => {
    const add = (side) => {
      const key = `${domino.id}:${side}`;
      if (!seen.has(key)) { seen.add(key); moves.push({ domino, side }); }
    };
    if (ends.left   !== null && canFit(domino, ends.left))   add('left');
    if (ends.right  !== null && canFit(domino, ends.right))  add('right');
    if (ends.top    !== null && canFit(domino, ends.top))    add('top');
    if (ends.bottom !== null && canFit(domino, ends.bottom)) add('bottom');
  });
  return moves;
}

export function getPlayableEnds(domino, board) {
  const ends = getOpenEnds(board);
  if (board.length === 0) return ['first'];
  const result = [];
  if (ends.left !== null && canFit(domino, ends.left))     result.push('left');
  if (ends.right !== null && canFit(domino, ends.right))   result.push('right');
  if (ends.top !== null && canFit(domino, ends.top))       result.push('top');
  if (ends.bottom !== null && canFit(domino, ends.bottom)) result.push('bottom');
  return result;
}

// Build the board entry for a played domino.
// Preserves original a/b; adds `flip` (bool) so the renderer knows to swap display order.
// Pip tracking uses explicit leftPip/rightPip/topPip/botPip fields.
export function buildEntry(domino, side, board) {
  const isDouble = domino.a === domino.b;
  const ends = getOpenEnds(board);

  if (side === 'first') {
    const orientation = isDouble ? 'v' : 'h';
    const rot = isDouble ? 0 : 90;
    return {
      id: domino.id, a: domino.a, b: domino.b, side,
      orientation, flip: false, rot,
      x: 50, y: 50, dir: null,
      leftPip:  domino.a,
      rightPip: isDouble ? domino.a : domino.b,
      topPip:   isDouble ? domino.a : null,
      botPip:   isDouble ? domino.a : null,
      isSpinner: isDouble,
    };
  }

  const endValue = ends[side];
  const connectingIsA = domino.a === endValue;
  const innerPip = connectingIsA ? domino.a : domino.b; // connects to chain
  const outerPip = connectingIsA ? domino.b : domino.a; // exposed outward

  const isSpinner = isDouble && !ends.hasSpinner && side !== 'top' && side !== 'bottom';

  // Route the next position inside the bounded table (turns at edges / around blocks)
  const pos = ends[side + 'Pos'] || { x: 50, y: 50, dir: side, orientation: 'h' };
  const nd = findNextDirection(board, pos.x, pos.y, pos.dir);
  // Doubles are placed perpendicular to the chain (crosswise); the spinner is
  // always vertical so its arms can branch up/down.
  const perpDouble = isDouble && !isSpinner;
  const rot = isSpinner ? 0 : (perpDouble ? (DIRS[nd].rot === 90 ? 0 : 90) : DIRS[nd].rot);
  const orientation = isSpinner ? 'v' : (perpDouble ? (DIRS[nd].orient === 'h' ? 'v' : 'h') : DIRS[nd].orient);
  const flip = (nd === 'right' || nd === 'top') ? connectingIsA : !connectingIsA;

  // Edge-to-edge step: half-length of the end tile + half-length of the new tile
  const endOrient = pos.orientation || (pos.dir === 'left' || pos.dir === 'right' ? 'h' : 'v');
  const step = halfLenAlong(endOrient, nd) + halfLenAlong(orientation, nd);
  const d = DIRS[nd];
  const nx = pos.x + d.sx * step;
  const ny = pos.y + d.sy * step;

  const entry = {
    id: domino.id, a: domino.a, b: domino.b, side,
    orientation, flip, rot,
    x: nx, y: ny, dir: nd,
    isSpinner,
  };

  if (isSpinner) {
    // Spinner (double): perpendicular, all four faces show the same pip
    entry.leftPip = domino.a; entry.rightPip = domino.a;
    entry.topPip = domino.a; entry.botPip = domino.a;
  } else if (nd === 'left' || nd === 'right') {
    entry.leftPip  = (nd === 'left') ? outerPip : innerPip;
    entry.rightPip = (nd === 'left') ? innerPip : outerPip;
    entry.topPip   = isDouble ? outerPip : null;
    entry.botPip   = isDouble ? outerPip : null;
  } else { // top / bottom
    entry.leftPip = null; entry.rightPip = null;
    entry.topPip = (nd === 'top') ? outerPip : innerPip;
    entry.botPip = (nd === 'top') ? innerPip : outerPip;
  }
  return entry;
}

// ── Scoring ────────────────────────────────────────────────────────────────

export function pipCount(hand) {
  return hand.reduce((s, d) => s + d.a + d.b, 0);
}

// Points scored after placing a tile: sum of all open ends, rounded to nearest 5.
// Returns 0 if not a multiple of 5.
export function calcEndScore(board) {
  const ends = getOpenEnds(board);
  let total = 0;
  if (ends.leftScore   !== null && ends.leftScore   !== undefined) total += ends.leftScore;
  if (ends.rightScore  !== null && ends.rightScore  !== undefined) total += ends.rightScore;
  if (ends.topScore    !== null && ends.topScore    !== undefined) total += ends.topScore;
  if (ends.bottomScore !== null && ends.bottomScore !== undefined) total += ends.bottomScore;
  return total % 5 === 0 ? total : 0;
}

// Returns points earned by the winning team at round end (loser pips, rounded to nearest 5)
export function calcRoundPoints(players, winnerSeat) {
  const losingTeam = 1 - getTeam(winnerSeat);
  const raw = players
    .filter((_, i) => getTeam(i) === losingTeam)
    .reduce((s, p) => s + pipCount(p.hand || []), 0);
  return Math.round(raw / 5) * 5;
}

// Check if game is blocked (no one can play, boneyard empty)
export function isBlocked(players, board) {
  return players.every(p => getLegalMoves(p.hand || [], board).length === 0);
}