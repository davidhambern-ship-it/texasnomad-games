// TXD Domino Engine — core game logic for Texas Dominoes

// Build the full double-6 set with IDs
export const DOMINO_SET = [];
for (let i = 0; i <= 6; i++) {
  for (let j = i; j <= 6; j++) {
    DOMINO_SET.push({ top: i, bottom: j, id: `${i}-${j}` });
  }
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'TXD' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deal tiles — 7 each, remainder is boneyard (empty for 4 players)
export function deal(set, playerCount) {
  const shuffled = shuffle(set);
  const handSize = 7;
  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(shuffled.slice(i * handSize, (i + 1) * handSize));
  }
  const boneyard = shuffled.slice(playerCount * handSize);
  return { hands, boneyard };
}

export function findHighestDoubleStarter(hands) {
  const doubleRank = ['6-6', '5-5', '4-4', '3-3', '2-2', '1-1', '0-0'];
  for (const doubleId of doubleRank) {
    for (let i = 0; i < hands.length; i++) {
      if (hands[i].some(d => d.id === doubleId)) {
        return { playerIndex: i, dominoId: doubleId };
      }
    }
  }
  return null;
}

export function findDoubleSixHolder(hands) {
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].some(d => d.id === '6-6')) return i;
  }
  return -1;
}

// ── Board placement engine ────────────────────────────────────────────────────

const TABLE_BOUNDS = { minX: 8, maxX: 92, minY: 12, maxY: 88 };

// Step sizes in % units for each orientation
const STEP_H = 7;  // horizontal tile width step
const STEP_V = 9;  // vertical tile height step

const DIR = {
  left:  { dx: -STEP_H, dy: 0,       rotation: 90  },
  right: { dx:  STEP_H, dy: 0,       rotation: 90  },
  up:    { dx: 0,       dy: -STEP_V, rotation: 0   },
  down:  { dx: 0,       dy:  STEP_V, rotation: 0   },
};

function oppositeDir(dir) {
  return { left: 'right', right: 'left', up: 'down', down: 'up' }[dir];
}

// After placing a tile, compute where the next tile in this branch should go.
// If it would overflow the table bounds, turn the branch.
function advanceEnd(end) {
  let dir = end.direction;
  let nx = end.x + DIR[dir].dx;
  let ny = end.y + DIR[dir].dy;

  // Would overflow? Turn the branch inward.
  if (nx < TABLE_BOUNDS.minX || nx > TABLE_BOUNDS.maxX) {
    dir = end.y <= 50 ? 'down' : 'up';
    nx = end.x + DIR[dir].dx;
    ny = end.y + DIR[dir].dy;
  }
  if (ny < TABLE_BOUNDS.minY || ny > TABLE_BOUNDS.maxY) {
    dir = end.x <= 50 ? 'right' : 'left';
    nx = end.x + DIR[dir].dx;
    ny = end.y + DIR[dir].dy;
  }

  return {
    ...end,
    x: nx,
    y: ny,
    direction: dir,
    rotation: DIR[dir].rotation,
  };
}

/**
 * Build the initial open-ends object for the opening domino.
 * Returns { left, right, top, bottom } — top/bottom only active for a spinner (double).
 */
export function buildOpenEndsForOpening(domino) {
  const isDouble = domino.top === domino.bottom;
  const cx = 50, cy = 50;

  if (isDouble) {
    // Spinner: 4 open ends
    return {
      left:   { id: 'left',   value: domino.top,    x: cx - STEP_H, y: cy,          direction: 'left',  rotation: DIR.left.rotation,  active: true },
      right:  { id: 'right',  value: domino.top,    x: cx + STEP_H, y: cy,          direction: 'right', rotation: DIR.right.rotation, active: true },
      top:    { id: 'top',    value: domino.top,    x: cx,          y: cy - STEP_V, direction: 'up',    rotation: DIR.up.rotation,    active: true },
      bottom: { id: 'bottom', value: domino.top,    x: cx,          y: cy + STEP_V, direction: 'down',  rotation: DIR.down.rotation,  active: true },
    };
  }
  // Non-double: left + right only
  return {
    left:   { id: 'left',   value: domino.top,    x: cx - STEP_H, y: cy, direction: 'left',  rotation: DIR.left.rotation,  active: true },
    right:  { id: 'right',  value: domino.bottom, x: cx + STEP_H, y: cy, direction: 'right', rotation: DIR.right.rotation, active: true },
    top:    null,
    bottom: null,
  };
}

