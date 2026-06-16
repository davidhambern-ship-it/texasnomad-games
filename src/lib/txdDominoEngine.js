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

// Find the player holding Double 6 (required first play in TXD)
export function findDoubleSixHolder(hands) {
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].some(d => d.id === '6-6')) return i;
  }
  return -1;
}

// Find the player with the highest double to go first (fallback)
export function findHighestDouble(hands) {
  let highestDouble = -1;
  let startPlayerIndex = 0;
  hands.forEach((hand, playerIdx) => {
    hand.forEach(d => {
      if (d.top === d.bottom && d.top > highestDouble) {
        highestDouble = d.top;
        startPlayerIndex = playerIdx;
      }
    });
  });
  return { startPlayerIndex, highestDouble };
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

// Apply a domino play and return new open ends
export function playDomino(domino, leftEnd, rightEnd, side) {
  if (leftEnd === null || rightEnd === null || side === 'first') {
    // For the spinner (Double 6), both ends open at 6
    if (domino.top === domino.bottom) {
      return { newLeftEnd: domino.top, newRightEnd: domino.top, isSpinner: true };
    }
    return { newLeftEnd: domino.top, newRightEnd: domino.bottom, isSpinner: false };
  }
  if (side === 'left') {
    const newLeft = domino.top === leftEnd ? domino.bottom : domino.top;
    return { newLeftEnd: newLeft, newRightEnd: rightEnd };
  }
  // right
  const newRight = domino.top === rightEnd ? domino.bottom : domino.top;
  return { newLeftEnd: leftEnd, newRightEnd: newRight };
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

// AI: pick the best domino to play (highest pip count that fits)
// On first play, AI must play Double 6 if it has it
export function aiChoosePlay(hand, leftEnd, rightEnd) {
  // First play: must be Double 6
  if (leftEnd === null && rightEnd === null) {
    const doubleSix = hand.find(d => d.id === '6-6');
    if (doubleSix) return { domino: doubleSix, side: 'first' };
    return null; // shouldn't happen — this AI doesn't have the 6-6
  }
  const playable = getPlayableDominoes(hand, leftEnd, rightEnd);
  if (playable.length === 0) return null;
  // Sort by pip total descending, play highest value
  const sorted = [...playable].sort((a, b) => (b.top + b.bottom) - (a.top + a.bottom));
  const domino = sorted[0];
  const side = getPlaySide(domino, leftEnd, rightEnd);
  const resolvedSide = side === 'both' ? 'right' : side;
  return { domino, side: resolvedSide };
}