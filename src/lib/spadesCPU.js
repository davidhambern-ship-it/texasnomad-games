// CPU Player Logic for Spades — Pro Level AI
// Implements skilled bidding and playing strategy

import { CARD_ORDER, getCardStrength, getActiveSuit, determineTrickWinner, getTeamFromSeat } from './spadesRules';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

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

// ─── TexasNomad character-based CPU creation ─────────────────────────────────

/** Create a CPU player using a specific TexasNomad character */
export function createTNCharacterPlayer(seatNumber, team, character) {
  return {
    playerId: `cpu_tn_${character.id}_seat${seatNumber}`,
    seatNumber,
    role: 'player',
    playerType: 'cpu',
    name: character.name,
    characterId: character.id,
    characterRole: character.role,
    characterAvatar: character.avatar,
    characterDifficulty: character.difficulty,
    team,
    connected: true,
    joinedAt: Date.now(),
    lastActionAt: Date.now(),
    hand: [],
    bid: null,
    tricksWon: 0,
  };
}

/** Fill empty seats with randomly selected, non-duplicate TexasNomad characters */
export function fillEmptySeatsWithTNCharacters(players, gs, specificAssignments = {}) {
  // specificAssignments: { seatNumber: characterId | 'random' }
  const seatedPlayers = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
  const occupiedSeats = seatedPlayers.map(p => p.seatNumber);
  const emptySeats = [1, 2, 3, 4].filter(s => !occupiedSeats.includes(s));

  // Track used character IDs to avoid duplicates
  const usedIds = seatedPlayers
    .filter(p => p.characterId)
    .map(p => p.characterId);

  const available = TEXASNOMAD_CHARACTERS.filter(c => !usedIds.includes(c.id));
  let pool = [...available].sort(() => Math.random() - 0.5);

  const updatedPlayers = [...players];
  for (const seat of emptySeats) {
    const team = [1, 3].includes(seat) ? 1 : 2;
    const specificId = specificAssignments[seat];

    let character;
    if (specificId && specificId !== 'random') {
      character = TEXASNOMAD_CHARACTERS.find(c => c.id === specificId);
      pool = pool.filter(c => c.id !== specificId);
    } else {
      character = pool.shift();
    }

    if (!character) {
      // Fallback to generic CPU if no characters left
      updatedPlayers.push(createCPUPlayer(seat, team));
    } else {
      updatedPlayers.push(createTNCharacterPlayer(seat, team, character));
    }
  }
  return updatedPlayers;
}

