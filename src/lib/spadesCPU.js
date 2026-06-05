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

  const context = buildContext(hand, trick, actualPartnerBid, myBid, booksWon, spadesBroken, gameState, mySeatNumber, playedCardIds);

  if (trick.length === 0) {
    return selectLeadCard(context);
  }
  return selectFollowCard(context);
}

// Build a context object for strategic decisions
function buildContext(hand, trick, myBid, booksWon, spadesBroken, gameState, mySeatNumber, playedCardIds) {
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
  const teamNeedsBooksMore = teamBid - teamBooksWon; // how many more we need
  const teamHasMadeBid = teamBooksWon >= teamBid;

  // Classify hand by suit
  const bySuit = { '♠': [], '♥': [], '♦': [], '♣': [], 'Joker': [] };
  for (const card of hand) bySuit[card.suit]?.push(card);
  for (const suit of Object.keys(bySuit)) bySuit[suit].sort((a, b) => cardVal(b) - cardVal(a));

  // What's winning the current trick
  const activeSuit = trick.length > 0 ? getActiveSuit(trick) : null;
  const currentWinner = trick.length > 0 ? determineTrickWinner(trick, activeSuit) : null;
  const partnerIsWinning = currentWinner && partnerSeat !== undefined &&
    players.find(p => p.seatNumber === partnerSeat)?.playerId === currentWinner.playerId;

  // Cards still alive (not yet played) by suit — for memory
  const remainingHigh = {
    BJ: !playedCardIds.has('BigJoker'),
    LJ: !playedCardIds.has('LittleJoker'),
    AS: !playedCardIds.has('♠A'),
    KS: !playedCardIds.has('♠K'),
  };

  return {
    hand, trick, myBid, booksWon, spadesBroken,
    bySuit, activeSuit, currentWinner, partnerIsWinning,
    teamBid, teamBooksWon, teamNeedsBooksMore, teamHasMadeBid, tricksLeft,
    partner, mySeatNumber, myTeam, teamSeats, oppSeats,
    playedCardIds, remainingHigh,
  };
}

// Collect IDs of all cards that have already been played
function collectPlayedCards(gameState, currentTrick) {
  const ids = new Set();
  // Cards in the current trick
  for (const play of (currentTrick || [])) {
    if (play.card?.id) ids.add(play.card.id);
  }
  // Also check completed_books for historical plays
  const completedBooks = gameState.completed_books || [];
  for (const book of completedBooks) {
    const cardsPlayed = book.cardsPlayed || [];
    for (const play of cardsPlayed) {
      if (play.card?.id) ids.add(play.card.id);
    }
  }
  return ids;
}

// ─── LEADING ────────────────────────────────────────────────────────────────

