import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RRHost from '@/components/brawl/RRHost';
import RRController from '@/components/brawl/RRController';
import RRDisplay from '@/components/brawl/RRDisplay';
import '@/components/brawl/rr.css';

/**
 * No-auth, no-database emergency lobby. No account data is read or modified.
 * Only dedicated guest WebSocket endpoints can be used from this page.
 */
export default function EmergencyArcade() {
  const [params, setParams] = useSearchParams();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState('');
  const host = params.get('host') === '1';
  const room = String(params.get('room') || '').toUpperCase();
  const display = String(params.get('display') || '').toUpperCase();
  const exit = () => setParams({}, { replace: true });
  const join = () => {
    const code = entry.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(code)) {
      setError('Enter the five-letter room code shown on the Host screen.');
      return;
    }
    setError('');
    setParams({ room: code });
  };

  if (/^[A-Z]{5}$/.test(display)) return <RRDisplay code={display} guest />;
  if (host) return <RRHost guest onExit={exit} />;
  if (/^[A-Z]{5}$/.test(room)) {
    return <RRController code={room} guest identityName="" identityLoading={false} onExit={exit} />;
  }

  return (
    <main className="min-h-screen bg-[#05030b] text-white px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <a className="text-sm text-[#e4c2ff] underline" href="/">TexasNomad Games</a>
        <div className="mt-8 rounded-2xl border border-[#BC13FE]/50 bg-[#130b1c] p-7">
          <p className="text-xs uppercase tracking-[.25em] text-[#dab7ff]">Temporary TNG access</p>
          <h1 className="mt-3 text-3xl font-black">The arcade is open for guest play.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-200">
            Our Neon database is currently unavailable. You can still play the
            games enabled here without signing in. Guest rooms are temporary:
            scores, wins, rewards, profiles and game history are not saved.
            Existing player accounts and records have not been changed.
          </p>
          <h2 className="mt-8 text-xl font-bold">Rodeo Rumble — Multiplayer</h2>
          <p className="mt-2 text-sm text-slate-300">Host on a computer or TV, then join from your phone or tablet with a room code.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="rounded-lg bg-[#BC13FE] px-5 py-3 font-bold text-white" onClick={() => setParams({ host: '1' })}>Host a room</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              aria-label="Five-letter room code"
              className="w-44 rounded-lg border border-white/30 bg-black p-3 text-white uppercase tracking-widest"
              value={entry} maxLength={5} placeholder="ROOM CODE"
              onChange={(e) => setEntry(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
            />
            <button className="rounded-lg border border-[#BC13FE] px-5 py-3 font-bold" onClick={join}>Join room</button>
          </div>
          {error && <p className="mt-3 text-red-300" role="alert">{error}</p>}
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">
          Emergency guest games are isolated from BERNAverse Passport and normal TNG accounts.
          Normal multiplayer games and saved stats will return after database recovery.
        </p>
      </div>
    </main>
  );
}
