import React from 'react';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Maps seatNumber to visual position in center area
const TRICK_POSITIONS = {
  1: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
  2: { left: 0, top: '50%', transform: 'translateY(-50%)' },
  3: { top: 0, left: '50%', transform: 'translateX(-50%)' },
  4: { right: 0, top: '50%', transform: 'translateY(-50%)' },
};

export default function SpadesCardArea({ trick, players }) {
  // Hide deck after cards are dealt (when players have cards in hand)
  const hasDealtCards = players?.some(p => p.hand && p.hand.length > 0);
  
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72">
      {trick.length === 0 && !hasDealtCards ? (
        <div className="w-full h-full flex items-center justify-center">
          {/* Deck of cards visual */}
          <div className="relative w-20 h-28">
            {[3, 2, 1, 0].map(offset => (
              <div key={offset}
                className="absolute rounded-lg overflow-hidden shadow-lg"
                style={{
                  width: 56, height: 80,
                  top: offset * 1.5,
                  left: offset * 1.5,
                }}>
                <img src={getCardBack()} alt="Card back" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full">
          {trick.map((play, i) => {
            const pos = TRICK_POSITIONS[play.seatNumber] || {};
            const isSpade = play.card?.suit === '♠';
            const isClub = play.card?.suit === '♣';
            const isRed = !isSpade && !isClub;
            return (
              <div key={i}
                className="absolute rounded-lg shadow-2xl overflow-hidden border-2 border-white/20"
                style={{ 
                  ...pos, 
                  position: 'absolute', 
                  width: 104, 
                  height: 144,
                  filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.6))',
                  zIndex: 50
                }}>
                <img src={getCardImage(play.card)} alt={`${play.card?.value}${play.card?.suit}`} className="w-full h-full object-cover rounded-lg" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}