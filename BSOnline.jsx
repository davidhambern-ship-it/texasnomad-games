import React, { useCallback, useEffect, useRef, useState } from 'react';
import BSBigScreen from './BSBigScreen';
import BSPhone from './BSPhone';
import { bsApi, bsSeat } from '@/api/battleSudokuApi';
import { sfx } from './bsSfx';
import { TEAMS } from '@/lib/battleSudoku/game';

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
  import.meta.env.VITE_TNG_PUBLIC_ORIGIN || 'https://texasnomadgames.com',
).replace(/\/+$/, '');
const joinUrlFor = () => `${TNG_PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}/games/sudoku`;

export function BSHost({ onExit }) {
  const [seat, setSeat] = useState(() => { try { return JSON.parse(localStorage.getItem('bs_host') || 'null'); } catch { return null; } });
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, offset, error, apply } = useRoom(seat?.code, seat?.token, () => { try { localStorage.removeItem('bs_host'); } catch { /* ignore */ } setSeat(null); });
  const create = useCallback(async () => {
    setCreating(true); setErr('');
    try { const d = await bsApi.createRoom(); const s = { code: d.roomCode, token: d.token }; try { localStorage.setItem('bs_host', JSON.stringify(s)); } catch { /* ignore */ } setSeat(s); apply(d); }
    catch (e) { setErr(e.message); } finally { setCreating(false); }
  }, [apply]);
  useEffect(() => { if (!seat && !creating && !err) create(); }, [seat]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = useCallback(async (action, payload = {}) => {
    try { const d = await bsApi.action(seat.code, seat.token, action, payload); apply(d); return d.result; }
    catch (e) { setErr(e.message); setTimeout(() => setErr(''), 3000); return null; }
  }, [seat, apply]);
  const exit = () => { try { localStorage.removeItem('bs_host'); } catch { /* ignore */ } onExit(); };
  if (!data) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>{err || error ? <><p>{err || error}</p><button type="button" className="bs-btn" onClick={() => { setErr(''); create(); }}>Try again</button> <button type="button" className="bs-btn ghost" onClick={onExit}>Back</button></> : 'Launching the fleet…'}</div></div>;
  return (
    <>
      <BSBigScreen data={data} isHost act={act} offset={offset} onExit={exit} joinUrl={joinUrlFor()} />
      {err && <div className="bs-toast bad">{err}</div>}
    </>
  );
}

export function BSDisplay({ code }) {
  const { data, offset, error } = useRoom(code, null);
  if (!data) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>{error || `Connecting to battle ${code}…`}</div></div>;
  return <BSBigScreen data={data} isHost={false} act={() => {}} offset={offset} onExit={() => {}} joinUrl={joinUrlFor()} />;
}

export function BSPlayer({ code, name, setName, onExit }) {
  const [seat, setSeat] = useState(() => bsSeat.get(code));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { data, offset, error, apply } = useRoom(code, seat?.token, () => bsSeat.clear(code));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const join = async () => {
    if (!name.trim()) { setErr('Type your name first.'); return; }
    setBusy(true); setErr(''); sfx.unlock();
    try {
      try { localStorage.setItem('bs_name', name.trim()); } catch { /* ignore */ }
      const d = await bsApi.action(code, seat?.token, 'join', { name: name.trim() });
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
          <input className="bs-input" style={{ marginTop: 14 }} value={name} maxLength={14} placeholder="CAPTAIN NAME" onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()} />
          <button type="button" className="bs-btn primary" style={{ width: '100%', marginTop: 12, padding: 14, fontSize: 18 }} disabled={busy} onClick={join}>Join the fleet</button>
          {err && <div className="bs-err">{err}</div>}
          <button type="button" className="bs-btn ghost small" style={{ marginTop: 12 }} onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }
  if (!room.game) {
    const meR = room.roster.find(p => p.id === data.you.id);
    const teamMode = room.settings?.mode === 'teams';
    const T = teamMode ? TEAMS[meR?.team || 0] : null;
    return (
      <div className="bs-wrap" style={{ maxWidth: 520 }}>
        <div className="bs-card" style={{ textAlign: 'center' }}>
          <span className="bs-chip" style={{ '--c': T ? T.color : meR?.color, fontSize: 20 }}><span className="bs-dot" style={{ background: T ? T.color : meR?.color }} />{data.you.name}</span>
          <h2 className="bs-h" style={{ fontSize: 44, color: T ? T.color : 'var(--bs-brass)', marginTop: 14 }}>{T ? `${T.name}!` : 'You’re aboard!'}</h2>
          {T && (
            <>
              <p className="bs-sub">Fleet vs Fleet — your crew: {room.roster.filter(p => (p.team || 0) === (meR?.team || 0)).map(p => p.name).join(', ')}</p>
              <button type="button" className="bs-btn small" onClick={() => act('team')}>⇄ Switch to {TEAMS[(meR?.team || 0) === 1 ? 0 : 1].name}</button>
            </>
          )}
          <p className="bs-sub">Watch the big screen. When the battle starts you’ll hide your fleet, then solve the same Sudoku as everyone else. Correct numbers load your cannon; every volley you fire at rivals’ hidden fleets.</p>
          <p className="bs-sub">{room.roster.length} captain{room.roster.length === 1 ? '' : 's'} in battle {code}</p>
          <button type="button" className="bs-btn ghost small" style={{ marginTop: 12 }} onClick={leave}>Leave</button>
        </div>
      </div>
    );
  }
  return <BSPhone v={room.game} act={act} now={now + offset} onExit={leave} />;
}
