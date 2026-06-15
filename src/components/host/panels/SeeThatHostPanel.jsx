import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SeeThatHostPanel({ gs, roomCode }) {
  const phase = gs.phase || 'lobby';
  const score = gs.score || 0;
  const foundCount = gs.foundCount || 0;
  const timeLeft = gs.timeLeft || 60;

  const scoreColor = score < 0 ? '#ef4444' : '#FFD700';
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#FF5F1F' : '#4ade80';

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
          <div>
            <h2 className="font-heading text-2xl tracking-widest text-white uppercase">See That!</h2>
            <p className="text-[7px] tracking-[0.2em] text-white/30 uppercase" style={PS2}>Host Control Panel</p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg text-[7px] uppercase tracking-widest"
          style={{ ...PS2, background: phase === 'playing' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${phase === 'playing' ? '#4ade80' : 'rgba(255,255,255,0.15)'}`, color: phase === 'playing' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
          {phase.toUpperCase()}
        </div>
      </div>

      {/* Main layout: game iframe left, stats right */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Embedded game */}
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden"
          style={{ border: '2px solid rgba(74,222,128,0.4)', minHeight: 500 }}>
          <iframe
            src="/games/see-that"
            className="w-full h-full"
            style={{ minHeight: 500, border: 'none', background: '#05030b' }}
            title="See That!"
          />
        </div>

        {/* Right sidebar: live stats */}
        <div className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto">

          {/* Live stats */}
          <div className="p-4 rounded-xl space-y-3"
            style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(74,222,128,0.3)' }}>
            <h3 className="text-[8px] tracking-[0.2em] text-[#4ade80] uppercase" style={PS2}>Live Stats</h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <span className="text-[7px] text-white/50 uppercase" style={PS2}>Found</span>
                <span className="font-heading text-xl text-[#4ade80]">{foundCount} <span className="text-sm text-white/30">/ 5</span></span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: `${timerColor}08`, border: `1px solid ${timerColor}30` }}>
                <span className="text-[7px] text-white/50 uppercase" style={PS2}>Time</span>
                <span className="font-heading text-xl" style={{ color: timerColor }}>{timeLeft}s</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: `${scoreColor}08`, border: `1px solid ${scoreColor}30` }}>
                <span className="text-[7px] text-white/50 uppercase" style={PS2}>Score</span>
                <span className="font-heading text-xl" style={{ color: scoreColor }}>{score}</span>
              </div>
            </div>
          </div>

          {/* Game info */}
          <div className="p-4 rounded-xl space-y-2"
            style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <h3 className="text-[8px] tracking-[0.2em] text-[#FFD700] uppercase mb-3" style={PS2}>Rules</h3>
            {[
              { icon: '👁', text: 'Find 5 hidden objects' },
              { icon: '⏱', text: '60 second time limit' },
              { icon: '✅', text: '+100 per correct find' },
              { icon: '❌', text: '-10 per wrong click' },
            ].map(r => (
              <div key={r.text} className="flex items-center gap-2">
                <span className="text-base">{r.icon}</span>
                <span className="text-[6px] text-white/50 uppercase tracking-widest" style={PS2}>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}