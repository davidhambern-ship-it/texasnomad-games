import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function ViralPlayerPanel({ player, isCurrentTurn, isActive }) {
  if (!player) return null;

  const equipmentCount = player.equipment?.length || 0;
  const sponsorCount = player.sponsors?.length || 0;

  return (
    <div
      className="p-3 rounded-lg border transition-all"
      style={{
        background: isCurrentTurn ? 'rgba(188,19,254,0.15)' : 'rgba(0,0,0,0.3)',
        borderColor: isCurrentTurn ? '#BC13FE' : 'rgba(255,255,255,0.1)',
        boxShadow: isCurrentTurn ? '0 0 15px rgba(188,19,254,0.3)' : 'none',
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: player.color || '#BC13FE', border: '2px solid white' }}
          >
            {player.seatNumber}
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase" style={{ fontFamily: "'Teko', sans-serif" }}>
              {player.name}
            </div>
            <div className="text-[6px] text-white/40 uppercase" style={PS2}>
              {player.controller === 'ai' ? '🤖 AI' : '👤 Human'}
            </div>
          </div>
        </div>
        {isCurrentTurn && (
          <div className="px-2 py-0.5 rounded bg-[#BC13FE] text-white text-[6px] uppercase" style={PS2}>
            TURN
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <StatBox label="Followers" value={formatNumber(player.followers)} color="#FFD700" />
        <StatBox label="Money" value={`$${player.money || 0}`} color="#00c875" />
        <StatBox label="SSP" value={player.ssp || 0} color="#BC13FE" />
        <StatBox label="Position" value={player.position || 0} color="#FF5F1F" />
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <ProgressBar 
          label="Equipment" 
          current={equipmentCount} 
          total={8} 
          color="#22d3ee" 
        />
        <ProgressBar 
          label="Sponsors" 
          current={sponsorCount} 
          total={1} 
          color="#a78bfa" 
        />
        <ProgressBar 
          label="Followers" 
          current={player.followers || 0} 
          total={1000000} 
          color="#FFD700"
          isPercentage
        />
      </div>

      {/* Equipment List */}
      {equipmentCount > 0 && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="text-[5px] text-white/40 uppercase mb-1" style={PS2}>Equipment</div>
          <div className="flex flex-wrap gap-1">
            {player.equipment?.slice(0, 8).map((eq, i) => (
              <div
                key={i}
                className="px-1.5 py-0.5 rounded text-[5px] uppercase"
                style={{
                  background: getTierColor(eq.tier) + '30',
                  border: `1px solid ${getTierColor(eq.tier)}`,
                  color: getTierColor(eq.tier),
                }}
                title={`${eq.slot} (${eq.tier})`}
              >
                {eq.slot?.split(' ')[0] || 'EQ'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="px-2 py-1.5 rounded bg-white/5 border border-white/10">
      <div className="text-[5px] text-white/40 uppercase mb-0.5" style={PS2}>{label}</div>
      <div className="text-sm font-bold" style={{ color, fontFamily: "'Teko', sans-serif" }}>{value}</div>
    </div>
  );
}

function ProgressBar({ label, current, total, color, isPercentage }) {
  const percentage = isPercentage ? Math.min(100, (current / total) * 100) : Math.min(100, (current / total) * 100);
  
  return (
    <div>
      <div className="flex items-center justify-between text-[5px] text-white/40 uppercase mb-0.5" style={PS2}>
        <span>{label}</span>
        <span>{isPercentage ? `${percentage.toFixed(1)}%` : `${current}/${total}`}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
    </div>
  );
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getTierColor(tier) {
  switch (tier) {
    case 'BS': return '#00c875';
    case 'Playing': return '#FFD700';
    case 'Serious': return '#BC13FE';
    default: return '#666';
  }
}