// Spades Rule Engine
// Handles all Spades game logic, validation, and book tracking

export const SUITS = ['♣', '♦', '♥', '♠'];
export const JOKERS = ['LJ', 'BJ'];

export const CARD_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  'LJ': 15, 'BJ': 16
};

// Cryptographically secure random integer generator
// Uses crypto.getRandomValues() for true randomness
export function secureRandomInt(maxExclusive) {
  const array = new Uint32Array(1);
  let value;
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;

  do {
    crypto.getRandomValues(array);
    value = array[0];
  } while (value >= limit);

  return value % maxExclusive;
}

// Fisher-Yates shuffle with cryptographically secure randomness
// This is the gold standard for shuffling - unbiased and truly random
export function fisherYatesShuffle(deck) {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// Generate a fresh full Spades deck (52 cards: 54 standard - 2♥ - 2♦ + 2 jokers = 52)
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

// Validate deck integrity - checks for duplicates, correct size, and card existence
export function validateDeck(deck) {
  const errors = [];
  
  // Check deck size (should be 52 for TexasNomad Spades)
  if (deck.length !== 52) {
    errors.push(`Invalid deck size: ${deck.length} (expected 52)`);
  }

  // Check for duplicate card IDs
  const ids = deck.map(c => c.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    errors.push(`Duplicate card IDs found: ${[...new Set(duplicateIds)].join(', ')}`);
  }

  // Verify all expected cards exist
  const expectedCards = new Set();
  for (const suit of SUITS) {
    for (const value of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) {
      if ((suit === '♥' || suit === '♦') && value === '2') continue;
      expectedCards.add(`${suit}${value}`);
    }
  }
  expectedCards.add('LittleJoker');
  expectedCards.add('BigJoker');

  const missingCards = [...expectedCards].filter(id => !ids.includes(id));
  if (missingCards.length > 0) {
    errors.push(`Missing cards: ${missingCards.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Generate a hash for a hand to detect duplicate hands across rounds
export function getHandHash(hand) {
  if (!hand || hand.length === 0) return '';
  const sorted = [...hand].sort((a, b) => a.id.localeCompare(b.id));
  return sorted.map(c => c.id).join('|');
}

// Riffle-style interleave: split deck roughly in half, then interleave
// simulates real-world card riffling to break up suit runs
function riffleShuffle(deck) {
  const mid = Math.floor(deck.length / 2) + (secureRandomInt(5) - 2); // slight random split
  const top = deck.slice(0, Math.max(1, mid));
  const bottom = deck.slice(Math.max(1, mid));
  const result = [];
  let t = 0, b = 0;
  while (t < top.length || b < bottom.length) {
    // Randomly drop 1-3 cards from each half (like real riffling)
    const dropTop = Math.min(top.length - t, secureRandomInt(3) + 1);
    for (let i = 0; i < dropTop; i++) result.push(top[t++]);
    const dropBot = Math.min(bottom.length - b, secureRandomInt(3) + 1);
    for (let i = 0; i < dropBot; i++) result.push(bottom[b++]);
  }
  return result;
}

// Cryptographically strong shuffle: multiple Fisher-Yates passes + riffle passes + cut
// Uses crypto.getRandomValues() for true randomness - NEVER use Math.random()
export function shuffleDeck(deck) {
  let d = [...deck];
  // 3 Fisher-Yates passes
  d = fisherYatesShuffle(d);
  d = fisherYatesShuffle(d);
  d = fisherYatesShuffle(d);
  // 4 riffle passes to break up any suit clustering
  d = riffleShuffle(d);
  d = riffleShuffle(d);
  d = riffleShuffle(d);
  d = riffleShuffle(d);
  // Final Fisher-Yates to fully randomize after riffling
  d = fisherYatesShuffle(d);
  // Random cut: rotate the deck at a random point
  const cutPoint = secureRandomInt(d.length);
  d = [...d.slice(cutPoint), ...d.slice(0, cutPoint)];
  return d;
}

/**
 * Filter and sort seated players by seat number for consistent dealing.
 */
export function getSeatedPlayers(players) {
  return (players || [])
    .filter(p => p.seatNumber != null && (p.role === 'player' || p.role === 'hostPlayer'))
    .sort((a, b) => a.seatNumber - b.seatNumber);
}

/**
 * Deal an existing shuffled deck round-robin starting left of the dealer.
 * Card order in the deck is preserved — index 0 is dealt first, then 1, etc.
 * @returns {{ dealSequence, handsBySeatNumber, dealStartSeat }}
 */
export function dealFromShuffledDeck(shuffledDeck, seatedPlayers, dealerSeat = null) {
  const seated = getSeatedPlayers(seatedPlayers);
  const deck = [...(shuffledDeck || [])];

  if (seated.length < 2 || deck.length === 0) {
    return { dealSequence: [], handsBySeatNumber: new Map(), dealStartSeat: null };
  }

  let startIdx = 0;
  if (dealerSeat != null) {
    const dealerIdx = seated.findIndex(p => p.seatNumber === dealerSeat);
    if (dealerIdx >= 0) startIdx = (dealerIdx + 1) % seated.length;
  }

  const hands = seated.map(() => []);
  const dealSequence = [];

  for (let i = 0; i < deck.length; i++) {
    const playerIdx = (startIdx + i) % seated.length;
    const card = deck[i];
    hands[playerIdx].push(card);
    dealSequence.push(card);
  }

  const handsBySeatNumber = new Map();
  seated.forEach((player, idx) => {
    handsBySeatNumber.set(player.seatNumber, hands[idx]);
  });

  return {
    dealSequence,
    handsBySeatNumber,
    dealStartSeat: seated[startIdx]?.seatNumber ?? null,
  };
}

/**
 * Shuffle a fresh deck and deal in one step (CPU auto-deal paths).
 * @returns {{ dealSequence, handsBySeatNumber, shuffledDeck, dealStartSeat }}
 */
export function shuffleAndDealToPlayers(seatedPlayers, dealerSeat = null) {
  const shuffledDeck = shuffleDeck(generateFullDeck());
  const result = dealFromShuffledDeck(shuffledDeck, seatedPlayers, dealerSeat);
  return { ...result, shuffledDeck };
}

// Validate dealt hands — no card in more than one hand
export function validateDealtHands(players) {
  const errors = [];
  const seenIds = new Map();

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
export function getShuffleDebugStats(deck, players, previousHandHashes = null) {
  const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const first5 = deck.slice(0, 5).map(c => `${c.value}${c.suit}`).join(', ');
  const first5Ids = deck.slice(0, 5).map(c => c.id).join(', ');

  // Validate deck integrity
  const validation = validateDeck(deck);
  const ids = deck.map(c => c.id);
  const uniqueIds = new Set(ids);
  const hasDuplicates = uniqueIds.size !== ids.length;

  const handStats = players
    .filter(p => p.hand?.length > 0)
    .map(p => {
      const spadesCount = p.hand.filter(c => c.suit === '♠').length;
      const jokers = p.hand.filter(c => c.suit === 'Joker').length;
      const handHash = getHandHash(p.hand);
      const isDuplicateHand = previousHandHashes?.has(handHash) || false;
      return {
        seat: p.seatNumber,
        cardCount: p.hand.length,
        spadesCount,
        jokersCount: jokers,
        handHash,
        isDuplicate: isDuplicateHand,
        label: `Seat ${p.seatNumber}: ${p.hand.length} cards, ${spadesCount}♠, ${jokers} jokers${isDuplicateHand ? ' ⚠️ DUPLICATE' : ''}`,
      };
    });

  // Check for duplicate hands
  const duplicateHands = handStats.filter(h => h.isDuplicate);
  const allHandHashes = new Set(handStats.map(h => h.handHash));

  return {
    sessionId,
    first5Cards: first5,
    first5CardIds: first5Ids,
    deckSize: deck.length,
    deckValid: validation.valid,
    validationErrors: validation.errors,
    hasDuplicateCards: hasDuplicates,
    duplicateCardIds: hasDuplicates ? ids.filter((id, i) => ids.indexOf(id) !== i) : [],
    handDistribution: handStats.map(h => h.label),
    handDetails: handStats,
    duplicateHands: duplicateHands.length > 0,
    duplicateHandSeats: duplicateHands.map(h => h.seat),
    allHandHashes,
  };
}

// Get card strength (for determining winner)
export function getCardStrength(card, activeSuit = null) {
  if (!card) return -1;

  const valueRank = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
    'LJ': 100,
    'BJ': 101,
  };

  // Jokers are classified as Spades — highest trump cards
  if (card.value === 'BJ') return 50 + 16; // Big Joker: highest spade
  if (card.value === 'LJ') return 50 + 15; // Little Joker: second highest spade

  // Spades are trump and beat all non-spades
  if (card.suit === '♠') {
    return 50 + (valueRank[card.value] || 0);
  }

  // Cards matching the led suit beat off-suit non-trump cards
  if (activeSuit && card.suit === activeSuit) {
    return 20 + (valueRank[card.value] || 0);
  }

  // Off-suit non-spades cannot win
  return valueRank[card.value] || 0;
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
  // Jokers count as Spades for follow-suit purposes
  const isSpadeOrJoker = (c) => c.suit === '♠' || c.suit === 'Joker';
  const cardMatchesSuit = activeSuit === '♠' ? isSpadeOrJoker(card) : card.suit === activeSuit;
  const hasActiveSuit = activeSuit === '♠'
    ? hand.some(isSpadeOrJoker)
    : hand.some(c => c.suit === activeSuit);

  if (hasActiveSuit && !cardMatchesSuit) {
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

// Score = simply the number of books won that round
export function calculateScore(bid, booksWon, isBlind = false) {
  return booksWon;
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