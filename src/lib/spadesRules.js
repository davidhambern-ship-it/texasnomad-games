// Spades Rule Engine
// Handles all Spades game logic, validation, and book tracking

export const SUITS = ['♣', '♦', '♥', '♠'];
export const JOKERS = ['LJ', 'BJ'];

export const CARD_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  'LJ': 15, 'BJ': 16
};

// Generate a fresh full Spades deck (54 cards: 52 standard - 2♥ - 2♦ + 2 jokers = 54)
// Each card gets a unique ID based on suit+value for deduplication checks
export function generateFullDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) {
      // Remove 2 of Hearts and 2 of Diamonds (TexasNomad Spades variant)
      if ((suit === '♥' || suit === '♦') && value === '2') continue;
      deck.push({ suit, value, id: `${suit}${value}` });
    }
  }
  deck.push({ suit: 'Joker', value: 'LJ', id: 'LittleJoker' });
  deck.push({ suit: 'Joker', value: 'BJ', id: 'BigJoker' });
  return deck;
}

// Cryptographically strong Fisher-Yates shuffle
// Uses crypto.getRandomValues() for strong randomness instead of Math.random()
export function shuffleDeck(deck) {
  const d = [...deck]; // Always work on a fresh copy
  const len = d.length;

  // Generate all random values in one call for efficiency
  const randomBuffer = new Uint32Array(len);
  crypto.getRandomValues(randomBuffer);

  for (let i = len - 1; i > 0; i--) {
    // Map the random uint32 to range [0, i] without modulo bias
    // Use high-quality reduction: (randomBuffer[i] / (2^32)) * (i+1)
    const j = Math.floor((randomBuffer[i] / 4294967296) * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }

  return d;
}

// Validate deck integrity before dealing
// Returns { valid: boolean, errors: string[] }
export function validateDeck(deck) {
  const errors = [];

  // Check total card count
  const expected = 54; // 52 - 2♥2 - 2♦2 + LJ + BJ
  if (deck.length !== expected) {
    errors.push(`Expected ${expected} cards, got ${deck.length}`);
  }

  // Check for duplicate IDs
  const ids = deck.map(c => c.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    errors.push(`Duplicate card IDs: ${dupes.join(', ')}`);
  }

  // Check required cards exist
  const mustExist = ['BigJoker', 'LittleJoker', '♠A', '♠K', '♠Q'];
  for (const id of mustExist) {
    if (!uniqueIds.has(id)) errors.push(`Missing required card: ${id}`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate dealt hands — no card in more than one hand
export function validateDealtHands(players) {
  const errors = [];
  const seenIds = new Map(); // id -> playerId

  for (const player of players) {
    if (!player.hand) continue;
    for (const card of player.hand) {
      if (seenIds.has(card.id)) {
        errors.push(`Card ${card.id} appears in both seat ${seenIds.get(card.id)} and seat ${player.seatNumber}`);
      } else {
        seenIds.set(card.id, player.seatNumber);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Debug shuffle stats (host-only, not shown to players)
export function getShuffleDebugStats(deck, players) {
  const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const first5 = deck.slice(0, 5).map(c => `${c.value}${c.suit}`).join(', ');

  const handStats = players
    .filter(p => p.hand?.length > 0)
    .map(p => {
      const spadesCount = p.hand.filter(c => c.suit === '♠').length;
      const jokers = p.hand.filter(c => c.suit === 'Joker').length;
      return `Seat ${p.seatNumber}: ${p.hand.length} cards, ${spadesCount}♠, ${jokers} jokers`;
    });

  return {
    sessionId,
    first5Cards: first5,
    deckSize: deck.length,
    handDistribution: handStats,
    deckValid: validateDeck(deck).valid,
  };
}

// Get card strength (for determining winner)
export function getCardStrength(card, activeSuit) {
  if (!card) return -1;

  // Jokers are absolute highest
  if (card.value === 'BJ') return 100;
  if (card.value === 'LJ') return 99;

  // Spades are trump
  if (card.suit === '♠') {
    return 50 + (CARD_ORDER[card.value] || 0);
  }

  // Active suit cards
  if (card.suit === activeSuit && activeSuit !== '♠') {
    return CARD_ORDER[card.value] || 0;
  }

  // Off-suit cards (cannot win)
  return -1;
}

// Check if a card play is valid
export function isValidPlay(card, hand, currentTrick, activeSuit, spadesBroken, isLead) {
  const errors = [];

  const cardInHand = hand.find(c => c.id === card.id);
  if (!cardInHand) {
    errors.push('Card not in hand');
    return { valid: false, errors };
  }

  // Leading (first to play in trick)
  if (isLead || currentTrick.length === 0) {
    if ((card.suit === '♠' || card.suit === 'Joker') && !spadesBroken) {
      const hasNonSpade = hand.some(c => c.suit !== '♠' && c.suit !== 'Joker');
      if (hasNonSpade) {
        errors.push('Spades have not been broken yet');
        return { valid: false, errors };
      }
    }
    return { valid: true, errors: [] };
  }

  // Following — must follow active suit if possible
  const hasActiveSuit = hand.some(c => c.suit === activeSuit);
  if (hasActiveSuit && card.suit !== activeSuit) {
    errors.push('You must follow suit');
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

// Determine the winner of a trick
export function determineTrickWinner(trick, activeSuit) {
  if (!trick || trick.length === 0) return null;

  let winningPlay = trick[0];
  let winningStrength = getCardStrength(trick[0].card, activeSuit);

  for (const play of trick) {
    const strength = getCardStrength(play.card, activeSuit);
    if (strength > winningStrength) {
      winningStrength = strength;
      winningPlay = play;
    }
  }

  return winningPlay;
}

// Get active suit from trick (suit of first card played, Jokers lead as Spade)
export function getActiveSuit(trick) {
  if (!trick || trick.length === 0) return null;
  const first = trick[0]?.card;
  if (!first) return null;
  // Jokers count as Spades for trump purposes
  if (first.suit === 'Joker') return '♠';
  return first.suit;
}

// Check if spades are broken
export function checkSpadesBroken(trick, wasAlreadyBroken) {
  if (wasAlreadyBroken) return true;
  return trick.some(play => play.card.suit === '♠' || play.card.suit === 'Joker');
}

// Get team from seat number (seats 1&3 = team 1, seats 2&4 = team 2)
export function getTeamFromSeat(seatNumber) {
  if (seatNumber === 1 || seatNumber === 3) return 1;
  if (seatNumber === 2 || seatNumber === 4) return 2;
  return null;
}

// Calculate score based on bids and books
export function calculateScore(bid, booksWon, isBlind = false) {
  if (bid === 0) {
    return booksWon === 0 ? (isBlind ? 200 : 100) : -100;
  }
  if (booksWon >= bid) {
    return bid * 10 + (booksWon - bid);
  }
  return -10 * bid;
}

// Format card for display
export function formatCard(card) {
  if (!card) return '';
  if (card.value === 'LJ') return '🃏 Little Joker';
  if (card.value === 'BJ') return '🃏 Big Joker';
  return `${card.value}${card.suit}`;
}

// Get all cards of a suit from hand
export function getCardsBySuit(hand, suit) {
  return hand.filter(c => c.suit === suit);
}

// Check if hand has any non-spade cards
export function hasNonSpades(hand) {
  return hand.some(c => c.suit !== '♠' && c.suit !== 'Joker');
}