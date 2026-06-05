// Spades Rule Engine
// Handles all Spades game logic, validation, and book tracking

export const SUITS = ['♣', '♦', '♥', '♠'];
export const JOKERS = ['LJ', 'BJ'];

export const CARD_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  'LJ': 15, 'BJ': 16
};

// Generate a full Spades deck (52 cards + 2 jokers)
export function generateFullDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) {
      // Remove 2 of Hearts and 2 of Diamonds (Spades uses 50 cards + 2 jokers)
      if ((suit === '♥' || suit === '♦') && value === '2') continue;
      deck.push({ suit, value, id: `${suit}${value}` });
    }
  }
  deck.push({ suit: 'Joker', value: 'LJ', id: 'LittleJoker' });
  deck.push({ suit: 'Joker', value: 'BJ', id: 'BigJoker' });
  return deck;
}

// Shuffle deck
export function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Get card strength (for determining winner)
export function getCardStrength(card, activeSuit) {
  if (!card) return -1;
  
  // Jokers are highest (always trump)
  if (card.value === 'BJ') return 100;
  if (card.value === 'LJ') return 99;
  
  // Spades are trump
  if (card.suit === '♠') {
    return 50 + (CARD_ORDER[card.value] || 0);
  }
  
  // Active suit cards (only if no spades played)
  if (card.suit === activeSuit && activeSuit !== '♠') {
    return CARD_ORDER[card.value] || 0;
  }
  
  // Off-suit cards (can't win)
  return -1;
}

// Check if a card play is valid
export function isValidPlay(card, hand, currentTrick, activeSuit, spadesBroken, isLead) {
  const errors = [];
  
  // Check if card is in hand
  const cardInHand = hand.find(c => c.id === card.id);
  if (!cardInHand) {
    errors.push('Card not in hand');
    return { valid: false, errors };
  }
  
  // If leading (first to play in trick)
  if (isLead || currentTrick.length === 0) {
    // Cannot lead Spades unless spades are broken or only have Spades
    if (card.suit === '♠' && !spadesBroken) {
      const hasNonSpade = hand.some(c => c.suit !== '♠');
      if (hasNonSpade) {
        errors.push('Spades have not been broken yet');
        return { valid: false, errors };
      }
    }
    return { valid: true, errors: [] };
  }
  
  // If following (not leading)
  // Must follow active suit if possible
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

// Get active suit from trick (suit of first card played)
export function getActiveSuit(trick) {
  if (!trick || trick.length === 0) return null;
  return trick[0]?.card?.suit;
}

// Check if spades are broken in this trick
export function checkSpadesBroken(trick, wasAlreadyBroken) {
  if (wasAlreadyBroken) return true;
  
  // Spades are broken if a Spade is played when player couldn't follow suit
  const activeSuit = getActiveSuit(trick);
  if (!activeSuit || activeSuit === '♠') return wasAlreadyBroken;
  
  // Check if any Spade was played by someone who didn't have the active suit
  // This is a simplified check - in real game we'd need to know each player's hand
  return trick.some(play => play.card.suit === '♠');
}

// Get team from seat number (1&3 vs 2&4)
export function getTeamFromSeat(seatNumber) {
  if (seatNumber === 1 || seatNumber === 3) return 1;
  if (seatNumber === 2 || seatNumber === 4) return 2;
  return null;
}

// Calculate score based on bids and books
export function calculateScore(bid, booksWon, isBlind = false) {
  if (bid === 0) {
    // Nil bid
    if (booksWon === 0) {
      return isBlind ? 200 : 100; // Success
    } else {
      return -100; // Failed
    }
  }
  
  if (booksWon >= bid) {
    // Made bid
    return bid * 10 + (booksWon - bid); // 1 point per book, plus 10 per bid
  } else {
    // Failed bid (set)
    return -10 * bid;
  }
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
  return hand.some(c => c.suit !== '♠');
}