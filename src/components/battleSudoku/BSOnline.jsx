import React, { useCallback, useEffect, useRef, useState } from 'react';
import BSBigScreen from './BSBigScreen';
import BSPhone from './BSPhone';
import BSLobby from './BSLobby';
import { bsApi, bsSeat } from '@/api/battleSudokuApi';
import { createGuestIdentity, getStoredGuestIdentity } from '@/lib/guestIdentity';
import { sfx } from './bsSfx';

function useRoom(code, token, onGone) {
  const [data, setData] = useState(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const tokenRef = useRef(token); tokenRef.current = token;
  const liveRef = useRef(false); liveRef.current = !!data?.room?.game && data.room.game.phase !== 'final';
  const apply = useCallback((d) => { if (d?.room) { setData(d); setOffset(d.room.now - Date.now()); } }, []);
  useEffect(() => {
    if (!code) return undefined;
    let alive = true, timer = null;
    const tick = async () => {
      try { const d = await bsApi.getRoom(code, tokenRef.current); if (!alive) return; apply(d); setError(''); }
      catch (e) { if (!alive) return; if (e.code === 'ROOM_NOT_FOUND') { setError(e.message); onGone && onGone(); return; } setError(e.message); }
      if (alive) timer = setTimeout(tick, liveRef.current ? 650 : 1500);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [code, apply]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, offset, error, apply };
}
const TNG_PUBLIC_ORIGIN = String(
  import.meta.env.VITE_TNG_PUBLIC_ORIGIN || 'https://www.texasnomadgames.com',
).replace(/\/+$/, '');
const joinUrlFor = () => `${TNG_PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}/games/sudoku`;

export function BSHost({ onExit, initialCode = '', freshRoom = false }) {
  const [seat, setSeat] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('bs_host') || 'null'); return freshRoom || (initialCode && saved?.code !== initialCode) ? null : saved; } catch { return null; } });
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, error, apply } = useRoom(seat?.code, seat?.token, () => { try { localStorage.removeItem('bs_host'); } catch { /* ignore */ } setSeat(null); });
  const { data: playerData, offset: playerOffset, apply: applyPlayer } = useRoom(seat?.code, seat?.playerToken);
  const create = useCallback(async () => {
    setCreating(true); setErr('');
    try {
      const d = await bsApi.createRoom(initialCode);
      const guest = getStoredGuestIdentity();
      if (!guest?.name) throw new Error('Choose your guest name before creating a room.');
      // The host also takes a captain seat, so the host plays the same Sudoku
      // interface as everyone else while retaining a separate host-control token.
      const joined = await bsApi.action(d.roomCode, d.token, 'join', { name: guest.name });
      const s = { code: d.roomCode, token: d.token, playerToken: joined.token };
      try { localStorage.setItem('bs_host', JSON.stringify(s)); } catch { /* ignore */ }
      setSeat(s); apply(joined); applyPlayer(joined);
    }
    catch (e) { setErr(e.message); } finally { setCreating(false); }
  }, [apply, applyPlayer]);
  useEffect(() => { if (!seat && !creating && !err) create(); }, [seat]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback(async (action, payload = {}) => {
    try { const d = await bsApi.action(seat.code, seat.token, action, payload); apply(d); return d.result; }
    catch (e) { setErr(e.message); setTimeout(() => setErr(''), 3000); return null; }
  }, [seat, apply]);
  const exit = () => {
    try { localStorage.removeItem('bs_host'); } catch { /* ignore */ }
    onExit();
  };
  if (!data) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>{err || error ? <><p>{err || error}</p><button type="button" className="bs-btn" onClick={() => { setErr(''); create(); }}>Try again</button> <button type="button" className="bs-btn ghost" onClick={onExit}>Back</button></> : 'Launching the fleet…'}</div></div>;
  return (
    <>
      {!data.room.game
        ? <BSLobby room={data.room} isHost act={act} onExit={exit} joinUrl={`${TNG_PUBLIC_ORIGIN}/games/sudoku?room=${seat.code}`} playerName={getStoredGuestIdentity()?.name || ''} selfPlayerId={playerData?.you?.id || ''} />
        : playerData?.room?.game?.me
          ? <BSPhone v={playerData.room.game} act={async (type, payload = {}) => {
              try { const d = await bsApi.action(seat.code, seat.playerToken, type, payload); applyPlayer(d); return d.result; }
              catch (e) { return { ok: false, error: e.message }; }
            }} now={Date.now() + playerOffset} onExit={exit} isHost hostRoom={data.room} hostAct={act} />
          : <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>Opening your captain screen…</div></div>}
      {err && <div className="bs-toast bad">{err}</div>}
    </>
  );
}

