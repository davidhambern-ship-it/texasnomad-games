import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// District configurations from master spec
export const DISTRICTS = {
  V: { name: 'Neighborhood', spaces: '1-20', color: '#10b981', theme: 'The Beginning', description: 'Community streets, coffee shops, creator supply stores' },
  I: { name: 'Highway', spaces: '21-40', color: '#3b82f6', theme: 'The Grind', description: 'Billboards, data centers, distribution hubs' },
  R: { name: 'Shopping', spaces: '41-80', color: '#f97316', theme: 'Creator Investment', description: 'Malls, tech stores, equipment upgrades' },
  A: { name: 'Business', spaces: '81-100', color: '#a855f7', theme: 'Monetization', description: 'Sponsor towers, talent agencies, podcast studios' },
  L: { name: 'Downtown', spaces: '101-120', color: '#eab308', theme: 'Creator Legend', description: 'TV studios, award theater, creator boulevard' },
};

// Space type configurations
export const SPACE_TYPES = {
  Follower: { icon: '👥', color: '#06b6d4', label: 'FOLLOW' },
  Sponsorship: { icon: '🤝', color: '#a855f7', label: 'SPON' },
  Equipment: { icon: '📷', color: '#10b981', label: 'EQUIP' },
  Viral: { icon: '🔥', color: '#f97316', label: 'VIRAL' },
  Challenge: { icon: '⚔️', color: '#ef4444', label: 'CHAL' },
  Collaboration: { icon: '✨', color: '#ec4899', label: 'COLLAB' },
  Drama: { icon: '💥', color: '#7c3aed', label: 'DRAMA' },
  Pay: { icon: '💰', color: '#eab308', label: 'PAY' },
  Play: { icon: '🎮', color: '#3b82f6', label: 'PLAY' },
  Event: { icon: '🎪', color: '#f43f5e', label: 'EVENT' },
  SAFE: { icon: '🛡️', color: '#22c55e', label: 'SAFE' },
  CREATOR_MANSION: { icon: '🏆', color: '#fbbf24', label: 'MANSION' },
};

// Get district for space number
export const getDistrict = (spaceNumber) => {
  if (spaceNumber >= 1 && spaceNumber <= 20) return 'V';
  if (spaceNumber >= 21 && spaceNumber <= 40) return 'I';
  if (spaceNumber >= 41 && spaceNumber <= 80) return 'R';
  if (spaceNumber >= 81 && spaceNumber <= 100) return 'A';
  if (spaceNumber >= 101 && spaceNumber <= 120) return 'L';
  return null;
};

// Calculate grid position to spell VIRAL
export const getVIRALPosition = (spaceNumber) => {
  const district = getDistrict(spaceNumber);
  if (!district) return { x: 0, y: 0 };

  const districtInDistrict = spaceNumber % 20 === 0 ? 20 : spaceNumber % 20;
  const letterSpacing = 18;
  const baseX = { V: 0, I: 1, R: 2, A: 3, L: 4 };
  
  const letterShapes = {
    V: () => {
      if (districtInDistrict <= 10) {
        return { x: baseX.V * letterSpacing + (10 - districtInDistrict) * 0.8, y: districtInDistrict * 1.2 };
      } else {
        const pos = districtInDistrict - 10;
        return { x: baseX.V * letterSpacing + pos * 0.8, y: (20 - districtInDistrict) * 1.2 + 12 };
      }
    },
    I: () => {
      return { x: baseX.I * letterSpacing + 2, y: districtInDistrict * 1.2 };
    },
    R: () => {
      if (districtInDistrict <= 12) {
        return { x: baseX.R * letterSpacing, y: districtInDistrict * 1.2 };
      } else if (districtInDistrict <= 20) {
        const loopPos = districtInDistrict - 12;
        return { x: baseX.R * letterSpacing + 1 + loopPos * 0.6, y: 2 + loopPos * 0.8 };
      } else if (districtInDistrict <= 28) {
        const backPos = districtInDistrict - 20;
        return { x: baseX.R * letterSpacing + 5 - backPos * 0.4, y: 10 - backPos * 0.6 };
      } else {
        const legPos = districtInDistrict - 28;
        return { x: baseX.R * letterSpacing + 2 + legPos * 0.7, y: 8 + legPos * 1.1 };
      }
    },
    A: () => {
      if (districtInDistrict <= 8) {
        return { x: baseX.A * letterSpacing + (8 - districtInDistrict) * 0.7, y: districtInDistrict * 1.3 };
      } else if (districtInDistrict <= 16) {
        const rightPos = districtInDistrict - 8;
        return { x: baseX.A * letterSpacing + 5 + rightPos * 0.7, y: (16 - rightPos) * 1.3 + 10.4 };
      } else {
        const barPos = districtInDistrict - 16;
        return { x: baseX.A * letterSpacing + 2 + barPos * 0.8, y: 7.5 };
      }
    },
    L: () => {
      if (districtInDistrict <= 12) {
        return { x: baseX.L * letterSpacing + 2, y: districtInDistrict * 1.3 };
      } else {
        const horizPos = districtInDistrict - 12;
        return { x: baseX.L * letterSpacing + 2 + horizPos * 0.9, y: 15.6 };
      }
    },
  };

  return letterShapes[district]();
};

