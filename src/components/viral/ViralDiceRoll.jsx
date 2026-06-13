import React, { useState, useEffect } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function ViralDiceRoll({ roll, isRolling, onRoll }) {
  const [displayRoll, setDisplayRoll] = useState(roll || 1);

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setDisplayRoll(Math.floor(Math.random() * 6) + 1);
      }, 100);
      return () => clearInterval(interval);
    } else if (roll) {
      setDisplayRoll(roll);
    }
  }, [isRolling, roll]);

  const diceFaces = {
    1: '⚀',
    2: '⚁',
    3: '⚂',
    4: '⚃',
    5: '⚄',
    6: '⚅',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl transition-all"
        style={{
          background: isRolling 
            ? 'linear-gradient(135deg, #BC13FE, #FF5F1F)' 
            : 'linear-gradient(135deg, #FFD700, #FF9A00)',
          boxShadow: isRolling 
            ? '0 0 30px rgba(188,19,254,0.6), inset 0 0 20px rgba(255,255,255,0.2)' 
            : '0 0 20px rgba(255,215,0,0.4), inset 0 0 20px rgba(255,255,255,0.2)',
          animation: isRolling ? 'spin 0.3s ease-in-out infinite' : 'none',
          transform: isRolling ? 'rotate(360deg)' : 'none',
        }}
      >
        <span className="filter drop-shadow-lg">{diceFaces[displayRoll]}</span>
      </div>
      
      {isRolling ? (
        <div className="text-[8px] text-[#BC13FE] uppercase animate-pulse" style={PS2}>
          Rolling...
        </div>
      ) : roll ? (
        <div className="text-[9px] text-[#FFD700] uppercase" style={PS2}>
          Rolled {roll}!
        </div>
      ) : (
        onRoll && (
          <button
            onClick={onRoll}
            className="px-6 py-3 rounded-lg font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #BC13FE40, #BC13FE20)',
              border: '2px solid #BC13FE',
              color: '#BC13FE',
              boxShadow: '0 0 20px rgba(188,19,254,0.3)',
            }}
          >
            🎲 ROLL DICE
          </button>
        )
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
}