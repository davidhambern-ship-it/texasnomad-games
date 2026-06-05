import React, { useEffect, useState } from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * Professional Shuffle Animation Component
 * Shows cards gathering, riffling, and settling with particle effects
 */
export default function SpadesShuffleAnimation({ phase, onComplete }) {
  const [animationStage, setAnimationStage] = useState(0);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (phase !== 'shuffling') return;

    // Stage 1: Cards gather (0-300ms)
    const t1 = setTimeout(() => setAnimationStage(1), 50);
    
    // Stage 2: Deck lifts and glows (300-600ms)
    const t2 = setTimeout(() => setAnimationStage(2), 400);
    
    // Stage 3: First riffle shuffle (600-1200ms)
    const t3 = setTimeout(() => {
      setAnimationStage(3);
      generateParticles();
    }, 700);
    
    // Stage 4: Second riffle (1200-1600ms)
    const t4 = setTimeout(() => setAnimationStage(4), 1300);
    
    // Stage 5: Deck spins with particles (1600-2000ms)
    const t5 = setTimeout(() => {
      setAnimationStage(5);
      generateParticles();
    }, 1700);
    
    // Stage 6: Deck settles (2000-2400ms)
    const t6 = setTimeout(() => {
      setAnimationStage(6);
      setTimeout(onComplete, 400);
    }, 2100);

    return () => {
      [t1, t2, t3, t4, t5, t6].forEach(t => clearTimeout(t));
    };
  }, [phase]);

  const generateParticles = () => {
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 200 - 100,
      y: Math.random() * 200 - 100,
      color: i % 2 === 0 ? '#BC13FE' : '#FF5F1F',
      size: Math.random() * 6 + 4,
      delay: Math.random() * 0.3,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 800);
  };

  if (phase !== 'shuffling') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-visible">
      {/* Deck container */}
      <div className="relative w-20 h-28">
        {/* Card layers - gather animation */}
        {[7, 6, 5, 4, 3, 2, 1, 0].map(offset => {
          const offsets = {
            0: { top: offset * 1.5, left: offset * 1.5, rotate: 0, opacity: 1 },
            1: { top: 10 + offset * 1.2, left: offset * 1.2, rotate: -5, opacity: 0.95 },
            2: { top: 15 + offset * 1, left: offset, rotate: 5, opacity: 0.9 },
            3: { top: 12 + offset * 0.8, left: offset * 0.8, rotate: -3, opacity: 0.85 },
            4: { top: 10 + offset * 0.6, left: offset * 0.6, rotate: 2, opacity: 0.8 },
            5: { top: 8 + offset * 0.4, left: offset * 0.4, rotate: -1, opacity: 0.85 },
            6: { top: 6 + offset * 0.3, left: offset * 0.3, rotate: 1, opacity: 0.9 },
          };
          const style = offsets[animationStage] || offsets[0];
          
          return (
            <div
              key={offset}
              className="absolute rounded-lg overflow-hidden shadow-lg transition-all duration-300 ease-out"
              style={{
                width: 56,
                height: 80,
                top: style.top,
                left: style.left,
                transform: `rotate(${style.rotate}deg)`,
                opacity: style.opacity,
                filter: animationStage >= 2 ? 'brightness(1.2)' : 'brightness(1)',
              }}>
              <img src={getCardBack()} alt="Card back" className="w-full h-full object-cover" />
            </div>
          );
        })}

        {/* Riffle split - Stage 3 & 4 */}
        {(animationStage === 3 || animationStage === 4) && (
          <>
            {/* Left half */}
            {[0, 1, 2, 3].map(i => (
              <div
                key={`left-${i}`}
                className="absolute rounded-lg overflow-hidden transition-all duration-200"
                style={{
                  width: 28,
                  height: 80,
                  top: 0,
                  left: -15 + i * 8,
                  transform: `rotate(${-10 + i * 5}deg)`,
                  opacity: 0.9,
                }}>
                <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
              </div>
            ))}
            {/* Right half */}
            {[0, 1, 2, 3].map(i => (
              <div
                key={`right-${i}`}
                className="absolute rounded-lg overflow-hidden transition-all duration-200"
                style={{
                  width: 28,
                  height: 80,
                  top: 0,
                  right: -15 + i * 8,
                  transform: `rotate(${10 - i * 5}deg)`,
                  opacity: 0.9,
                }}>
                <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
              </div>
            ))}
          </>
        )}

        {/* Spin animation - Stage 5 */}
        {animationStage === 5 && (
          <div
            className="absolute rounded-lg overflow-hidden"
            style={{
              width: 56,
              height: 80,
              top: 8,
              left: 8,
              animation: 'deck-spin 0.4s ease-in-out',
            }}>
            <img src={getCardBack()} alt="Deck" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Settled deck - Stage 6 */}
        {animationStage === 6 && (
          <div
            className="absolute rounded-lg overflow-hidden shadow-2xl"
            style={{
              width: 56,
              height: 80,
              top: 8,
              left: 8,
              boxShadow: '0 0 30px rgba(188,19,254,0.6), 0 0 60px rgba(255,95,31,0.3)',
            }}>
            <img src={getCardBack()} alt="Deck" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Glow effect - Stage 2+ */}
        {animationStage >= 2 && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 120,
              height: 120,
              top: -20,
              left: -32,
              background: 'radial-gradient(circle, rgba(188,19,254,0.4) 0%, transparent 70%)',
              animation: 'pulse-glow 0.6s ease-in-out',
            }}
          />
        )}

        {/* Particles - Stage 3 & 5 */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: p.size,
              height: p.size,
              top: `calc(50% + ${p.y}px)`,
              left: `calc(50% + ${p.x}px)`,
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              opacity: 0,
              animation: `particle-fade 0.6s ease-out ${p.delay}s forwards`,
            }}
          />
        ))}
      </div>

      {/* Status text */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className={`text-[8px] tracking-widest uppercase transition-all duration-300 ${
          animationStage >= 6 ? 'text-[#4ade80] opacity-100' : 'text-[#FFD700]/70 opacity-80'
        }`} style={PS2}>
          {animationStage >= 6 ? '✓ Deck Shuffled' : '⏳ Shuffling...'}
        </div>
      </div>

      <style>{`
        @keyframes deck-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes particle-fade {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.5); }
        }
      `}</style>
    </div>
  );
}