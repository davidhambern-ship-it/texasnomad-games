import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// District configurations matching prototype
export const DISTRICTS = {
  V: { name: 'Neighborhood', spaces: '1-20', color: '#18d45b', theme: 'The Beginning', purpose: 'First supporters, early content' },
  I: { name: 'Highway', spaces: '21-40', color: '#23aaff', theme: 'Consistency', purpose: 'Discipline, skill building' },
  R: { name: 'Shopping', spaces: '41-80', color: '#ff8a1c', theme: 'Investment', purpose: 'Equipment, upgrades' },
  A: { name: 'Business', spaces: '81-100', color: '#b84cff', theme: 'Monetization', purpose: 'Sponsorships, deals' },
  L: { name: 'Downtown', spaces: '101-120', color: '#ffd35a', theme: 'Endgame', purpose: 'Major fame, Creator Mansion' },
};

// Space types with icons
export const SPACE_TYPES = {
  Followers: { icon: '👥', color: '#18d45b', label: 'Followers' },
  Challenge: { icon: '⚡', color: '#ff4a3d', label: 'Challenge' },
  Equipment: { icon: '🎥', color: '#23aaff', label: 'Equipment' },
  Drama: { icon: '🔥', color: '#ff8a1c', label: 'Drama' },
  Collab: { icon: '🤝', color: '#b84cff', label: 'Collab' },
  Sponsorship: { icon: '💼', color: '#ffd35a', label: 'Sponsorship' },
  Pay: { icon: '💰', color: '#18d45b', label: 'Pay' },
  Play: { icon: '🎲', color: '#23aaff', label: 'Play' },
  Viral: { icon: '🚀', color: '#ff8a1c', label: 'Viral' },
  Event: { icon: '🎤', color: '#b84cff', label: 'Event' },
};

// Special space names
export const SPECIAL_SPACES = {
  1: 'START',
  10: "Creator's Corner",
  20: 'Exit to Highway',
  21: 'Merge Lane',
  30: 'Keep Grinding',
  40: 'Checkpoint',
  41: 'Mall Entrance',
  50: 'Equipment Shop',
  60: 'Creator Upgrade',
  70: 'Brand Fit Check',
  80: 'Exit to Business',
  81: 'Brand HQ',
  90: 'VIP Bridge',
  100: 'Exit to Downtown',
  101: 'Fame Run',
  110: 'Victory Lap',
  115: 'Final Climb',
  120: 'Creator Mansion',
};

// Building labels with positions
export const BUILDINGS = [
  { name: 'Community Center', x: 80, y: 270, desc: 'First supporters' },
  { name: 'Coffee Shop', x: 520, y: 735, desc: 'Create and connect' },
  { name: 'Creator Supply', x: 510, y: 230, desc: 'Early gear' },
  { name: 'Billboard Row', x: 570, y: 390, desc: 'Stay visible' },
  { name: 'Data Center', x: 765, y: 320, desc: 'Track growth' },
  { name: 'Distribution', x: 770, y: 705, desc: 'Share daily' },
  { name: 'Gaming Store', x: 930, y: 235, desc: 'Creator tools' },
  { name: 'Tech Hub', x: 1065, y: 520, desc: 'Upgrade setup' },
  { name: 'Sneaker Spot', x: 970, y: 720, desc: 'Style matters' },
  { name: 'Sponsor Towers', x: 1240, y: 295, desc: 'Monetize' },
  { name: 'Talent Agency', x: 1360, y: 385, desc: 'Get discovered' },
  { name: 'Podcast Studios', x: 1240, y: 645, desc: 'Build voice' },
  { name: 'TV Studios', x: 1395, y: 235, desc: 'Go bigger' },
  { name: 'Award Theater', x: 1370, y: 700, desc: 'Recognition' },
  { name: 'Creator Mansion', x: 1435, y: 855, desc: 'Space 120' },
];

// Player token colors
export const PLAYER_COLORS = ['#ff3df2', '#23aaff', '#ff8a1c', '#b84cff', '#ffd35a', '#18d45b', '#ff4a3d', '#ffffff', '#00ffd5', '#ff7ad9', '#7cff00', '#9ca3ff'];

