import React from 'react';

export default function SeatBadge({ seatNumber, isSeated, alreadyChosen }) {
  if (!isSeated) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className="px-3 py-1 rounded-lg border-2 flex items-center gap-2"
        style={{
          borderColor: '#BC13FE',
          background: 'rgba(188,19,254,0.1)',
          boxShadow: '0 0 10px rgba(188,19,254,0.3)',
        }}
      >
        <span className="text-[8px] tracking-widest uppercase text-[#BC13FE]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          YOU ARE
        </span>
        <span className="text-[10px] font-bold text-white tracking-widest" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          SEAT {seatNumber}
        </span>
      </div>
      {alreadyChosen && (
        <div className="px-2 py-1 rounded border border-[#FF5F1F]/50 bg-[#FF5F1F]/10 text-[7px] tracking-widest text-[#FF5F1F] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          Chose this round
        </div>
      )}
    </div>
  );
}