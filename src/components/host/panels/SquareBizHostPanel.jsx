import React, { useState } from 'react';

const Btn = ({ children, onClick, color = '#FF5F1F', size = 'md', className = '', disabled = false }) => {
  const pad = size === 'lg' ? 'px-6 py-4 text-xl' : size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-heading tracking-widest uppercase rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 ${pad} ${className}`}
      style={{ borderColor: color, color, background: 'transparent' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
};

const VolumeSlider = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3">
    <span className="font-heading text-xs tracking-widest text-white/50 uppercase w-20">{label}</span>
    <input
      type="range" min={0} max={100} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 accent-[#FF5F1F]"
    />
    <span className="font-heading text-sm text-[#FF5F1F] w-8 text-right">{value}</span>
  </div>
);

export default function SquareBizHostPanel({ gs, updateState, sendCommand }) {
  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F' };
    return { char: '·', color: '#ffffff20' };
  };

  const resetBoard = async () => {
    await updateState({ board: Array(9).fill(''), current_turn: 'X', winner: null, show_question: false });
  };

  const forceCell = (idx, mark) => {
    const next = [...board];
    next[idx] = next[idx] === mark ? '' : mark;
    updateState({ board: next });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── BOARD (TOP) ── */}
      <div className="p-5 border border-[#FF5F1F]/30 rounded-xl bg-black/60"
        style={{ boxShadow: '0 0 20px rgba(255,95,31,0.1)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FF5F1F] uppercase">Board State</h2>
          <div className="flex items-center gap-3">
            <span className="font-heading text-xs tracking-widest text-white/40 uppercase">Current Turn:</span>
            <span
              className="font-heading text-2xl font-bold"
              style={{ color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 15px ${currentTurn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}
            >
              {currentTurn}
            </span>
          </div>
        </div>

        {/* 3x3 Grid — clickable to toggle */}
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
          {board.map((cell, idx) => {
            const { char, color } = cellDisplay(cell);
            return (
              <div key={idx} className="relative group">
                <div
                  className="aspect-square flex items-center justify-center rounded-lg border-2 text-3xl font-heading cursor-pointer transition-all hover:scale-105"
                  style={{ borderColor: cell ? color : '#ffffff15', color, background: cell ? `${color}15` : 'black' }}
                >
                  {char}
                </div>
                {/* On hover show X/O toggle */}
                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-black/70 rounded-lg">
                  <button onClick={() => forceCell(idx, 'X')} className="w-8 h-8 rounded border border-[#BC13FE] text-[#BC13FE] text-sm font-heading hover:bg-[#BC13FE]/30">X</button>
                  <button onClick={() => forceCell(idx, 'O')} className="w-8 h-8 rounded border border-[#FF5F1F] text-[#FF5F1F] text-sm font-heading hover:bg-[#FF5F1F]/30">O</button>
                  <button onClick={() => forceCell(idx, '')} className="w-8 h-8 rounded border border-white/20 text-white/40 text-sm font-heading hover:bg-white/10">✕</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Force Turn */}
        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={() => updateState({ current_turn: 'X' })} color="#BC13FE">Force X Turn</Btn>
          <Btn onClick={() => updateState({ current_turn: 'O' })} color="#FF5F1F">Force O Turn</Btn>
        </div>
      </div>

      {/* ── QUESTION CONTROLS ── */}
      <div className="p-5 border border-[#BC13FE]/30 rounded-xl bg-black/60">
        <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase mb-4">Question</h2>
        <textarea
          className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-base focus:border-[#BC13FE] focus:outline-none transition-colors resize-none mb-3"
          rows={3}
          value={gs.current_question || ''}
          onChange={(e) => updateState({ current_question: e.target.value })}
          placeholder="Enter question text…"
        />
        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={() => updateState({ show_question: true })} color="#4ade80">Show Question</Btn>
          <Btn onClick={() => updateState({ show_question: false, current_question: Math.random().toString() })} color="#BC13FE">Shuffle Question</Btn>
        </div>
      </div>

      {/* ── AUDIO CONTROLS ── */}
      <div className="p-5 border border-[#FFD700]/20 rounded-xl bg-black/60 space-y-4">
        <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase">Audio</h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-heading text-xs tracking-widest text-white/60 uppercase">Music</span>
            <button
              onClick={() => updateState({ music_on: !gs.music_on })}
              className={`px-4 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all ${gs.music_on !== false ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-white/20 text-white/30'}`}
            >
              {gs.music_on !== false ? 'ON' : 'OFF'}
            </button>
          </div>
          <VolumeSlider label="Volume" value={gs.music_volume ?? 70} onChange={(v) => updateState({ music_volume: v })} />
        </div>

        <div className="h-px bg-white/10" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-heading text-xs tracking-widest text-white/60 uppercase">Sound FX</span>
            <button
              onClick={() => updateState({ sfx_on: !gs.sfx_on })}
              className={`px-4 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all ${gs.sfx_on !== false ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-white/20 text-white/30'}`}
            >
              {gs.sfx_on !== false ? 'ON' : 'OFF'}
            </button>
          </div>
          <VolumeSlider label="Volume" value={gs.sfx_volume ?? 80} onChange={(v) => updateState({ sfx_volume: v })} />
        </div>
      </div>

      {/* ── GAME CONTROLS ── */}
      <div className="grid grid-cols-2 gap-3">
        <Btn onClick={resetBoard} color="#FF5F1F" size="lg">↺ Reset Board</Btn>
        <Btn onClick={() => updateState({ board: Array(9).fill(''), current_turn: 'X', winner: null, show_question: false, current_question: '' })} color="#ffffff" size="lg">
          New Game
        </Btn>
      </div>
    </div>
  );
}