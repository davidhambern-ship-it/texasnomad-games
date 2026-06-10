import React, { useState, useEffect, useRef } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * BFFBuzzer — handles the GET READY → question reveal → buzzer phase
 * Props:
 *   phase: 'get_ready' | 'buzzer_active' | 'buzzed' | null
 *   buzzWinner: { playerName, teamName } | null
 *   canBuzz: boolean (human is allowed to buzz)
 *   onBuzz: () => void
 */
export default function BFFBuzzer({ phase, buzzWinner, canBuzz, onBuzz }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (phase !== 'buzzer_active') return;
    const id = setInterval(() => setPulse(p => !p), 400);
    return () => clearInterval(id);
  }, [phase]);

  if (!phase || phase === 'playing') return null;

  if (phase === 'get_ready') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="text-[#FFD700] animate-pulse" style={{ ...PS2, fontSize: '14px', letterSpacing: '0.4em' }}>
          GET READY!
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-3 rounded-full bg-[#FFD700] animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'buzzer_active') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="text-[7px] tracking-widest text-[#FF5F1F] uppercase animate-pulse" style={PS2}>
          ⚡ BUZZ IN NOW!
        </div>
        <button
          onClick={canBuzz ? onBuzz : undefined}
          disabled={!canBuzz}
          className="relative w-32 h-32 rounded-full border-4 font-heading text-2xl tracking-widest uppercase transition-all active:scale-90 disabled:opacity-40"
          style={{
            borderColor: pulse ? '#FFD700' : '#FF5F1F',
            background: pulse ? '#FFD70020' : '#FF5F1F20',
            color: pulse ? '#FFD700' : '#FF5F1F',
            boxShadow: pulse
              ? '0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.3)'
              : '0 0 20px rgba(255,95,31,0.4)',
            cursor: canBuzz ? 'pointer' : 'default',
          }}>
          🔔
        </button>
        {!canBuzz && (
          <div className="text-[6px] text-white/30 uppercase tracking-widest" style={PS2}>
            Buzzer active — tap fast!
          </div>
        )}
      </div>
    );
  }

  if (phase === 'buzzed' && buzzWinner) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="px-6 py-3 rounded-2xl border-2 border-[#BC13FE] bg-[#BC13FE]/10 text-center"
          style={{ boxShadow: '0 0 30px rgba(188,19,254,0.4)' }}>
          <div className="text-[7px] text-[#BC13FE]/60 uppercase tracking-widest mb-1" style={PS2}>⚡ First Buzz!</div>
          <div className="font-heading text-xl text-white tracking-widest uppercase">{buzzWinner.playerName}</div>
          <div className="text-[6px] text-white/40 uppercase mt-0.5 tracking-widest" style={PS2}>{buzzWinner.teamName}</div>
        </div>
      </div>
    );
  }

  return null;
}