import React, { useState } from 'react';

export default function HostPasswordGate({ onSuccess }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = onSuccess(pw);
    if (result === false) {
      setError(true);
      setShake(true);
      setTimeout(() => { setShake(false); setPw(''); }, 500);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TexasNomad Logo" className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-[0_0_20px_rgba(188,19,254,0.5)]" />
          <h1 className="text-3xl md:text-4xl tracking-wider text-white uppercase" style={{ fontFamily: "'Rye', serif" }}>
            TexasNomad
          </h1>
          <p className="text-[10px] tracking-[0.25em] text-[#FF5F1F] uppercase mt-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            Host Control Panel
          </p>
        </div>

        {/* Password Form */}
        <form
          onSubmit={handleSubmit}
          className={`p-6 border border-[#BC13FE]/40 rounded-xl bg-black/60 ${shake ? 'animate-shake' : ''}`}
          style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}
        >
          <label className="block text-[9px] tracking-[0.25em] text-white/60 uppercase mb-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            Enter Password
          </label>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false); }}
            placeholder="••••••••••"
            className={`w-full px-4 py-3 rounded-lg bg-black/80 border-2 text-center font-mono text-lg tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors ${
              error ? 'border-red-500' : 'border-[#BC13FE]/50 focus:border-[#BC13FE]'
            }`}
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-xs text-center mt-2 tracking-widest font-heading uppercase">
              Access Denied
            </p>
          )}
          <button
            type="submit"
            className="mt-4 w-full py-3 bg-[#BC13FE] text-white uppercase rounded-lg hover:bg-[#BC13FE]/80 transition-all text-[10px] tracking-[0.2em]" style={{ fontFamily: "'Press Start 2P', monospace" }}
            style={{ boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}
          >
            CONNECT
          </button>
        </form>
      </div>
    </div>
  );
}