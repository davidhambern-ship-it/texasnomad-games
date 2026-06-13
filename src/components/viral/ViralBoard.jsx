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

export default function ViralBoard({ board, players, currentPlayerNumber, onSpaceClick }) {
  if (!board || !board.length) return null;

  // Group spaces by level for visual layout
  const level1 = board.filter(s => s.level === 1);
  const level2 = board.filter(s => s.level === 2);
  const level3 = board.filter(s => s.level === 3);

  const renderSpace = (space) => {
    const playerOnSpace = players.find(p => p.position === space.number);
    const bgColor = SPACE_COLORS[space.type] || '#666';
    const label = SPACE_LABELS[space.type] || space.number;
    const isCurrentPlayerSpace = playerOnSpace?.seatNumber === currentPlayerNumber;

    return (
      <div
        key={space.number}
        className="relative flex items-center justify-center border border-white/20 hover:border-white/60 transition-all cursor-pointer"
        style={{
          width: 28,
          height: 28,
          background: `linear-gradient(135deg, ${bgColor}40, ${bgColor}20)`,
          boxShadow: isCurrentPlayerSpace ? `0 0 10px ${bgColor}` : 'none',
        }}
        onClick={() => onSpaceClick?.(space)}
        title={`Space ${space.number}: ${space.effect?.description || space.type}`}
      >
        <span className="text-[6px] font-bold text-white/90" style={PS2}>{label}</span>
        {playerOnSpace && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white"
            style={{ background: playerOnSpace.color || '#BC13FE' }}
            title={playerOnSpace.name}
          />
        )}
        {space.number % 20 === 0 && (
          <div className="absolute -bottom-3 text-[4px] text-white/40" style={PS2}>{space.number}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(188,19,254,0.3)' }}>
      {/* Level indicators */}
      <div className="flex items-center justify-between text-[6px] text-white/40 uppercase" style={PS2}>
        <span>Level 1: The Grind (1-40)</span>
        <span>Level 2: Growth Mode (41-80)</span>
        <span>Level 3: Influencer Status (81-120)</span>
      </div>

      {/* Board visualization - simplified as 3 rows */}
      <div className="space-y-2">
        <div className="flex items-center gap-0.5 flex-wrap">
          {level1.map(renderSpace)}
        </div>
        <div className="flex items-center gap-0.5 flex-wrap">
          {level2.map(renderSpace)}
        </div>
        <div className="flex items-center gap-0.5 flex-wrap">
          {level3.map(renderSpace)}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
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