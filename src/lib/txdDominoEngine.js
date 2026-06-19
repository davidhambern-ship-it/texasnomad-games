// TXD Domino Engine — core game logic for Texas Dominoes

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

export function deal(set, playerCount) {
  const shuffled = shuffle(set);
  const handSize = 7;
  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(shuffled.slice(i * handSize, (i + 1) * handSize));
  }
  return { hands, boneyard: shuffled.slice(playerCount * handSize) };
}

export function findHighestDoubleStarter(hands) {
  const doubleRank = ['6-6', '5-5', '4-4', '3-3', '2-2', '1-1', '0-0'];
  for (const doubleId of doubleRank) {
    for (let i = 0; i < hands.length; i++) {
      if (hands[i].some(d => d.id === doubleId)) return { playerIndex: i, dominoId: doubleId };
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

// ── Board layout engine ───────────────────────────────────────────────────────
//
// Instead of storing x/y positions in the DB (fragile with JSON round-trips),
// we COMPUTE positions from the board array at render time.
//
// Each board entry has: { id, top, bottom, side, placedOrientation }
// We track 4 "cursors" (left/right/top/bottom) starting from center.

const STEP = 18; // % of board dimension per tile
const CX = 50, CY = 50; // center

/**
 * Compute the {x, y} position for every tile on the board, derived purely
 * from the sequence of plays (no stored coordinates needed).
 *
 * Returns an array of { ...piece, x, y } in the same order as board[].
 */
export function computeBoardLayout(board) {
  if (!board || board.length === 0) return [];

  // Cursors track the NEXT available position in each arm.
  // After placing a tile at cursor, advance cursor by STEP in that direction.
  const cursors = {
    first: { x: CX, y: CY },
    left:  { x: CX - STEP, y: CY,      dx: -STEP, dy: 0 },
    right: { x: CX + STEP, y: CY,      dx:  STEP, dy: 0 },
    top:   { x: CX,        y: CY - STEP, dx: 0, dy: -STEP },
    bottom:{ x: CX,        y: CY + STEP, dx: 0, dy:  STEP },
  };

  const result = [];

  board.forEach((piece) => {
    const side = piece.side || 'first';

    if (side === 'first') {
      result.push({ ...piece, x: CX, y: CY });
      // First tile occupies center — arms start at ±STEP from center
      // (cursors already initialized correctly above)
      return;
    }

    const cursor = cursors[side];
    if (!cursor) {
      result.push({ ...piece, x: CX, y: CY });
      return;
    }

    // Clamp to table bounds
    const bx = Math.max(10, Math.min(90, cursor.x));
    const by = Math.max(12, Math.min(88, cursor.y));
    result.push({ ...piece, x: bx, y: by });

    // Advance cursor
    cursor.x += cursor.dx;
    cursor.y += cursor.dy;

    // Simple wrap: if we hit a wall, turn 90° inward
    if (cursor.x < 10 || cursor.x > 90) {
      cursor.dx = 0;
      cursor.dy = STEP * (cursor.y < 50 ? 1 : -1);
      cursor.x = Math.max(10, Math.min(90, cursor.x));
    }
    if (cursor.y < 12 || cursor.y > 88) {
      cursor.dy = 0;
      cursor.dx = STEP * (cursor.x < 50 ? 1 : -1);
      cursor.y = Math.max(12, Math.min(88, cursor.y));
    }
  });

  return result;
}

/**
 * Compute where the open-end drop zones should appear, based on the current
 * cursor positions AFTER all tiles have been placed.
 * Returns { left, right, top, bottom } — same shape as before, but derived
 * from board state, not stored in DB.
 */
export function computeOpenEnds(board, leftEnd, rightEnd, spinnerActive) {
  if (!board || board.length === 0) return null;

  // Re-run the cursor simulation to find where each arm is now
  const cursors = {
    left:   { x: CX - STEP, y: CY,       dx: -STEP, dy: 0 },
    right:  { x: CX + STEP, y: CY,       dx:  STEP, dy: 0 },
    top:    { x: CX,        y: CY - STEP, dx: 0, dy: -STEP },
    bottom: { x: CX,        y: CY + STEP, dx: 0, dy:  STEP },
  };

  // Track which arms are active
  let topActive = false;
  let bottomActive = false;

  board.forEach((piece) => {
    const side = piece.side || 'first';
    if (side === 'first') {
      // First tile is a spinner → all 4 arms active
      if (piece.top === piece.bottom) {
        topActive = true;
        bottomActive = true;
      }
      return;
    }
    if (side === 'top') topActive = true;
    if (side === 'bottom') bottomActive = true;

    const cursor = cursors[side];
    if (!cursor) return;
    cursor.x += cursor.dx;
    cursor.y += cursor.dy;
    if (cursor.x < 10 || cursor.x > 90) {
      cursor.dx = 0;
      cursor.dy = STEP * (cursor.y < 50 ? 1 : -1);
      cursor.x = Math.max(10, Math.min(90, cursor.x));
    }
    if (cursor.y < 12 || cursor.y > 88) {
      cursor.dy = 0;
      cursor.dx = STEP * (cursor.x < 50 ? 1 : -1);
      cursor.y = Math.max(12, Math.min(88, cursor.y));
    }
  });

  // Determine open end values from board edges
  // leftEnd/rightEnd from game state are the authoritative values
  const firstPiece = board[0];
  const isFirstDouble = firstPiece && firstPiece.top === firstPiece.bottom;

  // Find the last tile played on each arm to get its exposed value
  function lastOnSide(s) {
    const pieces = board.filter(p => p.side === s);
    return pieces.length > 0 ? pieces[pieces.length - 1] : null;
  }

  // Exposed value = the "outer" pip of the last tile on that arm
  // We use leftEnd/rightEnd from game state as the authoritative source
  const openEnds = {
    left:   { id: 'left',   value: leftEnd,  x: Math.max(10, Math.min(90, cursors.left.x)),   y: Math.max(12, Math.min(88, cursors.left.y)),   active: true },
    right:  { id: 'right',  value: rightEnd, x: Math.max(10, Math.min(90, cursors.right.x)),  y: Math.max(12, Math.min(88, cursors.right.y)),  active: true },
    top:    null,
    bottom: null,
  };

  // Top/bottom arms open if spinner played
  if (spinnerActive || topActive || isFirstDouble) {
    // Get the value exposed at top/bottom — it's the spinner's value if nothing played there yet
    const topLast = lastOnSide('top');
    const bottomLast = lastOnSide('bottom');
    const spinnerVal = firstPiece?.top ?? leftEnd;

    openEnds.top    = { id: 'top',    value: topLast    ? topLast.exposedValue    ?? spinnerVal : spinnerVal, x: Math.max(10, Math.min(90, cursors.top.x)),    y: Math.max(12, Math.min(88, cursors.top.y)),    active: true };
    openEnds.bottom = { id: 'bottom', value: bottomLast ? bottomLast.exposedValue ?? spinnerVal : spinnerVal, x: Math.max(10, Math.min(90, cursors.bottom.x)), y: Math.max(12, Math.min(88, cursors.bottom.y)), active: true };
  }

  return openEnds;
}

// ── Orient a domino for a given end ──────────────────────────────────────────

export function orientDominoForEnd(domino, side, endValue) {
  const { top, bottom } = domino;
  if (side === 'first' || endValue === null) {
    return { connectingValue: null, exposedValue: bottom, orientedTop: top, orientedBottom: bottom };
  }
  if (top === bottom) {
    return { connectingValue: top, exposedValue: top, orientedTop: top, orientedBottom: bottom };
  }
  if (side === 'left') {
    if (bottom === endValue) return { connectingValue: bottom, exposedValue: top,    orientedTop: top,    orientedBottom: bottom };
    else                     return { connectingValue: top,    exposedValue: bottom, orientedTop: bottom, orientedBottom: top };
  }
  if (top === endValue) return { connectingValue: top,    exposedValue: bottom, orientedTop: top,    orientedBottom: bottom };
  else                  return { connectingValue: bottom, exposedValue: top,    orientedTop: bottom, orientedBottom: top };
}

function getTileOrientation(isDouble, side) {
  if (isDouble) return 'vertical';
  if (side === 'left' || side === 'right') return 'horizontal';
  return 'vertical';
}

// ── Apply a domino play ───────────────────────────────────────────────────────

export function playDomino(domino, leftEnd, rightEnd, side, spinnerActive = false, openEnds = null) {
  // First play
  if (side === 'first' || leftEnd === null || rightEnd === null) {
    const isDouble = domino.top === domino.bottom;
    return {
      newLeftEnd: domino.top,
      newRightEnd: domino.bottom,
      isSpinner: isDouble,
      newSpinnerActive: isDouble,
      orientedTop: domino.top,
      orientedBottom: domino.bottom,
      exposedValue: isDouble ? domino.top : domino.bottom,
      placedOrientation: isDouble ? 'vertical' : 'horizontal',
    };
  }

  // Subsequent plays — resolve end value
  const endValue = openEnds?.[side]?.value ?? (side === 'left' ? leftEnd : rightEnd);

  if (domino.top !== endValue && domino.bottom !== endValue) {
    throw new Error(`Invalid play: ${domino.id} cannot connect to end value ${endValue} on side ${side}`);
  }

  const isDouble = domino.top === domino.bottom;
  const becomesSpinner = isDouble && !spinnerActive;
  const oriented = orientDominoForEnd(domino, side, endValue);

  // Update left/right end values
  let newLeftEnd = leftEnd;
  let newRightEnd = rightEnd;
  if (side === 'left')   newLeftEnd  = oriented.exposedValue;
  if (side === 'right')  newRightEnd = oriented.exposedValue;

  return {
    newLeftEnd,
    newRightEnd,
    isSpinner: becomesSpinner,
    newSpinnerActive: spinnerActive || becomesSpinner,
    orientedTop: oriented.orientedTop,
    orientedBottom: oriented.orientedBottom,
    exposedValue: oriented.exposedValue,
    placedOrientation: getTileOrientation(isDouble, side),
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function pipTotal(hand) {
  return hand.reduce((sum, d) => sum + d.top + d.bottom, 0);
}

export function calculateRoundScores(players, winnerIndex) {
  let total = 0;
  players.forEach((p, i) => { if (i !== winnerIndex) total += pipTotal(p.hand || []); });
  return total;
}

// ── Legal move detection ──────────────────────────────────────────────────────

export function getLegalMoves(hand, openEnds, leftEnd = null, rightEnd = null) {
  if (!openEnds && leftEnd === null) {
    return hand.map(domino => ({ dominoId: domino.id, endId: 'first', requiredValue: null, domino }));
  }
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
    const ends = getPlayableEndsForDomino(domino, openEnds);
    if (ends.length === 0) return null;
    if (ends.length > 1) return 'both';
    return ends[0];
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
  return { domino, side: side === 'both' ? 'right' : side };
}