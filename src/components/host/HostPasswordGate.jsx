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
          <div
            className="w-16 h-16 rounded-full bg-[#BC13FE]/20 border-2 border-[#FFD700] flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}
          >
            <span className="font-display text-[#FFD700] text-xl">TN</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl tracking-[0.15em] text-white uppercase">
            TexasNomad
          </h1>
          <p className="font-heading text-sm tracking-[0.25em] text-[#FF5F1F] uppercase mt-1">
            Host Control Panel
          </p>
        </div>

        {/* Password Form */}
        <form
          onSubmit={handleSubmit}
          className={`p-6 border border-[#BC13FE]/40 rounded-xl bg-black/60 ${shake ? 'animate-shake' : ''}`}
          style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}
        >
          <label className="block font-heading text-xs tracking-[0.25em] text-white/60 uppercase mb-2">
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
            className="mt-4 w-full py-3 bg-[#BC13FE] text-white font-heading text-lg tracking-[0.2em] uppercase rounded-lg hover:bg-[#BC13FE]/80 transition-all"
            style={{ boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}
          >
            CONNECT
          </button>
        </form>
      </div>
    </div>
  );
}