// Player token colors
const TOKEN_COLORS = ['#BC13FE', '#FF5F1F', '#FFD700', '#22d3ee', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa'];

// Player Token component
export function PlayerToken({ player, isCurrentTurn, offset = { x: 0, y: 0 } }) {
  const color = TOKEN_COLORS[player.seatNumber % TOKEN_COLORS.length];
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1,
        boxShadow: isCurrentTurn ? `0 0 20px ${color}, 0 0 40px ${color}` : `0 2px 8px ${color}60`
      }}
      transition={{ duration: 0.3 }}
      className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold z-20 cursor-pointer hover:scale-125 transition-transform"
      style={{ 
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
      title={`${player.name} (Seat ${player.seatNumber})`}
    >
      {player.seatNumber}
    </motion.div>
  );
}

// Game Space component
export function GameSpace({ space, players, currentTurnIndex, onSpaceClick, showNumber = true }) {
  const [isHovered, setIsHovered] = useState(false);
  const spaceType = SPACE_TYPES[space.type] || SPACE_TYPES.Follower;
  const district = getDistrict(space.number);
  const districtConfig = DISTRICTS[district];
  const playersOnSpace = players.filter(p => p.position === space.number);
  
  const isCreatorMansion = space.type === 'CREATOR_MANSION';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: space.number * 0.005 }}
      className={`relative flex items-center justify-center rounded-lg border-2 cursor-pointer transition-all duration-200 ${
        isHovered ? 'scale-110 z-10' : 'scale-100'
      } ${isCreatorMansion ? 'w-12 h-12' : 'w-8 h-8'}`}
      style={{
        background: isCreatorMansion 
          ? `linear-gradient(135deg, #fbbf24, #f59e0b)`
          : `linear-gradient(135deg, ${spaceType.color}30, ${spaceType.color}15)`,
        borderColor: isHovered ? spaceType.color : `${spaceType.color}60`,
        boxShadow: isHovered 
          ? `0 0 20px ${spaceType.color}, inset 0 0 10px ${spaceType.color}30`
          : `0 2px 8px ${spaceType.color}20`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSpaceClick?.(space)}
    >
      <span className="text-xs select-none">{isHovered ? spaceType.icon : spaceType.label}</span>
      
      {showNumber && (
        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-slate-900 border border-white/30 flex items-center justify-center text-[5px] font-bold text-white/80">
          {space.number}
        </div>
      )}
      
      <div 
        className="absolute -bottom-1 w-6 h-1 rounded-full opacity-60"
        style={{ background: districtConfig?.color }}
      />
      
      {playersOnSpace.map((player, idx) => {
        const offset = playersOnSpace.length > 1 
          ? { x: (idx - (playersOnSpace.length - 1) / 2) * 8, y: idx % 2 === 0 ? -4 : 4 }
          : { x: 0, y: 0 };
        
        return (
          <div key={player.seatNumber} className="absolute" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
            <PlayerToken player={player} isCurrentTurn={player.seatNumber === players[currentTurnIndex]?.seatNumber} />
          </div>
        );
      })}
      
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: -10 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full mb-2 px-3 py-2 bg-slate-900 border border-white/20 rounded-lg shadow-xl z-30 min-w-[150px] pointer-events-none"
          >
            <div className="text-[9px] font-bold text-white mb-1">{spaceType.icon} {space.type}</div>
            <div className="text-[6px] text-white/70">Space {space.number}</div>
            <div className="text-[6px] text-white/50 mt-0.5">{districtConfig?.name} District</div>
            {space.effect?.description && (
              <div className="text-[5px] text-white/60 mt-1 italic">{space.effect.description}</div>
            )}
            {playersOnSpace.length > 0 && (
              <div className="text-[5px] text-white/80 mt-1 pt-1 border-t border-white/10">
                {playersOnSpace.map(p => p.name).join(', ')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// District Header component
export function DistrictHeader({ district, isActive }) {
  const config = DISTRICTS[district];
  return (
    <motion.div
      animate={{ 
        scale: isActive ? 1.05 : 1,
        boxShadow: isActive ? `0 0 30px ${config.color}60` : 'none'
      }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border-2"
      style={{
        background: `linear-gradient(135deg, ${config.color}20, ${config.color}10)`,
        borderColor: `${config.color}60`,
      }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold text-white" style={{ background: config.color }}>
        {district}
      </div>
      <div>
        <div className="text-sm font-bold text-white">{config.name} District</div>
        <div className="text-[9px] text-white/60 uppercase">{config.theme} • Spaces {config.spaces}</div>
        <div className="text-[8px] text-white/40 mt-0.5">{config.description}</div>
      </div>
    </motion.div>
  );
}