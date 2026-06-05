// CPU Player Logic for Spades
// Handles AI bidding, card playing, and seat management

const CPU_NAMES = [
  'CPU Outlaw',
  'CPU Wrangler',
  'CPU Maverick',
  'CPU Ace',
  'CPU Rider',
  'CPU Bandit',
  'CPU Sheriff',
  'CPU Gambler',
];

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Generate a unique CPU player ID
export function generateCPUPlayerId(seatNumber) {
  return `cpu_spades_seat${seatNumber}`;
}

// Get a CPU name based on seat number
export function getCPUName(seatNumber) {
  return CPU_NAMES[seatNumber - 1] || `CPU Player ${seatNumber}`;
}

// Create a CPU player object
export function createCPUPlayer(seatNumber, team) {
  return {
    playerId: generateCPUPlayerId(seatNumber),
    seatNumber,
    role: 'player',
    playerType: 'cpu',
    name: getCPUName(seatNumber),
    team,
    connected: true,
    joinedAt: Date.now(),
    lastActionAt: Date.now(),
    hand: [],
    bid: null,
    tricksWon: 0,
  };
}

// Fill empty seats with CPU players
export function fillEmptySeatsWithCPU(players, gs) {
  const seatedPlayers = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
  const occupiedSeats = seatedPlayers.map(p => p.seatNumber);
  const emptySeats = [1, 2, 3, 4].filter(s => !occupiedSeats.includes(s));
  
  const updatedPlayers = [...players];
  
  // Determine teams: seats 1&3 vs 2&4
  const team1Seats = [1, 3];
  const team2Seats = [2, 4];
  
  for (const seat of emptySeats) {
    const team = team1Seats.includes(seat) ? 1 : 2;
    const cpuPlayer = createCPUPlayer(seat, team);
    updatedPlayers.push(cpuPlayer);
  }
  
  return updatedPlayers;
}

// Get all CPU seats from players array
export function getCPUSeats(players) {
  return players
    .filter(p => p.playerType === 'cpu')
    .map(p => ({
      seatNumber: p.seatNumber,
      name: p.name,
      playerId: p.playerId,
    }));
}

// Check if a seat is occupied by a CPU
export function isCPUSeat(players, seatNumber) {
  const player = players.find(p => p.seatNumber === seatNumber);
  return player?.playerType === 'cpu';
}

// Replace a CPU player with a human player
export function replaceCPUWithHuman(players, cpuSeatNumber, humanPlayerId, humanRole = 'player') {
  const cpuPlayer = players.find(p => p.seatNumber === cpuSeatNumber && p.playerType === 'cpu');
  if (!cpuPlayer) return players;
  
  return players.map(p => {
    if (p.playerId === cpuPlayer.playerId) {
      return {
        ...p,
        playerId: humanPlayerId,
        playerType: 'human',
        role: humanRole,
        name: null,
      };
    }
    return p;
  });
}

// Remove all CPU players from the game
export function removeCPUPlayers(players) {
  return players.filter(p => p.playerType !== 'cpu');
}

// CPU Bidding Logic
export function calculateCPUBid(hand, teamBid = 0) {
  // Count sure tricks (Aces, Kings with Aces, etc.)
  let sureTricks = 0;
  let potentialTricks = 0;
  
  const suitCounts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
  const suitCards = { '♠': [], '♥': [], '♦': [], '♣': [] };
  
  for (const card of hand) {
    suitCounts[card.suit]++;
    suitCards[card.suit].push(card.value);
  }
  
  // Evaluate each suit
  const cardValues = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1, '10': 0.5, '9': 0, '8': 0, '7': 0, '6': 0, '5': 0, '4': 0, '3': 0, '2': 0, 'BJ': 5, 'LJ': 5 };
  
  for (const suit of ['♠', '♥', '♦', '♣']) {
    const cards = suitCards[suit];
    const count = suitCounts[suit];
    
    // Aces are sure tricks
    if (cards.includes('A')) {
      sureTricks += 1;
    }
    
    // Kings are tricks if you have 2+ cards in suit or Ace
    if (cards.includes('K') && (count >= 2 || cards.includes('A'))) {
      sureTricks += 1;
    } else if (cards.includes('K')) {
      potentialTricks += 0.5;
    }
    
    // Queens with length
    if (cards.includes('Q') && count >= 3) {
      potentialTricks += 0.5;
    }
    
    // Spades are trump - count high spades
    if (suit === '♠') {
      if (cards.includes('A')) sureTricks += 1;
      if (cards.includes('K')) sureTricks += 0.5;
      if (cards.includes('Q') && count >= 2) potentialTricks += 0.5;
      
      // Long spades suit
      if (count >= 4) {
        potentialTricks += 1;
      }
    }
    
    // Jokers are high
    if (cards.includes('BJ') || cards.includes('LJ')) {
      sureTricks += cards.filter(c => c === 'BJ' || c === 'LJ').length;
    }
  }
  
  // Calculate bid
  let bid = Math.floor(sureTricks + potentialTricks);
  
  // Adjust for nil potential (very weak hand)
  if (sureTricks === 0 && potentialTricks < 1) {
    // Consider nil bid
    bid = 0;
  }
  
  // Don't overbid
  bid = Math.min(bid, 13 - teamBid);
  bid = Math.max(bid, 0);
  
  return bid;
}

