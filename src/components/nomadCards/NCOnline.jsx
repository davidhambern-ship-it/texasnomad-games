import React, { useCallback, useEffect, useRef, useState } from 'react';
import NCTable from './NCTable';
import NCHand from './NCHand';
import { ncApi, ncSeat } from '@/api/nomadCardsApi';
import { claimStandaloneDisplay, releaseStandaloneDisplay } from '@/api/standaloneDisplay';
import { ncSfx } from './ncSfx';

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
      try { const d = await ncApi.getRoom(code, tokenRef.current); if (!alive) return; apply(d); setError(''); }
      catch (e) { if (!alive) return; if (e.code === 'ROOM_NOT_FOUND') { setError(e.message); onGone && onGone(); return; } if (e.status === 401 || e.status === 403) { setData(null); onGone && onGone(); } setError(e.message); }
      if (alive) timer = setTimeout(tick, liveRef.current ? 600 : 1500);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [code, apply]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, offset, error, apply };
}
const TNG_PUBLIC_ORIGIN = String((import.meta.env && import.meta.env.VITE_TNG_PUBLIC_ORIGIN) || 'https://texasnomadgames.com').replace(/\/+$/, '');
const joinUrlFor = () => `${TNG_PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}/join`;

export function NCHost({ onExit }) {
  const [seat, setSeat] = useState(() => { try { return JSON.parse(localStorage.getItem('nc_host') || 'null'); } catch { return null; } });
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  const { data, offset, error, apply } = useRoom(seat?.code, seat?.token, () => { try { localStorage.removeItem('nc_host'); } catch { /* ignore */ } setSeat(null); });
  const create = useCallback(async () => {
    setCreating(true); setErr('');
    try { const d = await ncApi.createRoom(); const s = { code: d.roomCode, token: d.token }; try { localStorage.setItem('nc_host', JSON.stringify(s)); } catch { /* ignore */ } setSeat(s); apply(d); }
    catch (e) { setErr(e.message); } finally { setCreating(false); }
  }, [apply]);
  useEffect(() => { if (!seat && !creating && !err) create(); }, [seat]); // eslint-disable-line react-hooks/exhaustive-deps
  // pair with a TNG Game Display when one is linked to this host
  useEffect(() => {
    if (!seat?.code) return undefined;
    let alive = true;
    const sync = async () => { const r = await claimStandaloneDisplay('out', seat.code).catch(() => null); if (!alive || !r?.ok) return; };
    sync(); const timer = window.setInterval(sync, 30000);
    return () => { alive = false; window.clearInterval(timer); releaseStandaloneDisplay().catch(() => {}); };
  }, [seat?.code]);
  const act = useCallback(async (action, payload = {}) => {
    try { const d = await ncApi.action(seat.code, seat.token, action, payload); apply(d); return d.result; }
    catch (e) { setErr(e.message); setTimeout(() => setErr(''), 3000); return null; }
  }, [seat, apply]);
  const exit = () => { releaseStandaloneDisplay().catch(() => {}); try { localStorage.removeItem('nc_host'); } catch { /* ignore */ } onExit(); };
  if (!data) return <div className="nc-wrap"><div className="nc-panel" style={{ textAlign: 'center' }}>{err || error ? <><p>{err || error}</p><button type="button" className="nc-btn" onClick={() => { setErr(''); create(); }}>Try again</button> <button type="button" className="nc-btn ghost" onClick={onExit}>Back</button></> : 'Shuffling the deck…'}</div></div>;
  return (
    <>
      {data.room.game ? <>
        <div className="nc-host-controls"><span>OUT! · Table {seat.code}</span><button type="button" className="nc-btn ghost small" onClick={() => { if (window.confirm('End this game?')) act('lobby'); }}>Back to lobby</button></div>
        <NCHand v={data.room.game} act={act} now={now + offset} onExit={exit} isHost onNewGame={() => act('start')} onLobby={() => act('lobby')} />
      </> : <NCTable data={data} isHost act={act} offset={offset} onExit={exit} joinUrl={joinUrlFor()} />}
      {err && <div className="nc-toast bad">{err}</div>}
    </>
  );
}

