import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// District colors from concept art
const DISTRICT_COLORS = {
  V: { primary: '#7db451', highlight: '#b1d877', name: "Neighborhood" },
  I: { primary: '#3a85b9', highlight: '#73c1f2', name: 'Highway' },
  R: { primary: '#8a58a7', highlight: '#c499e0', name: 'Shopping District' },
  A: { primary: '#d4a742', highlight: '#f4d87a', name: 'Business District' },
  L: { primary: '#c74b4e', highlight: '#f48d8a', name: 'Downtown' },
};

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
  CREATOR_MANSION: 'WIN',
};

// Get district for a space number
const getDistrict = (spaceNumber) => {
  if (spaceNumber >= 1 && spaceNumber <= 20) return 'V';
  if (spaceNumber >= 21 && spaceNumber <= 40) return 'I';
  if (spaceNumber >= 41 && spaceNumber <= 80) return 'R';
  if (spaceNumber >= 81 && spaceNumber <= 100) return 'A';
  if (spaceNumber >= 101 && spaceNumber <= 120) return 'L';
  return null;
};

export default function ViralBoard({ board, players, currentTurnIndex, diceRoll }) {
  if (!board || !board.length) return null;

  const renderSpace = (space) => {
    const playerOnSpace = players.find(p => p.position === space.number);
    const district = getDistrict(space.number);
    const districtColor = district ? DISTRICT_COLORS[district] : null;
    const bgColor = SPACE_COLORS[space.type] || (districtColor?.primary || '#666');
    const label = SPACE_LABELS[space.type] || space.number;
    const isCurrentPlayerSpace = playerOnSpace && players.indexOf(playerOnSpace) === currentTurnIndex;

    return (
      <div
        key={space.number}
        className="relative flex items-center justify-center border border-white/20 hover:border-white/60 transition-all cursor-pointer rounded-sm"
        style={{
          width: 26,
          height: 26,
          background: `linear-gradient(135deg, ${bgColor}50, ${bgColor}25)`,
          boxShadow: isCurrentPlayerSpace ? `0 0 12px ${bgColor}, inset 0 0 8px ${bgColor}40` : '0 0 4px rgba(0,0,0,0.3)',
        }}
        title={`Space ${space.number}: ${space.effect?.description || space.type}`}
      >
        <span className="text-[5px] font-bold text-white" style={PS2}>{label}</span>
        {playerOnSpace && (
          <div
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[6px] font-bold"
            style={{ 
              background: playerOnSpace.color || '#BC13FE',
              boxShadow: '0 0 8px rgba(0,0,0,0.5)'
            }}
            title={playerOnSpace.name}
          >
            {playerOnSpace.seatNumber}
          </div>
        )}
      </div>
    );
  };

  // Render V shape (spaces 1-20) - descends then ascends
  const renderV = () => {
    const vSpaces = board.filter(s => s.number >= 1 && s.number <= 20);
    const left = vSpaces.slice(0, 10); // 1-10 descending
    const right = vSpaces.slice(10, 20); // 11-20 ascending
    
    return (
      <div key="V" className="flex flex-col items-center gap-2">
        <div className="text-[9px] tracking-widest uppercase" style={{ ...PS2, color: DISTRICT_COLORS.V.highlight }}>
          V - {DISTRICT_COLORS.V.name}
        </div>
        <div className="flex gap-1 items-start">
          <div className="flex flex-col gap-0.5" style={{ transform: 'rotate(25deg)' }}>
            {left.map(s => renderSpace(s))}
          </div>
          <div className="flex flex-col gap-0.5" style={{ transform: 'rotate(-25deg)' }}>
            {right.map(s => renderSpace(s))}
          </div>
        </div>
      </div>
    );
  };

  // Render I shape (spaces 21-40) - vertical column
  const renderI = () => {
    const iSpaces = board.filter(s => s.number >= 21 && s.number <= 40);
    
    return (
      <div key="I" className="flex flex-col items-center gap-2">
        <div className="text-[9px] tracking-widest uppercase" style={{ ...PS2, color: DISTRICT_COLORS.I.highlight }}>
          I - {DISTRICT_COLORS.I.name}
        </div>
        <div className="flex flex-col gap-0.5">
          {iSpaces.map(s => renderSpace(s))}
        </div>
      </div>
    );
  };

  // Render R shape (spaces 41-80) - 40 spaces with curve and leg
  const renderR = () => {
    const rSpaces = board.filter(s => s.number >= 41 && s.number <= 80);
    const vertical = rSpaces.slice(0, 10); // 41-50
    const curve = rSpaces.slice(10, 24); // 51-64 (top curve)
    const leg = rSpaces.slice(24, 40); // 65-80 (descending leg)
    
    return (
      <div key="R" className="flex flex-col items-center gap-2">
        <div className="text-[9px] tracking-widest uppercase" style={{ ...PS2, color: DISTRICT_COLORS.R.highlight }}>
          R - {DISTRICT_COLORS.R.name}
        </div>
        <div className="flex gap-0.5 items-start">
          <div className="flex flex-col gap-0.5">
            {vertical.map(s => renderSpace(s))}
            {leg.slice(0, 8).map(s => renderSpace(s))}
          </div>
          <div className="flex flex-col gap-0.5">
            {curve.map(s => renderSpace(s))}
            {leg.slice(8, 16).map(s => renderSpace(s))}
          </div>
        </div>
      </div>
    );
  };

  // Render A shape (spaces 81-100) - pyramid/triangle
  const renderA = () => {
    const aSpaces = board.filter(s => s.number >= 81 && s.number <= 100);
    const left = aSpaces.slice(0, 7);
    const right = aSpaces.slice(7, 14);
    const crossbar = aSpaces.slice(14, 20);
    
    return (
      <div key="A" className="flex flex-col items-center gap-2">
        <div className="text-[9px] tracking-widest uppercase" style={{ ...PS2, color: DISTRICT_COLORS.A.highlight }}>
          A - {DISTRICT_COLORS.A.name}
        </div>
        <div className="flex gap-0.5 items-start">
          <div className="flex flex-col gap-0.5" style={{ transform: 'rotate(-15deg)' }}>
            {left.map(s => renderSpace(s))}
          </div>
          <div className="flex flex-col gap-0.5 justify-center">
            {crossbar.map(s => renderSpace(s))}
          </div>
          <div className="flex flex-col gap-0.5" style={{ transform: 'rotate(15deg)' }}>
            {right.map(s => renderSpace(s))}
          </div>
        </div>
      </div>
    );
  };

  // Render L shape (spaces 101-120) - L frame
  const renderL = () => {
    const lSpaces = board.filter(s => s.number >= 101 && s.number <= 120);
    const vertical = lSpaces.slice(0, 10);
    const horizontal = lSpaces.slice(10, 20);
    
    return (
      <div key="L" className="flex flex-col items-center gap-2">
        <div className="text-[9px] tracking-widest uppercase" style={{ ...PS2, color: DISTRICT_COLORS.L.highlight }}>
          L - {DISTRICT_COLORS.L.name}
        </div>
        <div className="flex gap-0.5 items-start">
          <div className="flex flex-col gap-0.5">
            {vertical.map(s => renderSpace(s))}
          </div>
          <div className="flex flex-col gap-0.5 justify-end">
            <div className="flex gap-0.5">
              {horizontal.map(s => renderSpace(s))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 rounded-2xl overflow-auto max-h-[85vh] relative" 
      style={{ 
        background: 'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)', 
        border: '2px solid rgba(188,19,254,0.4)',
        boxShadow: '0 0 40px rgba(188,19,254,0.2), inset 0 0 60px rgba(0,0,0,0.5)',
      }}>
      
      {/* Neon glow overlay */}
      <div className="absolute inset-0 pointer-events-none" 
        style={{ 
          background: 'radial-gradient(circle at 50% 30%, rgba(188,19,254,0.1), transparent 60%)',
        }} 
      />

      {/* VIRAL Header */}
      <div className="flex items-center justify-center gap-3 pb-4 border-b border-[#BC13FE]/30 mb-6 relative">
        {['V', 'I', 'R', 'A', 'L'].map((letter, i) => {
          const district = DISTRICT_COLORS[letter];
          return (
            <div key={letter} 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold text-white relative overflow-hidden"
              style={{ 
                background: `linear-gradient(135deg, ${district.primary}, ${district.highlight})`,
                boxShadow: `0 0 20px ${district.primary}80, inset 0 0 10px rgba(255,255,255,0.2)`,
                transform: i === 2 ? 'scale(1.15)' : 'scale(1)',
              }}>
              <span className="relative z-10">{letter}</span>
              <div className="absolute inset-0" style={{ background: `linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)` }} />
            </div>
          );
        })}
      </div>

      {/* Board arranged as VIRAL letters */}
      <div className="flex flex-wrap justify-center gap-6 relative z-10">
        {renderV()}
        {renderI()}
        {renderR()}
        {renderA()}
        {renderL()}
      </div>

      {/* Info Panels at Bottom */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#BC13FE]/20 relative z-10">
        {/* How To Play */}
        <div className="p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(188,19,254,0.3)' }}>
          <div className="text-[7px] tracking-widest uppercase mb-2" style={{ ...PS2, color: '#BC13FE' }}>How To Play</div>
          <ol className="text-[5px] text-white/70 space-y-1" style={{ fontFamily: "'Inter', sans-serif" }}>
            <li>1. Roll the dice</li>
            <li>2. Move your token</li>
            <li>3. Follow space rules</li>
            <li>4. Earn $ and followers</li>
            <li>5. Reach Mansion to win!</li>
          </ol>
        </div>

        {/* Money Tiers */}
        <div className="p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div className="text-[7px] tracking-widest uppercase mb-2" style={{ ...PS2, color: '#FFD700' }}>Money</div>
          <div className="text-[5px] text-white/70 space-y-1" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="flex items-center gap-1"><span className="text-[#FFD700]">$</span> $1K</div>
            <div className="flex items-center gap-1"><span className="text-[#FFD700]">$$$</span> $5K</div>
            <div className="flex items-center gap-1"><span className="text-[#FFD700]">$$$$$</span> $20K</div>
            <div className="flex items-center gap-1"><span className="text-[#FFD700]">$$$$$$$</span> $50K</div>
          </div>
        </div>

        {/* Followers */}
        <div className="p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,211,238,0.3)' }}>
          <div className="text-[7px] tracking-widest uppercase mb-2" style={{ ...PS2, color: '#22d3ee' }}>Followers</div>
          <div className="text-[5px] text-white/70 space-y-1" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div>★ 1K = $8K</div>
            <div>★★ 10K = $30K</div>
            <div>★★★ 100K = $100K</div>
            <div>★★★★ 1M = $10M</div>
          </div>
        </div>

        {/* Special Spaces */}
        <div className="p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,95,31,0.3)' }}>
          <div className="text-[7px] tracking-widest uppercase mb-2" style={{ ...PS2, color: '#FF5F1F' }}>Special</div>
          <div className="flex flex-wrap gap-1">
            <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: '#FFD70030', color: '#FFD700', border: '1px solid #FFD70040' }}>$ Money</span>
            <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: '#22d3ee30', color: '#22d3ee', border: '1px solid #22d3ee40' }}>★ Star</span>
            <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: '#BC13FE30', color: '#BC13FE', border: '1px solid #BC13FE40' }}>? Chance</span>
            <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: '#FF5F1F30', color: '#FF5F1F', border: '1px solid #FF5F1F40' }}>! Action</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-[#BC13FE]/20 relative z-10">
        {Object.entries(SPACE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
            <span className="text-[5px] text-white/60 uppercase" style={PS2}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}