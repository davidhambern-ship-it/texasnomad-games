import React, { useEffect, useRef, useState } from 'react';
import { ROSTER, fighterById } from '@/lib/brawl/fighters';
import { STAGES } from '@/lib/brawl/engine';
import { rrConnect, rrSeat, packInput } from '@/api/rodeoRumbleLive';
import TouchPad from './TouchPad';
import RRPortrait from './RRPortrait';
import RRPlayerArena from './RRPlayerArena';
import { createKeyboard, readGamepad, merge, touchState } from './input';
import { pctColor } from './draw';

const FATAL = new Set(['ROOM_NOT_FOUND', 'FULL', 'KICKED', 'CLOSED']);

/** A player device: join → pick a fighter → watch the full match and control it. */
export default function RRController({ code, onExit, identityName = '', identityLoading = false }) {
  const [name, setName] = useState(() => { try { return identityName || localStorage.getItem('rr_name') || ''; } catch { return identityName || ''; } });
  const [seat, setSeat] = useState(() => rrSeat.get(code));
  const [joining, setJoining] = useState(!!rrSeat.get(code));
  const [me, setMe] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [hostOnline, setHostOnline] = useState(true);
  const [conn, setConn] = useState('idle');
  const [error, setError] = useState('');
  const [fighter, setFighter] = useState(null);
  const [ready, setReady] = useState(false);
  const sock = useRef(null);
  const frameRef = useRef(null);
  const [hasFrame, setHasFrame] = useState(false);
  const touch = useRef(touchState());
  const lastDmg = useRef(0);
  const nameRef = useRef(name); nameRef.current = name;
  const seatRef = useRef(seat); seatRef.current = seat;
  // signed-in TNG players join under their TNG name automatically
  useEffect(() => { if (identityName && !joining && !error) { setName(identityName); nameRef.current = identityName; setJoining(true); } }, [identityName]); // eslint-disable-line react-hooks/exhaustive-deps

  // connect once the player has a name (or a saved seat)
  useEffect(() => {
    if (!joining) return undefined;
    const s = rrConnect({
      hello: ({ authToken }) => ({ t: 'join', code, name: nameRef.current, token: seatRef.current?.token, authToken }),
      onStatus: setConn,
      onMessage: (m) => {
        if (m.t === 'joined') {
          const st = { token: m.token, id: m.id }; rrSeat.set(code, st); setSeat(st);
          setMe({ id: m.id, name: m.name, color: m.color }); setFighter(m.fighter || null); setHostOnline(m.host); setError('');
          if (m.lobby) setLobby(m.lobby);
          frameRef.current = m.frame || null; setHasFrame(!!m.frame?.game);
          setResult(m.result || null);
        } else if (m.t === 'frame') { frameRef.current = m.frame || null; setHasFrame(!!m.frame?.game); }
        else if (m.t === 'lobby') { setLobby(m.lobby); if (m.lobby && m.lobby.phase === 'lobby') { setResult(null); setStatus(null); frameRef.current = null; setHasFrame(false); } }
        else if (m.t === 'status') { setStatus(m.status); if (m.status && m.status.phase === 'countdown') setResult(null); }
        else if (m.t === 'result') setResult(m.result);
        else if (m.t === 'host') setHostOnline(!!m.online);
        else if (m.t === 'error') {
          setError(m.message || 'Something went wrong.');
          if (FATAL.has(m.code)) { rrSeat.clear(code); s.close(); setJoining(false); setMe(null); }
        }
      },
    });
    sock.current = s;
    return () => s.close();
  }, [joining, code]);

  const inMatch = !!(me && lobby && lobby.phase !== 'lobby' && (lobby.inMatch || []).includes(me.id));
  const playing = inMatch && !result;

  // controller loop: send input on change (sticks throttled to ~30/s) plus a keep-alive
  useEffect(() => {
    if (!playing) return undefined;
    const kb = createKeyboard();
    let raf = 0, last = '', lastAt = 0, lastStickAt = 0, prevB = -1;
    let wake = null;
    try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => { wake = w; }).catch(() => {}); } catch { /* ignore */ }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const snap = merge(touch.current, kb.read(), readGamepad(0));
      const msg = packInput(snap);
      const key = `${msg.b}:${msg.x}:${msg.y}`;
      const now = performance.now();
      const buttonsChanged = msg.b !== prevB;
      if ((key !== last && (buttonsChanged || now - lastStickAt > 33)) || now - lastAt > 200) {
        if (sock.current && sock.current.send(msg)) { last = key; lastAt = now; prevB = msg.b; if (!buttonsChanged) lastStickAt = now; }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); kb.dispose(); if (sock.current) sock.current.send({ t: 'i', b: 0, x: 0, y: 0 }); try { wake && wake.release(); } catch { /* ignore */ } };
  }, [playing]);

  // buzz when you get hit
  const mine = status && me ? status.fighters.find(f => f.id === me.id) : null;
  useEffect(() => {
    if (!mine) return;
    if (mine.dmg > lastDmg.current + 4) { try { navigator.vibrate && navigator.vibrate(Math.min(80, (mine.dmg - lastDmg.current) * 4)); } catch { /* ignore */ } }
    lastDmg.current = mine.dmg;
  }, [mine && mine.dmg]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id) => { setFighter(id); setReady(false); sock.current && sock.current.send({ t: 'pick', fighter: id }); };
  const toggleReady = () => { const v = !ready; setReady(v); sock.current && sock.current.send({ t: 'ready', v }); };
  const leave = () => { if (sock.current) sock.current.send({ t: 'leave' }); rrSeat.clear(code); onExit(); };
  const goFull = () => { try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen).call(el); setTimeout(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch { /* ignore */ } }, 200); } catch { /* ignore */ } };

  // ── name entry ──
  if (!joining || (!me && error)) {
    return (
      <div className="rr-root"><div className="rr-scroll"><div className="rr-wrap" style={{ maxWidth: 480 }}>
        <div className="rr-card" style={{ textAlign: 'center', marginTop: 20 }}>
          <h1 className="rr-h rr-logo" style={{ fontSize: 58 }}>Rodeo<b>Rumble</b></h1>
          <p className="rr-sub">Room <b style={{ color: 'var(--rr-gold)', letterSpacing: '.15em' }}>{code}</b></p>
          {identityLoading ? <p className="rr-sub">Loading your TNG profile…</p> : identityName ? <p className="rr-sub">Playing as <b style={{ color: 'var(--rr-gold)' }}>{identityName}</b></p> : null}
          {!identityName && !identityLoading && <p className="rr-sub" style={{ color: '#ff8a8a' }}>Sign in to TNG and finish your player profile before joining.</p>}
          <button type="button" className="rr-btn primary" style={{ width: '100%', marginTop: 12, fontSize: 20, padding: 14 }} disabled={identityLoading || !identityName} onClick={() => { try { localStorage.setItem('rr_name', name.trim()); } catch { /* ignore */ } setError(''); setJoining(true); }}>Join the rumble</button>
          {error && <p className="rr-sub" style={{ color: '#ff8a8a' }}>{error}</p>}
          <button type="button" className="rr-btn ghost" style={{ marginTop: 10 }} onClick={onExit}>Back</button>
        </div>
      </div></div></div>
    );
  }
  if (!me) return <div className="rr-root"><div className="rr-center">{conn === 'open' ? 'Joining…' : 'Connecting to the rumble…'}</div></div>;

  // ── controller ──
  if (playing) {
    const ch = mine ? fighterById(mine.ch) : fighter ? fighterById(fighter) : null;
    return (
      <div className="rr-root rr-pad rr-player-view">
        <div className="rr-padhud" style={{ '--c': me.color }}>
          <span className="rr-dot" style={{ background: me.color }} />
          <b>{me.name}</b>{ch && <span className="sub">{ch.name}</span>}
          {mine && <span className="pct" style={{ color: pctColor(mine.dmg) }}>{mine.dmg}%</span>}
          {mine && <span className="stocks">{Array.from({ length: mine.stocks }, (_, i) => <i key={i} />)}</span>}
          {mine && mine.stocks <= 0 && <span className="sub">KO’d — spectating</span>}
          <button type="button" className="rr-icon small" onClick={goFull} aria-label="Fullscreen">⛶</button>
        </div>
        <RRPlayerArena frameRef={frameRef} />
        {!hasFrame && <div className="rr-player-wait">Waiting for the live arena…</div>}
        {!hostOnline && <div className="rr-rotate" style={{ bottom: 'auto', top: 60 }}>Host disconnected — waiting…</div>}
        <TouchPad state={touch.current} />
      </div>
    );
  }

  // ── lobby / results ──
  const stageName = lobby && STAGES[lobby.stage] ? STAGES[lobby.stage].name : lobby && lobby.stage === 'random' ? 'Random stage' : '';
  return (
    <div className="rr-root"><div className="rr-scroll"><div className="rr-wrap" style={{ maxWidth: 720 }}>
      <div className="rr-card" style={{ textAlign: 'center' }}>
        <div className="rr-row" style={{ justifyContent: 'center' }}><span className="rr-chip" style={{ '--c': me.color }}><span className="rr-dot" style={{ background: me.color }} />{me.name}</span><span className="rr-sub" style={{ margin: 0 }}>Room {code}{stageName ? ` · ${stageName}` : ''}</span></div>
        {!hostOnline && <p className="rr-sub" style={{ color: '#ffb36b' }}>The host is reconnecting…</p>}
        {result ? (
          <>
            <h2 className="rr-h" style={{ fontSize: 48, color: result.winner === me.id ? '#3ef08a' : 'var(--rr-gold)', marginTop: 8 }}>{result.winner === me.id ? 'You win!' : `${(result.ranked.find(r => r.id === result.winner) || {}).name || 'Someone'} wins`}</h2>
            <div className="rr-list">{result.ranked.map((r, i) => <div key={r.id} style={{ fontWeight: r.id === me.id ? 900 : 500 }}>{i + 1}. {r.name} · {fighterById(r.ch).name} — {r.kos} KO{r.kos === 1 ? '' : 's'}</div>)}</div>
            <p className="rr-sub">Waiting for the host to start the next round…</p>
          </>
        ) : lobby && lobby.phase !== 'lobby' && !inMatch ? (
          <p className="rr-sub" style={{ fontSize: 18, marginTop: 14 }}>A match is on right now — you’re in the next one. Pick your fighter below while you wait!</p>
        ) : (
          <p className="rr-sub">Pick your fighter and hit Ready. The full match and controls appear right here — no TV needed.</p>
        )}
      </div>
      {!result && (
        <div className="rr-card" style={{ marginTop: 10 }}>
          <div className="rr-roster small">
            {ROSTER.map(r => (
              <button key={r.id} type="button" className="rr-fcard" style={{ '--c': r.color }} aria-pressed={fighter === r.id} onClick={() => pick(r.id)}>
                <RRPortrait ch={r} size={120} animate={fighter === r.id} />
                <b>{r.name}</b>
              </button>
            ))}
          </div>
          {fighter && <p className="rr-sub" style={{ textAlign: 'center' }}><b style={{ color: fighterById(fighter).color }}>{fighterById(fighter).name}:</b> {fighterById(fighter).blurb}</p>}
          <div className="rr-row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button type="button" className={`rr-btn ${ready ? '' : 'primary'}`} style={{ fontSize: 20, padding: '12px 30px' }} disabled={!fighter} onClick={toggleReady}>{ready ? 'Ready ✓ (tap to change)' : 'Ready!'}</button>
          </div>
          <details className="rr-sub" style={{ marginTop: 10 }}>
            <summary>Controls</summary>
            Left thumb: move (drag anywhere on the left side). <b>LIGHT</b> quick attacks · <b>HEAVY</b> smash (hold to charge) / specials · <b>JUMP</b> (again in the air) · <b>DODGE</b> shield, roll, air dodge. Tilt the stick while attacking for different moves. A Bluetooth controller paired to your phone works too.
          </details>
        </div>
      )}
      <div className="rr-row" style={{ justifyContent: 'center', marginTop: 10 }}><button type="button" className="rr-btn ghost" onClick={leave}>Leave room</button></div>
    </div></div></div>
  );
}