/** Assign a single TN character to a seat (removing any existing player there first) */
export function assignTNCharacterToSeat(players, seatNumber, characterId) {
  const team = [1, 3].includes(seatNumber) ? 1 : 2;
  const filtered = players.filter(p => p.seatNumber !== seatNumber);

  if (!characterId || characterId === 'none') return filtered;

  if (characterId === 'random') {
    const usedIds = filtered.filter(p => p.characterId).map(p => p.characterId);
    const available = TEXASNOMAD_CHARACTERS.filter(c => !usedIds.includes(c.id));
    if (available.length === 0) return filtered;
    const character = available[Math.floor(Math.random() * available.length)];
    return [...filtered, createTNCharacterPlayer(seatNumber, team, character)];
  }

  const character = TEXASNOMAD_CHARACTERS.find(c => c.id === characterId);
  if (!character) return filtered;
  return [...filtered, createTNCharacterPlayer(seatNumber, team, character)];
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

  const context = buildContext(hand, trick, myBid, booksWon, spadesBroken, gameState, mySeatNumber, playedCardIds || new Set());;

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
  const teamHasMadeBid = teamBid > 0 && teamBooksWon >= teamBid;

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
  // Partner is winning if the current trick winner's seat is the partner's seat
  const partnerIsWinning = !!(currentWinner && currentWinner.seatNumber === partnerSeat);

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
  const { hand, bySuit, spadesBroken, teamHasMadeBid, teamNeedsBooksMore, tricksLeft, playedCardIds,
    oppTeamNeedsBooks, oppTeamCanStillMakeBid, setPressure } = ctx;

  const hasNonSpade = hand.some(c => c.suit !== '♠' && c.suit !== 'Joker');

  // ── TEAM HAS MADE BID: Lead aggressively or low depending on set pressure ───
  if (teamHasMadeBid) {
    // SET STRATEGY: If opponents can still make bid, lead aggressively to block them
    if (setPressure >= 1 && oppTeamCanStillMakeBid && oppTeamNeedsBooks > 0) {
      for (const suit of ['♥', '♦', '♣']) {
        const cards = bySuit[suit];
        if (cards.length > 0 && cardVal(cards[0]) === 14 && !playedCardIds.has(`${suit}A`)) {
          return cards[0]; // Lead Ace to force opponents
        }
      }
    }
    return leadAggressive(ctx);
  }

  // ── TEAM NEEDS BOOKS: Lead offensively ──────────────────────────────────────

  // LATE GAME DESPERATION (≤3 tricks left): Lead highest available winner
  if (tricksLeft <= 3 && teamNeedsBooksMore > 0) {
    for (const suit of ['♥', '♦', '♣']) {
      const cards = bySuit[suit];
      if (cards.length > 0 && cardVal(cards[0]) === 14 && !playedCardIds.has(`${suit}A`)) {
        return cards[0];
      }
    }
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[0];
  }

  // FAR BEHIND: Lead Joker if we need 3+ books
  if (teamNeedsBooksMore >= 3 && bySuit['Joker'].length > 0) {
    return bySuit['Joker'][0];
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
      if (playedCardIds.has(`${suit}A`)) return cards[0];
    }
  }

  // LONG SUIT: Lead from long strong suit to establish winners
  const nonSpades = ['♥', '♦', '♣'].filter(s => bySuit[s].length > 0);
  if (nonSpades.length > 0 && hasNonSpade) {
    const longest = nonSpades.reduce((a, b) => bySuit[a].length >= bySuit[b].length ? a : b);
    const cards = bySuit[longest];
    if (cards.length >= 3 && cardVal(cards[0]) >= 13) {
      return cards[0];
    }
  }

  // PULL TRUMP: If spades are broken and we need books, lead high spade
  if (spadesBroken && bySuit['♠'].length > 0 && teamNeedsBooksMore > 0) {
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[0];
  }

  // MUST LEAD SPADES: Only suit available or spades broken
  if (bySuit['♠'].length > 0 && (!hasNonSpade || spadesBroken)) {
    const spades = bySuit['♠'].filter(c => c.value !== 'BJ' && c.value !== 'LJ');
    if (spades.length > 0) return spades[Math.floor(spades.length / 2)];
    return bySuit['Joker'][0] || bySuit['♠'][0];
  }

  // DEFAULT: Lead lowest non-spade (safe lead)
  return leadLowest(bySuit, spadesBroken, hasNonSpade);
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
    activeSuit, partnerIsWinning, teamHasMadeBid, teamNeedsBooksMore, 
    tricksLeft, partnerPlayedMid, winnerStrength,
    oppTeamNeedsBooks, oppTeamCanStillMakeBid, setPressure
  } = ctx;
  
  const iNeedBook = !teamHasMadeBid && teamNeedsBooksMore > 0;
  const lowest = suitCards[suitCards.length - 1]; // suitCards sorted descending → last is lowest

  // Find lowest card that beats the current winner
  const winningCards = suitCards.filter(c => getCardStrength(c, activeSuit) > winnerStrength);

  // ─── PARTNER IS WINNING — highest priority ──────────────────────────────────
  // Never overtake or waste a high card on partner's winning play.
  // Only break this rule in desperate endgame (≤2 tricks left AND team will miss bid
  // AND we have a card that definitely wins).
  if (partnerIsWinning) {
    const desperateEndgame = tricksLeft <= 2 && teamNeedsBooksMore >= tricksLeft && winningCards.length > 0;
    if (desperateEndgame) {
      // Use the absolute cheapest card that wins to take the book ourselves
      return winningCards[winningCards.length - 1];
    }
    // Normal case: duck — play the lowest legal card in suit
    return lowest;
  }

  // ─── OPPONENT IS WINNING ────────────────────────────────────────────────────

  // SET STRATEGY: steal a critical book from opponents cheaply
  if (setPressure >= 1 && oppTeamCanStillMakeBid && oppTeamNeedsBooks > 0 && winningCards.length > 0) {
    const isCriticalBook = oppTeamNeedsBooks <= tricksLeft && tricksLeft <= 3;
    if (isCriticalBook || setPressure >= 2) {
      return winningCards[winningCards.length - 1]; // lowest winner
    }
  }

  // TEAM NEEDS BOOKS: win with cheapest possible card
  if (iNeedBook && winningCards.length > 0) {
    return winningCards[winningCards.length - 1];
  }

  // PARTNER FISHING (mid-card signal): support with highest winner to apply pressure
  if (partnerPlayedMid && iNeedBook && winningCards.length > 0) {
    return winningCards[0]; // highest winner
  }

  // TEAM HAS MADE BID or can't win: dump lowest to avoid bags
  if (teamHasMadeBid) {
    return lowest;
  }

  // LATE GAME DESPERATION: ≤3 tricks left and we need books
  if (iNeedBook && tricksLeft <= 3 && winningCards.length > 0) {
    return winningCards[winningCards.length - 1];
  }

  // DEFAULT: win cheaply if possible, otherwise dump lowest
  return winningCards.length > 0 ? winningCards[winningCards.length - 1] : lowest;
}

