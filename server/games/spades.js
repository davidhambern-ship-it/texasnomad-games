import { randomInt } from 'node:crypto';

export const SPADES_SEATS = [1, 2, 3, 4];

export function defaultSpadesState() {
  return {
    phase: 'setup',
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    targetScore: 500,
    score1: 0,
    score2: 0,
    bid1: null,
    bid2: null,
    books1: 0,
    books2: 0,
    dealerSeat: 1,
    currentBidderSeat: null,
    currentTurnSeat: null,
    currentTrick: [],
    tricksPlayed: 0,
    spadesBroken: false,
    handNumber: 0,
    players: [],
  };
}

export function generateSpadesDeck() {
  const deck = [];
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

  for (const suit of suits) {
    for (const value of values) {
      if ((suit === '♥' || suit === '♦') && value === '2') continue;
      deck.push({ suit, value, id: `${suit}${value}` });
    }
  }

  deck.push({ suit: 'Joker', value: 'LJ', id: 'LittleJoker' });
  deck.push({ suit: 'Joker', value: 'BJ', id: 'BigJoker' });

  return deck;
}

export function shuffleSpadesDeck(deck) {
  const result = [...deck];

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(0, index + 1);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
  }

  const cut = randomInt(0, result.length);
  return [...result.slice(cut), ...result.slice(0, cut)];
}

export function dealSpades(deck, dealerSeat = 1) {
  const hands = new Map(SPADES_SEATS.map((seat) => [seat, []]));
  const dealerIndex = SPADES_SEATS.indexOf(dealerSeat);
  const firstSeatIndex = dealerIndex >= 0 ? (dealerIndex + 1) % SPADES_SEATS.length : 0;

  deck.forEach((card, index) => {
    const seat = SPADES_SEATS[(firstSeatIndex + index) % SPADES_SEATS.length];
    hands.get(seat).push(card);
  });

  return {
    hands,
    firstSeat: SPADES_SEATS[firstSeatIndex],
  };
}


export function isSpadeCard(card) {
  return card?.suit === '♠' || card?.suit === 'Joker';
}

export function getSpadesActiveSuit(trick = []) {
  const lead = trick[0]?.card;
  if (!lead) return null;
  return isSpadeCard(lead) ? '♠' : lead.suit;
}

export function validateSpadesPlay(card, hand = [], trick = [], spadesBroken = false) {
  if (!card || !hand.some((item) => item.id === card.id)) {
    return { valid: false, reason: 'That card is not in the player hand.' };
  }

  const activeSuit = getSpadesActiveSuit(trick);

  if (!activeSuit) {
    if (isSpadeCard(card) && !spadesBroken) {
      const hasNonSpade = hand.some((item) => !isSpadeCard(item));
      if (hasNonSpade) {
        return { valid: false, reason: 'Spades have not been broken yet.' };
      }
    }

    return { valid: true, reason: null };
  }

  const hasActiveSuit = activeSuit === '♠'
    ? hand.some(isSpadeCard)
    : hand.some((item) => item.suit === activeSuit);

  const followsSuit = activeSuit === '♠'
    ? isSpadeCard(card)
    : card.suit === activeSuit;

  if (hasActiveSuit && !followsSuit) {
    return { valid: false, reason: 'You must follow suit.' };
  }

  return { valid: true, reason: null };
}

export function legalSpadesCards(hand = [], trick = [], spadesBroken = false) {
  return hand.filter((card) => validateSpadesPlay(card, hand, trick, spadesBroken).valid);
}

export function spadesCardStrength(card, activeSuit = null) {
  if (!card) return -1;

  const rank = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };

  if (card.value === 'BJ') return 66;
  if (card.value === 'LJ') return 65;
  if (card.suit === '♠') return 50 + (rank[card.value] || 0);
  if (activeSuit && card.suit === activeSuit) return 20 + (rank[card.value] || 0);
  return rank[card.value] || 0;
}

export function determineSpadesTrickWinner(trick = []) {
  if (!trick.length) return null;

  const activeSuit = getSpadesActiveSuit(trick);
  return trick.reduce((winner, play) => (
    spadesCardStrength(play.card, activeSuit) > spadesCardStrength(winner.card, activeSuit)
      ? play
      : winner
  ), trick[0]);
}

export function spadesTeamForSeat(seatNumber) {
  return seatNumber === 1 || seatNumber === 3 ? 1 : 2;
}

export function nextSpadesSeat(seatNumber) {
  const index = SPADES_SEATS.indexOf(seatNumber);
  return SPADES_SEATS[index >= 0 ? (index + 1) % SPADES_SEATS.length : 0];
}

export function chooseCpuSpadesCard(hand = [], trick = [], spadesBroken = false) {
  const legal = legalSpadesCards(hand, trick, spadesBroken);
  if (!legal.length) return null;
  return legal[randomInt(0, legal.length)];
}