export function NCDisplay({ code }) {
  const { data, offset, error } = useRoom(code, null);
  if (!data) return <div className="nc-wrap"><div className="nc-panel" style={{ textAlign: 'center' }}>{error || `Connecting to table ${code}…`}</div></div>;
  return <NCTable data={data} isHost={false} act={() => {}} offset={offset} onExit={() => {}} joinUrl={joinUrlFor()} />;
}

export function NCPlayer({ code, name, identityReady = false, onExit }) {
  const [seat, setSeat] = useState(() => ncSeat.get(code));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { data, offset, error, apply } = useRoom(code, seat?.token, () => { ncSeat.clear(code); setSeat(null); });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const join = async () => {
    if (!identityReady) { setErr('Loading your TNG player profile…'); return; }
    setBusy(true); setErr(''); ncSfx.unlock();
    try { const d = await ncApi.action(code, seat?.token, 'join'); const s = { token: d.token, playerId: d.playerId }; ncSeat.set(code, s); setSeat(s); apply(d); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const leave = async () => { if (seat?.token) { try { await ncApi.action(code, seat.token, 'leave'); } catch { /* ignore */ } } ncSeat.clear(code); onExit(); };
  const act = useCallback(async (type, payload = {}) => {
    try { const d = await ncApi.action(code, seat.token, type, payload); apply(d); return d.result; }
    catch (e) { return { ok: false, error: e.message }; }
  }, [code, seat, apply]);

  const room = data?.room;
  if (error && !room) return <div className="nc-wrap"><div className="nc-panel" style={{ textAlign: 'center' }}><p>{error}</p><button type="button" className="nc-btn" onClick={onExit}>Back</button></div></div>;
  if (!room) return <div className="nc-wrap"><div className="nc-panel" style={{ textAlign: 'center' }}>Finding table {code}…</div></div>;
  if (!data.you) {
    return (
      <div className="nc-wrap" style={{ maxWidth: 520 }}>
        <div className="nc-panel" style={{ textAlign: 'center' }}>
          <h1 className="nc-h nc-logo" style={{ fontSize: 60 }}>OUT!</h1>
          <p className="nc-sub">Table <b style={{ color: 'var(--nc-gold)', letterSpacing: '.15em' }}>{code}</b> · {room.roster.length} player{room.roster.length === 1 ? '' : 's'}</p>
          <p className="nc-sub" style={{ marginTop: 14 }}>Playing as <b style={{ color: 'var(--nc-gold)' }}>{name || 'Loading TNG profile…'}</b></p>
          <button type="button" className="nc-btn primary big" style={{ width: '100%', marginTop: 12 }} disabled={busy || !identityReady} onClick={join}>Take a seat</button>
          {err && <div className="nc-err">{err}</div>}
          <button type="button" className="nc-btn ghost small" style={{ marginTop: 12 }} onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }
  if (!room.game) {
    const meR = room.roster.find(p => p.id === data.you.id);
    return (
      <div className="nc-wrap" style={{ maxWidth: 520 }}>
        <div className="nc-panel" style={{ textAlign: 'center' }}>
          <span className="nc-chip" style={{ '--c': meR?.color, fontSize: 20 }}><span className="nc-dot" style={{ background: meR?.color }} />{data.you.name}</span>
          <h2 className="nc-h" style={{ fontSize: 44, color: 'var(--nc-gold)', marginTop: 14 }}>You’re at the table!</h2>
          <p className="nc-sub">The table and your private hand appear here when the host deals. No TV needed. Match the top card by colour or number, and hit <b>OUT!</b> when you’re down to one card — or get caught and draw 2.</p>
          <p className="nc-sub">{room.roster.length} player{room.roster.length === 1 ? '' : 's'} at table {code}</p>
          <button type="button" className="nc-btn ghost small" style={{ marginTop: 12 }} onClick={leave}>Leave</button>
        </div>
      </div>
    );
  }
  return <NCHand v={room.game} act={act} now={now + offset} onExit={leave} />;
}
