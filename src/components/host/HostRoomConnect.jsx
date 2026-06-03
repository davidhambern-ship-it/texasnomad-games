import React, { useState } from 'react';

export default function HostRoomConnect({ game, onConnect, onBack }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleConnect = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    onConnect(code.trim().toUpperCase());
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      {/* Back */}
      <button
        onClick={onBack}
        className="self-start ml-0 sm:ml-8 mb-8 text-white/40 hover:text-white font-heading text-xs tracking-widest uppercase transition-colors"
      >
        ← Back to Game Select
      </button>

      <div className="w-full max-w-sm">
        {/* Selected Game Badge */}
        <div
          className="flex items-center gap-3 p-3 rounded-lg border mb-8"
          style={{ borderColor: `${game.color}50`, background: `${game.color}10` }}
        >
          <span className="text-3xl">{game.emoji}</span>
          <div>
            <span className="font-heading text-xl tracking-widest uppercase" style={{ color: game.color }}>
              {game.title}
            </span>
            <span className="block font-heading text-[10px] tracking-[0.2em] text-white/50 uppercase">
              {game.subtitle}
            </span>
          </div>
        </div>

        <form
          onSubmit={handleConnect}
          className={`p-6 border border-[#BC13FE]/40 rounded-xl bg-black/60 ${shake ? 'animate-shake' : ''}`}
          style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}
        >
          <label className="block font-heading text-xs tracking-[0.25em] text-white/60 uppercase mb-2">
            Room Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(false); }}
            placeholder="EX: TN817"
            className={`w-full px-4 py-3 rounded-lg bg-black/80 border-2 text-center font-mono text-xl tracking-[0.3em] text-white placeholder:text-white/20 focus:outline-none transition-colors ${
              error ? 'border-red-500' : 'border-[#BC13FE]/50 focus:border-[#BC13FE]'
            }`}
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-xs text-center mt-2 tracking-widest font-heading uppercase">
              Room Code Required
            </p>
          )}
          <p className="font-heading text-[9px] tracking-widest text-white/30 uppercase text-center mt-2">
            Players connect at: /games/{game.id}?room={code || 'TN817'}
          </p>
          <button
            type="submit"
            className="mt-5 w-full py-3.5 font-heading text-xl tracking-[0.2em] uppercase rounded-lg text-black transition-all"
            style={{
              background: game.color,
              boxShadow: `0 0 20px ${game.color}60`,
            }}
          >
            CONNECT TO ROOM
          </button>
        </form>
      </div>
    </div>
  );
}