import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPACE_TYPES, getDistrict, DISTRICTS } from './ViralBoardConfig';
import PlayerToken from './PlayerToken';

export default function GameSpace({ space, players, currentTurnIndex, onSpaceClick, showNumber = true }) {
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
      {/* Space icon */}
      <span className="text-xs select-none">{isHovered ? spaceType.icon : spaceType.label}</span>
      
      {/* Space number */}
      {showNumber && (
        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-slate-900 border border-white/30 flex items-center justify-center text-[5px] font-bold text-white/80">
          {space.number}
        </div>
      )}
      
      {/* District indicator */}
      <div 
        className="absolute -bottom-1 w-6 h-1 rounded-full opacity-60"
        style={{ background: districtConfig?.color }}
      />
      
      {/* Player tokens */}
      {playersOnSpace.map((player, idx) => {
        const offset = playersOnSpace.length > 1 
          ? { x: (idx - (playersOnSpace.length - 1) / 2) * 8, y: idx % 2 === 0 ? -4 : 4 }
          : { x: 0, y: 0 };
        
        return (
          <div
            key={player.seatNumber}
            className="absolute"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
          >
            <PlayerToken 
              player={player} 
              isCurrentTurn={player.seatNumber === players[currentTurnIndex]?.seatNumber}
            />
          </div>
        );
      })}
      
      {/* Hover tooltip */}
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