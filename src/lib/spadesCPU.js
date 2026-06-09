// CPU Player Logic for Spades — Pro Level AI
// Implements skilled bidding and playing strategy

import { CARD_ORDER, getCardStrength, getActiveSuit, determineTrickWinner, getTeamFromSeat } from './spadesRules';

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

// Card value reference used throughout
const VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };

function cardVal(card) {
  return VAL[card?.value] || 0;
}

// Delay for CPU actions — realistic table rhythm (1.2–1.8s)
export const CPU_ACTION_DELAY = 1400;

// ─── Player lifecycle helpers ───────────────────────────────────────────────

export function generateCPUPlayerId(seatNumber) {
  return `cpu_spades_seat${seatNumber}`;
}

export function getCPUName(seatNumber) {
  return CPU_NAMES[seatNumber - 1] || `CPU Player ${seatNumber}`;
}

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

export function fillEmptySeatsWithCPU(players, gs) {
  const seatedPlayers = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
  const occupiedSeats = seatedPlayers.map(p => p.seatNumber);
  const emptySeats = [1, 2, 3, 4].filter(s => !occupiedSeats.includes(s));
  const updatedPlayers = [...players];
  for (const seat of emptySeats) {
    const team = [1, 3].includes(seat) ? 1 : 2;
    updatedPlayers.push(createCPUPlayer(seat, team));
  }
  return updatedPlayers;
}

export function getCPUSeats(players) {
  return players.filter(p => p.playerType === 'cpu').map(p => ({
    seatNumber: p.seatNumber,
    name: p.name,
    playerId: p.playerId,
  }));
}

export function isCPUSeat(players, seatNumber) {
  return players.find(p => p.seatNumber === seatNumber)?.playerType === 'cpu';
}

export function replaceCPUWithHuman(players, cpuSeatNumber, humanPlayerId, humanRole = 'player') {
  const cpuPlayer = players.find(p => p.seatNumber === cpuSeatNumber && p.playerType === 'cpu');
  if (!cpuPlayer) return players;
  return players.map(p =>
    p.playerId === cpuPlayer.playerId
      ? { ...p, playerId: humanPlayerId, playerType: 'human', role: humanRole, name: null }
      : p
  );
}

export function removeCPUPlayers(players) {
  return players.filter(p => p.playerType !== 'cpu');
}

// ─── Pro Bidding Logic ───────────────────────────────────────────────────────

// Estimate how many tricks this hand can reliably win
export function calculateCPUBid(hand, teamBidSoFar = 0) {
  if (!hand || hand.length === 0) return 1;

  let sureTricks = 0;
  let potentialTricks = 0;

  const bySuit = { '♠': [], '♥': [], '♦': [], '♣': [], 'Joker': [] };
  for (const card of hand) {
    bySuit[card.suit]?.push(card);
  }

  // Sort each suit descending by value
  for (const suit of Object.keys(bySuit)) {
    bySuit[suit].sort((a, b) => cardVal(b) - cardVal(a));
  }

  // Jokers are always sure tricks
  sureTricks += bySuit['Joker'].length;

  // Spades — trump evaluation
  const spades = bySuit['♠'];
  const spadeCount = spades.length;
  const spadeVals = spades.map(c => cardVal(c));

  if (spadeVals.includes(14)) sureTricks += 1;       // Ace of Spades
  if (spadeVals.includes(13) && spadeCount >= 2) sureTricks += 1;  // King with guard
  else if (spadeVals.includes(13)) potentialTricks += 0.5;
  if (spadeVals.includes(12) && spadeCount >= 3) potentialTricks += 0.5;  // Queen with length

  // Long trump — extra potential
  if (spadeCount >= 5) potentialTricks += 1.5;
  else if (spadeCount >= 4) potentialTricks += 1;
  else if (spadeCount === 3) potentialTricks += 0.5;

  // Side suits
  for (const suit of ['♥', '♦', '♣']) {
    const cards = bySuit[suit];
    const count = cards.length;
    const vals = cards.map(c => cardVal(c));

    if (count === 0) {
      // Void — can cut from trick 1
      potentialTricks += 0.5;
      continue;
    }

    if (vals.includes(14)) sureTricks += 1;          // Ace is always a winner
    if (vals.includes(13) && count >= 2) sureTricks += 1;  // King with guard
    else if (vals.includes(13)) potentialTricks += 0.5;
    if (vals.includes(12) && count >= 3) potentialTricks += 0.5; // Q with 2 guards
    if (count === 1 && !vals.includes(14)) potentialTricks += 0.3; // Singleton, may cut later
  }

  let bid = Math.round(sureTricks + potentialTricks);

  // Conservative adjustment — don't overbid
  bid = Math.max(1, Math.min(bid, hand.length - 1));
  bid = Math.min(bid, 13 - teamBidSoFar);
  bid = Math.max(bid, 0);

  return bid;
}

