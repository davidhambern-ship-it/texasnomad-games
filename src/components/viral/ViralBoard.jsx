import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DISTRICTS, 
  SPACE_TYPES, 
  getDistrict, 
  getVIRALPosition,
  PlayerToken,
  GameSpace,
  DistrictHeader 
} from '@/data/viralBoardConstants.jsx';

export default function ViralBoard({ board, players, currentTurnIndex, diceRoll, onSpaceClick }) {
  const [zoom, setZoom] = useState(1);
  const [showAllNumbers, setShowAllNumbers] = useState(false);
  
  if (!board || !board.length) {
    return (
      <div className="flex items-center justify-center h-96 text-white/40">
        <div className="text-center">
          <div className="text-4xl mb-2">🎲</div>
          <div className="text-sm">Board loading...</div>
        </div>
      </div>
    );
  }

  // Calculate board bounds for proper viewport
  const allPositions = board.map(s => getVIRALPosition(s.number));
  const minX = Math.min(...allPositions.map(p => p.x));
  const maxX = Math.max(...allPositions.map(p => p.x));
  const minY = Math.min(...allPositions.map(p => p.y));
  const maxY = Math.max(...allPositions.map(p => p.y));
  
  const boardWidth = (maxX - minX + 6) * 32;
  const boardHeight = (maxY - minY + 4) * 32;

  return (
    <div className="w-full overflow-hidden rounded-2xl border-2 border-purple-500/30" 
      style={{ 
        background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        boxShadow: '0 0 60px rgba(188,19,254,0.3), inset 0 0 100px rgba(0,0,0,0.5)'
      }}>
      
      {/* Board header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/30">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400" style={{ fontFamily: "'Monoton', cursive" }}>
            VIRAL!
          </h2>
          <div className="text-xs text-white/60">120 Spaces • 5 Districts</div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-all"
          >
            🔍 −
          </button>
          <span className="text-xs text-white/60 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-all"
          >
            🔍 +
          </button>
          <button
            onClick={() => setShowAllNumbers(!showAllNumbers)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              showAllNumbers ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            #
          </button>
        </div>
      </div>

      {/* District headers */}
      <div className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-purple-500/20">
        {['V', 'I', 'R', 'A', 'L'].map(district => (
          <DistrictHeader 
            key={district} 
            district={district} 
            isActive={players[currentTurnIndex] && getDistrict(players[currentTurnIndex].position) === district}
          />
        ))}
      </div>

      {/* Board viewport */}
      <div className="relative overflow-auto p-8" style={{ maxHeight: '65vh' }}>
        <motion.div
          animate={{ scale: zoom }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative inline-block"
          style={{ 
            width: boardWidth, 
            height: boardHeight,
            transformOrigin: 'top left'
          }}
        >
          {/* Grid background */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />
          
          {/* Render all spaces */}
          {board.map(space => {
            const pos = getVIRALPosition(space.number);
            const x = (pos.x - minX + 1) * 32;
            const y = (pos.y - minY + 1) * 32;
            
            return (
              <div
                key={space.number}
                className="absolute"
                style={{
                  left: x,
                  top: y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <GameSpace
                  space={space}
                  players={players}
                  currentTurnIndex={currentTurnIndex}
                  onSpaceClick={onSpaceClick}
                  showNumber={showAllNumbers || space.number % 20 === 0 || space.type === 'CREATOR_MANSION'}
                />
              </div>
            );
          })}
          
          {/* Connection lines between spaces */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
            {board.slice(0, -1).map((space, idx) => {
              const pos1 = getVIRALPosition(space.number);
              const pos2 = getVIRALPosition(space.number + 1);
              const x1 = (pos1.x - minX + 1) * 32;
              const y1 = (pos1.y - minY + 1) * 32;
              const x2 = (pos2.x - minX + 1) * 32;
              const y2 = (pos2.y - minY + 1) * 32;
              
              const district = getDistrict(space.number);
              
              return (
                <line
                  key={`line-${space.number}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={DISTRICTS[district]?.color || '#fff'}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              );
            })}
          </svg>
        </motion.div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-purple-500/20">
        {Object.entries(SPACE_TYPES).map(([type, data]) => (
          <div key={type} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded flex items-center justify-center text-xs"
              style={{ background: `${data.color}30`, border: `1px solid ${data.color}60` }}
            >
              {data.icon}
            </div>
            <span className="text-[8px] text-white/60 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}