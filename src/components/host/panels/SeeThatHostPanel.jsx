import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const OBJECT_POOL = [
  { id: 'frog',          label: 'Frog',          emoji: '🐸' },
  { id: 'gold_bean',     label: 'Gold Bean',     emoji: '🫘' },
  { id: 'cowboy_hat',    label: 'Cowboy Hat',    emoji: '🤠' },
  { id: 'lantern',       label: 'Lantern',       emoji: '🏮' },
  { id: 'boot',          label: 'Boot',          emoji: '👢' },
  { id: 'snake',         label: 'Snake',         emoji: '🐍' },
  { id: 'diamond',       label: 'Diamond',       emoji: '💎' },
  { id: 'playing_card',  label: 'Playing Card',  emoji: '🃏' },
  { id: 'camera',        label: 'Camera',        emoji: '📷' },
  { id: 'ring_light',    label: 'Ring Light',    emoji: '💡' },
  { id: 'microphone',    label: 'Microphone',    emoji: '🎤' },
  { id: 'sheriff_badge', label: 'Sheriff Badge', emoji: '⭐' },
  { id: 'texas_flag',    label: 'Texas Flag',    emoji: '🚩' },
  { id: 'bigo_dino',     label: 'Bigo Dino',     emoji: '🦕' },
  { id: 'dexter',        label: 'Dexter',        emoji: '🤖' },
];

export default function SeeThatHostPanel({ gs, roomCode }) {
  const phase = gs.phase || 'lobby';
  const score = gs.score || 0;
  const foundCount = gs.foundCount || 0;
  const timeLeft = gs.timeLeft || 60;

  const scoreColor = score < 0 ? '#ef4444' : '#FFD700';
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#FF5F1F' : '#4ade80';

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
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

      {/* Open game link */}
      <div className="p-4 rounded-xl flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg,#070f07,#0d1a0d)', border: '2px solid rgba(74,222,128,0.4)', boxShadow: '0 0 20px rgba(74,222,128,0.1)' }}>
        <div>
          <div className="font-heading text-lg tracking-widest text-[#4ade80] uppercase">Play Full Game</div>
          <p className="text-[7px] tracking-widest text-white/40 uppercase mt-0.5" style={PS2}>
            See That! is a single-player hidden object game — open and play directly
          </p>
        </div>
        <a
          href="/games/see-that"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg,#4ade8030,#4ade8015)', border: '2px solid #4ade80', color: '#4ade80', boxShadow: '0 0 15px rgba(74,222,128,0.3)' }}>
          ▶ OPEN GAME ↗
        </a>
      </div>

      {/* Live stats (shown when a game is in progress) */}
      {phase === 'playing' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl text-center"
            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.3)' }}>
            <div className="text-[7px] text-[#4ade80]/60 uppercase mb-1" style={PS2}>Found</div>
            <div className="font-heading text-3xl text-[#4ade80]">{foundCount}<span className="text-lg text-white/30"> / 5</span></div>
          </div>
          <div className="p-4 rounded-xl text-center"
            style={{ background: `${timerColor}08`, border: `1px solid ${timerColor}50` }}>
            <div className="text-[7px] uppercase mb-1" style={{ ...PS2, color: `${timerColor}80` }}>Time</div>
            <div className="font-heading text-3xl" style={{ color: timerColor }}>{timeLeft}s</div>
          </div>
          <div className="p-4 rounded-xl text-center"
            style={{ background: `${scoreColor}08`, border: `1px solid ${scoreColor}50` }}>
            <div className="text-[7px] uppercase mb-1" style={{ ...PS2, color: `${scoreColor}80` }}>Score</div>
            <div className="font-heading text-3xl" style={{ color: scoreColor }}>{score}</div>
          </div>
        </div>
      )}

      {/* Object reference guide */}
      <div className="p-5 rounded-xl"
        style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(74,222,128,0.2)' }}>
        <h3 className="text-[8px] tracking-[0.2em] text-[#4ade80] uppercase mb-4" style={PS2}>
          Hidden Object Pool — 15 Objects
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {OBJECT_POOL.map(obj => (
            <div key={obj.id} className="flex flex-col items-center gap-1 p-2 rounded-lg"
              style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <span className="text-2xl">{obj.emoji}</span>
              <span className="text-[6px] text-white/50 uppercase tracking-widest text-center" style={PS2}>{obj.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[6px] text-white/20 uppercase tracking-widest mt-3" style={PS2}>
          Each round picks 5 random objects from this pool and hides them in the saloon scene.
        </p>
      </div>

      {/* How to play */}
      <div className="p-5 rounded-xl"
        style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(255,215,0,0.15)' }}>
        <h3 className="text-[8px] tracking-[0.2em] text-[#FFD700] uppercase mb-3" style={PS2}>How to Play</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: '👁', label: '5 Objects', desc: 'Find all 5 hidden objects in the saloon scene' },
            { icon: '⏱', label: '60 Seconds', desc: 'Race the clock — find all objects before time runs out' },
            { icon: '🎯', label: 'No Misses', desc: '+100 per correct find, -10 per wrong click' },
          ].map(f => (
            <div key={f.label} className="flex gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}>
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div>
                <div className="font-heading text-sm text-[#FFD700] uppercase tracking-widest">{f.label}</div>
                <div className="text-[7px] text-white/40 mt-0.5" style={PS2}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}