// ─── Pro Playing Logic ───────────────────────────────────────────────────────

/**
 * Select the best card for the CPU to play.
 * Implements partner-aware, strategic card play following Spades partnership principles.
 * 
 * Decision hierarchy:
 * 1. Legal play validation
 * 2. Partner position & status detection
 * 3. Partner signal interpretation (low=need help, high=winning, mid=fishing)
 * 4. Team book needs assessment
 * 5. Card memory & void tracking
 * 6. Strategic card selection (lowest winning, protect partner, etc.)
 * 
 * @param {Array} hand - CPU's current hand
 * @param {Array} currentTrick - Cards played so far in this trick
 * @param {number} partnerBid - Partner's bid
 * @param {number} myBid - This CPU's bid
 * @param {number} booksWon - Books won by this CPU so far
 * @param {boolean} spadesBroken - Whether spades have been broken
 * @param {object} gameState - Full game state for memory/context
 * @param {number} mySeatNumber - This CPU's seat number
 */
export function selectCPUCard(hand, currentTrick, partnerBid = 0, myBid = 0, booksWon = 0, spadesBroken = false, gameState = {}, mySeatNumber = 0) {
  if (!hand || hand.length === 0) return null;
  const trick = currentTrick || [];

  // Collect all played cards across all tricks for memory
  const playedCardIds = collectPlayedCards(gameState, trick);

  // Get team info from game state
  const players = gameState.players || [];
  const myTeam = getTeamFromSeat(mySeatNumber);
  const teamSeats = myTeam === 1 ? [1, 3] : [2, 4];
  const oppSeats = myTeam === 1 ? [2, 4] : [1, 3];
  
  // Get actual team bids from game state
  const actualTeamBid = (gameState.bid1 || 0) + (gameState.bid2 || 0);
  const teamBooksWon = (gameState.books1 || 0) + (gameState.books2 || 0);
  
  // Calculate partner's bid
  const partnerSeat = mySeatNumber === 1 ? 3 : mySeatNumber === 3 ? 1 : mySeatNumber === 2 ? 4 : 2;
  const partner = players.find(p => p.seatNumber === partnerSeat);
  const actualPartnerBid = partner?.bid || 0;

  const context = buildContext(hand, trick, actualPartnerBid, myBid, booksWon, spadesBroken, gameState, mySeatNumber, playedCardIds || new Set());

  if (trick.length === 0) {
    return selectLeadCard(context);
  }
  return selectFollowCard(context);
}

