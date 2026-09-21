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
