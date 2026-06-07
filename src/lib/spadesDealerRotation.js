// Handles automatic dealer rotation and CPU-triggered shuffle/deal

import { shuffleAndDealToPlayers } from '@/lib/spadesRules';

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

  const { handsBySeatNumber } = shuffleAndDealToPlayers(seated, dealerSeat);

  const updatedPlayers = players.map(p => {
    if (p.role !== 'player' && p.role !== 'hostPlayer') return p;
    return {
      ...p,
      hand: handsBySeatNumber.get(p.seatNumber) || [],
      bid: null,
      tricksWon: 0,
    };
  });

  const sortedSeated = [...seated].sort((a, b) => a.seatNumber - b.seatNumber);
  const dealerIdx = sortedSeated.findIndex(p => p.seatNumber === dealerSeat);
  const firstBidder = sortedSeated[(dealerIdx + 1) % sortedSeated.length];

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
    deck_shuffled: true,
    deal_start_seat: firstBidder?.seatNumber ?? null,
  });
}