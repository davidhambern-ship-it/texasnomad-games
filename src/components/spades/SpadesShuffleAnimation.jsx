import React, { useEffect, useState } from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * Professional Shuffle Animation - Modern Western Digital Card Room
 * Stages: Gather → Lift → Riffle 1 → Riffle 2 → Spin → Settle
 */
export default function SpadesShuffleAnimation({ phase, onComplete }) {
  const [animationStage, setAnimationStage] = useState(0);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (phase !== 'shuffling') return;

    // Professional shuffle timing: 1.5-2.5 seconds total
    const t1 = setTimeout(() => setAnimationStage(1), 50);      // Gather
    const t2 = setTimeout(() => setAnimationStage(2), 350);     // Lift & glow
    const t3 = setTimeout(() => {                                // First riffle
      setAnimationStage(3);
      generateParticles();
    }, 650);
    const t4 = setTimeout(() => setAnimationStage(4), 1100);    // Second riffle
    const t5 = setTimeout(() => {                                // Spin with particles
      setAnimationStage(5);
      generateParticles();
    }, 1500);
    const t6 = setTimeout(() => {                                // Settle
      setAnimationStage(6);
      setTimeout(onComplete, 300);
    }, 1900);

    return () => {
      [t1, t2, t3, t4, t5, t6].forEach(t => clearTimeout(t));
    };
  }, [phase]);

  const generateParticles = () => {
    const newParticles = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: Math.random() * 240 - 120,
      y: Math.random() * 240 - 120,
      color: i % 3 === 0 ? '#BC13FE' : i % 3 === 1 ? '#FF5F1F' : '#FFD700',
      size: Math.random() * 8 + 4,
      delay: Math.random() * 0.2,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 600);
  };

  if (phase !== 'shuffling') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-visible">
      {/* Deck container */}
      <div className="relative w-20 h-28">
        {/* Card layers with smooth gathering */}
        {[7, 6, 5, 4, 3, 2, 1, 0].map(offset => {
          const stageStyles = {
            0: { top: 20 + offset * 3, left: offset * 2, rotate: (offset % 2) * 15 - 7.5, opacity: 0.7, scale: 0.9 },
            1: { top: 12 + offset * 1.5, left: offset * 1.2, rotate: (offset % 2) * 8 - 4, opacity: 0.85, scale: 0.95 },
            2: { top: 8 + offset * 1.2, left: offset * 0.8, rotate: (offset % 2) * 5 - 2.5, opacity: 0.9, scale: 0.98 },
            3: { top: 6 + offset * 1, left: offset * 0.6, rotate: (offset % 2) * 3 - 1.5, opacity: 0.95, scale: 1 },
            4: { top: 8 + offset * 0.8, left: offset * 0.4, rotate: (offset % 2) * 2 - 1, opacity: 0.95, scale: 1 },
            5: { top: 6 + offset * 0.5, left: offset * 0.3, rotate: (offset % 2) - 0.5, opacity: 1, scale: 1 },
            6: { top: 8, left: 8, rotate: 0, opacity: 1, scale: 1 },
          };
          const style = stageStyles[animationStage] || stageStyles[0];
          
          return (
            <div
              key={offset}
              className="absolute rounded-lg overflow-hidden shadow-lg transition-all duration-300 ease-out"
              style={{
                width: 56,
                height: 80,
                top: style.top,
                left: style.left,
                transform: `rotate(${style.rotate}deg) scale(${style.scale})`,
                opacity: style.opacity,
                filter: animationStage >= 2 ? 'brightness(1.15) contrast(1.05)' : 'brightness(1)',
                zIndex: offset,
              }}>
              <img src={getCardBack()} alt="Card back" className="w-full h-full object-cover" />
            </div>
          );
        })}

        {/* Professional Riffle - Stage 3 (first riffle) */}
        {animationStage === 3 && (
          <>
            {/* Left half - splitting */}
            {[0, 1, 2, 3].map(i => (
              <div
                key={`l-${i}`}
                className="absolute rounded-lg overflow-hidden transition-all duration-250 ease-out"
                style={{
                  width: 26,
                  height: 80,
                  top: -5,
                  left: -18 + i * 9,
                  transform: `rotate(${-12 + i * 6}deg) translateY(-8px)`,
                  opacity: 0.92,
                  filter: 'brightness(1.1)',
                }}>
                <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
              </div>
            ))}
            {/* Right half - splitting */}
            {[0, 1, 2, 3].map(i => (
              <div
                key={`r-${i}`}
                className="absolute rounded-lg overflow-hidden transition-all duration-250 ease-out"
                style={{
                  width: 26,
                  height: 80,
                  top: -5,
                  right: -18 + i * 9,
                  transform: `rotate(${12 - i * 6}deg) translateY(-8px)`,
                  opacity: 0.92,
                  filter: 'brightness(1.1)',
                }}>
                <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
              </div>
            ))}
          </>
        )}

        {/* Professional Riffle - Stage 4 (interweave) */}
        {animationStage === 4 && (
          <>
            {/* Interweaved cards */}
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div
                key={`iw-${i}`}
                className="absolute rounded-lg overflow-hidden transition-all duration-200"
                style={{
                  width: i % 2 === 0 ? 24 : 26,
                  height: 80,
                  top: i % 2 === 0 ? -3 : 0,
                  left: -20 + i * 7,
                  transform: `rotate(${(i % 2 === 0 ? -8 : 8) + (i - 3) * 2}deg)`,
                  opacity: 0.95,
                  filter: 'brightness(1.08)',
                  zIndex: i,
                }}>
                <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
              </div>
            ))}
          </>
        )}

        {/* Spin with glow - Stage 5 */}
        {animationStage === 5 && (
          <>
            <div
              className="absolute rounded-lg overflow-hidden"
              style={{
                width: 56,
                height: 80,
                top: 8,
                left: 8,
                animation: 'deck-spin-fast 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: 'brightness(1.2)',
              }}>
              <img src={getCardBack()} alt="Deck" className="w-full h-full object-cover" />
            </div>
            {/* Spin glow trail */}
            <div
              className="absolute rounded-full"
              style={{
                width: 140,
                height: 140,
                top: -30,
                left: -42,
                background: 'radial-gradient(circle, rgba(188,19,254,0.3) 0%, transparent 70%)',
                animation: 'pulse-glow 0.25s ease-in-out',
              }}
            />
          </>
        )}

        {/* Settled deck - Stage 6 (final) */}
        {animationStage === 6 && (
          <div
            className="absolute rounded-lg overflow-hidden shadow-2xl"
            style={{
              width: 56,
              height: 80,
              top: 8,
              left: 8,
              boxShadow: '0 0 40px rgba(188,19,254,0.5), 0 0 80px rgba(255,95,31,0.25), inset 0 0 20px rgba(188,19,254,0.1)',
              filter: 'brightness(1.1)',
            }}>
            <img src={getCardBack()} alt="Deck" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Ambient glow - Stage 2+ */}
        {animationStage >= 2 && animationStage <= 5 && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 140,
              height: 140,
              top: -30,
              left: -42,
              background: 'radial-gradient(circle, rgba(188,19,254,0.35) 0%, rgba(255,95,31,0.15) 50%, transparent 75%)',
              animation: 'ambient-pulse 0.8s ease-in-out infinite',
            }}
          />
        )}

        {/* Particle effects */}
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
              boxShadow: `0 0 ${p.size * 2}px ${p.color}, 0 0 ${p.size * 4}px ${p.color}66`,
              opacity: 0,
              animation: `particle-burst 0.5s ease-out ${p.delay}s forwards`,
            }}
          />
        ))}
      </div>

      {/* Status text */}
      <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className={`text-[8px] tracking-widest uppercase transition-all duration-300 ${
          animationStage >= 6 ? 'text-[#4ade80] opacity-100' : 'text-[#FFD700]/80 opacity-90'
        }`} style={PS2}>
          {animationStage >= 6 ? '✓ DECK SHUFFLED' : '⏳ SHUFFLING...'}
        </div>
      </div>

      <style>{`
        @keyframes deck-spin-fast {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.08); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes particle-burst {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(0.6); }
        }
        @keyframes ambient-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}