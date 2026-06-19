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
// Computes pixel positions for each tile from the sequence of plays.
// Uses pixel units so tiles are evenly spaced regardless of container size.
// The board component scales these to fit.
//
// Layout: tiles chain left←center→right horizontally.
// Doubles are placed vertically (narrow), non-doubles horizontally.
// Tile pixel sizes (at scale 1):
//   non-double horizontal: W=56, H=28
//   double    vertical:    W=28, H=56

const TW = 56;  // non-double tile width (horizontal)
const TH = 28;  // tile height
const GAP = 4;  // gap between tiles

// Step sizes (center-to-center distance when placing next tile)
const HSTEP = TW + GAP; // horizontal step
const VSTEP = TH + GAP; // vertical step (for top/bottom arms)

/**
 * Compute pixel positions for every tile, relative to the board's virtual canvas.
 * Returns { tiles: [{...piece, px, py, tw, th}], bounds: {minX,minY,maxX,maxY} }
 * px/py = top-left corner of the tile.
 */
export function computeBoardLayout(board) {
  if (!board || board.length === 0) return { tiles: [], bounds: null };

  // Track the "attachment point" (the open edge) for each arm, in pixels.
  // We place a tile such that its connecting edge aligns with the arm's cursor.
  // For left arm: cursor.x is the RIGHT edge of the next tile to place → tile's left = cursor.x - TW
  // For right arm: cursor.x is the LEFT edge of next tile to place

  // Virtual canvas origin: first tile placed at (0, 0)
  const tileData = [];

  // cursors: track where the OPEN EDGE is for each arm
  // left arm: moves in -x direction. cursor.x = next tile's right edge x
  // right arm: moves in +x direction. cursor.x = next tile's left edge x
  // top arm: moves in -y direction. cursor.y = next tile's bottom edge y
  // bottom arm: moves in +y direction. cursor.y = next tile's top edge y

  let leftCursorX = 0;        // left arm: next tile's right edge
  let rightCursorX = 0;       // right arm: next tile's left edge
  let topCursorY = 0;         // top arm: next tile's bottom edge
  let bottomCursorY = 0;      // bottom arm: next tile's top edge
  let spinnerX = 0;           // x center of spinner (for top/bottom arms)

  board.forEach((piece, idx) => {
    const side = piece.side || 'first';
    const isDouble = piece.top === piece.bottom;
    // For doubles: tile is rendered vertically → w=TH, h=TW (narrow and tall)
    // For non-doubles: horizontal → w=TW, h=TH
    const tw = isDouble ? TH : TW;
    const th = isDouble ? TW : TH;

    if (side === 'first') {
      // Center the first tile at origin
      const px = -tw / 2;
      const py = -th / 2;
      tileData.push({ ...piece, px, py, tw, th });

      // Initialize arm cursors from the edges of the first tile
      leftCursorX  = px - GAP;           // left arm: next tile's right edge
      rightCursorX = px + tw + GAP;      // right arm: next tile's left edge
      topCursorY   = py - GAP;           // top arm: next tile's bottom edge
      bottomCursorY= py + th + GAP;      // bottom arm: next tile's top edge
      spinnerX     = px + tw / 2;        // horizontal center of first tile
      return;
    }

    if (side === 'left') {
      const px = leftCursorX - tw;
      const py = -th / 2;
      tileData.push({ ...piece, px, py, tw, th });
      leftCursorX = px - GAP;
      return;
    }

    if (side === 'right') {
      const px = rightCursorX;
      const py = -th / 2;
      tileData.push({ ...piece, px, py, tw, th });
      rightCursorX = px + tw + GAP;
      return;
    }

    if (side === 'top') {
      const px = spinnerX - tw / 2;
      const py = topCursorY - th;
      tileData.push({ ...piece, px, py, tw, th });
      topCursorY = py - GAP;
      return;
    }

    if (side === 'bottom') {
      const px = spinnerX - tw / 2;
      const py = bottomCursorY;
      tileData.push({ ...piece, px, py, tw, th });
      bottomCursorY = py + th + GAP;
      return;
    }

    // Fallback
    tileData.push({ ...piece, px: 0, py: 0, tw, th });
  });

  // Compute bounds
  if (tileData.length === 0) return { tiles: [], bounds: null };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  tileData.forEach(t => {
    minX = Math.min(minX, t.px);
    minY = Math.min(minY, t.py);
    maxX = Math.max(maxX, t.px + t.tw);
    maxY = Math.max(maxY, t.py + t.th);
  });

  return {
    tiles: tileData,
    bounds: { minX, minY, maxX, maxY },
    // Open end positions (for drop zones), in the same virtual pixel space
    openEnds: {
      leftX: leftCursorX - GAP,
      rightX: rightCursorX,
      topY: topCursorY - GAP,
      bottomY: bottomCursorY,
      spinnerX,
    },
  };
}

