import React from 'react';
import { getCardImage } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Maps seatNumber to visual position in center area
const TRICK_POSITIONS = {
  1: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
  2: { left: 0, top: '50%', transform: 'translateY(-50%)' },
  3: { top: 0, left: '50%', transform: 'translateX(-50%)' },
  4: { right: 0, top: '50%', transform: 'translateY(-50%)' },
};

export default function SpadesCardArea({ trick, players }) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56">
      {trick.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          {/* Deck of cards visual */}
          <div className="relative w-20 h-28">
            {[3, 2, 1, 0].map(offset => (
              <div key={offset}
                className="absolute rounded-lg border border-gray-300 bg-white"
                style={{
                  width: 56, height: 80,
                  top: offset * 1.5,
                  left: offset * 1.5,
                  background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}>
                <div className="absolute inset-1.5 rounded"
                  style={{ background: 'repeating-linear-gradient(45deg, #1a4d8f 0px, #1a4d8f 6px, #154080 6px, #154080 12px)' }} />
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
                className="absolute rounded-lg shadow-xl overflow-hidden"
                style={{ ...pos, position: 'absolute', width: 52, height: 72 }}>
                {getCardImage(play.card) ? (
                  <img src={getCardImage(play.card)} alt={`${play.card?.value}${play.card?.suit}`} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <div className="w-full h-full rounded-lg bg-white border-2 border-gray-300 flex flex-col items-center justify-center">
                    <span className={`text-lg leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{play.card?.suit}</span>
                    <span className={`text-xs leading-none font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{play.card?.value}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}