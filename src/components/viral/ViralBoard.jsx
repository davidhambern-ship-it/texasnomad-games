import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SPACE_COLORS = {
  Equipment: '#00c875',
  Challenge: '#BC13FE',
  Viral: '#FF5F1F',
  Pay: '#FFD700',
  Play: '#22d3ee',
  Event: '#f472b6',
  Sponsor: '#a78bfa',
  SAFE: '#4ade80',
  CREATOR_MANSION: '#FFD700',
};

const SPACE_LABELS = {
  Equipment: 'EQ',
  Challenge: 'CH',
  Viral: 'VR',
  Pay: '$',
  Play: 'PL',
  Event: 'EV',
  Sponsor: 'SP',
  SAFE: 'SAFE',
  CREATOR_MANSION: 'FIN',
};

// Letter configurations for VIRAL layout
const LETTER_CONFIGS = {
  V: { spaces: 20, range: [1, 20], label: "Creator's Corner" },
  I: { spaces: 20, range: [21, 40], label: 'Shopping District' },
  R: { spaces: 20, range: [41, 60], label: 'The Mall' },
  A: { spaces: 20, range: [81, 100], label: 'Business District' },
  L: { spaces: 20, range: [101, 120], label: 'Downtown District' },
};

export default function ViralBoard({ board, players, currentTurnIndex, diceRoll }) {
  if (!board || !board.length) return null;

  const renderSpace = (space, customClass = '') => {
    const playerOnSpace = players.find(p => p.position === space.number);
    const bgColor = SPACE_COLORS[space.type] || '#666';
    const label = SPACE_LABELS[space.type] || '';
    const isCurrentPlayerSpace = playerOnSpace && players.indexOf(playerOnSpace) === currentTurnIndex;

    return (
      <div
        key={space.number}
        className={`relative flex items-center justify-center border border-white/20 hover:border-white/60 transition-all cursor-pointer ${customClass}`}
        style={{
          width: 24,
          height: 24,
          background: `linear-gradient(135deg, ${bgColor}40, ${bgColor}20)`,
          boxShadow: isCurrentPlayerSpace ? `0 0 10px ${bgColor}` : 'none',
        }}
        title={`Space ${space.number}: ${space.effect?.description || space.type}`}
      >
        <span className="text-[5px] font-bold text-white/90" style={PS2}>{label}</span>
        {playerOnSpace && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white"
            style={{ background: playerOnSpace.color || '#BC13FE' }}
            title={playerOnSpace.name}
          />
        )}
      </div>
    );
  };

  // Render V shape (spaces 1-20) - Y shaped path
  const renderV = () => {
    const vSpaces = board.filter(s => s.number >= 1 && s.number <= 20);
    const left = vSpaces.slice(0, 10);
    const right = vSpaces.slice(10, 20);
    
    return (
      <div key="V" className="flex flex-col items-center">
        <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase mb-2" style={PS2}>V - {LETTER_CONFIGS.V.label}</div>
        <div className="flex gap-1">
          {/* Left diagonal of V */}
          <div className="flex flex-col" style={{ transform: 'rotate(30deg)' }}>
            {left.map(s => renderSpace(s))}
          </div>
          {/* Right diagonal of V */}
          <div className="flex flex-col" style={{ transform: 'rotate(-30deg)' }}>
            {right.map(s => renderSpace(s))}
          </div>
        </div>
      </div>
    );
  };

  // Render I shape (spaces 21-40) - vertical line
  const renderI = () => {
    const iSpaces = board.filter(s => s.number >= 21 && s.number <= 40);
    
    return (
      <div key="I" className="flex flex-col items-center">
        <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase mb-2" style={PS2}>I - {LETTER_CONFIGS.I.label}</div>
        <div className="flex flex-col gap-0.5">
          {iSpaces.map(s => renderSpace(s))}
        </div>
      </div>
    );
  };

  // Render R shape (spaces 41-60) - curved path
  const renderR = () => {
    const rSpaces = board.filter(s => s.number >= 41 && s.number <= 60);
    const vertical = rSpaces.slice(0, 8);
    const curve = rSpaces.slice(8, 14);
    const leg = rSpaces.slice(14, 20);
    
    return (
      <div key="R" className="flex flex-col items-center">
        <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase mb-2" style={PS2}>R - {LETTER_CONFIGS.R.label}</div>
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5">
            {vertical.map(s => renderSpace(s))}
          </div>
          <div className="flex flex-col gap-0.5">
            {curve.map(s => renderSpace(s))}
            <div className="flex flex-col gap-0.5" style={{ transform: 'rotate(45deg)' }}>
              {leg.map(s => renderSpace(s))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render A shape (spaces 81-100) - A frame with crossbar
  const renderA = () => {
    const aSpaces = board.filter(s => s.number >= 81 && s.number <= 100);
    const left = aSpaces.slice(0, 7);
    const right = aSpaces.slice(7, 14);
    const crossbar = aSpaces.slice(14, 20);
    
    return (
      <div key="A" className="flex flex-col items-center">
        <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase mb-2" style={PS2}>A - {LETTER_CONFIGS.A.label}</div>
        <div className="flex gap-0.5 items-start">
          <div className="flex flex-col gap-0.5" style={{ transform: 'rotate(-20deg)' }}>
            {left.map(s => renderSpace(s))}
          </div>
          <div className="flex gap-0.5 items-center">
            {crossbar.map(s => renderSpace(s, 'rotate-90'))}
          </div>
          <div className="flex flex-col gap-0.5" style={{ transform: 'rotate(20deg)' }}>
            {right.map(s => renderSpace(s))}
          </div>
        </div>
      </div>
    );
  };

  // Render L shape (spaces 101-120) - L frame
  const renderL = () => {
    const lSpaces = board.filter(s => s.number >= 101 && s.number <= 120);
    const vertical = lSpaces.slice(0, 12);
    const horizontal = lSpaces.slice(12, 20);
    
    return (
      <div key="L" className="flex flex-col items-center">
        <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase mb-2" style={PS2}>L - {LETTER_CONFIGS.L.label}</div>
        <div className="flex gap-0.5 items-end">
          <div className="flex flex-col gap-0.5">
            {vertical.map(s => renderSpace(s))}
          </div>
          <div className="flex gap-0.5">
            {horizontal.map(s => renderSpace(s))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 rounded-xl overflow-auto max-h-[80vh]" 
      style={{ 
        background: 'linear-gradient(135deg, #07040d, #0d0620)', 
        border: '1px solid rgba(188,19,254,0.3)',
        boxShadow: '0 0 30px rgba(188,19,254,0.1)'
      }}>
      
      {/* VIRAL Header */}
      <div className="flex items-center justify-center gap-4 pb-4 border-b border-[#BC13FE]/20 mb-4">
        {['V', 'I', 'R', 'A', 'L'].map((letter, i) => (
          <div key={letter} className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold text-white"
            style={{ 
              background: 'linear-gradient(135deg, #BC13FE, #7700cc)',
              boxShadow: '0 0 15px rgba(188,19,254,0.5)',
              transform: i === 2 ? 'scale(1.1)' : 'scale(1)',
            }}>
            {letter}
          </div>
        ))}
      </div>

      {/* Board arranged as VIRAL letters */}
      <div className="flex flex-wrap justify-center gap-8">
        {renderV()}
        {renderI()}
        {renderR()}
        {renderA()}
        {renderL()}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-[#BC13FE]/20">
        {Object.entries(SPACE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded" style={{ background: color }} />
            <span className="text-[5px] text-white/60 uppercase" style={PS2}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}