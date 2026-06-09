import React, { useState } from 'react';
import { getCardImage } from '@/lib/spadesCardImages';
import { isValidPlay, getActiveSuit, checkSpadesBroken } from '@/lib/spadesRules';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SUIT_ORDER = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, 'Joker': 4 };
const VALUE_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    const sd = (SUIT_ORDER[a.suit] ?? 5) - (SUIT_ORDER[b.suit] ?? 5);
    return sd !== 0 ? sd : (VALUE_ORDER[a.value] ?? 0) - (VALUE_ORDER[b.value] ?? 0);
  });
}

export default function HostHandBox({ hostPlayerId, players, gs, updateState }) {
  const [error, setError] = useState('');

  const seatedHost = (players || []).find(
    p => p.playerId === hostPlayerId && p.seatNumber != null && (p.role === 'player' || p.role === 'hostPlayer')
  );

  const hand = seatedHost?.hand || [];
  const sortedHand = hand.length > 0 ? sortHand(hand) : [];

  const isMyTurn = gs?.phase === 'playing' && gs?.current_turn_seat === seatedHost?.seatNumber;

  const handlePlayCard = async (card) => {
    if (!isMyTurn || !seatedHost) return;

    const trick = gs.current_trick || [];
    const activeSuit = getActiveSuit(trick);
    const isLead = trick.length === 0;

    const { valid, errors } = isValidPlay(card, hand, trick, activeSuit, gs.spades_broken, isLead);
    if (!valid) {
      setError(errors[0] || 'Invalid play');
      setTimeout(() => setError(''), 2500);
      return;
    }

    setError('');

    const newTrick = [...trick, { seatNumber: seatedHost.seatNumber, playerId: hostPlayerId, card }];
    const newHand = hand.filter(c => c.id !== card.id);
    const newSpadesBroken = checkSpadesBroken(newTrick, gs.spades_broken);

    const updatedPlayers = players.map(p =>
      p.playerId === hostPlayerId ? { ...p, hand: newHand, lastActionAt: Date.now() } : p
    );

    // Advance turn to next seated player
    const seated = players
      .filter(p => p.seatNumber != null && (p.role === 'player' || p.role === 'hostPlayer'))
      .sort((a, b) => a.seatNumber - b.seatNumber);

    const currentIdx = seated.findIndex(p => p.seatNumber === seatedHost.seatNumber);
    const nextPlayer = seated[(currentIdx + 1) % seated.length];

    await updateState({
      players: updatedPlayers,
      current_trick: newTrick,
      current_turn_seat: nextPlayer?.seatNumber ?? seatedHost.seatNumber,
      spades_broken: newSpadesBroken,
    });
  };

  return (
    <div className="p-4 border-2 border-[#BC13FE]/40 rounded-xl bg-black/60 space-y-3"
      style={{ boxShadow: '0 0 15px rgba(188,19,254,0.1)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xs tracking-[0.2em] text-[#BC13FE]/80 uppercase">🎛 Host Hand</h3>
        <div className="flex items-center gap-3">
          {isMyTurn && (
            <span className="text-[7px] text-[#FFD700] uppercase animate-pulse" style={PS2}>▶ YOUR TURN</span>
          )}
          {seatedHost && (
            <span className="text-[7px] text-white/40 uppercase" style={PS2}>Seat {seatedHost.seatNumber} · {hand.length} cards</span>
          )}
        </div>
      </div>

      {!seatedHost ? (
        <div className="text-center py-4 text-[7px] text-white/30 uppercase" style={PS2}>Host is not seated</div>
      ) : hand.length === 0 ? (
        <div className="text-center py-4 text-[7px] text-white/30 uppercase" style={PS2}>No cards dealt yet</div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center">
          {sortedHand.map((card, i) => (
            <div
              key={card.id || i}
              onClick={() => handlePlayCard(card)}
              className={`rounded-lg overflow-hidden shadow-md border transition-all duration-200 ${
                isMyTurn
                  ? 'border-[#FFD700]/60 cursor-pointer hover:-translate-y-3 hover:shadow-[0_0_18px_rgba(255,215,0,0.5)] hover:z-30'
                  : 'border-white/20 cursor-not-allowed opacity-75'
              }`}
              style={{ width: 56, height: 80, position: 'relative' }}
            >
              <img
                src={getCardImage(card)}
                alt={`${card.value}${card.suit}`}
                className="w-full h-full object-contain"
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center text-[7px] text-red-400 uppercase animate-shake" style={PS2}>{error}</div>
      )}

      {seatedHost?.bid != null && (
        <div className="text-center text-[7px] text-[#FFD700]/70 uppercase pt-1 border-t border-white/10" style={PS2}>
          Bid: {seatedHost.bid}{seatedHost.blind ? ' (BLIND)' : ''} · Books: {seatedHost.tricksWon || 0}
        </div>
      )}
    </div>
  );
}