import React, { useState, useEffect } from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Seat positions relative to center
const SEAT_POSITIONS = {
  1: { x: 0, y: 200, rotation: 0 },    // Bottom
  2: { x: -220, y: 0, rotation: 90 },  // Left  
  3: { x: 0, y: -200, rotation: 180 }, // Top
  4: { x: 220, y: 0, rotation: 270 },  // Right
};

export default function SpadesDealAnimation({ deck, players, onComplete }) {
  const [dealtCards, setDealtCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const seatedPlayers = (players || [])
    .filter(p => (p.role === 'player' || p.role === 'hostPlayer') && p.seatNumber && p.hand)
    .sort((a, b) => a.seatNumber - b.seatNumber);

  useEffect(() => {
    if (!deck || deck.length === 0 || seatedPlayers.length === 0) {
      onComplete?.();
      return;
    }

    const totalCards = deck.length;
    const dealSpeed = 80; // ms per card (fast for satisfying deal)
    
    const interval = setInterval(() => {
      if (currentIndex >= totalCards) {
        clearInterval(interval);
        setTimeout(() => onComplete?.(), 300);
        return;
      }

      const playerIndex = currentIndex % seatedPlayers.length;
      const player = seatedPlayers[playerIndex];
      
      setDealtCards(prev => [
        ...prev,
        {
          seatNumber: player.seatNumber,
          indexInHand: prev.filter(c => c.seatNumber === player.seatNumber).length,
        }
      ]);

      setCurrentIndex(prev => prev + 1);
    }, dealSpeed);

    return () => clearInterval(interval);
  }, [deck.length, seatedPlayers.length, currentIndex, onComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Center deck */}
      <div className="relative w-20 h-28 z-30">
        {[3, 2, 1, 0].map(offset => (
          <div
            key={offset}
            className="absolute rounded-lg overflow-hidden shadow-lg"
            style={{
              width: 56,
              height: 80,
              top: offset * 1.5,
              left: offset * 1.5,
              opacity: Math.max(0.3, 1 - (currentIndex / deck.length) * 0.7),
            }}
          >
            <img src={getCardBack()} alt="Card back" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* Flying cards */}
      {dealtCards.map((deal, i) => {
        const pos = SEAT_POSITIONS[deal.seatNumber] || SEAT_POSITIONS[1];
        const fanAngle = (deal.indexInHand - 6) * 3; // Spread cards in arc
        const distance = 160 + deal.indexInHand * 2;
        
        return (
          <div
            key={i}
            className="absolute rounded-lg overflow-hidden shadow-xl"
            style={{
              width: 52,
              height: 72,
              top: '50%',
              left: '50%',
              marginTop: -36,
              marginLeft: -26,
              transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation + fanAngle}deg)`,
              opacity: 1,
              zIndex: 20,
            }}
          >
            <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
          </div>
        );
      })}

      {/* Status text */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className="text-[8px] tracking-widest text-[#4ade80] uppercase" style={PS2}>
          ✓ Dealing Cards... {Math.min(currentIndex, deck.length)}/{deck.length}
        </div>
      </div>

      <style>{`
        @keyframes card-deal-fly {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.8);
          }
          100% {
            opacity: 1;
            transform: translate(var(--target-x), var(--target-y)) scale(1);
          }
        }
      `}</style>
    </div>
  );
}