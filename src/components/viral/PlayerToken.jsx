import React from 'react';
import { motion } from 'framer-motion';

const colors = ['#BC13FE', '#FF5F1F', '#FFD700', '#22d3ee', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa'];

export default function PlayerToken({ player, isCurrentTurn, offset = { x: 0, y: 0 } }) {
  const color = colors[player.seatNumber % colors.length];
  
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