import React from 'react';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SUIT_ORDER = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, 'Joker': 4 };
const VALUE_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    const sd = (SUIT_ORDER[a.suit] ?? 5) - (SUIT_ORDER[b.suit] ?? 5);
    return sd !== 0 ? sd : (VALUE_ORDER[a.value] ?? 0) - (VALUE_ORDER[b.value] ?? 0);
  });
}

export default function HostHandBox({ hostPlayerId, players }) {
  // Find the host's seated player record by their exact playerId
  const seatedHost = (players || []).find(
    p => p.playerId === hostPlayerId && p.seatNumber != null && (p.role === 'player' || p.role === 'hostPlayer')
  );

  const hand = seatedHost?.hand || [];
  const sortedHand = hand.length > 0 ? sortHand(hand) : [];

  return (
    <div className="p-4 border-2 border-[#BC13FE]/40 rounded-xl bg-black/60 space-y-3"
      style={{ boxShadow: '0 0 15px rgba(188,19,254,0.1)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xs tracking-[0.2em] text-[#BC13FE]/80 uppercase">🎛 Host Hand</h3>
        {seatedHost && (
          <span className="text-[7px] text-white/40 uppercase" style={PS2}>Seat {seatedHost.seatNumber} · {hand.length} cards</span>
        )}
      </div>

      {!seatedHost ? (
        <div className="text-center py-4 text-[7px] text-white/30 uppercase" style={PS2}>Host is not seated</div>
      ) : hand.length === 0 ? (
        <div className="text-center py-4 text-[7px] text-white/30 uppercase" style={PS2}>No cards dealt yet</div>
      ) : (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {sortedHand.map((card, i) => (
            <div
              key={card.id || i}
              className="rounded-lg overflow-hidden shadow-md border border-white/20"
              style={{ width: 52, height: 74 }}
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

      {seatedHost?.bid != null && (
        <div className="text-center text-[7px] text-[#FFD700]/70 uppercase pt-1 border-t border-white/10" style={PS2}>
          Bid: {seatedHost.bid}{seatedHost.blind ? ' (BLIND)' : ''} · Books: {seatedHost.tricksWon || 0}
        </div>
      )}
    </div>
  );
}