// Build a context object for strategic decisions
function buildContext(hand, trick, myBid, booksWon, spadesBroken, gameState, mySeatNumber, playedCardIds) {
  // Ensure playedCardIds is a Set
  if (!(playedCardIds instanceof Set)) {
    playedCardIds = new Set();
  }
  const players = gameState.players || [];
  const myTeam = getTeamFromSeat(mySeatNumber);
  const partnerSeat = mySeatNumber === 1 ? 3 : mySeatNumber === 3 ? 1 : mySeatNumber === 2 ? 4 : 2;
  const partner = players.find(p => p.seatNumber === partnerSeat);

  // Team books and bids
  const teamSeats = myTeam === 1 ? [1, 3] : [2, 4];
  const oppSeats = myTeam === 1 ? [2, 4] : [1, 3];

  const teamBooksWon = players
    .filter(p => teamSeats.includes(p.seatNumber))
    .reduce((sum, p) => sum + (p.tricksWon || 0), 0);

  const teamBid = players
    .filter(p => teamSeats.includes(p.seatNumber))
    .reduce((sum, p) => sum + (p.bid || 0), 0);

  const tricksLeft = Math.max(0, 13 - (gameState.tricks_played || 0));
  const teamNeedsBooksMore = Math.max(0, teamBid - teamBooksWon); // how many more we need
  const teamHasMadeBid = teamBooksWon >= teamBid;

  // ─── SET TRACKING: Opponent team status ────────────────────────────────────
  const oppTeamBooksWon = players
    .filter(p => oppSeats.includes(p.seatNumber))
    .reduce((sum, p) => sum + (p.tricksWon || 0), 0);

  const oppTeamBid = players
    .filter(p => oppSeats.includes(p.seatNumber))
    .reduce((sum, p) => sum + (p.bid || 0), 0);

  const oppTeamNeedsBooks = Math.max(0, oppTeamBid - oppTeamBooksWon);
  const oppTeamHasMadeBid = oppTeamBooksWon >= oppTeamBid;
  const oppTeamCanBeSet = oppTeamBooksWon + tricksLeft < oppTeamBid; // mathematically can't reach bid
  const oppTeamCanStillMakeBid = !oppTeamCanBeSet && !oppTeamHasMadeBid;

  // Set pressure: how aggressively should we try to set them?
  // Higher when: their bid is high, they're close but vulnerable, we've made our bid
  let setPressure = 0;
  if (teamHasMadeBid && oppTeamCanStillMakeBid && oppTeamNeedsBooks > 0) {
    setPressure = oppTeamNeedsBooks <= tricksLeft ? 2 : 1; // 2 = critical, 1 = moderate
  }

  // Classify hand by suit
  const bySuit = { '♠': [], '♥': [], '♦': [], '♣': [], 'Joker': [] };
  for (const card of hand) bySuit[card.suit]?.push(card);
  for (const suit of Object.keys(bySuit)) bySuit[suit].sort((a, b) => cardVal(b) - cardVal(a));

  // What's winning the current trick
  const activeSuit = trick.length > 0 ? getActiveSuit(trick) : null;
  const currentWinner = trick.length > 0 ? determineTrickWinner(trick, activeSuit) : null;
  const partnerIsWinning = currentWinner && partnerSeat !== undefined &&
    players.find(p => p.seatNumber === partnerSeat)?.playerId === currentWinner.playerId;

  // Partner-aware: who played before me and what did they play?
  const lastPlay = trick.length > 0 ? trick[trick.length - 1] : null;
  const partnerPlayed = trick.find(t => t.seatNumber === partnerSeat);
  const partnerPlayCard = partnerPlayed?.card;
  const partnerPlayedLow = partnerPlayCard && cardVal(partnerPlayCard) <= 6; // 2-6 considered low
  const partnerPlayedHigh = partnerPlayCard && cardVal(partnerPlayCard) >= 13; // K, A, Jokers
  const partnerPlayedMid = partnerPlayCard && cardVal(partnerPlayCard) >= 9 && cardVal(partnerPlayCard) <= 12; // 9-Q (fishing range)

  // Detect if partner is fishing (led from connected run)
  const partnerMayBeFishing = partnerPlayed && !partnerIsWinning && partnerPlayedMid;

  // Cards still alive (not yet played) by suit — for memory
  const remainingHigh = {
    BJ: !playedCardIds?.has('BigJoker'),
    LJ: !playedCardIds?.has('LittleJoker'),
    AS: !playedCardIds?.has('♠A'),
    KS: !playedCardIds?.has('♠K'),
  };

  // Void tracking: which opponents are void in which suits
  const voids = detectVoids(gameState, players);

  // Winner strength for comparison
  const winnerStrength = currentWinner ? getCardStrength(currentWinner.card, activeSuit) : -1;

  return {
    hand, trick, myBid, booksWon, spadesBroken,
    bySuit, activeSuit, currentWinner, partnerIsWinning,
    teamBid, teamBooksWon, teamNeedsBooksMore, teamHasMadeBid, tricksLeft,
    partner, partnerSeat, mySeatNumber, myTeam, teamSeats, oppSeats,
    playedCardIds, remainingHigh,
    // Partner signals
    partnerPlayed, partnerPlayCard, partnerPlayedLow, partnerPlayedHigh, partnerPlayedMid, partnerMayBeFishing,
    // Memory
    voids, winnerStrength,
    // Set tracking
    oppTeamBid, oppTeamBooksWon, oppTeamNeedsBooks, oppTeamHasMadeBid, oppTeamCanBeSet, oppTeamCanStillMakeBid, setPressure,
  };
}

