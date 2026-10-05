import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import STBigScreen from './STBigScreen';
import STPhone from './STPhone';
import { claimSeeThatDisplay, releaseSeeThatDisplay, stApi, stSeat } from '@/api/seeThatApi';
import { sfx } from './stSfx';

// Poll a room. Faster while a round is live.
function useRoom(code, token, onGone) {
  const [data, setData] = useState(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const tokenRef = useRef(token); tokenRef.current = token;
  const phaseRef = useRef(null); phaseRef.current = data?.room?.phase;
  const apply = useCallback((d) => { if (d?.room) { setData(d); setOffset(d.room.now - Date.now()); } }, []);
  useEffect(() => {
    if (!code) return undefined;
    let alive = true, timer = null;
    const tick = async () => {
      try { const d = await stApi.getRoom(code, tokenRef.current); if (!alive) return; apply(d); setError(''); }
      catch (e) { if (!alive) return; if (e.code === 'ROOM_NOT_FOUND') { setError(e.message); onGone && onGone(); return; } setError(e.message); }
      if (alive) { const ph = phaseRef.current; timer = setTimeout(tick, ph === 'playing' || ph === 'countdown' ? 650 : 1500); }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [code, apply]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, offset, error, apply, setError };
}

const TNG_PUBLIC_ORIGIN = String(
  import.meta.env.VITE_TNG_PUBLIC_ORIGIN || 'https://texasnomadgames.com',
).replace(/\/+$/, '');

const joinUrlFor = () => `${TNG_PUBLIC_ORIGIN}/games/see-that`;

/** The big screen. Creates a room (or resumes one) and shows lobby → rounds → podium. */
export function STHost({ scenes, onExit }) {
  const [seat, setSeat] = useState(() => { try { return JSON.parse(localStorage.getItem('st_host') || 'null'); } catch { return null; } });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const { data, offset, error, apply } = useRoom(seat?.code, seat?.token, () => { try { localStorage.removeItem('st_host'); } catch { /* ignore */ } setSeat(null); });

  const create = useCallback(async () => {
    setCreating(true); setErr('');
    try {
      const d = await stApi.createRoom();
      const s = { code: d.roomCode, token: d.token };
      try { localStorage.setItem('st_host', JSON.stringify(s)); } catch { /* ignore */ }
      setSeat(s); apply(d);
    } catch (e) { setErr(e.message); } finally { setCreating(false); }
  }, [apply]);
  useEffect(() => { if (!seat && !creating && !err) create(); }, [seat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the already-paired TNG Game Display attached to this See That room.
  // This runs only in STHost; player and read-only display clients never claim ownership.
  useEffect(() => {
    if (!seat?.code) return undefined;

    let alive = true;
    const sync = async () => {
      const result = await claimSeeThatDisplay(seat.code).catch(() => null);
      if (!alive || !result) return;
    };

    sync();
    const timer = window.setInterval(sync, 10000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [seat?.code]);

  const act = useCallback(async (action, payload = {}) => {
    try { const d = await stApi.action(seat.code, seat.token, action, payload); apply(d); return d; }
    catch (e) { setErr(e.message); return null; }
  }, [seat, apply]);
  const exit = async () => {
    await releaseSeeThatDisplay().catch(() => null);
    try { localStorage.removeItem('st_host'); } catch { /* ignore */ }
    onExit();
  };

  if (!data) return <div className="st-wrap"><div className="st-card" style={{ textAlign: 'center' }}>{err || error ? <><p>{err || error}</p><button type="button" className="st-btn" onClick={() => { setErr(''); create(); }}>Try again</button> <button type="button" className="st-btn ghost" onClick={onExit}>Back</button></> : 'Opening a game…'}</div></div>;
  return (
    <>
      <STBigScreen data={data} isHost act={act} scenes={scenes} offset={offset} onExit={exit} joinUrl={joinUrlFor()} />
      {err && <div className="st-toast bad" style={{ position: 'fixed', zIndex: 90 }} onAnimationEnd={() => setErr('')}>{err}</div>}
    </>
  );
}

/** Read-only big screen for the TNG Game Display (or a second TV). */
export function STDisplay({ code, scenes }) {
  const { data, offset, error } = useRoom(code, null);
  if (!data) return <div className="st-wrap"><div className="st-card" style={{ textAlign: 'center' }}>{error || `Connecting to game ${code}…`}</div></div>;
  return <STBigScreen data={data} isHost={false} act={() => {}} scenes={scenes} offset={offset} onExit={() => {}} joinUrl={joinUrlFor()} />;
}

/** A player's phone: join with a name, then hunt. */
export function STPlayer({ code, name, setName, onExit }) {
  const [seat, setSeat] = useState(() => stSeat.get(code));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { data, offset, error, apply } = useRoom(code, seat?.token, () => stSeat.clear(code));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);

  const join = async () => {
    if (!name.trim()) { setErr('Type your name first.'); return; }
    setBusy(true); setErr(''); sfx.unlock();
    try {
      try { localStorage.setItem('st_name', name.trim()); } catch { /* ignore */ }
      const d = await stApi.action(code, seat?.token, 'join', { name: name.trim() });
      const s = { token: d.token, playerId: d.playerId };
      stSeat.set(code, s); setSeat(s); apply(d);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const leave = async () => { if (seat?.token) { try { await stApi.action(code, seat.token, 'leave'); } catch { /* ignore */ } } stSeat.clear(code); onExit(); };

  const room = data?.room;
  const you = data?.you;
  const players = useMemo(() => Object.fromEntries((room?.players || []).map(p => [p.id, p])), [room?.players]);

  const onTap = useCallback(async (x, y) => {
    try { const d = await stApi.action(code, seat.token, 'tap', { x, y, round: room.roundNo }); apply(d); return d.result; }
    catch (e) { setErr(e.message); return null; }
  }, [code, seat, room?.roundNo, apply]);
  const onHint = useCallback(async () => {
    try { const d = await stApi.action(code, seat.token, 'hint', { round: room.roundNo }); apply(d); return d.result; }
    catch (e) { setErr(e.message); return null; }
  }, [code, seat, room?.roundNo, apply]);

  if (error && !room) return <div className="st-wrap"><div className="st-card" style={{ textAlign: 'center' }}><p>{error}</p><button type="button" className="st-btn" onClick={onExit}>Back</button></div></div>;
  if (!room) return <div className="st-wrap"><div className="st-card" style={{ textAlign: 'center' }}>Finding game {code}…</div></div>;

  if (!you) {
    return (
      <div className="st-wrap" style={{ maxWidth: 520 }}>
        <div className="st-card" style={{ textAlign: 'center' }}>
          <h1 className="st-h st-logo" style={{ fontSize: 64 }}>See That<span className="q">?!</span></h1>
          <p className="st-sub">Game <b style={{ color: 'var(--st-gold)', letterSpacing: '.15em' }}>{code}</b> · {room.players.length} playing</p>
          <input className="st-input" style={{ marginTop: 14 }} value={name} maxLength={16} placeholder="YOUR NAME" onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()} />
          <button type="button" className="st-btn primary" style={{ width: '100%', marginTop: 12, padding: 14, fontSize: 18 }} disabled={busy} onClick={join}>Join the hunt</button>
          {err && <div className="st-err">{err}</div>}
          <button type="button" className="st-btn ghost small" style={{ marginTop: 12 }} onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  const live = room.scene && (room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'roundover' || room.phase === 'final');
  if (!live) {
    const meP = players[you.id];
    return (
      <div className="st-wrap" style={{ maxWidth: 520 }}>
        <div className="st-card" style={{ textAlign: 'center' }}>
          <div className="st-pchip" style={{ '--c': meP?.color || '#ffc85c', fontSize: 20 }}><span className="st-dot" style={{ background: meP?.color }} />{you.name}</div>
          <h2 className="st-h" style={{ fontSize: 44, color: 'var(--st-gold)', marginTop: 14 }}>You’re in!</h2>
          <p className="st-sub">Watch the big screen. When the hunt starts, the scene shows up here — pinch to zoom, tap what you find. Wild tapping locks you out for a bit.</p>
          <p className="st-sub">📱 Tip: turn your phone sideways for a bigger scene.</p>
          <p className="st-sub">{room.players.length} player{room.players.length === 1 ? '' : 's'} in game {code}</p>
          <button type="button" className="st-btn ghost small" style={{ marginTop: 12 }} onClick={leave}>Leave game</button>
        </div>
      </div>
    );
  }

  const srvNow = now + offset;
  const meP = players[you.id];
  const rank = room.players.slice().sort((a, b) => b.total - a.total).findIndex(p => p.id === you.id) + 1;
  const banner = room.phase === 'countdown' ? { title: 'Get ready…', text: 'The hunt starts in a moment.' }
    : room.phase === 'roundover' ? { title: `Round ${room.roundNo} done`, text: `You scored ${meP?.round ?? 0} · you’re #${rank}. Next round soon — check the big screen.` }
      : room.phase === 'final' ? { title: rank === 1 ? 'You won!' : `You finished #${rank}`, text: `${(meP?.total || 0).toLocaleString()} points. Thanks for playing!` } : null;
  return (
    <STPhone scene={room.scene} placements={room.placements} targets={room.targets} players={players} myId={you.id} mine={{ ...(data.mine || {}), score: meP?.total ?? 0 }} now={srvNow}
      startsAt={room.startsAt} endsAt={room.endsAt} onTap={onTap} onHint={onHint} onExit={leave} banner={banner}
      roundLabel={`Round ${room.roundNo}/${room.settings.rounds}`} />
  );
}
