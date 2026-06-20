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

// Find who holds the highest double (goes first)
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
  // (standard spinner rule: must close left & right before playing top/bottom)
  const spinnerPlayedOn = { left: false, right: false };
  if (spinner) {
    board.forEach(t => {
      if (t.side === 'left')  spinnerPlayedOn.left  = true;
      if (t.side === 'right') spinnerPlayedOn.right = true;
    });
    // If spinner IS the first tile, left/right are already "open"
    if (spinner.side === 'first') {
      spinnerPlayedOn.left  = board.some(t => t.side === 'left');
      spinnerPlayedOn.right = board.some(t => t.side === 'right');
    }
  }
  const armsOpen = spinner && spinnerPlayedOn.left && spinnerPlayedOn.right;

  return {
    left:       leftTile.leftPip,
    right:      rightTile.rightPip,
    top:        armsOpen ? (topTile    ? topTile.topPip    : spinner.a) : null,
    bottom:     armsOpen ? (bottomTile ? bottomTile.botPip : spinner.a) : null,
    hasSpinner: !!spinner,
    armsOpen,
  };
}

// Can this domino play on this end value?
export function canFit(domino, endValue) {
  return domino.a === endValue || domino.b === endValue;
}

// Get all legal (domino, side) pairs for a hand
export function getLegalMoves(hand, board) {
  const ends = getOpenEnds(board);
  if (board.length === 0) {
    return hand.map(d => ({ domino: d, side: 'first' }));
  }
  const moves = [];
  hand.forEach(domino => {
    if (ends.left !== null && canFit(domino, ends.left))   moves.push({ domino, side: 'left'   });
    if (ends.right !== null && canFit(domino, ends.right)) moves.push({ domino, side: 'right'  });
    if (ends.top !== null && canFit(domino, ends.top))     moves.push({ domino, side: 'top'    });
    if (ends.bottom !== null && canFit(domino, ends.bottom)) moves.push({ domino, side: 'bottom' });
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

// Build the board entry for a played domino
export function buildEntry(domino, side, board) {
  const isDouble = domino.a === domino.b;
  const ends = getOpenEnds(board);

  if (side === 'first') {
    // First tile: if it's a double it becomes the spinner immediately
    const orientation = isDouble ? 'v' : 'h';
    return {
      id: domino.id, a: domino.a, b: domino.b, side,
      orientation,
      leftPip:  domino.a,
      rightPip: isDouble ? domino.a : domino.b,
      topPip:   isDouble ? domino.a : null,
      botPip:   isDouble ? domino.a : null,
      isSpinner: isDouble,
    };
  }

  const endValue = ends[side];
  // Orient so the connecting pip faces the chain, exposed pip faces outward
  const connectingIsA = domino.a === endValue;
  const innerPip = connectingIsA ? domino.a : domino.b;
  const outerPip = connectingIsA ? domino.b : domino.a;

  // A double becomes the spinner if there isn't one yet (first tile already handled above)
  const isSpinner = isDouble && !ends.hasSpinner && side !== 'top' && side !== 'bottom';

  if (side === 'left') {
    // a=outerPip (left/exposed), b=innerPip (right/connecting) — matches visual rendering
    return {
      id: domino.id,
      a: outerPip, b: innerPip,
      side, orientation: isDouble ? 'v' : 'h',
      leftPip:  outerPip,
      rightPip: innerPip,
      topPip:   isDouble ? innerPip : null,
      botPip:   isDouble ? innerPip : null,
      isSpinner,
    };
  }
  if (side === 'right') {
    // a=innerPip (left/connecting), b=outerPip (right/exposed) — matches visual rendering
    return {
      id: domino.id,
      a: innerPip, b: outerPip,
      side, orientation: isDouble ? 'v' : 'h',
      leftPip:  innerPip,
      rightPip: outerPip,
      topPip:   isDouble ? innerPip : null,
      botPip:   isDouble ? innerPip : null,
      isSpinner,
    };
  }
  // top: a=outerPip (top/exposed), b=innerPip (bottom/connecting)
  if (side === 'top') {
    return {
      id: domino.id,
      a: outerPip, b: innerPip,
      side, orientation: 'v',
      leftPip: null, rightPip: null,
      topPip:  outerPip,
      botPip:  innerPip,
      isSpinner: false,
    };
  }
  // bottom: a=innerPip (top/connecting), b=outerPip (bottom/exposed)
  return {
    id: domino.id,
    a: innerPip, b: outerPip,
    side, orientation: 'v',
    leftPip: null, rightPip: null,
    topPip:  innerPip,
    botPip:  outerPip,
    isSpinner: false,
  };
}

// ── Scoring ────────────────────────────────────────────────────────────────

export function pipCount(hand) {
  return hand.reduce((s, d) => s + d.a + d.b, 0);
}

// Returns points earned by the winning team this round
export function calcRoundPoints(players, winnerSeat) {
  const losingTeam = 1 - getTeam(winnerSeat);
  return players
    .filter((_, i) => getTeam(i) === losingTeam)
    .reduce((s, p) => s + pipCount(p.hand || []), 0);
}

// Check if game is blocked (no one can play, boneyard empty)
export function isBlocked(players, board) {
  return players.every(p => getLegalMoves(p.hand || [], board).length === 0);
}