// Detect which players are void in which suits based on completed books
function detectVoids(gameState, players) {
  const voids = {}; // { seatNumber: [suits] }
  const completedBooks = Array.isArray(gameState.completed_books) ? gameState.completed_books : [];
  
  for (const book of completedBooks) {
    const cardsPlayed = Array.isArray(book.cardsPlayed) ? book.cardsPlayed : [];
    const activeSuit = book.activeSuit;
    if (!activeSuit) continue;
    
    for (const play of cardsPlayed) {
      const seat = play.seatNumber;
      const card = play.card;
      if (card.suit !== activeSuit && card.suit !== '♠') {
        // Player didn't follow suit - mark as void
        if (!voids[seat]) voids[seat] = [];
        if (!voids[seat].includes(activeSuit)) {
          voids[seat].push(activeSuit);
        }
      }
    }
  }
  
  return voids;
}

// Collect IDs of all cards that have already been played
function collectPlayedCards(gameState, currentTrick) {
  const ids = new Set();
  // Cards in the current trick
  if (Array.isArray(currentTrick)) {
    for (const play of currentTrick) {
      if (play.card?.id) ids.add(play.card.id);
    }
  }
  // Also check completed_books for historical plays
  const completedBooks = Array.isArray(gameState.completed_books) ? gameState.completed_books : [];
  for (const book of completedBooks) {
    const cardsPlayed = Array.isArray(book.cardsPlayed) ? book.cardsPlayed : [];
    for (const play of cardsPlayed) {
      if (play.card?.id) ids.add(play.card.id);
    }
  }
  return ids;
}

// ─── LEADING ────────────────────────────────────────────────────────────────

