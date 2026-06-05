import React, { useState, useEffect, useRef } from 'react';

const sty = { fontFamily: "'Press Start 2P', monospace" };
const LETTERS = ['B', 'Y', 'E'];
// Dimmed colors for inline display — readable but not overpowering
const COLORS_INLINE = ['#cc4400', '#8a0eb5', '#cc9900'];
// Slightly brighter for the flash popups but still reduced
const COLORS_FLASH = ['#FF5F1F', '#BC13FE', '#FFD700'];

export default function BYEDisplay({ byeCount = 0, byeFlash = 0 }) {
  const [flashLetter, setFlashLetter] = useState(null);
  const [showFullBye, setShowFullBye] = useState(false);
  const prevByeCount = useRef(byeCount);
  const prevByeFlash = useRef(byeFlash);

  // Detect new strike — animate the newly added letter
  useEffect(() => {
    if (byeCount > prevByeCount.current && byeCount >= 1 && byeCount <= 3) {
      const newLetterIdx = byeCount - 1;
      setFlashLetter(newLetterIdx);
      setTimeout(() => setFlashLetter(null), 1500);
    }
    if (byeCount === 3 && prevByeCount.current < 3) {
      setTimeout(() => { setShowFullBye(true); setTimeout(() => setShowFullBye(false), 2500); }, 400);
    }
    prevByeCount.current = byeCount;
  }, [byeCount]);

  // Host-triggered BYE animation
  useEffect(() => {
    if (byeFlash && byeFlash !== prevByeFlash.current) {
      setShowFullBye(true);
      setTimeout(() => setShowFullBye(false), 2500);
      prevByeFlash.current = byeFlash;
    }
  }, [byeFlash]);

  return (
    <>
      {/* Full BYE popup — reduced bloom */}
      {showFullBye && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex gap-2" style={{ filter: 'drop-shadow(0 0 15px rgba(255,95,31,0.6))' }}>
            {LETTERS.map((l, i) => (
              <div key={l} className="font-heading text-[18vw] leading-none"
                style={{ ...sty, color: COLORS_FLASH[i], textShadow: `0 0 20px ${COLORS_FLASH[i]}, 0 0 40px ${COLORS_FLASH[i]}60` }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flash single letter popup — reduced bloom */}
      {flashLetter !== null && !showFullBye && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
          <div className="font-heading" style={{
            ...sty,
            fontSize: '25vw',
            color: COLORS_FLASH[flashLetter],
            textShadow: `0 0 30px ${COLORS_FLASH[flashLetter]}80, 0 0 60px ${COLORS_FLASH[flashLetter]}40`,
            animation: 'byeFlashIn 1.5s ease-out forwards',
          }}>
            {LETTERS[flashLetter]}
          </div>
          <style>{`
            @keyframes byeFlashIn {
              0%   { opacity: 0; transform: scale(2.5); }
              20%  { opacity: 1; transform: scale(1); }
              70%  { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(0.8); }
            }
          `}</style>
        </div>
      )}

      {/* Inline BYE letters display — dimmer, still readable */}
      <div className="flex items-center justify-center gap-3">
        {LETTERS.map((letter, i) => {
          const active = i < byeCount;
          const isLatest = i === byeCount - 1 && flashLetter === i;
          return (
            <div key={letter}
              className="font-heading transition-all duration-300"
              style={{
                ...sty,
                fontSize: '2.5rem',
                color: active ? COLORS_INLINE[i] : '#ffffff10',
                textShadow: active ? `0 0 8px ${COLORS_INLINE[i]}` : 'none',
                transform: isLatest ? 'scale(1.4)' : 'scale(1)',
              }}>
              {letter}
            </div>
          );
        })}
      </div>

      {byeCount >= 3 && (
        <div className="text-center mt-1 text-[8px] tracking-[0.3em] uppercase animate-pulse"
          style={{ ...sty, color: '#FF5F1F' }}>
          BYE COMPLETE
        </div>
      )}
    </>
  );
}