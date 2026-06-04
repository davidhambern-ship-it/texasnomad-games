import React from 'react';

const sty = { fontFamily: "'Press Start 2P', monospace" };

export default function RoleSelection({ roomCode, seatNumber, onChooseRole, loading = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl border-2 border-[#FFD700]/40 bg-[#05030b] text-center space-y-6"
        style={{ boxShadow: '0 0 40px rgba(255,215,0,0.15)' }}>
        
        <div className="space-y-2">
          <div className="font-heading text-xl tracking-widest text-white uppercase">Choose Your Role</div>
          {seatNumber && (
            <div className="text-[9px] tracking-[0.25em] text-white/40 uppercase" style={sty}>
              You are Seat {seatNumber}
            </div>
          )}
        </div>

        <p className="font-body text-white/60 text-sm px-4">
          How would you like to join Room {roomCode}?
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-8 h-8 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => onChooseRole('participant')}
              className="p-6 rounded-xl border-2 border-[#4ade80]/50 bg-[#4ade80]/5 hover:bg-[#4ade80]/15 hover:border-[#4ade80] transition-all duration-200 active:scale-95"
            >
              <div className="text-4xl mb-3">🎮</div>
              <div className="font-heading text-lg tracking-widest uppercase text-[#4ade80] mb-2">Participant</div>
              <div className="text-[7px] tracking-widest text-white/40 uppercase" style={sty}>
                Play the game • Control X or O • Join queue if full
              </div>
            </button>

            <button
              onClick={() => onChooseRole('watcher')}
              className="p-6 rounded-xl border-2 border-[#ffffff]/30 bg-white/5 hover:bg-white/10 hover:border-white/50 transition-all duration-200 active:scale-95"
            >
              <div className="text-4xl mb-3">👁️</div>
              <div className="font-heading text-lg tracking-widest uppercase text-white mb-2">Watcher</div>
              <div className="text-[7px] tracking-widest text-white/40 uppercase" style={sty}>
                Watch only • No controls • Can join queue later
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}