function selectLeadCard(ctx) {
  const { hand, bySuit, myBid, booksWon, spadesBroken, teamHasMadeBid, teamNeedsBooksMore, remainingHigh, tricksLeft, playedCardIds,
    oppTeamBid, oppTeamBooksWon, oppTeamNeedsBooks, oppTeamCanStillMakeBid, setPressure } = ctx;

  const hasNonSpade = hand.some(c => c.suit !== '♠' && c.suit !== 'Joker');

  // ── TEAM HAS MADE BID: Lead low to avoid bags ───────────────────────────────
  if (teamHasMadeBid) {
    // SET STRATEGY: If opponents can still make bid, lead aggressively to block them
    if (setPressure >= 1 && oppTeamCanStillMakeBid && oppTeamNeedsBooks > 0) {
      // Lead from suit where opponents are weak or need to burn high cards
      // Prefer leading Aces or Kings to force out opponent high cards
      for (const suit of ['♥', '♦', '♣']) {
        const cards = bySuit[suit];
        if (cards.length > 0 && cardVal(cards[0]) === 14 && !playedCardIds.has(`${suit}A`)) {
          return cards[0]; // Lead Ace to force opponents
        }
      }
    }
    return leadAggressive(ctx);
  }
function leadAggressive(ctx) {
  const { bySuit, hand, spadesBroken, teamHasMadeBid, teamNeedsBooksMore, setPressure } = ctx;
  const hasNonSpade = hand.some(c => c.suit !== '♠' && c.suit !== 'Joker');

  // If we already made bid and there is no pressure, avoid extra bags.
  if (teamHasMadeBid && setPressure === 0) {
    return leadLowest(bySuit, spadesBroken, hasNonSpade);
  }

  const options = [];

  for (const suit of ['♥', '♦', '♣']) {
    const cards = bySuit[suit] || [];

    cards.forEach((card, index) => {
      const v = cardVal(card);

      options.push({
        card,
        score:
          v * 4 +
          cards.length * 2 +
          (v === 14 ? 30 : 0) +
          (v === 13 ? 24 : 0) +
          (v === 12 ? 18 : 0) +
          (v === 11 ? 12 : 0) -
          index,
      });
    });
  }

  options.sort((a, b) => b.score - a.score);

  if (options.length > 0) {
    return options[0].card;
  }

  const spades = bySuit['♠'] || [];
  if ((spadesBroken || !hasNonSpade) && spades.length > 0) {
    return spades[0];
  }

  const jokers = bySuit['Joker'] || [];
  if (teamNeedsBooksMore >= 2 && jokers.length > 0) {
    return jokers[0];
  }

  return leadLowest(bySuit, spadesBroken, hasNonSpade);
}
  // ── TEAM NEEDS BOOKS: Lead offensively ──────────────────────────────────────

  // LATE GAME DESPERATION (≤3 tricks left): Lead highest available winner
  if (tricksLeft <= 3 && teamNeedsBooksMore > 0) {
    // Check for sure winners first (Aces that haven't been played)
    for (const suit of ['♥', '♦', '♣']) {
      const cards = bySuit[suit];
      if (cards.length > 0 && cardVal(cards[0]) === 14 && !playedCardIds.has(`${suit}A`)) {
        return cards[0]; // Ace still good
      }
    }
    // Lead highest spade if no side aces (but not Jokers)
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[0];
  }

  // FAR BEHIND: Lead Joker if we need 3+ books
  if (teamNeedsBooksMore >= 3 && bySuit['Joker'].length > 0) {
    return bySuit['Joker'][0]; // BJ first (sorted highest)
  }

  // SAFE LEAD: Ace of non-spade suit (guaranteed winner if not played)
  for (const suit of ['♥', '♦', '♣']) {
    const cards = bySuit[suit];
    if (cards.length > 0 && cardVal(cards[0]) === 14 && !playedCardIds.has(`${suit}A`)) {
      return cards[0];
    }
  }

  // KING LEAD: Lead King from suit where Ace is gone (now top card)
  for (const suit of ['♥', '♦', '♣']) {
    const cards = bySuit[suit];
    if (cards.length >= 2 && cardVal(cards[0]) === 13) {
      const aceGone = playedCardIds.has(`${suit}A`);
      if (aceGone) return cards[0];
    }
  }

  // LONG SUIT: Lead from long strong suit to establish winners
  const nonSpades = ['♥', '♦', '♣'].filter(s => bySuit[s].length > 0);
  if (nonSpades.length > 0 && hasNonSpade) {
    const longest = nonSpades.reduce((a, b) => bySuit[a].length >= bySuit[b].length ? a : b);
    const cards = bySuit[longest];
    if (cards.length >= 3 && cardVal(cards[0]) >= 13) {
      return cards[0]; // Lead high from long suit
    }
  }

  // PULL TRUMP: If spades are broken and we need books, lead high spade
  if (spadesBroken && bySuit['♠'].length > 0 && teamNeedsBooksMore > 0) {
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[0]; // Lead highest non-joker spade
  }

  // MUST LEAD SPADES: Only suit available or spades broken
  if (bySuit['♠'].length > 0 && (!hasNonSpade || spadesBroken)) {
    // Lead middle-value spade to pull trump without burning jokers
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[Math.floor(spades.length / 2)];
    return bySuit['Joker'][0] || bySuit['♠'][0];
  }

  // DEFAULT: Lead lowest non-spade (safe lead)
  return leadLowest(bySuit, spadesBroken, hasNonSpade);
}

function leadLowest(bySuit, spadesBroken, hasNonSpade) {
  for (const suit of ['♥', '♦', '♣']) {
    const cards = bySuit[suit];
    if (cards.length > 0) return cards[cards.length - 1]; // sorted descending, last = lowest
  }
  if (bySuit['♠'].length > 0) return bySuit['♠'][bySuit['♠'].length - 1];
  if (bySuit['Joker'].length > 0) return bySuit['Joker'][bySuit['Joker'].length - 1];
  return null;
}

// ─── FOLLOWING ───────────────────────────────────────────────────────────────

function selectFollowCard(ctx) {
  const { hand, bySuit, activeSuit, currentWinner, partnerIsWinning,
    myBid, booksWon, teamHasMadeBid, teamNeedsBooksMore } = ctx;

  const iNeedBook = !teamHasMadeBid && teamNeedsBooksMore > 0;

  // ── Can follow suit ──
  if (activeSuit && bySuit[activeSuit]?.length > 0) {
    return followWithSuit(ctx, bySuit[activeSuit]);
  }

  // ── Void in led suit — can cut or sluff ──
  return voidPlay(ctx);
}

