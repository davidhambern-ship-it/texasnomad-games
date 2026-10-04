import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DominoBoard from './DominoBoard';
import DominoTile from './DominoTile';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import {
  getTeam, getLegalMoves, boardCount, pipCount, teamScore, winningTeam,
} from '@/lib/dominoEngine';
import './domino.css';

export const TEAM_COLORS = ['#BC13FE', '#FF5F1F'];
export const TEAM_NAMES = ['Team A', 'Team B'];
const POS = ['bottom', 'left', 'top', 'right'];
export const relPos = (mySeat, seat) => POS[(seat - (mySeat ?? 0) + 4) % 4];
const charOf = (p) => TEXASNOMAD_CHARACTERS.find(c => c.id === p?.aiCharacterId);
const sortHand = (h) => [...h].sort((x, y) => (Math.max(y.a, y.b) - Math.max(x.a, x.b)) || (y.a + y.b - x.a - x.b));

// ── tiny WebAudio sound kit (no files) ──────────────────────────────────────
function useSounds() {
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('tnd-muted') === '1'; } catch { return false; } });
  const ctxRef = useRef(null);
  useEffect(() => { try { localStorage.setItem('tnd-muted', muted ? '1' : '0'); } catch { /* ignore */ } }, [muted]);
  const ctx = () => {
    if (!ctxRef.current) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctxRef.current = new AC(); }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  };
  const tone = (c, t, f, d, type = 'sine', v = 0.25, to) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  };
  const noise = (c, t, d, f, v = 0.3) => {
    const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = c.createBufferSource(); s.buffer = b; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 2; const g = c.createGain(); g.gain.value = v;
    s.connect(fl); fl.connect(g); g.connect(c.destination); s.start(t);
  };
  const play = (name) => {
    if (muted) return; const c = ctx(); if (!c) return; const t = c.currentTime + 0.01;
    try {
      if (name === 'clack') { noise(c, t, 0.06, 2600, 0.5); tone(c, t, 420, 0.07, 'triangle', 0.12); }
      if (name === 'score') { [784, 988, 1319].forEach((f, i) => tone(c, t + i * 0.07, f, 0.25, 'triangle', 0.16)); }
      if (name === 'knock') { noise(c, t, 0.08, 500, 0.6); noise(c, t + 0.13, 0.08, 500, 0.6); }
      if (name === 'turn') { tone(c, t, 660, 0.12, 'sine', 0.12); tone(c, t + 0.1, 990, 0.2, 'sine', 0.12); }
      if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.12, f, 0.45, 'sawtooth', 0.08)); }
    } catch { /* ignore */ }
  };
  return { muted, setMuted, play, unlock: () => { if (!muted) ctx(); } };
}

// ── confetti for the game winner ───────────────────────────────────────────
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = ['#BC13FE', '#FF5F1F', '#FFD700', '#4ade80', '#ffffff'];
    const P = Array.from({ length: 180 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 300, y: innerHeight * 0.3, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, s: 6 + Math.random() * 8, c: cols[Math.floor(Math.random() * cols.length)] }));
    let raf, t0 = performance.now();
    const f = (t) => { x.clearRect(0, 0, c.width, c.height); for (const p of P) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); } if (t - t0 < 4000) raf = requestAnimationFrame(f); else x.clearRect(0, 0, c.width, c.height); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="tnd-confetti" aria-hidden="true" />;
}

