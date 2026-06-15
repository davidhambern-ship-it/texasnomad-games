import React, { useState, useEffect } from 'react';

export default function SudokuTimer({ timeStart, timeLimit, phase, onExpire }) {
  const [remaining, setRemaining] = useState(timeLimit);

  useEffect(() => {
    if (phase !== 'playing' || !timeStart) {
      setRemaining(timeLimit);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - timeStart) / 1000);
      const left = Math.max(0, timeLimit - elapsed);
      setRemaining(left);
      if (left <= 0 && onExpire) onExpire();
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [phase, timeStart, timeLimit]);

  const mins = Math.floor(remaining / 60);
  const secs = String(remaining % 60).padStart(2, '0');
  const pct = remaining / timeLimit;
  const isUrgent = remaining <= 30;
  const isCritical = remaining <= 10;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 'clamp(20px, 4vw, 36px)',
          color: isCritical ? '#ef4444' : isUrgent ? '#FF5F1F' : '#FFD700',
          textShadow: `0 0 20px ${isCritical ? '#ef4444' : isUrgent ? '#FF5F1F' : '#FFD700'}`,
          letterSpacing: '0.05em',
          animation: isCritical ? 'pulse 0.5s ease-in-out infinite' : 'none',
        }}
      >
        {mins}:{secs}
      </div>
      {/* Progress bar */}
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct * 100}%`,
            background: isCritical
              ? '#ef4444'
              : isUrgent
              ? 'linear-gradient(90deg,#FF5F1F,#ef4444)'
              : 'linear-gradient(90deg,#BC13FE,#FFD700)',
            boxShadow: `0 0 8px ${isCritical ? '#ef4444' : '#FFD700'}`,
          }}
        />
      </div>
    </div>
  );
}