function followWithSuit(ctx, suitCards) {
  // suitCards are sorted descending (highest first)
  const { 
    activeSuit, currentWinner, partnerIsWinning, teamHasMadeBid, teamNeedsBooksMore, 
    trick, myBid, booksWon, tricksLeft, partnerPlayedLow, partnerPlayedHigh, 
    partnerPlayedMid, partnerMayBeFishing, partnerSeat, winnerStrength,
    oppTeamBid, oppTeamBooksWon, oppTeamNeedsBooks, oppTeamCanStillMakeBid, setPressure
  } = ctx;
  
  const iNeedBook = !teamHasMadeBid && teamNeedsBooksMore > 0;
  
  // Find lowest card that can beat current winner
  const winningCards = suitCards.filter(c => getCardStrength(c, activeSuit) > winnerStrength);

  // ─── PARTNER IS WINNING ─────────────────────────────────────────────────────
  // Partner is currently winning the trick
  if (partnerIsWinning) {
    // Default: play lowest to avoid overtaking partner
    // Save high cards for when we really need them
    return suitCards[suitCards.length - 1];
  }

  // ─── OPPONENT IS WINNING ────────────────────────────────────────────────────
  // Opponent is currently winning
  
  // SET STRATEGY: Opponent winning a critical book that helps them make bid
  if (setPressure >= 1 && oppTeamCanStillMakeBid && oppTeamNeedsBooks > 0 && winningCards.length > 0) {
    // Try to win this book away from opponents if we can do it cheaply
    // Don't waste high cards unless it's a critical book (last few they need)
    const isCriticalBook = oppTeamNeedsBooks <= tricksLeft && tricksLeft <= 3;
    if (isCriticalBook || setPressure >= 2) {
      // Critical: use lowest winning card to steal the book
      return winningCards[winningCards.length - 1];
    }
  }
  
  // TEAM NEEDS BOOKS: Win with lowest possible card
  if (iNeedBook && winningCards.length > 0) {
    // LOWEST WINNING CARD RULE: Play the minimum card that wins
    return winningCards[winningCards.length - 1];
  }

  // PARTNER PLAYED LOW (signal for help): Partner may need support
  if (partnerPlayedLow && !iNeedBook) {
    // Partner led low or played low - may be trying to save high cards
    // If we can win cheaply, do it to help partner
    if (winningCards.length > 0) {
      return winningCards[winningCards.length - 1]; // lowest winner
    }
  }

  // PARTNER PLAYED MID (fishing signal): Partner may be fishing
  if (partnerMayBeFishing && iNeedBook) {
    // Partner is likely trying to draw out high cards
    // Support by playing high if we can control the suit
    if (winningCards.length > 0) {
      // Play highest useful card to apply pressure and draw out opponent face cards
      return winningCards[0]; // highest winner
    }
  }

  // PARTNER PLAYED HIGH: Partner is winning or tried to win
  if (partnerPlayedHigh) {
    // Partner already played high - don't waste another high card
    // Play lowest regardless of whether we could win
    return suitCards[suitCards.length - 1];
  }

  // TEAM HAS MADE BID: Avoid bags at all costs
  if (teamHasMadeBid) {
    return suitCards[suitCards.length - 1];
  }

  // LATE GAME DESPERATION: ≤3 tricks left and we need books
  if (iNeedBook && tricksLeft <= 3 && winningCards.length > 0) {
    return winningCards[winningCards.length - 1];
  }

  // DEFAULT: Win cheaply if possible, otherwise dump lowest
  if (winningCards.length > 0) {
    return winningCards[winningCards.length - 1];
  }
  return suitCards[suitCards.length - 1];
}

