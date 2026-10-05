import React, { useCallback, useEffect, useRef, useState } from 'react';
import WWPlay from './WWPlay';
import { Avatar, Confetti, Countdown, RIVALS, colorFor } from './WWShared';
import { createGame } from '@/lib/wordWranglerEngine';
import { wwApi, wwSeat } from '@/api/wordWranglerApi';
import { claimStandaloneDisplay, releaseStandaloneDisplay } from '@/api/standaloneDisplay';
import { soundManager } from '@/lib/wordWranglerSound';

const DURS = [[90, '1:30'], [150, '2:30'], [240, '4:00']];

const TNG_PUBLIC_ORIGIN = String(
  import.meta.env.VITE_TNG_PUBLIC_ORIGIN || 'https://texasnomadgames.com',
).replace(/\/+$/, '');

/**
 * Online race. Everyone gets the same seed, plays on their own copy of the board,
 * and the server replays every word to keep the leaderboard honest.
 */
export default function WWOnline({ dict, code: initialCode, name, identityReady = false, onExit, onCode, muted, setMuted, autoHost = false }) {
  const [code, setCode] = useState(initialCode || '');
  const [seat, setSeat] = useState(() => (initialCode ? wwSeat.get(initialCode) : null));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [st, setSt] = useState(null);
  const [round, setRound] = useState(0);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [cpuPick, setCpuPick] = useState('lemonade');
  const stRef = useRef(null);
  const queue = useRef(Promise.resolve());
  const autoHostStarted = useRef(false);
  const seatRef = useRef(seat);
  seatRef.current = seat;
  stRef.current = st;

  const room = data?.room;
  const you = data?.you;
  const serverNow = now + offset;

  const apply = useCallback((d) => {
    if (!d?.room) return;
    setData(d);
    setOffset(d.room.now - Date.now());
  }, []);

  // poll the room
  useEffect(() => {
    if (!code) return undefined;
    let alive = true, timer = null;
    const tick = async () => {
      try {
        const d = await wwApi.getRoom(code, seatRef.current?.token);
        if (!alive) return;
        apply(d); setError('');
      } catch (e) {
        if (!alive) return;
        if (e.code === 'ROOM_NOT_FOUND') { setError(`Room ${code} wasn’t found — it may have closed.`); wwSeat.clear(code); setData(null); return; }
        setError(e.message);
      }
      if (alive) {
        const ph = stRefPhase.current;
        timer = setTimeout(tick, ph === 'playing' || ph === 'countdown' ? 1000 : 1600);
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [code, seat?.token, apply]);
  const stRefPhase = useRef(null);
  stRefPhase.current = room?.phase;

  // local clock
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  // a new race started → build my board from the shared seed
  useEffect(() => {
    if (!room || !room.seed || room.round === round) return;
    if (room.phase === 'countdown' || room.phase === 'playing') {
      setSt(createGame({ seed: room.seed, mode: 'race' }));
      setRound(room.round);
      try { soundManager.init(); soundManager.playSaloonDoors(); } catch { /* ignore */ }
    }
  }, [room?.seed, room?.round, room?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // re-sync if the server's copy of my board doesn't match
  const resync = useCallback(async () => {
    try {
      const d = await wwApi.getRoom(code, seatRef.current?.token, true);
      apply(d);
      if (d.mine?.state) setSt(d.mine.state);
    } catch { /* next poll will retry */ }
  }, [code, apply]);

  const onMove = useCallback(({ kind, path, state }) => {
    const prev = stRef.current;
    setSt(state);
    const move = prev.moves;
    queue.current = queue.current.then(async () => {
      try {
        const d = await wwApi.action(code, seatRef.current?.token, kind === 'word' ? 'word' : 'shuffle', kind === 'word' ? { path, move } : { move });
        apply(d);
        if (d.result?.desync) await resync();
      } catch (e) {
        if (e.code === 'NOT_PLAYING') return;
        await resync();
      }
    });
  }, [code, apply, resync]);

  const act = async (action, payload = {}) => {
    setBusy(true); setError('');
    try { const d = await wwApi.action(code, seat?.token, action, payload); apply(d); return d; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  const host = async () => {
    if (!identityReady) { setError('Loading your TNG player profile…'); return; }
    setBusy(true); setError('');
    try {
      const d = await wwApi.createRoom();
      const s = { token: d.token, playerId: d.playerId };
      wwSeat.set(d.roomCode, s);
      setSeat(s); setCode(d.roomCode); onCode && onCode(d.roomCode); apply(d);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (
      !autoHost ||
      autoHostStarted.current ||
      !identityReady ||
      code ||
      seat ||
      data ||
      busy
    ) return;

    autoHostStarted.current = true;
    host();
  }, [autoHost, identityReady, code, seat, data, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const ownsRoom = Boolean(data?.you?.isHost);
  useEffect(() => {
    if (!ownsRoom || !code) return undefined;

    let alive = true;
    const sync = async () => {
      const result = await claimStandaloneDisplay('word-wrangler', code).catch(() => null);
      if (!alive || !result?.ok) return;
    };

    sync();
    const timer = window.setInterval(sync, 30000);

    return () => {
      alive = false;
      window.clearInterval(timer);
      releaseStandaloneDisplay().catch(() => {});
    };
  }, [ownsRoom, code]);

  const join = async (c) => {
    const cc = String(c || '').trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(cc)) { setError('Room codes are 5 letters.'); return; }
    if (!identityReady) { setError('Loading your TNG player profile…'); return; }
    setBusy(true); setError('');
    try {
      const d = await wwApi.action(cc, wwSeat.get(cc)?.token, 'join');
      const s = { token: d.token, playerId: d.playerId };
      wwSeat.set(cc, s);
      setSeat(s); setCode(cc); onCode && onCode(cc); apply(d);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const leave = async () => {
    if (code && seat?.token) { try { await wwApi.action(code, seat.token, 'leave'); } catch { /* ignore */ } }
    if (code) wwSeat.clear(code);
    onExit();
  };

  const invite = code ? `${TNG_PUBLIC_ORIGIN}/games/word-wrangler?room=${code}` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt('Copy this invite link:', invite); } };

  // ── no room yet: host or join ──
  if (!code || (!data && error && !seat)) {
    return (
      <div className="ww-menu">
        <div className="ww-card">
          <h2 className="ww-h" style={{ fontSize: 44, color: 'var(--ww-gold)' }}>Online race</h2>
          <p className="ww-sub">Everyone gets the same tiles. Most points when the clock hits zero wins.</p>
          <div className="ww-sub" style={{ marginTop: 14 }}>
            Playing as <b style={{ color: 'var(--ww-gold)' }}>{name || 'Loading TNG profile…'}</b>
          </div>
          <div className="ww-row" style={{ marginTop: 14 }}>
            <button type="button" className="ww-btn primary" disabled={busy || !identityReady} onClick={host}>Host a race</button>
            <span style={{ color: 'var(--ww-dim)' }}>or</span>
            <input className="ww-input" style={{ width: 150, textTransform: 'uppercase', letterSpacing: '.2em' }} maxLength={5} placeholder="CODE" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} onKeyDown={e => e.key === 'Enter' && join(joinCode)} />
            <button type="button" className="ww-btn" disabled={busy || !identityReady} onClick={() => join(joinCode)}>Join</button>
          </div>
          {error && <div className="ww-err">{error}</div>}
          <div className="ww-row" style={{ marginTop: 14 }}><button type="button" className="ww-btn ghost small" onClick={onExit}>← Back</button></div>
        </div>
      </div>
    );
  }

  // ── have a code but no seat: authenticated TNG identity + join ──
  if (!you && room) {
    return (
      <div className="ww-menu">
        <div className="ww-card" style={{ textAlign: 'center' }}>
          <div className="ww-label">Word Wrangler race</div>
          <div className="ww-roomcode">{code}</div>
          <p className="ww-sub">{room.players.length} in the room{room.phase === 'playing' || room.phase === 'countdown' ? ' · a race is running — you’ll join the next one' : ''}</p>
          <p className="ww-sub" style={{ marginTop: 14 }}>
            Playing as <b style={{ color: 'var(--ww-gold)' }}>{name || 'Loading TNG profile…'}</b>
          </p>
          <div className="ww-row" style={{ marginTop: 14, justifyContent: 'center' }}>
            <button type="button" className="ww-btn primary" disabled={busy || !identityReady} onClick={() => join(code)}>Join the race</button>
            <button type="button" className="ww-btn ghost" onClick={onExit}>Back</button>
          </div>
          {error && <div className="ww-err">{error}</div>}
        </div>
      </div>
    );
  }
  if (!room) {
    return <div className="ww-menu"><div className="ww-card" style={{ textAlign: 'center' }}>{error ? <><p>{error}</p><button type="button" className="ww-btn" onClick={leave}>Back</button></> : 'Finding the room…'}</div></div>;
  }

  const players = room.players.slice().sort((a, b) => b.score - a.score);
  const colorIdx = Object.fromEntries(room.players.map((p, i) => [p.id, i]));
  const mineIn = st && round === room.round;
  const racing = (room.phase === 'countdown' || room.phase === 'playing') && mineIn;
  const isHost = you?.isHost;

  const board = (
    <div className="ww-panel">
      <h4>Leaderboard · room {code}</h4>
      <div className="ww-lb">
        {players.map((p, i) => {
          const score = p.id === you?.id && st && racing ? st.score : p.score;
          return (
            <div key={p.id} className={`ww-lbrow${p.id === you?.id ? ' me' : ''}`}>
              <span className="rk">{i + 1}</span>
              <Avatar className="ava" name={p.name} charId={p.isAI ? p.char : null} color={colorFor(colorIdx[p.id])} size={32} />
              <span className="nm">{p.name}{p.isAI ? ' · CPU' : ''}{!p.online && !p.isAI ? ' · away' : ''}<small>{p.words} words{p.last ? ` · ${p.last.w.toUpperCase()} +${p.last.p}` : ''}</small></span>
              <span className="sc">{score.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── racing ──
  if (racing || (room.phase === 'over' && mineIn)) {
    const left = Math.max(0, (room.endsAt - serverNow) / 1000);
    const over = room.phase === 'over' || left <= 0;
    const ranked = players;
    const myRank = ranked.findIndex(p => p.id === you?.id) + 1;
    return (
      <>
        <WWPlay key={room.round} state={st} onMove={onMove} dict={dict} timeLeft={left} totalTime={room.duration} disabled={room.phase !== 'playing' || over} side={board} muted={muted}
          title={`Race · room ${code}`}
          hudRight={<><button type="button" className="ww-btn small" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button><button type="button" className="ww-btn small" onClick={leave} aria-label="Leave race">✕</button></>} />
        {room.phase === 'countdown' && <Countdown endsAt={room.startsAt} offset={offset} />}
        {room.phase === 'over' && (
          <div className="ww-overlay"><div className="ww-card ww-results">
            <p className={`ww-banner ${myRank === 1 ? 'win' : 'lose'}`}>{myRank === 1 ? 'You win the race!' : `${ranked[0]?.name} wins!`}</p>
            <div className="ww-lb" style={{ marginTop: 12, textAlign: 'left' }}>
              {ranked.map((p, i) => (
                <div key={p.id} className={`ww-lbrow${p.id === you?.id ? ' me' : ''}`}>
                  <span className="rk">{i === 0 ? '👑' : i + 1}</span>
                  <Avatar className="ava" name={p.name} charId={p.isAI ? p.char : null} color={colorFor(colorIdx[p.id])} size={32} />
                  <span className="nm">{p.name}<small>{p.words} words{p.best ? ` · best ${p.best.w.toUpperCase()} ${p.best.p}` : ''}</small></span>
                  <span className="sc">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="ww-row" style={{ justifyContent: 'center', marginTop: 16 }}>
              {isHost ? <button type="button" className="ww-btn primary" disabled={busy} onClick={() => act('start')}>Race again</button> : <span className="ww-sub">Waiting for the host to start the next race…</span>}
              <button type="button" className="ww-btn" onClick={leave}>Leave</button>
            </div>
          </div></div>
        )}
        <Confetti on={room.phase === 'over' && myRank === 1} />
      </>
    );
  }

  // ── lobby (or a race you're sitting out) ──
  const usedChars = new Set(room.players.map(p => p.char).filter(Boolean));
  return (
    <div className="ww-menu">
      <div className="ww-card" style={{ textAlign: 'center' }}>
        <div className="ww-label">Room code</div>
        <div className="ww-roomcode">{code}</div>
        <div className="ww-row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button type="button" className="ww-btn" onClick={copy}>{copied ? 'Link copied!' : 'Copy invite link'}</button>
        </div>
        <p className="ww-sub" style={{ marginTop: 8 }}>Friends open the invite link, or enter the code under Word Wrangler → Online race.</p>
        {room.phase !== 'lobby' && room.phase !== 'over' && <p className="ww-sub">A race is running — you’ll be in the next one.</p>}
      </div>
      <div className="ww-card">
        <h4 className="ww-label" style={{ marginBottom: 8 }}>Players ({room.players.length}/8)</h4>
        <div className="ww-lb">
          {room.players.map((p) => (
            <div key={p.id} className={`ww-lbrow${p.id === you?.id ? ' me' : ''}`} style={{ gridTemplateColumns: '34px 1fr auto' }}>
              <Avatar className="ava" name={p.name} charId={p.isAI ? p.char : null} color={colorFor(colorIdx[p.id])} size={32} />
              <span className="nm">{p.name}<small>{p.isHost ? 'Host' : p.isAI ? `CPU · level ${p.level}` : p.online ? 'Ready' : 'Away'}</small></span>
              {isHost && !p.isHost && (room.phase === 'lobby' || room.phase === 'over') ? <button type="button" className="ww-btn small" onClick={() => act('remove', { playerId: p.id })}>Remove</button> : <span />}
            </div>
          ))}
        </div>
        {isHost && (room.phase === 'lobby' || room.phase === 'over') && (
          <>
            <h4 className="ww-label" style={{ margin: '16px 0 8px' }}>Add a CPU rival</h4>
            <div className="ww-crew">
              {RIVALS.filter(r => !usedChars.has(r.id)).map(r => (
                <button key={r.id} type="button" className="ww-crewbtn" aria-pressed={cpuPick === r.id} onClick={() => setCpuPick(r.id)}>
                  <Avatar name={r.name} charId={r.id} color={r.color} size={34} />
                  <span><b>{r.name}</b><small>{r.title} · lvl {r.level}</small></span>
                </button>
              ))}
            </div>
            <div className="ww-row" style={{ marginTop: 10 }}>
              <button type="button" className="ww-btn" disabled={busy || room.players.length >= 8} onClick={() => { const r = RIVALS.find(x => x.id === cpuPick && !usedChars.has(x.id)) || RIVALS.find(x => !usedChars.has(x.id)); if (r) act('addCpu', { char: r.id, level: r.level }); }}>+ Add CPU</button>
            </div>
            <h4 className="ww-label" style={{ margin: '16px 0 8px' }}>Race length</h4>
            <div className="ww-seg">{DURS.map(([s, l]) => <button key={s} type="button" aria-pressed={room.duration === s} onClick={() => act('setDuration', { seconds: s })}>{l}</button>)}</div>
            <button type="button" className="ww-btn primary" style={{ width: '100%', marginTop: 18, padding: 14, fontSize: 18 }} disabled={busy} onClick={() => act('start')}>Start the race</button>
          </>
        )}
        {!isHost && <p className="ww-sub" style={{ marginTop: 12 }}>Waiting for the host to start…</p>}
        {error && <div className="ww-err">{error}</div>}
        <div className="ww-row" style={{ marginTop: 14 }}>
          <button type="button" className="ww-btn ghost small" onClick={leave}>Leave room</button>
          <button type="button" className="ww-btn ghost small" onClick={() => setMuted(!muted)}>{muted ? 'Sound off' : 'Sound on'}</button>
        </div>
      </div>
    </div>
  );
}


export function WWDisplay({ code }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    let timer = null;

    const tick = async () => {
      try {
        const next = await wwApi.getRoom(code);
        if (!alive) return;
        setData(next);
        setError('');
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'The Word Wrangler room could not be loaded.');
      }

      if (alive) timer = window.setTimeout(tick, 900);
    };

    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const room = data?.room;
  if (!room) {
    return (
      <div className="ww-menu">
        <div className="ww-card" style={{ textAlign: 'center' }}>
          <h1 className="ww-h ww-title">Word Wrangler</h1>
          <p className="ww-sub">{error || `Connecting to race ${code}…`}</p>
        </div>
      </div>
    );
  }

  const serverNow = Number(room.now || now);
  const players = room.players.slice().sort((a, b) => b.score - a.score);
  const colorIdx = Object.fromEntries(room.players.map((p, i) => [p.id, i]));
  const left = room.endsAt
    ? Math.max(0, Math.ceil((Number(room.endsAt) - serverNow) / 1000))
    : null;

  return (
    <div className="ww-menu">
      <div className="ww-card" style={{ width: 'min(1000px, 94vw)' }}>
        <div className="ww-label" style={{ textAlign: 'center' }}>TNG GAME DISPLAY · ROOM {code}</div>
        <h1 className="ww-h ww-title" style={{ textAlign: 'center' }}>Word Wrangler</h1>
        <div className="ww-row" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <span className="tag">{String(room.phase || 'lobby').replace('_', ' ').toUpperCase()}</span>
          {left != null && <span className="tag">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}
          <span className="tag">Round {room.round || 0}</span>
        </div>

        <div className="ww-lb">
          {players.map((p, i) => (
            <div key={p.id} className="ww-lbrow">
              <span className="rk">{i === 0 && room.phase === 'over' ? '👑' : i + 1}</span>
              <Avatar className="ava" name={p.name} charId={p.isAI ? p.char : null} color={colorFor(colorIdx[p.id])} size={46} />
              <span className="nm">
                {p.name}{p.isAI ? ' · CPU' : ''}
                <small>{p.words} words{p.last ? ` · ${p.last.w.toUpperCase()} +${p.last.p}` : ''}</small>
              </span>
              <span className="sc" style={{ fontSize: 24 }}>{Number(p.score || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {!players.length && (
          <p className="ww-sub" style={{ textAlign: 'center', marginTop: 16 }}>
            Waiting for players to join…
          </p>
        )}
      </div>
    </div>
  );
}
