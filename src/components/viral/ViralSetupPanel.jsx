import React, { useState } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function ViralSetupPanel({ isSinglePlayer, cpuId, onStart, seatNumber, aiOpponent, setAiOpponent }) {
  const [mode, setMode] = useState(isSinglePlayer ? 'ai' : 'single');
  const selectedAI = aiOpponent || 'dexter';

  const modeOptions = isSinglePlayer
    ? [{ value: 'ai', label: 'Player vs AI' }]
    : [
        { value: 'single', label: 'Single Player' },
        { value: 'multi', label: 'Multiplayer' },
        { value: 'ai', label: 'Player vs AI' },
      ];

  const aiOptions = [
    { value: 'dexter', label: '🎓 Dexter - The Professor' },
    { value: 'lemonade', label: '🍋 Lemonade - The Hustler' },
    { value: 'carlos', label: '😈 Carlos - The Menace' },
    { value: 'skie', label: '👻 Skie - The Ghost' },
  ];

  return (
    <div
      className="p-4 rounded-xl space-y-4"
      style={{
        background: 'linear-gradient(135deg,#07040d,#0d0620)',
        border: '1px solid rgba(188,19,254,0.4)',
        boxShadow: '0 0 20px rgba(188,19,254,0.1)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-5 rounded-full" style={{ background: '#BC13FE', boxShadow: '0 0 8px #BC13FE' }} />
        <h2 className="text-[9px] tracking-[0.2em] text-[#BC13FE] uppercase" style={PS2}>Game Setup</h2>
      </div>

      {cpuId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5">
          <div className="text-[8px] text-[#FF5F1F] uppercase tracking-widest" style={PS2}>🤖 VS AI: {selectedAI}</div>
        </div>
      )}

      {!isSinglePlayer && (
        <div className="space-y-1">
          <label className="block text-[7px] tracking-widest text-white/40 uppercase" style={PS2}>Game Mode</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-white text-xs font-body focus:outline-none"
            style={{ background: '#07040d', border: '1px solid rgba(188,19,254,0.3)', color: '#fff' }}
          >
            {modeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {mode === 'ai' && !cpuId && (
        <div className="space-y-1">
          <label className="block text-[7px] tracking-widest text-white/40 uppercase" style={PS2}>AI Opponent</label>
          <select
            value={selectedAI}
            onChange={e => setAiOpponent?.(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-white text-xs font-body focus:outline-none"
            style={{ background: '#07040d', border: '1px solid rgba(188,19,254,0.3)', color: '#fff' }}
          >
            {aiOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      <button
        onClick={() => onStart({ mode, aiOpponent: selectedAI })}
        className="w-full py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #BC13FE40, #BC13FE20)',
          border: '2px solid #BC13FE',
          color: '#BC13FE',
          boxShadow: '0 0 20px rgba(188,19,254,0.3)',
        }}
      >
        ▶ START GAME
      </button>
    </div>
  );
}