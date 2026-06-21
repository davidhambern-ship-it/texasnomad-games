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

  // Helper: pip score for an end tile on a given side.
  // - Doubles on an open end count both pips (e.g. 6-6 = 12).
  // - The spinner is interior once arms are open — don't count it for left/right.
  const endScore = (tile, side) => {
    if (!tile) return null;
    const isDouble = tile.a === tile.b;
    // Spinner with arms open is fully interior — not an open end
    if (tile.isSpinner && armsOpen) return null;
    // Doubles count both halves
    if (isDouble) return tile.a * 2;
    // Normal tile: exposed pip on the relevant side
    if (side === 'left')   return tile.leftPip;
    if (side === 'right')  return tile.rightPip;
    if (side === 'top')    return tile.topPip;
    if (side === 'bottom') return tile.botPip;
    return null;
  };

  // Arm end: outermost tile on arm, or spinner itself (a double = both pips) if arm empty
  const armScore = (tile, side) => {
    if (tile) return endScore(tile, side);
    return spinner ? spinner.a * 2 : null;
  };

  return {
    left:       endScore(leftTile, 'left'),
    right:      endScore(rightTile, 'right'),
    top:        armsOpen ? armScore(topTile, 'top')       : null,
    bottom:     armsOpen ? armScore(bottomTile, 'bottom') : null,
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
    return {
      id: domino.id, a: domino.a, b: domino.b, side,
      orientation, flip: false,
      leftPip:  domino.a,
      rightPip: isDouble ? domino.a : domino.b,
      topPip:   isDouble ? domino.a : null,
      botPip:   isDouble ? domino.a : null,
      isSpinner: isDouble,
    };
  }

  const endValue = ends[side];
  // connectingIsA: is domino.a the pip that connects to the open end?
  const connectingIsA = domino.a === endValue;
  const innerPip = connectingIsA ? domino.a : domino.b; // connects to chain
  const outerPip = connectingIsA ? domino.b : domino.a; // exposed outward

  const isSpinner = isDouble && !ends.hasSpinner && side !== 'top' && side !== 'bottom';

  if (side === 'left' || side === 'right') {
    // Chain runs horizontally — doubles should be vertical (perpendicular to chain).
    const orientation = isDouble ? 'v' : 'h';
    // DominoTile horizontal uses rotate(90deg): a(top→RIGHT), b(bottom→LEFT) visually.
    // So visually: LEFT=b, RIGHT=a.
    // We need outerPip on the exposed side, innerPip on the connecting side.
    // For left side: outerPip on LEFT means outerPip must equal b visually.
    // For right side: outerPip on RIGHT means outerPip must equal a visually.
    const flip = side === 'left' ? !connectingIsA : connectingIsA;
    return {
      id: domino.id, a: domino.a, b: domino.b, side,
      orientation, flip,
      leftPip:  side === 'left' ? outerPip : innerPip,
      rightPip: side === 'left' ? innerPip : outerPip,
      topPip:   isDouble ? outerPip : null,
      botPip:   isDouble ? outerPip : null,
      isSpinner,
    };
  }
  if (side === 'top' || side === 'bottom') {
    // Chain runs vertically — doubles should be horizontal (perpendicular to chain).
    const orientation = isDouble ? 'h' : 'v';
    // DominoTile vertical: a=TOP, b=BOTTOM. No rotation.
    // For top side: outerPip on TOP means outerPip must equal a.
    // For bottom side: outerPip on BOTTOM means outerPip must equal b.
    const flip = side === 'top' ? connectingIsA : !connectingIsA;
    return {
      id: domino.id, a: domino.a, b: domino.b, side,
      orientation, flip,
      leftPip: null, rightPip: null,
      topPip:  side === 'top' ? outerPip : innerPip,
      botPip:  side === 'top' ? innerPip : outerPip,
      isSpinner: false,
    };
  }
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
  if (ends.left   !== null) total += ends.left;
  if (ends.right  !== null) total += ends.right;
  if (ends.top    !== null) total += ends.top;
  if (ends.bottom !== null) total += ends.bottom;
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