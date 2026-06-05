import React, { useEffect, useState } from 'react';
import { getCardImage } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Seat positions relative to center
const SEAT_POSITIONS = {
  1: { startX: 0, startY: 220, endX: 0, endY: 40 },    // Bottom to center-bottom
  2: { startX: -240, startY: 0, endX: -40, endY: 0 },  // Left to center-left
  3: { startX: 0, startY: -220, endX: 0, endY: -40 },  // Top to center-top
  4: { startX: 240, startY: 0, endX: 40, endY: 0 },    // Right to center-right
};

export default function SpadesCardPlayAnimation({ 
  card, 
  seatNumber, 
  onComplete 
}) {
  const [phase, setPhase] = useState('start'); // start, flying, landed
  const pos = SEAT_POSITIONS[seatNumber] || { startX: 0, startY: 100, endX: 0, endY: 0 };

  useEffect(() => {
    if (!card) return;

    // Start flying immediately
    setPhase('flying');

    // Land after animation
    const landTimeout = setTimeout(() => {
      setPhase('landed');
    }, 600);

    // Complete after landing
    const completeTimeout = setTimeout(() => {
      onComplete?.();
    }, 1000);

    return () => {
      clearTimeout(landTimeout);
      clearTimeout(completeTimeout);
    };
  }, [card, onComplete]);

  const isRed = card.suit === '♥' || card.suit === '♦';

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        width: 64,
        height: 88,
        marginTop: -44,
        marginLeft: -32,
        animation: phase === 'flying' 
          ? 'card-play-fly 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
          : 'card-play-land 0.3s ease-out forwards',
        '--start-x': `${pos.startX}px`,
        '--start-y': `${pos.startY}px`,
        '--start-rotation': seatNumber === 1 ? 0 : seatNumber === 2 ? -90 : seatNumber === 3 ? 180 : 90,
        '--end-x': `${pos.endX}px`,
        '--end-y': `${pos.endY}px`,
        '--end-rotation': 0,
      }}
    >
      <div
        className="w-full h-full rounded-xl overflow-hidden shadow-2xl"
        style={{
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(188,19,254,0.3)',
        }}
      >
        {getCardImage(card) ? (
          <img
            src={getCardImage(card)}
            alt={`${card.value}${card.suit}`}
            className="w-full h-full object-cover"
            style={{
              filter: 'brightness(1.25) contrast(1.15) saturate(1.1)',
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-white to-gray-100 flex flex-col items-center justify-center">
            <span className={`text-3xl leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              {card.suit}
            </span>
            <span className={`text-lg leading-none font-bold mt-1 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              {card.value}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes card-play-fly {
          0% {
            opacity: 0;
            transform: translate(var(--start-x), var(--start-y)) 
              scale(1) rotate(var(--start-rotation));
          }
          10% {
            opacity: 1;
            transform: translate(
              calc(var(--start-x) * 0.9), 
              calc(var(--start-y) * 0.9)
            ) scale(1.1) rotate(var(--start-rotation));
          }
          50% {
            transform: translate(
              calc(var(--start-x) * 0.5 + var(--end-x) * 0.5), 
              calc(var(--start-y) * 0.5 + var(--end-y) * 0.5)
            ) scale(1.15) rotate(calc(var(--start-rotation) * 0.5));
          }
          100% {
            opacity: 1;
            transform: translate(var(--end-x), var(--end-y)) 
              scale(1) rotate(var(--end-rotation));
          }
        }
        @keyframes card-play-land {
          0% {
            transform: translate(var(--end-x), var(--end-y)) 
              scale(1.05) rotate(var(--end-rotation));
            filter: brightness(1.3);
          }
          100% {
            transform: translate(var(--end-x), var(--end-y)) 
              scale(1) rotate(var(--end-rotation));
            filter: brightness(1);
          }
        }
      `}</style>
    </div>
  );
}