/**
 * Activate top/bottom ends on the spinner if a spinner exists and those ends aren't yet active.
 * Called after the first non-double is placed (spinner rules: top/bottom open after left+right played).
 */
export function activateSpinnerEnds(openEnds, spinnerValue) {
  const updated = { ...openEnds };
  if (!updated.top) {
    updated.top    = { id: 'top',    value: spinnerValue, x: 50, y: 50 - STEP_V, direction: 'up',   rotation: DIR.up.rotation,   active: true };
    updated.bottom = { id: 'bottom', value: spinnerValue, x: 50, y: 50 + STEP_V, direction: 'down', rotation: DIR.down.rotation, active: true };
  }
  return updated;
}

/**
 * Orient a domino so the matching pip faces inward (connects to open end),
 * exposed pip faces outward (becomes new open end value).
 */
export function orientDominoForEnd(domino, side, endValue) {
  const { top, bottom } = domino;
  if (side === 'first' || endValue === null) {
    return { connectingValue: null, exposedValue: bottom, orientedTop: top, orientedBottom: bottom };
  }
  if (side === 'left') {
    if (bottom === endValue) {
      return { connectingValue: bottom, exposedValue: top, orientedTop: top, orientedBottom: bottom };
    } else {
      return { connectingValue: top, exposedValue: bottom, orientedTop: bottom, orientedBottom: top };
    }
  }
  // right / up / down — same logic: connecting touches open end, exposed faces outward
  if (top === endValue) {
    return { connectingValue: top, exposedValue: bottom, orientedTop: top, orientedBottom: bottom };
  } else {
    return { connectingValue: bottom, exposedValue: top, orientedTop: bottom, orientedBottom: top };
  }
}

/**
 * Apply a domino play. Returns updated openEnds + board-entry data.
 * side = 'first' | 'left' | 'right' | 'top' | 'bottom'
 */
export function playDomino(domino, leftEnd, rightEnd, side, spinnerActive = false, openEnds = null) {
  // First play
  if (leftEnd === null || rightEnd === null || side === 'first') {
    const isDouble = domino.top === domino.bottom;
    const newOpenEnds = buildOpenEndsForOpening(domino);
    return {
      newLeftEnd: domino.top,
      newRightEnd: domino.bottom,
      isSpinner: isDouble,
      newSpinnerActive: isDouble,
      orientedTop: domino.top,
      orientedBottom: domino.bottom,
      exposedValue: isDouble ? domino.top : domino.bottom,
      newOpenEnds,
    };
  }

  // Resolve end value from openEnds or fallback to leftEnd/rightEnd
  let endValue;
  let endObj = null;
  if (openEnds && openEnds[side]) {
    endObj = openEnds[side];
    endValue = endObj.value;
  } else {
    endValue = side === 'left' ? leftEnd : rightEnd;
  }

  if (domino.top !== endValue && domino.bottom !== endValue) {
    throw new Error(`Invalid play: ${domino.top}-${domino.bottom} cannot be played on end value ${endValue}`);
  }

  const isDouble = domino.top === domino.bottom;
  const becomesSpinner = isDouble && !spinnerActive;
  const oriented = orientDominoForEnd(domino, side === 'top' || side === 'bottom' ? 'right' : side, endValue);

  // Update open ends
  let newOpenEnds = openEnds ? { ...openEnds } : null;
  let newLeftEnd = leftEnd;
  let newRightEnd = rightEnd;

  if (newOpenEnds) {
    const currentEnd = newOpenEnds[side];
    if (currentEnd) {
      const advanced = advanceEnd({ ...currentEnd, value: oriented.exposedValue });
      newOpenEnds[side] = { ...advanced, value: oriented.exposedValue, active: true };
    }
    newLeftEnd  = newOpenEnds.left   ? newOpenEnds.left.value   : leftEnd;
    newRightEnd = newOpenEnds.right  ? newOpenEnds.right.value  : rightEnd;
  } else {
    if (side === 'left')  newLeftEnd  = oriented.exposedValue;
    if (side === 'right') newRightEnd = oriented.exposedValue;
  }

  return {
    newLeftEnd,
    newRightEnd,
    isSpinner: becomesSpinner,
    newSpinnerActive: spinnerActive || becomesSpinner,
    orientedTop: oriented.orientedTop,
    orientedBottom: oriented.orientedBottom,
    exposedValue: oriented.exposedValue,
    newOpenEnds,
    placedX: endObj?.x ?? null,
    placedY: endObj?.y ?? null,
    placedRotation: endObj?.rotation ?? null,
  };
}