function voidPlay(ctx) {
  const { 
    bySuit, currentWinner, partnerIsWinning, teamHasMadeBid, teamNeedsBooksMore, 
    activeSuit, tricksLeft, myBid, booksWon, partnerPlayedLow, partnerPlayed,
    winnerStrength, partnerSeat, voids,
    oppTeamBid, oppTeamBooksWon, oppTeamNeedsBooks, oppTeamCanStillMakeBid, setPressure
  } = ctx;
  const iNeedBook = !teamHasMadeBid && teamNeedsBooksMore > 0;

  const spades = bySuit['♠'] || [];
  const jokers = bySuit['Joker'] || [];
  const allTrump = [...jokers, ...spades]; // sorted highest first
  allTrump.sort((a, b) => cardVal(b) - cardVal(a));

  // ─── PARTNER IS WINNING ─────────────────────────────────────────────────────
  // NEVER cut partner unless absolutely critical
  if (partnerIsWinning) {
    // Partner is winning - throw away lowest non-trump
    // Save trump for when opponents are winning
    return sluffLowest(bySuit);
  }

  // ─── TEAM HAS MADE BID ──────────────────────────────────────────────────────
  // Avoid bags - don't cut, just dump garbage
  if (teamHasMadeBid) {
    return sluffLowest(bySuit);
  }

  // ─── OPPONENT WINNING - CUT DECISION ────────────────────────────────────────
  // Opponent is winning - decide whether to cut
  
  const winningTrump = allTrump.filter(c => getCardStrength(c, activeSuit) > winnerStrength);
  
  // SET STRATEGY: Opponent winning a book that helps them make their bid
  // Cut them off if we can do it without wasting critical trump
  if (setPressure >= 1 && oppTeamCanStillMakeBid && oppTeamNeedsBooks > 0 && winningTrump.length > 0) {
    const isCriticalBook = oppTeamNeedsBooks <= tricksLeft && tricksLeft <= 3;
    if (isCriticalBook || setPressure >= 2) {
      // Cut with lowest winning trump to steal the book
      return winningTrump[winningTrump.length - 1];
    }
  }
  
  // TEAM NEEDS BOOKS: Cut with lowest winning trump
  if (iNeedBook && winningTrump.length > 0) {
    // LOWEST WINNING TRUMP RULE: Don't waste high trump
    // Save Jokers and Ace/King of Spades for crucial moments
    return winningTrump[winningTrump.length - 1];
  }

  // PARTNER PLAYED LOW (needs help): Consider cutting if we can win
  if (partnerPlayedLow && allTrump.length > 0 && winningTrump.length > 0) {
    // Partner may need help - cut with lowest winning trump
    return winningTrump[winningTrump.length - 1];
  }

  // ─── HIGH TRUMP PROTECTION ──────────────────────────────────────────────────
  // Don't waste these unless necessary:
  // - Big Joker, Little Joker
  // - Ace of Spades, King of Spades
  
  const highTrump = allTrump.filter(c => cardVal(c) >= 14); // Jokers and Ace
  const wouldWasteHighTrump = winningTrump.some(c => cardVal(c) >= 14);
  
  if (wouldWasteHighTrump && !iNeedBook) {
    // We'd have to waste a high trump but we don't desperately need the book
    // Sluff lowest instead - save high trump for later
    return sluffLowest(bySuit);
  }

  // ─── LATE GAME DESPERATION ──────────────────────────────────────────────────
  // ≤3 tricks left and we need books - be aggressive with trump
  if (iNeedBook && tricksLeft <= 3 && allTrump.length > 0) {
    if (winningTrump.length > 0) {
      return winningTrump[winningTrump.length - 1]; // lowest winning trump
    }
    // Can't win - sluff lowest
    return sluffLowest(bySuit);
  }

  // ─── DEFAULT: DON'T CUT UNLESS WE NEED THE BOOK ─────────────────────────────
  // Opponent winning, we don't need books - sluff lowest
  return sluffLowest(bySuit);
}

// Return the lowest-value non-trump card, or lowest trump if no other choice
function sluffLowest(bySuit) {
  // Sluff from side suits first (preserve spades)
  const sideSuits = ['♥', '♦', '♣'];
  let lowest = null;
  let lowestVal = Infinity;

  for (const suit of sideSuits) {
    for (const card of bySuit[suit]) {
      const v = cardVal(card);
      if (v < lowestVal) {
        lowestVal = v;
        lowest = card;
      }
    }
  }

  if (lowest) return lowest;

  // Fall back to lowest spade
  const spades = bySuit['♠'];
  if (spades.length > 0) return spades[spades.length - 1]; // descending sort → last = lowest

  // Last resort: lowest joker
  const jokers = bySuit['Joker'];
  if (jokers.length > 0) return jokers[jokers.length - 1];

  return null;
}