function voidPlay(ctx) {
  const {
    bySuit, partnerIsWinning, teamHasMadeBid, teamNeedsBooksMore,
    activeSuit, tricksLeft, winnerStrength, trick, mySeatNumber,
    oppTeamNeedsBooks, oppTeamCanStillMakeBid, setPressure,
  } = ctx;
  const iNeedBook = !teamHasMadeBid && teamNeedsBooksMore > 0;

  // Build all trump (spades + jokers), sort ascending by strength so [0] = lowest
  const spades = [...(bySuit['♠'] || [])];
  const jokers = [...(bySuit['Joker'] || [])];
  const allTrump = [...spades, ...jokers];
  allTrump.sort((a, b) => getCardStrength(a, activeSuit) - getCardStrength(b, activeSuit)); // ascending

  // Lowest trump that still beats the current winner
  const winningTrump = allTrump.filter(c => getCardStrength(c, activeSuit) > winnerStrength);
  // winningTrump[0] = cheapest winning trump (ascending sort)

  // Detect if CPU is last to act this trick
  const seatedCount = (ctx.teamSeats?.length || 0) + (ctx.oppSeats?.length || 0);
  const isLastToPlay = trick.length === seatedCount - 1;

  // ─── PARTNER IS WINNING ─────────────────────────────────────────────────────
  if (partnerIsWinning) {
    // Only override in desperate endgame (partner may still lose to a later player)
    const desperateEndgame = tricksLeft <= 2 && teamNeedsBooksMore >= tricksLeft;
    if (desperateEndgame && winningTrump.length > 0) {
      return winningTrump[0]; // cheapest winning trump
    }
    return sluffLowest(bySuit);
  }

  // ─── OPPONENT IS WINNING ────────────────────────────────────────────────────

  // If we have winning trump, cut — this is the core fix.
  // Use the cheapest winning trump to preserve high trump for later.
  if (winningTrump.length > 0) {
    // Don't burn a Joker if a regular spade can win, unless it's the only option
    const cheapestWinner = winningTrump[0];
    const isJoker = cheapestWinner.suit === 'Joker';

    // If only Jokers can win but we already made bid and it's not critical, sluff
    if (isJoker && teamHasMadeBid && setPressure === 0 && !iNeedBook) {
      return sluffLowest(bySuit);
    }

    return cheapestWinner;
  }

  // No winning trump available — sluff lowest non-trump
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