// Sum of pips on a hand
export function pipTotal(hand) {
  return hand.reduce((sum, d) => sum + d.top + d.bottom, 0);
}

// Calculate round score: winner earns pip total of all other players' hands
export function calculateRoundScores(players, winnerIndex) {
  let total = 0;
  players.forEach((p, i) => {
    if (i !== winnerIndex) total += pipTotal(p.hand || []);
  });
  return total;
}

// ── Legal move detection ──────────────────────────────────────────────────────

/**
 * Returns all legal moves for a hand against the current open ends.
 * Each move: { dominoId, endId, requiredValue, domino }
 */
export function getLegalMoves(hand, openEnds) {
  if (!openEnds) return [];
  const moves = [];
  hand.forEach(domino => {
    Object.entries(openEnds).forEach(([endId, end]) => {
      if (!end || !end.active) return;
      if (domino.top === end.value || domino.bottom === end.value) {
        moves.push({ dominoId: domino.id, endId, requiredValue: end.value, domino });
      }
    });
  });
  return moves;
}

/**
 * Get playable end IDs for a specific domino.
 */
export function getPlayableEndsForDomino(domino, openEnds) {
  if (!openEnds) return [];
  return Object.entries(openEnds)
    .filter(([, end]) => end && end.active && (domino.top === end.value || domino.bottom === end.value))
    .map(([endId]) => endId);
}

// ── Legacy helpers (kept for AI + compatibility) ──────────────────────────────

export function canPlay(domino, leftEnd, rightEnd) {
  if (leftEnd === null || rightEnd === null) return true;
  return domino.top === leftEnd || domino.bottom === leftEnd ||
         domino.top === rightEnd || domino.bottom === rightEnd;
}

export function getPlaySide(domino, leftEnd, rightEnd, openEnds = null) {
  if (leftEnd === null || rightEnd === null) return 'first';
  if (openEnds) {
    const playableEnds = getPlayableEndsForDomino(domino, openEnds);
    if (playableEnds.length === 0) return null;
    if (playableEnds.length > 1) return 'both';
    return playableEnds[0]; // 'left' | 'right' | 'top' | 'bottom'
  }
  const fitsLeft  = domino.top === leftEnd  || domino.bottom === leftEnd;
  const fitsRight = domino.top === rightEnd || domino.bottom === rightEnd;
  if (fitsLeft && fitsRight) return 'both';
  if (fitsLeft) return 'left';
  if (fitsRight) return 'right';
  return null;
}

export function getPlayableDominoes(hand, leftEnd, rightEnd) {
  return hand.filter(d => canPlay(d, leftEnd, rightEnd));
}

export function checkBlocked(players, leftEnd, rightEnd, boneyardCount) {
  if (boneyardCount > 0) return false;
  return players.every(p => getPlayableDominoes(p.hand || [], leftEnd, rightEnd).length === 0);
}

/**
 * AI: pick the best move using open ends when available.
 */
export function aiChoosePlay(hand, leftEnd, rightEnd, startingDominoLocked = null, openEnds = null) {
  if (leftEnd === null && rightEnd === null) {
    if (startingDominoLocked) {
      const locked = hand.find(d => d.id === startingDominoLocked);
      if (locked) return { domino: locked, side: 'first' };
    }
    const doubles = hand.filter(d => d.top === d.bottom).sort((a, b) => b.top - a.top);
    if (doubles.length > 0) return { domino: doubles[0], side: 'first' };
    const sorted = [...hand].sort((a, b) => (b.top + b.bottom) - (a.top + a.bottom));
    return sorted.length ? { domino: sorted[0], side: 'first' } : null;
  }

  if (openEnds) {
    const moves = getLegalMoves(hand, openEnds);
    if (moves.length === 0) return null;
    // Pick highest pip move
    const sorted = [...moves].sort((a, b) => (b.domino.top + b.domino.bottom) - (a.domino.top + a.domino.bottom));
    return { domino: sorted[0].domino, side: sorted[0].endId };
  }

  const playable = getPlayableDominoes(hand, leftEnd, rightEnd);
  if (playable.length === 0) return null;
  const sorted = [...playable].sort((a, b) => (b.top + b.bottom) - (a.top + a.bottom));
  const domino = sorted[0];
  const side = getPlaySide(domino, leftEnd, rightEnd);
  const resolvedSide = side === 'both' ? 'right' : side;
  return { domino, side: resolvedSide };
}