/**
 * Compute where open-end drop zones are, returning normalized values
 * compatible with the existing interface used by TXDBoard and game pages.
 * Returns { left, right, top?, bottom? } with pixel coords in virtual space.
 */
export function computeOpenEnds(board, leftEnd, rightEnd, spinnerActive) {
  if (!board || board.length === 0) return null;

  const layout = computeBoardLayout(board);
  const oe = layout.openEnds;
  if (!oe) return null;

  const firstPiece = board[0];
  const isFirstDouble = firstPiece && firstPiece.top === firstPiece.bottom;

  function lastOnSide(s) {
    const pieces = board.filter(p => p.side === s);
    return pieces.length > 0 ? pieces[pieces.length - 1] : null;
  }

  const result = {
    left:   { id: 'left',   value: leftEnd,  active: true, _px: oe.leftX,  _py: 0 },
    right:  { id: 'right',  value: rightEnd, active: true, _px: oe.rightX, _py: 0 },
    top:    null,
    bottom: null,
  };

  if (spinnerActive || isFirstDouble) {
    const spinnerVal = firstPiece?.top ?? leftEnd;
    const topLast    = lastOnSide('top');
    const bottomLast = lastOnSide('bottom');
    result.top    = { id: 'top',    value: topLast    ? (topLast.exposedValue    ?? spinnerVal) : spinnerVal, active: true, _px: oe.spinnerX, _py: oe.topY };
    result.bottom = { id: 'bottom', value: bottomLast ? (bottomLast.exposedValue ?? spinnerVal) : spinnerVal, active: true, _px: oe.spinnerX, _py: oe.bottomY };
  }

  return result;
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
  if (side === 'top' || side === 'bottom') return 'vertical';
  return 'horizontal'; // left, right
}

// ── Apply a domino play ───────────────────────────────────────────────────────

export function playDomino(domino, leftEnd, rightEnd, side, spinnerActive = false, openEnds = null, chosenOrientation = null) {
  // First play
  if (side === 'first' || leftEnd === null || rightEnd === null) {
    const isDouble = domino.top === domino.bottom;
    // For doubles on first play, allow caller to choose orientation; default vertical
    const orientation = chosenOrientation || (isDouble ? 'vertical' : 'horizontal');
    return {
      newLeftEnd: domino.top,
      newRightEnd: domino.bottom,
      isSpinner: isDouble,
      newSpinnerActive: isDouble,
      orientedTop: domino.top,
      orientedBottom: domino.bottom,
      exposedValue: isDouble ? domino.top : domino.bottom,
      placedOrientation: orientation,
    };
  }

  // Subsequent plays — resolve end value
  // top/bottom arms connect to the spinner's value; left/right use their respective ends
  let endValue;
  if (openEnds?.[side]?.value !== undefined && openEnds[side].value !== null) {
    endValue = openEnds[side].value;
  } else if (side === 'left') {
    endValue = leftEnd;
  } else if (side === 'right') {
    endValue = rightEnd;
  } else {
    // top or bottom arm — connect to spinner value (first tile's pip value)
    endValue = leftEnd; // spinner value stored as leftEnd initially; openEnds should always be passed for top/bottom
  }

  if (domino.top !== endValue && domino.bottom !== endValue) {
    throw new Error(`Invalid play: ${domino.id} cannot connect to end value ${endValue} on side ${side}`);
  }

  const isDouble = domino.top === domino.bottom;
  const becomesSpinner = isDouble && !spinnerActive;

  // Orient: connecting end faces the spinner, exposed end faces outward
  const connectsWithTop = domino.top === endValue;
  const orientedTop    = connectsWithTop ? domino.top    : domino.bottom;
  const orientedBottom = connectsWithTop ? domino.bottom : domino.top;
  const exposedValue   = isDouble ? domino.top : (connectsWithTop ? domino.bottom : domino.top);

  // Update left/right end values (top/bottom plays don't change left/right ends)
  let newLeftEnd = leftEnd;
  let newRightEnd = rightEnd;
  if (side === 'left')  newLeftEnd  = exposedValue;
  if (side === 'right') newRightEnd = exposedValue;

  return {
    newLeftEnd,
    newRightEnd,
    isSpinner: becomesSpinner,
    newSpinnerActive: spinnerActive || becomesSpinner,
    orientedTop,
    orientedBottom,
    exposedValue,
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