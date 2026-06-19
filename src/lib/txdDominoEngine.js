// ─────────────────────────────────────────────────────────────────────────────
// TXD Domino Engine  —  Texas Double-Six Dominoes
// ─────────────────────────────────────────────────────────────────────────────

// ── Tile set ──────────────────────────────────────────────────────────────────

export const DOMINO_SET = [];
for (let i = 0; i <= 6; i++) {
  for (let j = i; j <= 6; j++) {
    DOMINO_SET.push({ top: i, bottom: j, id: `${i}-${j}` });
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

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

// Find who holds the highest double to start
export function findHighestDoubleStarter(hands) {
  const doubleRank = ['6-6', '5-5', '4-4', '3-3', '2-2', '1-1', '0-0'];
  for (const doubleId of doubleRank) {
    for (let i = 0; i < hands.length; i++) {
      if (hands[i].some(d => d.id === doubleId)) return { playerIndex: i, dominoId: doubleId };
    }
  }
  return null;
}

export function pipTotal(hand) {
  return hand.reduce((sum, d) => sum + d.top + d.bottom, 0);
}

export function calculateRoundScores(players, winnerIndex) {
  let total = 0;
  players.forEach((p, i) => { if (i !== winnerIndex) total += pipTotal(p.hand || []); });
  return total;
}

// ── Play a domino ─────────────────────────────────────────────────────────────
//
// Board state tracks:
//   leftEnd  — pip value exposed on the left arm
//   rightEnd — pip value exposed on the right arm
//   topEnd   — pip value exposed on the top arm (null until spinner played)
//   bottomEnd— pip value exposed on the bottom arm (null until spinner played)
//   spinnerPlayed — boolean, true once a double is on the board
//
// Each board entry: { id, top, bottom, side, orientation, exposedLeft, exposedRight }
//   side: 'first' | 'left' | 'right' | 'top' | 'bottom'
//   orientation: 'horizontal' | 'vertical'
//   exposedLeft / exposedRight: the pip shown at each end for left/right arms
//   (for top/bottom arms the single exposed pip = exposedLeft)

export function playDomino(domino, gameState, side, chosenOrientation = null) {
  const { leftEnd, rightEnd, topEnd, bottomEnd, spinnerPlayed } = gameState;
  const isDouble = domino.top === domino.bottom;

  // ── First play ──
  if (leftEnd === null) {
    const orientation = chosenOrientation || (isDouble ? 'vertical' : 'horizontal');
    // Horizontal: left half shows top pip, right half shows bottom pip
    // For first play, leftEnd = top value, rightEnd = bottom value
    const entry = {
      id: domino.id,
      top: domino.top,
      bottom: domino.bottom,
      side: 'first',
      orientation,
      exposedLeft: domino.top,
      exposedRight: domino.bottom,
    };
    return {
      entry,
      newLeftEnd: domino.top,
      newRightEnd: domino.bottom,
      newTopEnd: isDouble ? domino.top : null,
      newBottomEnd: isDouble ? domino.top : null,
      newSpinnerPlayed: isDouble,
    };
  }

  // ── Subsequent plays ──
  // Determine what pip value this end requires
  const endValue = {
    left:   leftEnd,
    right:  rightEnd,
    top:    topEnd,
    bottom: bottomEnd,
  }[side];

  if (endValue === null || endValue === undefined) {
    throw new Error(`Cannot play on ${side} — that arm is not open`);
  }
  if (domino.top !== endValue && domino.bottom !== endValue) {
    throw new Error(`[${domino.id}] cannot connect to ${side} end (value ${endValue})`);
  }

  // Orient so connecting pip faces inward, exposed pip faces outward
  // connectingPip = the pip touching the existing chain
  const connectingPip = (domino.top === endValue) ? domino.top : domino.bottom;
  const exposedPip    = (domino.top === endValue) ? domino.bottom : domino.top;

  // For doubles the pip value is the same on both ends
  const actualExposed = isDouble ? connectingPip : exposedPip;

  // Orientation: doubles always vertical, top/bottom arms non-doubles always vertical,
  // left/right arms non-doubles always horizontal
  let orientation;
  if (isDouble) {
    orientation = 'vertical';
  } else if (side === 'top' || side === 'bottom') {
    orientation = 'vertical';
  } else {
    orientation = 'horizontal';
  }

  // For the board entry we store oriented top/bottom:
  // horizontal tile: left half = top, right half = bottom
  //   left arm: exposedPip is on the LEFT (outer) side → top=exposedPip, bottom=connectingPip
  //   right arm: exposedPip is on the RIGHT (outer) side → top=connectingPip, bottom=exposedPip
  // vertical tile: top half = top, bottom half = bottom
  //   top arm: exposedPip is on TOP → top=exposedPip, bottom=connectingPip
  //   bottom arm: exposedPip is on BOTTOM → top=connectingPip, bottom=exposedPip

  let entryTop, entryBottom;
  if (isDouble) {
    entryTop = domino.top; entryBottom = domino.bottom;
  } else if (side === 'left') {
    entryTop = exposedPip; entryBottom = connectingPip;
  } else if (side === 'right') {
    entryTop = connectingPip; entryBottom = exposedPip;
  } else if (side === 'top') {
    entryTop = exposedPip; entryBottom = connectingPip;
  } else { // bottom
    entryTop = connectingPip; entryBottom = exposedPip;
  }

  const entry = {
    id: domino.id,
    top: entryTop,
    bottom: entryBottom,
    side,
    orientation,
    exposedLeft: side === 'left' ? actualExposed : null,
    exposedRight: side === 'right' ? actualExposed : null,
  };

  // This double becomes the spinner if it's the first double after the first tile
  const becomesSpinner = isDouble && !spinnerPlayed;

  const newLeftEnd   = side === 'left'   ? actualExposed : leftEnd;
  const newRightEnd  = side === 'right'  ? actualExposed : rightEnd;
  const newTopEnd    = (becomesSpinner)  ? domino.top    : (side === 'top'    ? actualExposed : topEnd);
  const newBottomEnd = (becomesSpinner)  ? domino.top    : (side === 'bottom' ? actualExposed : bottomEnd);

  return {
    entry,
    newLeftEnd,
    newRightEnd,
    newTopEnd,
    newBottomEnd,
    newSpinnerPlayed: spinnerPlayed || becomesSpinner,
  };
}

// ── Legal move detection ──────────────────────────────────────────────────────

// Returns array of { domino, side } for every legal play
export function getLegalMoves(hand, gameState) {
  const { leftEnd, rightEnd, topEnd, bottomEnd } = gameState;

  // First play — anything goes
  if (leftEnd === null) {
    return hand.map(domino => ({ domino, side: 'first' }));
  }

  const openEnds = [
    { side: 'left',   value: leftEnd   },
    { side: 'right',  value: rightEnd  },
    ...(topEnd    !== null && topEnd    !== undefined ? [{ side: 'top',    value: topEnd    }] : []),
    ...(bottomEnd !== null && bottomEnd !== undefined ? [{ side: 'bottom', value: bottomEnd }] : []),
  ];

  const moves = [];
  hand.forEach(domino => {
    openEnds.forEach(({ side, value }) => {
      if (domino.top === value || domino.bottom === value) {
        moves.push({ domino, side });
      }
    });
  });
  return moves;
}

// Which open ends can a specific domino play on?
export function getPlayableEnds(domino, gameState) {
  return getLegalMoves([domino], gameState).map(m => m.side);
}

// ── AI ────────────────────────────────────────────────────────────────────────

export function aiChoosePlay(hand, gameState, startingDominoLocked = null) {
  // First play — must play startingDominoLocked if set
  if (gameState.leftEnd === null) {
    if (startingDominoLocked) {
      const locked = hand.find(d => d.id === startingDominoLocked);
      if (locked) return { domino: locked, side: 'first' };
    }
    // Play highest double, else highest pip total
    const doubles = hand.filter(d => d.top === d.bottom).sort((a, b) => b.top - a.top);
    if (doubles.length > 0) return { domino: doubles[0], side: 'first' };
    const sorted = [...hand].sort((a, b) => (b.top + b.bottom) - (a.top + a.bottom));
    return sorted.length ? { domino: sorted[0], side: 'first' } : null;
  }

  const moves = getLegalMoves(hand, gameState);
  if (moves.length === 0) return null;
  // Play highest pip total
  moves.sort((a, b) => (b.domino.top + b.domino.bottom) - (a.domino.top + a.domino.bottom));
  return moves[0];
}

// Draw from boneyard — returns the drawn domino or null if boneyard empty
export function drawFromBoneyard(boneyard) {
  if (!boneyard || boneyard.length === 0) return { drawn: null, newBoneyard: boneyard };
  const newBoneyard = [...boneyard];
  const drawn = newBoneyard.pop();
  return { drawn, newBoneyard };
}

// Check if a player is blocked (no legal moves, boneyard empty)
export function isBlocked(hand, gameState, boneyardCount) {
  if (boneyardCount > 0) return false;
  return getLegalMoves(hand, gameState).length === 0;
}