export function BSDisplay({ code }) {
  const { data, offset, error } = useRoom(code, null);
  if (!data) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>{error || `Connecting to battle ${code}…`}</div></div>;
  return <BSBigScreen data={data} isHost={false} act={() => {}} offset={offset} onExit={() => {}} joinUrl={joinUrlFor()} />;
}

export function BSPlayer({ code, name, onExit }) {
  const [seat, setSeat] = useState(() => bsSeat.get(code));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [displayName, setDisplayName] = useState(() => name || getStoredGuestIdentity()?.name || '');
  const { data, offset, error, apply } = useRoom(code, seat?.token, () => bsSeat.clear(code));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const join = async () => {
    setBusy(true); setErr(''); sfx.unlock();
    try {
      const cleanName = String(displayName || '').trim().slice(0, 32);
      if (!cleanName) throw new Error('Enter your player name to join.');
      await createGuestIdentity(cleanName);
      const d = await bsApi.action(code, seat?.token, 'join', { name: cleanName });
      const s = { token: d.token, playerId: d.playerId }; bsSeat.set(code, s); setSeat(s); apply(d);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const leave = async () => { if (seat?.token) { try { await bsApi.action(code, seat.token, 'leave'); } catch { /* ignore */ } } bsSeat.clear(code); onExit(); };
  const act = useCallback(async (type, payload = {}) => {
    try { const d = await bsApi.action(code, seat.token, type, payload); apply(d); return d.result; }
    catch (e) { return { ok: false, error: e.message }; }
  }, [code, seat, apply]);

  const room = data?.room;
  if (error && !room) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}><p>{error}</p><button type="button" className="bs-btn" onClick={onExit}>Back</button></div></div>;
  if (!room) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>Finding battle {code}…</div></div>;
  if (!data.you) {
    return (
      <div className="bs-wrap" style={{ maxWidth: 520 }}>
        <div className="bs-card" style={{ textAlign: 'center' }}>
          <h1 className="bs-h bs-logo" style={{ fontSize: 60 }}>Battle<b>Sudoku</b></h1>
          <p className="bs-sub">Battle <b style={{ color: 'var(--bs-brass)', letterSpacing: '.15em' }}>{code}</b> · {room.roster.length} captain{room.roster.length === 1 ? '' : 's'}</p>
          <label className="bs-label" htmlFor="bs-player-name" style={{ display: 'block', textAlign: 'left', marginTop: 18 }}>Your player name</label>
          <input id="bs-player-name" className="bs-input" style={{ width: '100%', marginTop: 6, fontSize: 18 }} maxLength={32} autoComplete="nickname" placeholder="Enter your name" value={displayName} onChange={e => setDisplayName(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()} />
          <p className="bs-sub" style={{ marginTop: 8 }}>No account needed. Your name appears on the battle screen.</p>
          <button type="button" className="bs-btn primary" style={{ width: '100%', marginTop: 12, padding: 14, fontSize: 18 }} disabled={busy || !displayName.trim()} onClick={join}>Join the fleet</button>
          {err && <div className="bs-err">{err}</div>}
          <button type="button" className="bs-btn ghost small" style={{ marginTop: 12 }} onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }
  if (!room.game) {
    return <BSLobby room={room} isHost={false} act={act} onExit={leave} joinUrl={`${TNG_PUBLIC_ORIGIN}/games/sudoku?room=${code}`} playerName={data.you.name} />;
  }
  return <BSPhone v={room.game} act={act} now={now + offset} onExit={leave} />;
}
