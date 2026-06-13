import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// District images mapping to board sections
const DISTRICT_IMAGES = {
  V: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/9eb63b4f0_boardletters-V.png',
  I: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1241d498d_boardletters-I.png',
  R: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/8bd90f93d_boardletters-R.png',
  A: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/9e1e3159e_boardletters-A.png',
  L: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/6cf49806a_boardletters-L.png',
};

// Space ranges for each district
const DISTRICT_RANGES = {
  V: { start: 1, end: 20, label: "Creator's Corner" },
  I: { start: 21, end: 40, label: 'Shopping District' },
  R: { start: 41, end: 60, label: 'The Mall' },
  A: { start: 81, end: 100, label: 'Business District' },
  L: { start: 101, end: 120, label: 'Downtown District' },
};

const PLAYER_COLORS = ['#BC13FE', '#FF5F1F', '#FFD700', '#22d3ee'];

export default function ViralBoard({ board, players, currentTurnIndex }) {
  if (!board || !board.length) return null;

  const getPlayerAtPosition = (position) => {
    return players.find(p => p.position === position);
  };

  const renderDistrict = (districtKey, districtData) => {
    const imageUrl = DISTRICT_IMAGES[districtKey];
    const spacesInRange = board.filter(s => s.number >= districtData.start && s.number <= districtData.end);
    
    return (
      <div key={districtKey} className="relative">
        {/* District header */}
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold text-white"
              style={{ 
                background: 'linear-gradient(135deg, #BC13FE, #7700cc)',
                boxShadow: '0 0 15px rgba(188,19,254,0.5)'
              }}>
              {districtKey}
            </div>
            <div>
              <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>{districtData.label}</div>
              <div className="text-[6px] text-white/40">Spaces {districtData.start}-{districtData.end}</div>
            </div>
          </div>
        </div>
        
        {/* District image */}
        <div className="relative rounded-xl overflow-hidden border-2 border-[#BC13FE]/30"
          style={{ boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}>
          <img src={imageUrl} alt={districtData.label} className="w-full h-auto" />
          
          {/* Player markers overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {spacesInRange.map(space => {
              const player = getPlayerAtPosition(space.number);
              if (!player) return null;
              
              const playerIndex = players.indexOf(player);
              const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
              
              // Calculate approximate position based on space number
              const totalSpaces = districtData.end - districtData.start + 1;
              const positionInDistrict = space.number - districtData.start;
              const percentage = (positionInDistrict / totalSpaces) * 100;
              
              return (
                <div
                  key={player.playerCode}
                  className="absolute w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                  style={{
                    background: color,
                    boxShadow: `0 0 10px ${color}`,
                    left: `${Math.min(90, Math.max(5, percentage))}%`,
                    top: `${20 + (playerIndex * 15)}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                  }}
                  title={`${player.name} - Space ${space.number}`}
                >
                  {player.name?.charAt(0) || 'P'}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 rounded-xl overflow-auto max-h-[70vh]" 
      style={{ 
        background: 'linear-gradient(135deg, #07040d, #0d0620)', 
        border: '1px solid rgba(188,19,254,0.3)',
        boxShadow: '0 0 30px rgba(188,19,254,0.1)'
      }}>
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#BC13FE]/20">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🎲</div>
          <div>
            <h2 className="text-[10px] tracking-[0.2em] text-[#FFD700] uppercase" style={PS2}>VIRAL! Game Board</h2>
            <div className="text-[6px] text-white/40">120 Spaces to Fame</div>
          </div>
        </div>
        <div className="text-[8px] tracking-widest text-[#BC13FE]" style={PS2}>
          {players.length} PLAYER{players.length !== 1 ? 'S' : ''}
        </div>
      </div>

      {/* Districts */}
      <div className="space-y-6">
        {renderDistrict('V', DISTRICT_RANGES.V)}
        {renderDistrict('I', DISTRICT_RANGES.I)}
        {renderDistrict('R', DISTRICT_RANGES.R)}
        {renderDistrict('A', DISTRICT_RANGES.A)}
        {renderDistrict('L', DISTRICT_RANGES.L)}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-[#BC13FE]/20">
        <div className="text-[7px] tracking-widest text-white/40 uppercase mb-2" style={PS2}>Players</div>
        <div className="flex flex-wrap gap-3">
          {players.map((player, index) => (
            <div key={player.playerCode} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full border border-white"
                style={{ background: PLAYER_COLORS[index % PLAYER_COLORS.length] }}
              />
              <span className="text-[7px] text-white/80" style={PS2}>{player.name}</span>
              {index === currentTurnIndex && (
                <span className="text-[6px] text-[#4ade80] uppercase" style={PS2}>• TURN</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}