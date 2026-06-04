import React from 'react';

const sty = { fontFamily: "'Press Start 2P', monospace" };

export default function RoleSelector({ seatNumber, isSeated, onChooseRole, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl border-2 border-[#FFD700]/40 bg-black text-center space-y-6"
        style={{ boxShadow: '0 0 40px rgba(255,215,0,0.15)' }}>
        
        <div>
          <div className="font-heading text-2xl tracking-widest text-white uppercase mb-2">Choose Your Role</div>
          {isSeated && seatNumber && (
            <div className="text-[9px] tracking-[0.25em] text-white/40 uppercase mt-1" style={sty}>
              You are Seat {seatNumber}
            </div>
          )}
          {!isSeated && (
            <div className="text-[8px] tracking-widest text-white/20 uppercase mt-1" style={sty}>
              Assigning seat…
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-10 h-10 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => onChooseRole('participant')}
              disabled={!isSeated}
              className="p-6 rounded-xl border-2 border-[#4ade80]/50 bg-[#4ade80]/5 hover:bg-[#4ade80]/15 hover:border-[#4ade80] hover:scale-105 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-3">🎮</div>
              <div className="font-heading text-xl tracking-widest uppercase text-[#4ade80] mb-2">Participant</div>
              <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase" style={sty}>
                Play the game • Compete for X/O • Join queue
              </div>
            </button>

            <button
              onClick={() => onChooseRole('watcher')}
              disabled={!isSeated}
              className="p-6 rounded-xl border-2 border-[#ffffff]/30 bg-white/5 hover:bg-white/10 hover:border-white/50 hover:scale-105 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-3">👁</div>
              <div className="font-heading text-xl tracking-widest uppercase text-white/70 mb-2">Watcher</div>
              <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase" style={sty}>
                Watch only • Can join queue later
              </div>
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-white/10">
          <div className="text-[7px] tracking-widest text-white/30 uppercase" style={sty}>
            Choose how you want to experience the game
          </div>
        </div>
      </div>
    </div>
  );
}