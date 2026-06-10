import React, { useEffect, useState, useRef } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const TIMER_SECONDS = 10;

/**
 * SpadesBidTimer — circular countdown ring for bidding
 * Props:
 *   isActive: boolean — is this player currently bidding?
 *   playerName: string
 *   onTimeout: () => void — called when timer hits 0
 *   onBidPlaced: boolean — set to true to stop/reset timer
 */
export default function SpadesBidTimer({ isActive, playerName, onTimeout, onBidPlaced }) {
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const intervalRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      clearInterval(intervalRef.current);
      setTimeLeft(TIMER_SECONDS);
      firedRef.current = false;
      return;
    }
    if (onBidPlaced) {
      clearInterval(intervalRef.current);
      return;
    }

    firedRef.current = false;
    setTimeLeft(TIMER_SECONDS);

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (!firedRef.current) {
            firedRef.current = true;
            onTimeout?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isActive, onBidPlaced]);

  if (!isActive) return null;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / TIMER_SECONDS;
  const dashOffset = circumference * (1 - progress);
  const color = timeLeft > 6 ? '#4ade80' : timeLeft > 3 ? '#FFD700' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="absolute inset-0" width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <span style={{ ...PS2, fontSize: 14, color }}>{timeLeft}</span>
      </div>
      <div style={{ ...PS2, fontSize: 7, color: '#ffffff80' }} className="uppercase tracking-widest text-center">
        {playerName} bidding…
      </div>
    </div>
  );
}