// Path definitions matching the prototype SVG
export const DISTRICT_PATHS = {
  V: {
    points: [[220, 150], [420, 820], [610, 150]],
    color: '#18d45b',
    spaceRange: [1, 20],
  },
  I: {
    points: [[710, 140], [710, 820]],
    color: '#23aaff',
    spaceRange: [21, 40],
  },
  R: {
    points: [[840, 820], [840, 150], [1000, 145], [1120, 255], [1090, 420], [850, 485], [1130, 820]],
    color: '#ff8a1c',
    spaceRange: [41, 80],
  },
  A: {
    points: [[1220, 820], [1340, 150], [1460, 820]],
    color: '#b84cff',
    spaceRange: [81, 100],
  },
  L: {
    points: [[1510, 150], [1510, 820], [1580, 820]],
    color: '#ffd35a',
    spaceRange: [101, 120],
  },
};

// Linear interpolation helper
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Calculate points along a path
function getPointsAlongPath(pathPoints, totalSpaces, startNum) {
  const spaces = [];
  const segmentLengths = [];
  let totalLength = 0;

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const dx = pathPoints[i + 1][0] - pathPoints[i][0];
    const dy = pathPoints[i + 1][1] - pathPoints[i][1];
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    totalLength += len;
  }

  for (let n = 0; n < totalSpaces; n++) {
    const dist = (n / (totalSpaces - 1)) * totalLength;
    let acc = 0;
    let x = pathPoints[0][0], y = pathPoints[0][1];

    for (let s = 0; s < segmentLengths.length; s++) {
      if (acc + segmentLengths[s] >= dist) {
        const local = (dist - acc) / segmentLengths[s];
        x = lerp(pathPoints[s][0], pathPoints[s + 1][0], local);
        y = lerp(pathPoints[s][1], pathPoints[s + 1][1], local);
        break;
      }
      acc += segmentLengths[s];
    }

    spaces.push({ num: startNum + n, x, y });
  }

  return spaces;
}

// Pre-calculate all space positions
export const SPACE_POSITIONS = {};
Object.entries(DISTRICT_PATHS).forEach(([district, config]) => {
  const spaceCount = config.spaceRange[1] - config.spaceRange[0] + 1;
  const spacePositions = getPointsAlongPath(config.points, spaceCount, config.spaceRange[0]);
  
  spacePositions.forEach(space => {
    SPACE_POSITIONS[space.num] = {
      x: space.x,
      y: space.y,
      district,
    };
  });
});

// Get position for a space number
export function getVIRALPosition(spaceNumber) {
  const pos = SPACE_POSITIONS[spaceNumber];
  if (pos) return { x: pos.x, y: pos.y };
  return { x: 220, y: 150 };
}

// Get district for a space number
export function getDistrict(spaceNumber) {
  if (spaceNumber >= 1 && spaceNumber <= 20) return 'V';
  if (spaceNumber >= 21 && spaceNumber <= 40) return 'I';
  if (spaceNumber >= 41 && spaceNumber <= 80) return 'R';
  if (spaceNumber >= 81 && spaceNumber <= 100) return 'A';
  if (spaceNumber >= 101 && spaceNumber <= 120) return 'L';
  return 'V';
}

// Get space type cycle
export function getSpaceType(index) {
  const typeCycle = ['Followers', 'Challenge', 'Equipment', 'Drama', 'Collab', 'Sponsorship', 'Pay', 'Play', 'Viral', 'Event'];
  return typeCycle[index % typeCycle.length];
}

// Player Token Component
export function PlayerToken({ seatNumber, color, isCurrentTurn, offsetX = 0, offsetY = 0 }) {
  return (
    <motion.div
      className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg"
      style={{ 
        background: color || PLAYER_COLORS[seatNumber % PLAYER_COLORS.length],
        boxShadow: isCurrentTurn ? '0 0 12px rgba(255,255,255,0.9), 0 0 20px currentColor' : '0 0 8px rgba(255,255,255,0.7)',
        left: `calc(50% + ${offsetX}px)`,
        top: `calc(50% + ${offsetY}px)`,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: isCurrentTurn ? [1, 1.15, 1] : 1,
        opacity: 1,
      }}
      transition={{ 
        duration: isCurrentTurn ? 1 : 0.3,
        repeat: isCurrentTurn ? Infinity : 0,
        repeatType: 'reverse',
      }}
      title={`Player ${seatNumber}`}
    />
  );
}