// CPU Card Selection Logic
export function selectCPUCard(hand, currentTrick, partnerBid = 0, myBid = 0, booksWon = 0) {
  if (!hand || hand.length === 0) return null;
  
  const trick = currentTrick || [];
  
  // If leading (no cards in trick)
  if (trick.length === 0) {
    return selectLeadingCard(hand, myBid, booksWon);
  }
  
  // If following to a trick
  return selectFollowingCard(hand, trick, myBid, booksWon);
}

// Select card when leading a trick
function selectLeadingCard(hand, myBid, booksWon) {
  const suitCounts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
  const suitCards = { '♠': [], '♥': [], '♦': [], '♣': [] };
  
  for (const card of hand) {
    suitCounts[card.suit]++;
    suitCards[card.suit].push(card);
  }
  
  // Sort cards by value within each suit
  const cardOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'BJ': 15, 'LJ': 14.5 };
  
  for (const suit of ['♠', '♥', '♦', '♣']) {
    suitCards[suit].sort((a, b) => cardOrder[b.value] - cardOrder[a.value]);
  }
  
  // If we need tricks to make our bid, lead high
  if (booksWon < myBid) {
    // Lead highest non-spade if we have it
    for (const suit of ['♥', '♦', '♣']) {
      if (suitCards[suit].length > 0 && suitCards[suit][0].value !== 'BJ' && suitCards[suit][0].value !== 'LJ') {
        return suitCards[suit][0];
      }
    }
    // Lead highest spade (but not joker unless necessary)
    if (suitCards['♠'].length > 0) {
      const highSpade = suitCards['♠'].find(c => c.value !== 'BJ' && c.value !== 'LJ');
      if (highSpade) return highSpade;
      return suitCards['♠'][0];
    }
  }
  
  // If we made our bid, lead low to avoid bags
  for (const suit of ['♥', '♦', '♣']) {
    if (suitCards[suit].length > 0) {
      return suitCards[suit][suitCards[suit].length - 1];
    }
  }
  
  if (suitCards['♠'].length > 0) {
    return suitCards['♠'][suitCards['♠'].length - 1];
  }
  
  return hand[0];
}

// Select card when following to a trick
function selectFollowingCard(hand, trick, myBid, booksWon) {
  const leadSuit = trick[0]?.card?.suit;
  const currentWinner = getCurrentTrickWinner(trick);
  
  const suitCounts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
  const suitCards = { '♠': [], '♥': [], '♦': [], '♣': [] };
  
  for (const card of hand) {
    suitCounts[card.suit]++;
    suitCards[card.suit].push(card);
  }
  
  const cardOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'BJ': 15, 'LJ': 14.5 };
  
  // Must follow suit if possible
  if (leadSuit && suitCounts[leadSuit] > 0) {
    const followCards = suitCards[leadSuit];
    followCards.sort((a, b) => cardOrder[b.value] - cardOrder[a.value]);
    
    // Can we win the trick?
    const canWin = followCards.some(c => {
      const testTrick = [...trick, { card: c }];
      const winner = getCurrentTrickWinner(testTrick);
      return winner?.card?.id === c.id;
    });
    
    if (booksWon < myBid && canWin) {
      // Win the trick if we need it
      return followCards[0];
    } else if (booksWon >= myBid) {
      // Dump low card to avoid bags
      return followCards[followCards.length - 1];
    } else {
      // Play middle card
      return followCards[Math.floor(followCards.length / 2)];
    }
  }
  
  // Can't follow suit - consider cutting with spades
  const spades = suitCards['♠'] || [];
  if (spades.length > 0) {
    spades.sort((a, b) => cardOrder[b.value] - cardOrder[a.value]);
    
    // Should we cut?
    const partnerIsWinning = currentWinner && isPartner(currentWinner, myBid);
    
    if (!partnerIsWinning && booksWon < myBid) {
      // Cut with low spade if possible
      const lowSpade = spades[spades.length - 1];
      if (lowSpade.value !== 'BJ' && lowSpade.value !== 'LJ') {
        return lowSpade;
      }
    }
    
    // Otherwise dump low spade
    return spades[spades.length - 1];
  }
  
  // Dump highest card of other suit
  for (const suit of ['♥', '♦', '♣']) {
    if (suitCards[suit].length > 0) {
      const sorted = [...suitCards[suit]].sort((a, b) => cardOrder[b.value] - cardOrder[a.value]);
      return sorted[sorted.length - 1];
    }
  }
  
  return hand[0];
}

// Get current trick winner
function getCurrentTrickWinner(trick) {
  if (!trick || trick.length === 0) return null;
  
  const spades = trick.filter(t => t.card?.suit === '♠');
  const relevant = spades.length > 0 ? spades : trick;
  
  const cardOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'BJ': 15, 'LJ': 14.5 };
  
  return relevant.reduce((a, b) => (cardOrder[a.card?.value] || 0) > (cardOrder[b.card?.value] || 0) ? a : b);
}

// Check if trick winner is partner (simplified)
function isPartner(winner, myBid) {
  // This would need team info - simplified for now
  return false;
}

// Delay for CPU actions (ms)
export const CPU_ACTION_DELAY = 1500;