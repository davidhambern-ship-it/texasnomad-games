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

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deal tiles to players (7 each for 2-3 players, 5 each for 4)
export function deal(set, playerCount) {
  const shuffled = shuffle(set);
  const handSize = playerCount <= 3 ? 7 : 5;
  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(shuffled.slice(i * handSize, (i + 1) * handSize));
  }
  const boneyard = shuffled.slice(playerCount * handSize);
  return { hands, boneyard };
}

/**
 * Find the player index & domino that should start the first hand.
 * Checks doubles in order: 6-6, 5-5, 4-4, 3-3, 2-2, 1-1, 0-0
 * Returns { playerIndex, dominoId } or null if no doubles dealt.
 */
export function findHighestDoubleStarter(hands) {
  const doubleRank = ['6-6', '5-5', '4-4', '3-3', '2-2', '1-1', '0-0'];
  for (const doubleId of doubleRank) {
    for (let i = 0; i < hands.length; i++) {
      if (hands[i].some(d => d.id === doubleId)) {
        return { playerIndex: i, dominoId: doubleId };
      }
    }
  }
  return null; // no doubles — redeal
}

// Legacy alias used in older host/game code (kept for compatibility)
export function findDoubleSixHolder(hands) {
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].some(d => d.id === '6-6')) return i;
  }
  return -1;
}

// Check if a domino can be played on the current board
export function canPlay(domino, leftEnd, rightEnd) {
  if (leftEnd === null || rightEnd === null) return true; // first play
  return domino.top === leftEnd || domino.bottom === leftEnd ||
         domino.top === rightEnd || domino.bottom === rightEnd;
}

// Get the side a domino should be played on ('left', 'right', 'both', or null)
export function getPlaySide(domino, leftEnd, rightEnd) {
  if (leftEnd === null || rightEnd === null) return 'first';
  const fitsLeft = domino.top === leftEnd || domino.bottom === leftEnd;
  const fitsRight = domino.top === rightEnd || domino.bottom === rightEnd;
  if (fitsLeft && fitsRight) return 'both';
  if (fitsLeft) return 'left';
  if (fitsRight) return 'right';
  return null;
}

// Get all playable dominoes from a hand
export function getPlayableDominoes(hand, leftEnd, rightEnd) {
  return hand.filter(d => canPlay(d, leftEnd, rightEnd));
}

/**
 * Apply a domino play and return new open ends.
 * isSpinner is true when:
 *   - it's the first play AND it's a double, OR
 *   - it's the first double played in this hand (spinnerActive is false)
 * Callers pass spinnerActive so we can mark correctly.
 */
export function playDomino(domino, leftEnd, rightEnd, side, spinnerActive = false) {
  if (leftEnd === null || rightEnd === null || side === 'first') {
    const isDouble = domino.top === domino.bottom;
    return {
      newLeftEnd: domino.top,
      newRightEnd: domino.bottom,
      isSpinner: isDouble, // first double played in hand = spinner
      newSpinnerActive: isDouble,
    };
  }
  const isDouble = domino.top === domino.bottom;
  const becomesSpinner = isDouble && !spinnerActive;
  if (side === 'left') {
    const newLeft = domino.top === leftEnd ? domino.bottom : domino.top;
    return { newLeftEnd: newLeft, newRightEnd: rightEnd, isSpinner: becomesSpinner, newSpinnerActive: spinnerActive || becomesSpinner };
  }
  // right
  const newRight = domino.top === rightEnd ? domino.bottom : domino.top;
  return { newLeftEnd: leftEnd, newRightEnd: newRight, isSpinner: becomesSpinner, newSpinnerActive: spinnerActive || becomesSpinner };
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

// Check if a game is blocked (no player can play and boneyard is empty)
export function checkBlocked(players, leftEnd, rightEnd, boneyardCount) {
  if (boneyardCount > 0) return false;
  return players.every(p => getPlayableDominoes(p.hand || [], leftEnd, rightEnd).length === 0);
}

/**
 * AI: pick the best domino to play.
 * First play with a locked starting domino → must play that domino.
 * First play without lock → play highest double if available, else highest pip.
 * Otherwise → play highest pip value that fits.
 */
export function aiChoosePlay(hand, leftEnd, rightEnd, startingDominoLocked = null) {
  if (leftEnd === null && rightEnd === null) {
    // First play
    if (startingDominoLocked) {
      const locked = hand.find(d => d.id === startingDominoLocked);
      if (locked) return { domino: locked, side: 'first' };
    }
    // Play highest double available
    const doubles = hand.filter(d => d.top === d.bottom).sort((a, b) => b.top - a.top);
    if (doubles.length > 0) return { domino: doubles[0], side: 'first' };
    // No doubles — play any tile
    const sorted = [...hand].sort((a, b) => (b.top + b.bottom) - (a.top + a.bottom));
    return sorted.length ? { domino: sorted[0], side: 'first' } : null;
  }
  const playable = getPlayableDominoes(hand, leftEnd, rightEnd);
  if (playable.length === 0) return null;
  const sorted = [...playable].sort((a, b) => (b.top + b.bottom) - (a.top + a.bottom));
  const domino = sorted[0];
  const side = getPlaySide(domino, leftEnd, rightEnd);
  const resolvedSide = side === 'both' ? 'right' : side;
  return { domino, side: resolvedSide };
}