// Game Space Component
export function GameSpace({ space, players, currentTurnIndex, onSpaceClick, showNumber = true }) {
  const [isHovered, setIsHovered] = useState(false);
  const district = getDistrict(space.number);
  const districtConfig = DISTRICTS[district];
  const spaceType = SPACE_TYPES[space.type] || SPACE_TYPES.Followers;
  const isSpecial = SPECIAL_SPACES[space.number];
  const isCreatorMansion = space.number === 120;
  
  const spacePlayers = players.filter(p => p.position === space.number);
  const isCurrentSpace = players[currentTurnIndex]?.position === space.number;

  return (
    <div
      className="absolute w-[58px] h-[58px] rounded-full flex items-center justify-center border-4 cursor-pointer transition-all duration-150 z-10"
      style={{
        left: space.x,
        top: space.y,
        transform: 'translate(-50%, -50%)',
        color: districtConfig.color,
        background: '#fff',
        borderColor: districtConfig.color,
        boxShadow: `0 0 12px ${districtConfig.color}, inset 0 0 0 5px rgba(0,0,0,0.12)`,
        zIndex: isHovered ? 20 : 10,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSpaceClick?.(space)}
    >
      <AnimatePresence>
        {showNumber || isSpecial || isCreatorMansion ? (
          <motion.span
            className="font-black text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isSpecial ? SPECIAL_SPACES[space.number] || space.number : space.number}
          </motion.span>
        ) : null}
      </AnimatePresence>
      
      {/* Type icon badge */}
      <div
        className="absolute -top-2 -right-2 w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs border border-current"
        style={{
          background: '#0a0a12',
          color: districtConfig.color,
        }}
      >
        {spaceType.icon}
      </div>
      
      {/* Current player indicator */}
      {isCurrentSpace && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 32px ${districtConfig.color}, 0 0 52px ${districtConfig.color}`,
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
        />
      )}
      
      {/* Player tokens */}
      {spacePlayers.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {spacePlayers.map((player, idx) => (
            <PlayerToken
              key={player.seatNumber}
              seatNumber={player.seatNumber}
              color={player.color}
              isCurrentTurn={players[currentTurnIndex]?.seatNumber === player.seatNumber}
              offsetX={(idx % 3) * 16 - 16}
              offsetY={Math.floor(idx / 3) * 16 - 8}
            />
          ))}
        </div>
      )}
      
      {/* Hover tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 rounded-xl shadow-2xl z-50 min-w-[200px]"
            style={{
              background: 'rgba(5,5,14,0.95)',
              border: `2px solid ${districtConfig.color}`,
              boxShadow: `0 0 20px ${districtConfig.color}60`,
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="text-sm font-bold" style={{ color: districtConfig.color }}>
              {isSpecial ? SPECIAL_SPACES[space.number] : spaceType.label}
            </div>
            <div className="text-xs text-white/80 mt-1">Space {space.number}</div>
            <div className="text-xs text-white/60 mt-1">{districtConfig.name} District</div>
            {spacePlayers.length > 0 && (
              <div className="text-xs text-white/60 mt-2 pt-2 border-t border-white/20">
                {spacePlayers.length} player{spacePlayers.length > 1 ? 's' : ''} here
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// District Header Component
export function DistrictHeader({ district, isActive }) {
  const config = DISTRICTS[district];
  
  return (
    <motion.div
      className="px-4 py-3 rounded-xl border-2 text-center"
      style={{
        background: isActive ? `${config.color}20` : 'rgba(255,255,255,0.05)',
        borderColor: config.color,
        boxShadow: isActive ? `0 0 18px ${config.color}` : 'none',
      }}
      animate={{
        scale: isActive ? 1.05 : 1,
      }}
      transition={{ duration: 0.2 }}
    >
      <div className="text-lg font-black uppercase" style={{ color: config.color }}>
        {district}
      </div>
      <div className="text-[10px] text-white/60 mt-1">{config.name}</div>
      {isActive && (
        <div className="text-[8px] text-white/80 mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          ACTIVE
        </div>
      )}
    </motion.div>
  );
}