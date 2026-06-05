// Handles automatic dealer rotation and CPU-triggered shuffle/deal

const DEALER_ROTATION_DELAY = 2000; // 2 seconds after round ends

/**
 * Checks if dealer should rotate and triggers auto-shuffle if new dealer is CPU
 * @param {Object} gs - Current game state
 * @param {Function} updateState - State update function
 * @param {boolean} cpuEnabled - Whether CPU players are enabled
 */
export async function handleDealerRotation(gs, updateState, cpuEnabled) {
  if (!cpuEnabled) return;
  
  const players = gs.players || [];
  const seated = players.filter(p => p.role === 'player' || p.role === 'hostPlayer').sort((a, b) => a.seatNumber - b.seatNumber);
  
  if (seated.length < 2) return;
  
  const currentDealerIdx = seated.findIndex(p => p.seatNumber === gs.dealer_seat);
  const nextDealerIdx = (currentDealerIdx + 1) % seated.length;
  const nextDealer = seated[nextDealerIdx];
  
  if (!nextDealer) return;
  
  // Update dealer seat
  await updateState({ dealer_seat: nextDealer.seatNumber });
  
  // If next dealer is CPU, auto-shuffle and deal after delay
  if (nextDealer.playerType === 'cpu') {
    setTimeout(async () => {
      // Shuffle 3 times
      for (let i = 0; i < 3; i++) {
        const deck = generateFullDeck();
        await updateState({ deck: shuffleDeck(deck), deck_shuffled: true, shuffle_count: i + 1 });
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      
      // Auto-deal
      await autoDeal(gs, updateState, nextDealer.seatNumber);
    }, DEALER_ROTATION_DELAY);
  }
}

/**
 * Auto-deal cards to all players
 */
async function autoDeal(gs, updateState, dealerSeat) {
  const players = gs.players || [];
  const seated = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
  
  if (seated.length < 2) return;
  
  const workingDeck = shuffleDeck(generateFullDeck());
  const cardsPerPlayer = Math.floor(workingDeck.length / seated.length);
  
  const updatedPlayers = players.map(p => {
    if (p.role !== 'player' && p.role !== 'hostPlayer') return p;
    const idx = seated.findIndex(s => s.playerId === p.playerId);
    return { 
      ...p, 
      hand: workingDeck.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer), 
      bid: null, 
      tricksWon: 0 
    };
  });
  
  // First bidder is player to left of dealer
  const dealerIdx = seated.findIndex(p => p.seatNumber === dealerSeat);
  const firstBidderIdx = (dealerIdx + 1) % seated.length;
  const firstBidder = seated[firstBidderIdx];
  
  await updateState({
    players: updatedPlayers, 
    phase: 'bidding', 
    status: 'active',
    deck: [], 
    current_trick: [], 
    current_bidder_seat: firstBidder?.seatNumber,
    tricks_played: 0, 
    bid1: null, 
    bid2: null, 
    books1: 0, 
    books2: 0, 
    shuffle_count: 0,
  });
}

function generateFullDeck() {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      if ((suit === '♥' || suit === '♦') && value === '2') continue;
      deck.push({ suit, value, id: `${suit}${value}` });
    }
  }
  deck.push({ suit: 'Joker', value: 'BJ', id: 'BigJoker' });
  deck.push({ suit: 'Joker', value: 'LJ', id: 'LittleJoker' });
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}