import React, { useState, useEffect } from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Professional seat positions with precise coordinates
const SEAT_POSITIONS = {
  1: { x: 0, y: 220, rotation: 0, label: 'Bottom' },    // Bottom (player)
  2: { x: -240, y: 0, rotation: 90, label: 'Left' },    // Left
  3: { x: 0, y: -220, rotation: 180, label: 'Top' },    // Top
  4: { x: 240, y: 0, rotation: 270, label: 'Right' },   // Right
};

export default function SpadesDealAnimation({ deck, players, onComplete }) {
  const [dealtCards, setDealtCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const DEAL_SPEED = 90; // Fast professional deal speed (0.09s per card)

  const seatedPlayers = (players || [])
    .filter(p => (p.role === 'player' || p.role === 'hostPlayer') && p.seatNumber && p.hand)
    .sort((a, b) => a.seatNumber - b.seatNumber);

  useEffect(() => {
    if (!deck || deck.length === 0 || seatedPlayers.length === 0) {
      onComplete?.();
      return;
    }

    const totalCards = deck.length;
    
    const interval = setInterval(() => {
      if (currentIndex >= totalCards) {
        clearInterval(interval);
        setTimeout(() => onComplete?.(), 400);
        return;
      }

      const playerIndex = currentIndex % seatedPlayers.length;
      const player = seatedPlayers[playerIndex];
      
      setDealtCards(prev => [
        ...prev,
        {
          seatNumber: player.seatNumber,
          indexInHand: prev.filter(c => c.seatNumber === player.seatNumber).length,
          timestamp: Date.now(),
        }
      ]);

      setCurrentIndex(prev => prev + 1);
    }, DEAL_SPEED);

    return () => clearInterval(interval);
  }, [deck.length, seatedPlayers.length, currentIndex, onComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
      {/* Center deck - depleting as cards deal */}
      <div className="relative w-20 h-28 z-30">
        {[4, 3, 2, 1, 0].map(offset => {
          const remainingCards = deck.length - currentIndex;
          const visible = offset < Math.ceil(remainingCards / 10) + 1;
          return visible ? (
            <div
              key={offset}
              className="absolute rounded-lg overflow-hidden shadow-lg transition-all duration-200"
              style={{
                width: 56,
                height: 80,
                top: offset * 1.5,
                left: offset * 1.5,
                opacity: Math.max(0.2, 1 - (currentIndex / deck.length) * 0.8),
                filter: 'brightness(1.05)',
              }}
            >
              <img src={getCardBack()} alt="Card back" className="w-full h-full object-cover" />
            </div>
          ) : null;
        })}
        
        {/* Deck glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 100,
            height: 100,
            top: -10,
            left: -22,
            background: 'radial-gradient(circle, rgba(188,19,254,0.2) 0%, transparent 70%)',
            animation: 'deck-pulse 1s ease-in-out infinite',
          }}
        />
      </div>

      {/* Cards flying to seats with smooth animation */}
      {dealtCards.map((deal, i) => {
        const pos = SEAT_POSITIONS[deal.seatNumber] || SEAT_POSITIONS[1];
        const fanAngle = (deal.indexInHand - 6) * 2.5; // Professional card fan spread
        const fanOffset = deal.indexInHand * 1.5; // Slight spacing in fan
        
        // Calculate final position with fan
        const finalX = pos.x + (pos.rotation === 0 || pos.rotation === 180 ? fanOffset : 0);
        const finalY = pos.y + (pos.rotation === 90 || pos.rotation === 270 ? fanOffset : 0);
        
        return (
          <div
            key={i}
            className="absolute rounded-lg overflow-hidden shadow-2xl"
            style={{
              width: 54,
              height: 76,
              top: '50%',
              left: '50%',
              marginTop: -38,
              marginLeft: -27,
              transform: `translate(${finalX}px, ${finalY}px) rotate(${pos.rotation + fanAngle}deg)`,
              opacity: 1,
              zIndex: 20 + deal.indexInHand,
              animation: `card-fly-deal 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
              animationDelay: `${(i * DEAL_SPEED) / 1000}s`,
              filter: 'brightness(1.08) contrast(1.02)',
            }}
          >
            <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
          </div>
        );
      })}

      {/* Deal progress counter */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className="text-[8px] tracking-widest text-[#FFD700] uppercase" style={PS2}>
          DEALING {Math.min(currentIndex, deck.length)}/{deck.length}
        </div>
      </div>

      <style>{`
        @keyframes card-fly-deal {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.85) rotate(0deg);
          }
          15% {
            opacity: 1;
            transform: translate(var(--start-x, 20px), var(--start-y, -20px)) scale(0.95) rotate(-5deg);
          }
          50% {
            transform: translate(var(--mid-x, 100px), var(--mid-y, 100px)) scale(1.05) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: translate(var(--end-x, 200px), var(--end-y, 200px)) scale(1) rotate(0deg);
          }
        }
        @keyframes deck-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}