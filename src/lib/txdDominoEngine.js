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

// Deal tiles — 7 each, remainder is boneyard
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
//
// Coordinate system: percentages (0-100) of the board container.
// STEP_H / STEP_V = how far to advance the center point per tile placed.

const STEP_H = 18; // % board width per horizontal step
const STEP_V = 18; // % board height per vertical step

const TABLE_BOUNDS = { minX: 14, maxX: 86, minY: 16, maxY: 84 };

// Given an open end, advance its position one step in the arm's direction.
// Turns at table boundaries so tiles wrap around the edge.
function advanceEnd(end) {
  let dir = end.direction;
  let nx = end.x + (dir === 'left' ? -STEP_H : dir === 'right' ? STEP_H : 0);
  let ny = end.y + (dir === 'up' ? -STEP_V : dir === 'down' ? STEP_V : 0);

  // Boundary wrap: turn the arm
  if (nx < TABLE_BOUNDS.minX || nx > TABLE_BOUNDS.maxX) {
    dir = end.y <= 50 ? 'down' : 'up';
    nx = end.x;
    ny = end.y + (dir === 'down' ? STEP_V : -STEP_V);
  }
  if (ny < TABLE_BOUNDS.minY || ny > TABLE_BOUNDS.maxY) {
    dir = end.x <= 50 ? 'right' : 'left';
    ny = end.y;
    nx = end.x + (dir === 'right' ? STEP_H : -STEP_H);
  }

  return { ...end, x: nx, y: ny, direction: dir };
}

/**
 * Build open-ends for the first domino (always placed at center).
 * A double (spinner) opens 4 arms. A non-double opens left + right only.
 * Each open end represents where the NEXT tile in that arm will land.
 */
export function buildOpenEndsForOpening(domino) {
  const isDouble = domino.top === domino.bottom;
  const cx = 50, cy = 50;

  if (isDouble) {
    return {
      left:   { id: 'left',   value: domino.top, x: cx - STEP_H, y: cy,          direction: 'left',  active: true },
      right:  { id: 'right',  value: domino.top, x: cx + STEP_H, y: cy,          direction: 'right', active: true },
      top:    { id: 'top',    value: domino.top, x: cx,          y: cy - STEP_V, direction: 'up',    active: true },
      bottom: { id: 'bottom', value: domino.top, x: cx,          y: cy + STEP_V, direction: 'down',  active: true },
    };
  }
  // Non-double: left arm value = top pip (left half), right arm value = bottom pip (right half)
  return {
    left:   { id: 'left',   value: domino.top,    x: cx - STEP_H, y: cy, direction: 'left',  active: true },
    right:  { id: 'right',  value: domino.bottom, x: cx + STEP_H, y: cy, direction: 'right', active: true },
    top:    null,
    bottom: null,
  };
}

export function activateSpinnerEnds(openEnds, spinnerValue) {
  const updated = { ...openEnds };
  if (!updated.top) {
    updated.top    = { id: 'top',    value: spinnerValue, x: 50, y: 50 - STEP_V, direction: 'up',   active: true };
    updated.bottom = { id: 'bottom', value: spinnerValue, x: 50, y: 50 + STEP_V, direction: 'down', active: true };
  }
  return updated;
}

/**
 * Orient a domino so the matching pip faces the chain (inward)
 * and returns what value is now exposed outward.
 */
export function orientDominoForEnd(domino, side, endValue) {
  const { top, bottom } = domino;
  if (side === 'first' || endValue === null) {
    return { connectingValue: null, exposedValue: bottom, orientedTop: top, orientedBottom: bottom };
  }
  // Doubles always expose the same pip regardless of direction
  if (top === bottom) {
    return { connectingValue: top, exposedValue: top, orientedTop: top, orientedBottom: bottom };
  }
  if (side === 'left') {
    // Left arm grows left; the tile's right (bottom) side connects inward
    if (bottom === endValue) {
      return { connectingValue: bottom, exposedValue: top, orientedTop: top, orientedBottom: bottom };
    } else {
      return { connectingValue: top, exposedValue: bottom, orientedTop: bottom, orientedBottom: top };
    }
  }
  // right / top / bottom: tile's left (top) side connects inward
  if (top === endValue) {
    return { connectingValue: top, exposedValue: bottom, orientedTop: top, orientedBottom: bottom };
  } else {
    return { connectingValue: bottom, exposedValue: top, orientedTop: bottom, orientedBottom: top };
  }
}

function getTileOrientation(isDouble, direction) {
  if (isDouble) return 'vertical';
  if (direction === 'left' || direction === 'right') return 'horizontal';
  return 'vertical';
}

/**
 * Apply a domino play. Returns updated openEnds + board-entry data.
 * side = 'first' | 'left' | 'right' | 'top' | 'bottom'
 */
