import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  DISTRICTS, 
  SPACE_TYPES, 
  SPECIAL_SPACES,
  BUILDINGS,
  getDistrict,
  SPACE_POSITIONS,
  DISTRICT_PATHS,
  GameSpace,
  DistrictHeader 
} from '@/data/viralBoardConstants.jsx';

// Board dimensions matching prototype
const BOARD_WIDTH = 1600;
const BOARD_HEIGHT = 1050;

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

  // Base scale to fit board in viewport (55% of screen)
  const baseScale = Math.min(0.55, zoom);

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
          <span className="text-xs text-white/60 w-12 text-center">{Math.round(baseScale * 100)}%</span>
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
          animate={{ scale: baseScale }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative"
          style={{ 
            width: BOARD_WIDTH, 
            height: BOARD_HEIGHT,
          }}
        >
          {/* Grid background */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />

          {/* SVG Paths with glow effects */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} preserveAspectRatio="none">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* District V path */}
            <polyline 
              points="220,150 420,820 610,150" 
              fill="none" 
              stroke="#18d45b" 
              strokeWidth="42" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              opacity=".22"
            />
            <polyline 
              points="220,150 420,820 610,150" 
              fill="none" 
              stroke="#18d45b" 
              strokeWidth="7" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              filter="url(#glow)"
            />

            {/* District I path */}
            <line 
              x1="710" y1="140" 
              x2="710" y2="820" 
              stroke="#23aaff" 
              strokeWidth="42" 
              strokeLinecap="round" 
              opacity=".22"
            />
            <line 
              x1="710" y1="140" 
              x2="710" y2="820" 
              stroke="#23aaff" 
              strokeWidth="7" 
              strokeLinecap="round" 
              filter="url(#glow)"
            />

            {/* District R path */}
            <path 
              d="M840 820 L840 150 Q1110 135 1120 315 Q1130 500 850 485 L1130 820" 
              fill="none" 
              stroke="#ff8a1c" 
              strokeWidth="42" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              opacity=".22"
            />
            <path 
              d="M840 820 L840 150 Q1110 135 1120 315 Q1130 500 850 485 L1130 820" 
              fill="none" 
              stroke="#ff8a1c" 
              strokeWidth="7" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              filter="url(#glow)"
            />

            {/* District A path */}
            <polyline 
              points="1220,820 1340,150 1460,820" 
              fill="none" 
              stroke="#b84cff" 
              strokeWidth="42" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              opacity=".22"
            />
            <polyline 
              points="1220,820 1340,150 1460,820" 
              fill="none" 
              stroke="#b84cff" 
              strokeWidth="7" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              filter="url(#glow)"
            />
            <line 
              x1="1268" y1="555" 
              x2="1412" y2="555" 
              stroke="#b84cff" 
              strokeWidth="7" 
              filter="url(#glow)"
            />

            {/* District L path */}
            <polyline 
              points="1510,150 1510,820 1580,820" 
              fill="none" 
              stroke="#ffd35a" 
              strokeWidth="42" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              opacity=".22"
            />
            <polyline 
              points="1510,150 1510,820 1580,820" 
              fill="none" 
              stroke="#ffd35a" 
              strokeWidth="7" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              filter="url(#glow)"
            />
          </svg>

          {/* District labels */}
          {Object.entries(DISTRICT_PATHS).map(([district, config]) => (
            <div
              key={district}
              className="absolute border-2 rounded-xl px-4 py-3 bg-[#05050e]/84 shadow-lg z-5"
              style={{
                left: district === 'V' ? 60 : district === 'I' ? 640 : district === 'R' ? 850 : district === 'A' ? 1210 : 1390,
                top: 35,
                borderColor: config.color,
                color: config.color,
                boxShadow: `0 0 18px ${config.color}`,
              }}
            >
              <div className="text-xs font-black uppercase tracking-wider">{district} — {DISTRICTS[district].name}</div>
              <div className="text-[10px] text-white/60 mt-1">Spaces {config.spaceRange[0]}–{config.spaceRange[1]}</div>
            </div>
          ))}
          
          {/* Building labels */}
          {BUILDINGS.map((building, idx) => (
            <div
              key={idx}
              className="absolute px-3 py-2.5 rounded-lg z-1"
              style={{
                left: building.x,
                top: building.y,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03))',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.4), 0 0 12px rgba(255,255,255,0.08)',
                minWidth: '120px',
                textAlign: 'center',
              }}
            >
              <div className="text-[10px] font-black uppercase text-white">{building.name}</div>
              <div className="text-[8px] text-white/60 mt-1.5">{building.desc}</div>
            </div>
          ))}
          
          {/* Render all spaces */}
          {board.map(space => {
            const pos = SPACE_POSITIONS[space.number];
            if (!pos) return null;
            
            return (
              <div
                key={space.number}
                className="absolute"
                style={{
                  left: pos.x,
                  top: pos.y,
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