function selectLeadCard(ctx) {
  const { hand, bySuit, myBid, booksWon, spadesBroken, teamHasMadeBid, teamNeedsBooksMore, remainingHigh, tricksLeft, playedCardIds } = ctx;

  const hasNonSpade = hand.some(c => c.suit !== '♠' && c.suit !== 'Joker');

  // ── If team already made bid: lead low to avoid bags ──
  if (teamHasMadeBid) {
    return leadLowest(bySuit, spadesBroken, hasNonSpade);
  }

  // ── Team still needs books: lead offensively ──

  // Late game desperation (≤3 tricks left) — lead highest available card
  if (tricksLeft <= 3 && teamNeedsBooksMore > 0) {
    // Check for sure winners first
    for (const suit of ['♥', '♦', '♣']) {
      const cards = bySuit[suit];
      if (cards.length > 0 && cardVal(cards[0]) === 14 && !playedCardIds.has(`${suit}A`)) {
        return cards[0]; // Ace still good
      }
    }
    // Lead highest spade if no side aces
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[0];
  }

  // Lead a Joker if we really need the book and are far behind
  if (teamNeedsBooksMore >= 3 && bySuit['Joker'].length > 0) {
    return bySuit['Joker'][0]; // BJ first (sorted highest)
  }

  // Lead Ace of non-spade suit (guaranteed winner)
  for (const suit of ['♥', '♦', '♣']) {
    const cards = bySuit[suit];
    if (cards.length > 0 && cardVal(cards[0]) === 14) return cards[0];
  }

  // Lead King of a suit where Ace is gone (now top card)
  for (const suit of ['♥', '♦', '♣']) {
    const cards = bySuit[suit];
    if (cards.length >= 2 && cardVal(cards[0]) === 13) {
      const aceGone = playedCardIds.has(`${suit}A`);
      if (aceGone) return cards[0];
    }
  }

  // Lead from long strong suit to establish winners
  const nonSpades = ['♥', '♦', '♣'].filter(s => bySuit[s].length > 0);
  if (nonSpades.length > 0 && hasNonSpade) {
    const longest = nonSpades.reduce((a, b) => bySuit[a].length >= bySuit[b].length ? a : b);
    const cards = bySuit[longest];
    if (cards.length >= 3 && cardVal(cards[0]) >= 13) return cards[0]; // Lead high from long suit
  }

  // If spades are broken and we need books, lead high spade to pull trump
  if (spadesBroken && bySuit['♠'].length > 0 && teamNeedsBooksMore > 0) {
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[0]; // Lead highest non-joker spade
  }

  // Must lead spades (only suit) or spades broken
  if (bySuit['♠'].length > 0 && (!hasNonSpade || spadesBroken)) {
    // Lead middle-value spade to pull trump without burning jokers
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[Math.floor(spades.length / 2)];
    return bySuit['Joker'][0] || bySuit['♠'][0];
  }

  // Default: lead lowest non-spade
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
  const { activeSuit, currentWinner, partnerIsWinning, teamHasMadeBid, teamNeedsBooksMore, trick, myBid, booksWon, tricksLeft } = ctx;
  const iNeedBook = !teamHasMadeBid && teamNeedsBooksMore > 0;

  // Find lowest card that can beat current winner
  const winnerStrength = currentWinner ? getCardStrength(currentWinner.card, activeSuit) : -1;
  const winningCards = suitCards.filter(c => getCardStrength(c, activeSuit) > winnerStrength);
  const losingCards = suitCards.filter(c => getCardStrength(c, activeSuit) <= winnerStrength);

  // Partner is already winning — don't overtake unless we desperately need the book
  if (partnerIsWinning && !iNeedBook) {
    return suitCards[suitCards.length - 1];
  }

  // Partner winning and we need book — let partner win, save high cards
  if (partnerIsWinning && iNeedBook) {
    return suitCards[suitCards.length - 1];
  }

  // Opponent winning and we need a book — play lowest winner if possible
  if (!partnerIsWinning && iNeedBook && winningCards.length > 0) {
    return winningCards[winningCards.length - 1]; // lowest card that wins
  }

  // We've already made our bid — play absolute lowest to avoid bags
  if (teamHasMadeBid) {
    return suitCards[suitCards.length - 1];
  }

  // Critical: we're short on books and tricks are running out — be aggressive
  if (iNeedBook && tricksLeft <= 3 && winningCards.length > 0) {
    return winningCards[winningCards.length - 1];
  }

  // Default: if we can win cheaply, do it; otherwise dump lowest
  if (winningCards.length > 0) return winningCards[winningCards.length - 1];
  return suitCards[suitCards.length - 1];
}

function voidPlay(ctx) {
  const { bySuit, currentWinner, partnerIsWinning, teamHasMadeBid, teamNeedsBooksMore, activeSuit, tricksLeft, myBid, booksWon } = ctx;
  const iNeedBook = !teamHasMadeBid && teamNeedsBooksMore > 0;

  const spades = bySuit['♠'] || [];
  const jokers = bySuit['Joker'] || [];
  const allTrump = [...jokers, ...spades]; // sorted highest first
  allTrump.sort((a, b) => cardVal(b) - cardVal(a));

  // Partner is already winning — just sluff garbage (don't waste trump)
  if (partnerIsWinning) {
    return sluffLowest(bySuit);
  }

  // We've made our bid — sluff lowest to avoid bags (never cut)
  if (teamHasMadeBid) {
    return sluffLowest(bySuit);
  }

  // We need the book — cut with trump if we can win
  if (iNeedBook && allTrump.length > 0) {
    const winnerStrength = currentWinner ? getCardStrength(currentWinner.card, activeSuit) : -1;
    const winningTrump = allTrump.filter(c => getCardStrength(c, activeSuit) > winnerStrength);
    if (winningTrump.length > 0) {
      // Use lowest winning trump (save big ones for later)
      return winningTrump[winningTrump.length - 1];
    }
    // Can't win even with trump — sluff lowest instead of wasting trump
    return sluffLowest(bySuit);
  }

  // Late game desperation — if we're short on books and have high trump, use it
  if (iNeedBook && tricksLeft <= 3 && allTrump.length > 0) {
    const highTrump = allTrump.filter(c => cardVal(c) >= 13); // King or better
    if (highTrump.length > 0) {
      return highTrump[highTrump.length - 1]; // lowest of the high trump
    }
  }

  // Default: sluff lowest non-trump
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