function Avatar({ player, seat, size = 44 }) {
  const ch = charOf(player);
  const color = TEAM_COLORS[getTeam(seat)];
  const [broken, setBroken] = useState(false);
  if (ch && !broken) return <img src={ch.avatar} alt="" className="tnd-avatar" style={{ width: size, height: size, borderColor: color }} onError={() => setBroken(true)} />;
  const initials = (player?.playerName || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return <div className="tnd-avatar tnd-avatar-txt" style={{ width: size, height: size, borderColor: color, background: `${color}33`, fontSize: size * 0.38 }}>{player?.playerId ? initials : '·'}</div>;
}

function Seat({ game, seat, pos, mySeat, bubble }) {
  const p = game.players[seat];
  const team = getTeam(seat);
  const turn = game.phase === 'playing' && game.currentSeat === seat;
  const count = p?.hand?.length || 0;
  const rel = mySeat == null ? '' : seat === (mySeat + 2) % 4 ? 'Partner' : getTeam(seat) === getTeam(mySeat) ? 'You' : 'Opponent';
  return (
    <div className={`tnd-seat pos-${pos}${turn ? ' is-turn' : ''}`} style={{ '--tc': TEAM_COLORS[team] }}>
      <div className="tnd-seat-card">
        <Avatar player={p} seat={seat} size={40} />
        <div className="tnd-seat-info">
          <div className="tnd-seat-name">{p?.playerName || `Seat ${seat + 1}`}{p?.isAI && <span className="tnd-chip">CPU</span>}</div>
          <div className="tnd-seat-sub"><span style={{ color: TEAM_COLORS[team] }}>{TEAM_NAMES[team]}</span>{rel && <> · {rel}</>}</div>
        </div>
        {turn && <div className="tnd-think" aria-label="Their turn"><i /><i /><i /></div>}
      </div>
      {game.phase !== 'waiting' && (
        <div className="tnd-seat-hand" aria-label={`${count} tiles`}>
          {Array.from({ length: count }).map((_, i) => <DominoTile key={i} unit={11} faceDown horizontal={pos === 'left' || pos === 'right'} />)}
        </div>
      )}
      {bubble && <div key={bubble.key} className={`tnd-bubble ${bubble.kind}`}>{bubble.text}</div>}
    </div>
  );
}

/**
 * DominoTable — the whole in-game experience, shared by the Host and player pages.
 */
export default function DominoTable({ game, mySeat = null, onPlay, onPass, isHost = false, onNextRound, onPlayAgain, onLeave, roomCode, headerRight, notice }) {
  const sounds = useSounds();
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState(null);
  const [bubbles, setBubbles] = useState({});
  const [busy, setBusy] = useState(false);
  const trayRef = useRef(null);
  const [trayW, setTrayW] = useState(600);
  useLayoutEffect(() => { const el = trayRef.current; if (!el) return; const u = () => setTrayW(el.clientWidth); u(); const ro = new ResizeObserver(u); ro.observe(el); return () => ro.disconnect(); }, []);

  const board = game.board || [];
  const me = mySeat != null ? game.players[mySeat] : null;
  const myHand = useMemo(() => sortHand(me?.hand || []), [me?.hand]);
  const myTurn = mySeat != null && game.phase === 'playing' && game.currentSeat === mySeat;
  const legal = useMemo(() => (myTurn ? getLegalMoves(me.hand, board, game.leadTile) : []), [myTurn, me?.hand, board, game.leadTile]);
  const playableIds = new Set(legal.map(m => m.domino.id));
  const selected = selectedId && myHand.find(d => d.id === selectedId);
  const selectedMoves = selected ? legal.filter(m => m.domino.id === selected.id) : [];
  const ghostMoves = useMemo(() => selectedMoves.map(m => ({ side: m.side, domino: m.domino })), [selectedId, board, legal.length]);
  const count = boardCount(board);
  const current = game.players[game.currentSeat];
  const seatPos = (s) => relPos(mySeat, s);

  // Reset selection when the turn or board changes
  useEffect(() => { setSelectedId(null); }, [game.currentSeat, board.length, game.phase]);

  // React to the latest play: sounds, score popup, seat bubbles
  const lastKey = game.lastPlay ? `${game.roundNumber}:${game.lastPlay.n}:${game.lastPlay.seat}:${game.lastPlay.pass ? 'p' : game.lastPlay.id}` : null;
  const seenKey = useRef(lastKey);
  useEffect(() => {
    if (!lastKey || lastKey === seenKey.current) return;
    seenKey.current = lastKey;
    const lp = game.lastPlay;
    if (lp.pass) { sounds.play('knock'); setBubbles(b => ({ ...b, [lp.seat]: { key: lastKey, text: 'Knock knock!', kind: 'knock' } })); }
    else {
      sounds.play('clack');
      if (lp.points) { setTimeout(() => sounds.play('score'), 180); setPopup({ key: lastKey, text: `+${lp.points}`, team: getTeam(lp.seat), name: game.players[lp.seat]?.playerName }); setBubbles(b => ({ ...b, [lp.seat]: { key: lastKey, text: `+${lp.points}`, kind: 'score' } })); }
    }
    const k = lastKey;
    setTimeout(() => { setBubbles(b => { const n = { ...b }; if (n[lp.seat]?.key === k) delete n[lp.seat]; return n; }); }, 2200);
  }, [lastKey]);
  useEffect(() => { if (!popup) return; const t = setTimeout(() => setPopup(null), 1700); return () => clearTimeout(t); }, [popup]);
  const turnKey = myTurn ? `${game.roundNumber}:${board.length}:${game.passes || 0}` : null;
  useEffect(() => { if (turnKey) sounds.play('turn'); }, [turnKey]);
  useEffect(() => { if (game.phase === 'game_over') sounds.play('win'); }, [game.phase]);
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(null), 2600); return () => clearTimeout(t); }, [error]);

  const doPlay = async (id, side) => {
    if (busy) return;
    setBusy(true);
    try { const err = await onPlay(id, side); if (err) setError(err); else setSelectedId(null); }
    finally { setBusy(false); }
  };
  const tapTile = (d) => {
    sounds.unlock();
    if (!myTurn) { setError(game.phase === 'playing' ? `Wait for ${current?.playerName || 'your turn'}` : null); return; }
    if (!playableIds.has(d.id)) { setError(board.length ? 'That tile doesn’t match any open end' : `Lead with the ${game.leadTile}`); return; }
    const moves = legal.filter(m => m.domino.id === d.id);
    const sides = [...new Set(moves.map(m => m.side))];
    if (sides.length === 1) { doPlay(d.id, sides[0]); return; }
    setSelectedId(prev => (prev === d.id ? null : d.id));
  };

  // Tray tile size: fit the hand across the tray
  const n = Math.max(myHand.length, 4);
  const handUnit = Math.max(26, Math.min(54, (trayW - 24) / (n * 1.22)));

  let banner;
  if (game.phase === 'playing') {
    if (myTurn) banner = !board.length ? (game.leadTile ? `Your lead — play the ${game.leadTile}` : 'Your lead — play any tile') : legal.length ? (selected ? 'Tap a glowing spot on the table' : 'Your turn — tap a glowing tile') : 'No tile fits — knock to pass';
    else banner = `${current?.playerName || '…'} is ${current?.isAI ? 'thinking' : 'up'}…`;
  }
  const rw = game.roundWinner;
  const win = winningTeam(game);
  const myTeam = mySeat != null ? getTeam(mySeat) : null;

  return (
    <div className="tnd-root" onPointerDown={sounds.unlock}>
      {/* ── top bar ── */}
      <div className="tnd-topbar">
        <div className="tnd-brand"><span className="tnd-title">DOMINOES</span>{roomCode && <span className="tnd-code" title="Room code">{roomCode}</span>}<span className="tnd-round">Round {game.roundNumber || 1}</span></div>
        <div className="tnd-scores">
          {[0, 1].map(t => {
            const sc = teamScore(game, t), lim = game.scoreLimit || 150;
            return (
              <div key={t} className={`tnd-score${myTeam === t ? ' is-mine' : ''}`} style={{ '--tc': TEAM_COLORS[t] }}>
                <div className="tnd-score-top"><span>{TEAM_NAMES[t]}{myTeam === t ? ' · You' : ''}</span><b key={sc} className="tnd-bump">{sc}</b></div>
                <div className="tnd-bar"><i style={{ width: `${Math.min(100, (sc / lim) * 100)}%` }} /></div>
              </div>
            );
          })}
          <div className="tnd-target">to {game.scoreLimit || 150}</div>
        </div>
        <div className="tnd-actions">
          <div className={`tnd-count${count && count % 5 === 0 ? ' is-five' : ''}`} title="Sum of the open ends — scores when it's a multiple of 5">Count <b>{board.length ? count : '—'}</b></div>
          <button type="button" className="tnd-icon" onClick={() => sounds.setMuted(m => !m)} aria-label={sounds.muted ? 'Turn sound on' : 'Mute sound'} title={sounds.muted ? 'Sound off' : 'Sound on'}>{sounds.muted ? '🔇' : '🔊'}</button>
          {headerRight}
        </div>
      </div>

      {/* ── table ── */}
      <div className="tnd-stage">
        <div className="tnd-table">
          <div className="tnd-felt">
            {banner && <div className={`tnd-banner${myTurn ? ' is-mine' : ''}`}>{banner}</div>}
            <div className="tnd-ticker" aria-live="polite">{(game.activityLog || []).slice(-3).map((m, i, arr) => <div key={`${arr.length}-${i}-${m}`} style={{ opacity: 0.45 + (i / Math.max(1, arr.length - 1)) * 0.55 }}>{m}</div>)}</div>
            <DominoBoard board={board} ghostMoves={myTurn ? ghostMoves : []} onGhost={(side) => selected && doPlay(selected.id, side)} seatPos={seatPos}
              highlightN={game.lastPlay && !game.lastPlay.pass ? game.lastPlay.n : null}
              hint={game.phase === 'playing' ? (game.leadTile ? `${game.players[game.currentSeat]?.playerName} leads the ${game.leadTile}` : `${game.players[game.currentSeat]?.playerName} leads`) : 'Waiting for the host to start'} />
            {popup && <div key={popup.key} className="tnd-popup" style={{ '--tc': TEAM_COLORS[popup.team] }}><b>{popup.text}</b><span>{popup.name} · {TEAM_NAMES[popup.team]}</span></div>}
            {notice && <div className="tnd-notice">{notice}</div>}
          </div>
          {[0, 1, 2, 3].filter(s => s !== mySeat).map(s => <Seat key={s} game={game} seat={s} pos={seatPos(s)} mySeat={mySeat} bubble={bubbles[s]} />)}
        </div>

        {/* ── my hand ── */}
        <div ref={trayRef} className={`tnd-tray${myTurn ? ' is-turn' : ''}`} style={{ '--tc': TEAM_COLORS[myTeam ?? 0] }}>
          {me ? (
            <>
              <div className="tnd-tray-head">
                <Avatar player={me} seat={mySeat} size={34} />
                <div className="tnd-tray-name"><b>{me.playerName}</b><span style={{ color: TEAM_COLORS[myTeam] }}>{TEAM_NAMES[myTeam]}</span> · {myHand.length} tile{myHand.length === 1 ? '' : 's'} · {pipCount(myHand)} pips</div>
                {bubbles[mySeat] && <div key={bubbles[mySeat].key} className={`tnd-bubble inline ${bubbles[mySeat].kind}`}>{bubbles[mySeat].text}</div>}
                {myTurn && !legal.length && game.phase === 'playing' && (
                  <button type="button" className="tnd-btn tnd-knock" disabled={busy} onClick={async () => { const e = await onPass(); if (e) setError(e); }}>Knock · pass</button>
                )}
                {selected && <button type="button" className="tnd-btn ghosty" onClick={() => setSelectedId(null)}>Cancel</button>}
              </div>
              <div className="tnd-hand">
                {myHand.map(d => {
                  const can = myTurn && playableIds.has(d.id);
                  return (
                    <DominoTile key={d.id} a={d.a} b={d.b} unit={handUnit} playable={can && selectedId !== d.id} selected={selectedId === d.id} dim={myTurn && !can}
                      onClick={() => tapTile(d)} className="tnd-hand-tile" />
                  );
                })}
                {!myHand.length && <div className="tnd-empty-hand">{game.phase === 'waiting' ? 'Tiles are dealt when the host starts' : 'No tiles left'}</div>}
              </div>
            </>
          ) : <div className="tnd-empty-hand">Watching the table</div>}
          {error && <div className="tnd-error" role="alert">{error}</div>}
        </div>
      </div>

      {/* ── round / game over ── */}
      {((game.phase === 'round_over' && rw) || game.phase === 'game_over') && (
        <div className="tnd-modal-bg">
          {game.phase === 'game_over' && <Confetti />}
          <div className="tnd-modal" role="dialog" aria-label="Round results">
            {game.phase === 'game_over' ? (
              <>
                <div className="tnd-modal-kicker">Game over</div>
                <h2 style={{ color: win == null ? '#fff' : TEAM_COLORS[win] }}>{win == null ? 'It’s a tie!' : myTeam == null ? `${TEAM_NAMES[win]} wins!` : win === myTeam ? 'Your team wins!' : `${TEAM_NAMES[win]} wins`}</h2>
              </>
            ) : (
              <>
                <div className="tnd-modal-kicker">Round {game.roundNumber} over</div>
                <h2>{rw?.reason === 'blocked' ? (rw.team == null ? 'Blocked — dead even' : 'Blocked!') : `${rw.playerName} dominoes!`}</h2>
              </>
            )}
            {rw && <p className="tnd-modal-sub">
              {rw.reason === 'score' ? <><b>{rw.playerName}</b> made <b>+{rw.points}</b> to reach {game.scoreLimit || 150}</> : rw.team == null ? 'Both teams hold the same pips, so nobody scores.' : rw.reason === 'blocked'
                ? <><b style={{ color: TEAM_COLORS[rw.team] }}>{TEAM_NAMES[rw.team]}</b> has the lighter hands and takes <b>+{rw.points}</b></>
                : <><b style={{ color: TEAM_COLORS[rw.team] }}>{TEAM_NAMES[rw.team]}</b> scores the other team’s pips: <b>+{rw.points}</b></>}
            </p>}
            <div className="tnd-reveal">
              {[0, 1, 2, 3].map(s => {
                const p = game.players[s];
                return (
                  <div key={s} className="tnd-reveal-row" style={{ '--tc': TEAM_COLORS[getTeam(s)] }}>
                    <Avatar player={p} seat={s} size={28} />
                    <span className="tnd-reveal-name">{p?.playerName}</span>
                    <span className="tnd-reveal-tiles">{(p?.hand || []).map(d => <DominoTile key={d.id} a={d.a} b={d.b} unit={16} horizontal />)}{!(p?.hand || []).length && <em>out!</em>}</span>
                    <b>{pipCount(p?.hand || [])}</b>
                  </div>
                );
              })}
            </div>
            <div className="tnd-final">
              {[0, 1].map(t => <div key={t} style={{ '--tc': TEAM_COLORS[t] }}><span>{TEAM_NAMES[t]}</span><b>{teamScore(game, t)}</b></div>)}
            </div>
            <div className="tnd-modal-actions">
              {game.phase === 'round_over' && (isHost ? <button type="button" className="tnd-btn primary" onClick={onNextRound}>Deal next round</button> : <span className="tnd-wait">Waiting for the host to deal…</span>)}
              {game.phase === 'game_over' && isHost && onPlayAgain && <button type="button" className="tnd-btn primary" onClick={onPlayAgain}>Play again</button>}
              {game.phase === 'game_over' && onLeave && <button type="button" className="tnd-btn" onClick={onLeave}>Back to games</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
