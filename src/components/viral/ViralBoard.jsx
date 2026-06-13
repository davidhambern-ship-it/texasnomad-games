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

// Grid positions for VIRAL - each letter clearly formed
// V: 20 spaces (1-20), I: 20 spaces (21-40), R: 40 spaces (41-80), A: 20 spaces (81-100), L: 20 spaces (101-120)
const getLetterGridPosition = (spaceNumber) => {
  const district = getDistrict(spaceNumber);
  if (!district) return { row: 0, col: 0 };
  
  // Letter column offsets (spaced for clarity)
  const colOffset = { V: 0, I: 8, R: 14, A: 24, L: 32 };
  
  if (district === 'V') {
    // V: Two diagonal lines meeting at bottom (spaces 1-20)
    // Left side: 1-10 going down-right, Right side: 11-20 going down-left
    const pos = spaceNumber - 1;
    if (pos < 10) {
      // Left diagonal: starts top-left, goes down-right
      return { row: pos + 1, col: colOffset.V + pos };
    } else {
      // Right diagonal: starts top-right, goes down-left, meets at bottom
      const rightPos = pos - 10;
      return { row: rightPos + 1, col: colOffset.V + 9 - rightPos };
    }
  }
  
  if (district === 'I') {
    // I: Simple vertical line (spaces 21-40)
    return { row: spaceNumber - 20, col: colOffset.I + 2 };
  }
  
  if (district === 'R') {
    // R: 40 spaces - vertical stem, top loop, diagonal leg
    const pos = spaceNumber - 40;
    if (pos < 12) {
      // Vertical stem (41-52)
      return { row: pos + 1, col: colOffset.R };
    } else if (pos < 20) {
      // Top curve going right (53-60)
      const curvePos = pos - 12;
      return { row: 2 + curvePos, col: colOffset.R + 1 + curvePos };
    } else if (pos < 28) {
      // Top curve coming back (61-68)
      const curvePos = pos - 20;
      return { row: 8 - curvePos, col: colOffset.R + 5 + curvePos };
    } else {
      // Diagonal leg going down-right (69-80)
      const legPos = pos - 28;
      return { row: 6 + legPos, col: colOffset.R + 3 + legPos };
    }
  }
  
  if (district === 'A') {
    // A: 20 spaces - two diagonals meeting at top, crossbar
    const pos = spaceNumber - 80;
    if (pos < 8) {
      // Left diagonal going down-right (81-88)
      return { row: pos + 1, col: colOffset.A + pos };
    } else if (pos < 16) {
      // Right diagonal going down-left (89-96)
      const rightPos = pos - 8;
      return { row: rightPos + 1, col: colOffset.A + 7 - rightPos };
    } else {
      // Crossbar horizontal (97-100)
      const barPos = pos - 16;
      return { row: 5, col: colOffset.A + 2 + barPos };
    }
  }
  
  if (district === 'L') {
    // L: 20 spaces - vertical down, then horizontal right
    const pos = spaceNumber - 100;
    if (pos < 12) {
      // Vertical stem (101-112)
      return { row: pos + 1, col: colOffset.L + 2 };
    } else {
      // Horizontal bottom (113-120)
      const horizPos = pos - 12;
      return { row: 12, col: colOffset.L + 2 + horizPos };
    }
  }
  
  return { row: 0, col: 0 };
};

export default function ViralBoard({ board, players, currentTurnIndex, diceRoll }) {
  if (!board || !board.length) return null;

  // Create grid map
  const gridSize = { rows: 14, cols: 42 };
  const gridMap = {};
  
  board.forEach(space => {
    const pos = getLetterGridPosition(space.number);
    const key = `${pos.row}-${pos.col}`;
    gridMap[key] = space;
  });

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
          background: `linear-gradient(135deg, ${bgColor}70, ${bgColor}35)`,
          boxShadow: isCurrentPlayerSpace ? `0 0 12px ${bgColor}, inset 0 0 8px ${bgColor}40` : '0 0 3px rgba(0,0,0,0.3)',
        }}
        title={`Space ${space.number}: ${space.effect?.description || space.type}`}
      >
        <span className="text-[5px] font-bold text-white" style={PS2}>{label}</span>
        {playerOnSpace && (
          <div
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[6px] font-bold z-10"
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

  // Render grid
  const renderGrid = () => {
    const rows = [];
    for (let row = 0; row < gridSize.rows; row++) {
      const rowCells = [];
      for (let col = 0; col < gridSize.cols; col++) {
        const key = `${row}-${col}`;
        const space = gridMap[key];
        if (space) {
          rowCells.push(renderSpace(space));
        } else {
          rowCells.push(
            <div key={`empty-${row}-${col}`} className="w-6.5 h-6.5" />
          );
        }
      }
      rows.push(
        <div key={`row-${row}`} className="flex gap-0.5 justify-center">
          {rowCells}
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="p-6 rounded-2xl overflow-auto max-h-[85vh] relative" 
      style={{ 
        background: 'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)', 
        border: '2px solid rgba(188,19,254,0.4)',
        boxShadow: '0 0 40px rgba(188,19,254,0.2), inset 0 0 60px rgba(0,0,0,0.5)',
      }}>
      
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

      {/* Board grid showing VIRAL */}
      <div className="flex flex-col items-center gap-1 relative z-10">
        {renderGrid()}
      </div>

      {/* District Labels */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-[#BC13FE]/20 relative z-10">
        {Object.entries(DISTRICT_COLORS).map(([letter, data]) => (
          <div key={letter} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: data.primary, boxShadow: `0 0 8px ${data.primary}` }} />
            <span className="text-[6px] text-white/70 uppercase" style={PS2}>{letter} - {data.name}</span>
          </div>
        ))}
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