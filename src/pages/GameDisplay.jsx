import React, { useState } from 'react';
import { CheckCircle2, Loader2, Monitor } from 'lucide-react';

import { backendMigration } from '@/config/backendMigration';
import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function GameDisplay() {
  const [code, setCode] = useState('');
  const [display, setDisplay] = useState(() => {
    const token = localStorage.getItem('tng_display_token');
    const deviceId = localStorage.getItem('tng_display_device_id');
    const hostSessionId = localStorage.getItem('tng_display_host_session_id');
    return token && deviceId ? { token, deviceId, hostSessionId } : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function pairDisplay(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await tngApi.display.pair(code);
      localStorage.setItem('tng_display_token', payload.display.token);
      localStorage.setItem('tng_display_device_id', payload.display.deviceId);
      localStorage.setItem('tng_display_host_session_id', payload.display.hostSessionId);
      setDisplay(payload.display);
    } catch (pairError) {
      setError(pairError.message || 'The Game Display could not connect.');
    } finally {
      setLoading(false);
    }
  }

  function resetDisplay() {
    localStorage.removeItem('tng_display_token');
    localStorage.removeItem('tng_display_device_id');
    localStorage.removeItem('tng_display_host_session_id');
    setDisplay(null);
    setCode('');
    setError('');
  }

  if (!backendMigration.tngBackendEnabled) {
    return (
      <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center px-4 text-center">
        <div className="max-w-lg">
          <Monitor className="w-12 h-12 mx-auto mb-5 text-white/25" />
          <div className="uppercase tracking-widest text-white/45" style={{ ...PS2, fontSize: 9 }}>GAME DISPLAY PAIRING IS NOT ENABLED IN THIS ENVIRONMENT</div>
        </div>
      </div>
    );
  }

  if (display) {
    return (
      <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center px-4 text-center">
        <div className="w-full max-w-xl">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-5 text-[#4ade80]" />
          <div className="text-[8px] text-[#4ade80] uppercase tracking-[0.3em] mb-3" style={PS2}>DISPLAY CONNECTED</div>
          <h1 className="text-4xl uppercase tracking-wider" style={{ fontFamily: "'Rye', serif" }}>Game Display Ready</h1>
          <p className="mt-4 text-sm text-white/45 leading-relaxed">Leave this screen open. The Host Controller now owns this display and will send the live room state here as each game moves to the Neon room protocol.</p>

          <div className="mt-8 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 p-5 text-left">
            <div className="text-[7px] text-white/30 uppercase tracking-widest mb-2" style={PS2}>DISPLAY DEVICE</div>
            <div className="font-mono text-xs text-white/55 break-all">{display.deviceId}</div>
          </div>

          <button onClick={resetDisplay} className="mt-7 px-5 py-3 rounded-lg border border-white/20 text-white/45 hover:text-white hover:bg-white/5 uppercase tracking-widest" style={{ ...PS2, fontSize: 8 }}>
            DISCONNECT DISPLAY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <Monitor className="w-14 h-14 mx-auto mb-5 text-[#FFD700]" />
        <div className="text-[8px] text-[#FFD700] uppercase tracking-[0.3em] mb-3" style={PS2}>TNG GAME DISPLAY</div>
        <h1 className="text-4xl uppercase tracking-wider" style={{ fontFamily: "'Rye', serif" }}>Pair This Screen</h1>
        <p className="mt-4 text-sm text-white/45 leading-relaxed">Enter the six-digit code shown on the Host Controller.</p>

        <form onSubmit={pairDisplay} className="mt-8 rounded-2xl border border-[#FFD700]/35 bg-black/60 p-6">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="w-full h-16 rounded-xl border-2 border-[#FFD700]/40 bg-black/70 text-center font-mono text-4xl tracking-[0.28em] text-[#FFD700] pl-[0.28em] outline-none focus:border-[#FFD700]"
          />

          {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="mt-5 w-full h-12 rounded-lg bg-[#FFD700] text-black disabled:opacity-40 flex items-center justify-center gap-2 uppercase tracking-widest"
            style={{ ...PS2, fontSize: 8 }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'PAIRING…' : 'CONNECT DISPLAY'}
          </button>
        </form>
      </div>
    </div>
  );
}