export function playDomino(domino, leftEnd, rightEnd, side, spinnerActive = false, openEnds = null) {
  // ── First play ──
  if (side === 'first' || leftEnd === null || rightEnd === null) {
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
      placedX: 50,
      placedY: 50,
      placedOrientation: isDouble ? 'vertical' : 'horizontal',
    };
  }

  // ── Subsequent play ──
  // Resolve the end object and its required match value
  const endObj = openEnds?.[side] || null;
  const endValue = endObj?.value ?? (side === 'left' ? leftEnd : rightEnd);

  if (domino.top !== endValue && domino.bottom !== endValue) {
    throw new Error(`Invalid play: ${domino.id} cannot connect to end value ${endValue} on side ${side}`);
  }

  const isDouble = domino.top === domino.bottom;
  const becomesSpinner = isDouble && !spinnerActive;
  const oriented = orientDominoForEnd(domino, side, endValue);

  // Tile is placed at the open end's current position
  const placedX = endObj?.x ?? 50;
  const placedY = endObj?.y ?? 50;
  const placedOrientation = getTileOrientation(isDouble, endObj?.direction || side);

  // Advance the open end one step forward
  let newOpenEnds = openEnds ? { ...openEnds } : {
    left:   { id: 'left',   value: leftEnd,  x: 50 - STEP_H, y: 50, direction: 'left',  active: true },
    right:  { id: 'right',  value: rightEnd, x: 50 + STEP_H, y: 50, direction: 'right', active: true },
    top:    null,
    bottom: null,
  };

  if (newOpenEnds[side]) {
    const advanced = advanceEnd({ ...newOpenEnds[side], value: oriented.exposedValue });
    newOpenEnds[side] = { ...advanced, value: oriented.exposedValue, active: true };
  }

  const newLeftEnd  = newOpenEnds.left?.active  ? newOpenEnds.left.value  : leftEnd;
  const newRightEnd = newOpenEnds.right?.active ? newOpenEnds.right.value : rightEnd;

  return {
    newLeftEnd,
    newRightEnd,
    isSpinner: becomesSpinner,
    newSpinnerActive: spinnerActive || becomesSpinner,
    orientedTop: oriented.orientedTop,
    orientedBottom: oriented.orientedBottom,
    exposedValue: oriented.exposedValue,
    newOpenEnds,
    placedX,
    placedY,
    placedOrientation,
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function pipTotal(hand) {
  return hand.reduce((sum, d) => sum + d.top + d.bottom, 0);
}

export function calculateRoundScores(players, winnerIndex) {
  let total = 0;
  players.forEach((p, i) => {
    if (i !== winnerIndex) total += pipTotal(p.hand || []);
  });
  return total;
}

// ── Legal move detection ──────────────────────────────────────────────────────

/**
 * Returns all valid moves for a hand given the current open ends.
 * Each move: { dominoId, endId, requiredValue, domino }
 */
export function getLegalMoves(hand, openEnds, leftEnd = null, rightEnd = null) {
  // No board yet — any tile can start
  if (!openEnds && leftEnd === null) {
    return hand.map(domino => ({ dominoId: domino.id, endId: 'first', requiredValue: null, domino }));
  }

  // openEnds is the primary source; fall back to leftEnd/rightEnd if openEnds is missing
  const activeEnds = openEnds
    ? Object.entries(openEnds).filter(([, end]) => end && end.active)
    : [
        ...(leftEnd  !== null ? [['left',  { value: leftEnd  }]] : []),
        ...(rightEnd !== null ? [['right', { value: rightEnd }]] : []),
      ];

  const moves = [];
  hand.forEach(domino => {
    activeEnds.forEach(([endId, end]) => {
      if (domino.top === end.value || domino.bottom === end.value) {
        moves.push({ dominoId: domino.id, endId, requiredValue: end.value, domino });
      }
    });
  });
  return moves;
}

/**
 * Returns which end IDs a given domino can legally play on.
 */
export function getPlayableEndsForDomino(domino, openEnds) {
  if (!openEnds) return ['first'];
  return Object.entries(openEnds)
    .filter(([, end]) => end && end.active && (domino.top === end.value || domino.bottom === end.value))
    .map(([endId]) => endId);
}

// ── Legacy helpers (used by AI and blocking checks) ───────────────────────────

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
    return playableEnds[0];
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

export function aiChoosePlay(hand, leftEnd, rightEnd, startingDominoLocked = null, openEnds = null) {
  // First play of the round
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

  // Use openEnds when available (preferred — accurate legal move detection)
  if (openEnds) {
    const moves = getLegalMoves(hand, openEnds);
    if (moves.length === 0) return null;
    const sorted = [...moves].sort((a, b) => (b.domino.top + b.domino.bottom) - (a.domino.top + a.domino.bottom));
    return { domino: sorted[0].domino, side: sorted[0].endId };
  }

  // Fallback: use leftEnd/rightEnd directly
  const playable = getPlayableDominoes(hand, leftEnd, rightEnd);
  if (playable.length === 0) return null;
  const sorted = [...playable].sort((a, b) => (b.top + b.bottom) - (a.top + a.bottom));
  const domino = sorted[0];
  const side = getPlaySide(domino, leftEnd, rightEnd);
  return { domino, side: side === 'both' ? 'right' : side };
}