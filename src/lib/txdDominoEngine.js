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
// Each "arm" of the chain grows in a direction.
//
// A non-double domino is laid HORIZONTALLY (wide): orientation='horizontal', rotation=0
//   → occupies ~13% width × ~7% height
// A double domino is laid VERTICALLY (tall): orientation='vertical', rotation=0
//   → occupies ~7% width × ~13% height
//
// STEP_H = how far to advance the center point along the horizontal axis per tile
// STEP_V = how far to advance along the vertical axis per tile

const STEP_H = 14; // % board width per horizontal step
const STEP_V = 14; // % board height per vertical step

const TABLE_BOUNDS = { minX: 12, maxX: 88, minY: 15, maxY: 85 };

// Returns the CSS rotation for a tile on a given arm direction.
// Non-doubles are horizontal (no rotation). Doubles are vertical (no rotation either — 
// they're rendered with orientation='vertical' which already shows them tall).
function tileRotation(isDouble) {
  return 0; // handled by orientation prop, not CSS rotation
}

// Given an open end, advance it one step in its direction.
// Wraps/turns at table boundaries.
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
 * Build initial open-ends for the first domino placed at center (50, 50).
 *
 * The open ends represent WHERE THE NEXT TILE will be placed (the drop zone).
 * A spinner (double) opens 4 arms. A non-double opens left + right only.
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
 * Orient a domino so the matching pip faces the chain (inward),
 * and the exposed pip faces outward as the new open end value.
 */
export function orientDominoForEnd(domino, side, endValue) {
  const { top, bottom } = domino;
  if (side === 'first' || endValue === null) {
    return { connectingValue: null, exposedValue: bottom, orientedTop: top, orientedBottom: bottom };
  }
  if (side === 'left') {
    // Left arm grows leftward. The right side of the new tile connects to the chain.
    // bottom connects → exposed = top; else top connects → exposed = bottom
    if (bottom === endValue) {
      return { connectingValue: bottom, exposedValue: top, orientedTop: top, orientedBottom: bottom };
    } else {
      return { connectingValue: top, exposedValue: bottom, orientedTop: bottom, orientedBottom: top };
    }
  }
  // right / up / down: top side connects to chain
  if (top === endValue) {
    return { connectingValue: top, exposedValue: bottom, orientedTop: top, orientedBottom: bottom };
  } else {
    return { connectingValue: bottom, exposedValue: top, orientedTop: bottom, orientedBottom: top };
  }
}

/**
 * Determine the visual orientation for a tile on a given arm direction.
 * - Doubles are always 'vertical' (tall) regardless of direction.
 * - Non-doubles on left/right arms are 'horizontal' (wide).
 * - Non-doubles on up/down arms are 'vertical' (tall).
 */
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
  if (leftEnd === null || rightEnd === null || side === 'first') {
    const isDouble = domino.top === domino.bottom;
    const newOpenEnds = buildOpenEndsForOpening(domino);
    const orientation = isDouble ? 'vertical' : 'horizontal';
    return {
      newLeftEnd: domino.top,
      newRightEnd: domino.bottom,
      isSpinner: isDouble,
      newSpinnerActive: isDouble,
      orientedTop: domino.top,
      orientedBottom: domino.bottom,
      exposedValue: isDouble ? domino.top : domino.bottom,
      newOpenEnds,
      // First tile always goes to center
      placedX: 50,
      placedY: 50,
      placedOrientation: orientation,
    };
  }

  // ── Subsequent play ──
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

  // The tile is placed AT the current open end position
  const placedX = endObj?.x ?? 50;
  const placedY = endObj?.y ?? 50;
  const placedOrientation = getTileOrientation(isDouble, endObj?.direction || side);

  // Advance the open end one step further
  let newOpenEnds = openEnds ? { ...openEnds } : null;
  let newLeftEnd = leftEnd;
  let newRightEnd = rightEnd;

  if (newOpenEnds && newOpenEnds[side]) {
    const advanced = advanceEnd({ ...newOpenEnds[side], value: oriented.exposedValue });
    newOpenEnds[side] = { ...advanced, value: oriented.exposedValue, active: true };
    newLeftEnd  = newOpenEnds.left  ? newOpenEnds.left.value  : leftEnd;
    newRightEnd = newOpenEnds.right ? newOpenEnds.right.value : rightEnd;
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

export function getLegalMoves(hand, openEnds) {
  if (!openEnds) {
    return hand.map(domino => ({ dominoId: domino.id, endId: 'first', requiredValue: null, domino }));
  }
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

export function getPlayableEndsForDomino(domino, openEnds) {
  if (!openEnds) return ['first'];
  return Object.entries(openEnds)
    .filter(([, end]) => end && end.active && (domino.top === end.value || domino.bottom === end.value))
    .map(([endId]) => endId);
}

// ── Legacy helpers ────────────────────────────────────────────────────────────

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