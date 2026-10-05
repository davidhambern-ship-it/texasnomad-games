import React, { useEffect, useRef, useState } from 'react';
import { dominoStore as base44 } from '@/api/dominoStore';
import Header from '@/components/home/Header';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import DominoTable, { TEAM_COLORS, TEAM_NAMES } from '@/components/domino/DominoTable';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import { generateRoomCode, getTeam, newRound, applyPlay, applyPass, chooseAIMove } from '@/lib/dominoEngine';
import '@/components/domino/domino.css';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';

const LIMITS = [100, 150, 200, 250];
const HOST_KEY = 'dom_host_room';
const emptySeat = (i) => ({ seat: i, playerId: null, playerName: null, hand: [], isAI: false, connected: false });
const aiLevel = (p) => { const c = TEXASNOMAD_CHARACTERS.find(x => x.id === p?.aiCharacterId); return Math.max(3, Math.min(10, Math.round((c?.traits?.intelligence ?? 65) / 10))); };

async function fetchRoom(code) {
  const rows = await base44.entities.DominoGame.filter(
    { room_code: code },
    { host: true },
  );
  return rows[0] || null;
}

function SeatAvatar({ p, seat }) {
  const ch = TEXASNOMAD_CHARACTERS.find(c => c.id === p?.aiCharacterId);
  const color = TEAM_COLORS[getTeam(seat)];
  const [broken, setBroken] = useState(false);
  if (ch && !broken) return <img src={ch.avatar} alt="" className="tnd-avatar" style={{ width: 40, height: 40, borderColor: color }} onError={() => setBroken(true)} />;
  return <div className="tnd-avatar tnd-avatar-txt" style={{ width: 40, height: 40, borderColor: color, background: `${color}33`, fontSize: 15 }}>{p?.playerName ? p.playerName.slice(0, 2).toUpperCase() : '·'}</div>;
}

export default function DominoHost() {
  const [game, setGame] = useState(null);
  const identity = useTngGameIdentity();
  const hostName = identity.publicName;
  const [scoreLimit, setScoreLimit] = useState(150);
  const [loading, setLoading] = useState(false);
  const [hostError, setHostError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedRoom] = useState(() => { try { return localStorage.getItem(HOST_KEY); } catch { return null; } });
  const savedRoomAuthorized = Boolean(
    savedRoom && base44.entities.DominoGame.hostToken(savedRoom),
  );
  const gameRef = useRef(null);
  const aiBusy = useRef(false);
  const [aiTick, setAiTick] = useState(0);
  useEffect(() => { gameRef.current = game; }, [game]);

  const save = async (g) => {
    const saved = await base44.entities.DominoGame.update(
      g.id,
      g,
      { roomCode: g.room_code },
    );
    setGame(saved || g);
    return saved || g;
  };

  // Live updates (subscription + polling fallback)
  useEffect(() => {
    if (!game?.id) return;
    const unsub = base44.entities.DominoGame.subscribe(ev => { if (ev.data && ev.id === game.id) setGame(ev.data); });
    const poll = setInterval(async () => { try { const g = await fetchRoom(game.room_code); if (g) setGame(g); } catch { /* offline */ } }, 3000);
    return () => { try { unsub && unsub(); } catch { /* ignore */ } clearInterval(poll); };
  }, [game?.id]);

  // CPU turns run on the host's screen
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const p = game.players?.[game.currentSeat];
    if (!p?.isAI) return;
    const t = setTimeout(async () => {
      if (aiBusy.current) { setTimeout(() => setAiTick(t => t + 1), 400); return; }
      aiBusy.current = true;
      try {
        const fresh = await fetchRoom(game.room_code);
        if (!fresh || fresh.phase !== 'playing') return;
        const seat = fresh.currentSeat, player = fresh.players[seat];
        if (!player?.isAI) return;
        const move = chooseAIMove(fresh, seat, aiLevel(player));
        const next = move ? applyPlay(fresh, seat, move.domino.id, move.side) : applyPass(fresh, seat);
        if (!next.error) await save(next);
      } finally { aiBusy.current = false; }
    }, 900 + Math.random() * 700);
    return () => clearTimeout(t);
  }, [game?.currentSeat, game?.phase, game?.board?.length, game?.passes, game?.roundNumber, aiTick]);

  const createRoom = async () => {
    if (!hostName.trim()) return;
    setLoading(true);
    setHostError('');
    try {
      const players = [0, 1, 2, 3].map(i => (i === 0 ? { ...emptySeat(0), playerId: `host_${Date.now()}`, playerName: hostName.trim(), connected: true, isHost: true } : emptySeat(i)));
      const created = await base44.entities.DominoGame.create({
        room_code: generateRoomCode(), status: 'waiting', phase: 'waiting', players, board: [], boneyard: [],
        currentSeat: 0, roundNumber: 1, teamScores: { teamA: 0, teamB: 0 }, scoreLimit, activityLog: [],
      });
      try { localStorage.setItem(HOST_KEY, created.room_code); } catch { /* ignore */ }
      setGame(created);
    } catch (error) {
      setHostError(
        error?.message ||
        'TNG could not create the Domino table. Open it from the Host Controller.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resumeRoom = async () => {
    setLoading(true);
    setHostError('');
    try {
      const g = await fetchRoom(savedRoom);
      if (g) setGame(g);
      else setHostError('That saved Domino room is no longer available.');
    } catch (error) {
      setHostError(error?.message || 'That Domino room could not be resumed.');
    } finally {
      setLoading(false);
    }
  };

  const usedChars = (g) => g.players.filter(p => p.aiCharacterId).map(p => p.aiCharacterId);
  const pickChar = (g, extra = []) => { const used = [...usedChars(g), ...extra]; const pool = TEXASNOMAD_CHARACTERS.filter(c => !used.includes(c.id)); const list = pool.length ? pool : TEXASNOMAD_CHARACTERS; return list[Math.floor(Math.random() * list.length)]; };
  const addAI = async (seat) => { const g = await fetchRoom(game.room_code) || game; if (g.players[seat].playerId) return; const c = pickChar(g); await save({ ...g, players: g.players.map((p, i) => (i === seat ? { ...p, playerId: `ai_${seat}_${c.id}`, playerName: c.name, isAI: true, connected: true, aiCharacterId: c.id } : p)) }); };
  const clearSeat = async (seat) => { const g = await fetchRoom(game.room_code) || game; await save({ ...g, players: g.players.map((p, i) => (i === seat ? emptySeat(i) : p)) }); };
  const setLimit = async (v) => { setScoreLimit(v); if (game) await save({ ...game, scoreLimit: v }); };

  const startGame = async () => {
    const g = await fetchRoom(game.room_code) || game;
    const extra = [];
    const players = g.players.map(p => {
      if (p.playerId) return p;
      const c = pickChar(g, extra); extra.push(c.id);
      return { ...p, playerId: `ai_${p.seat}_${c.id}`, playerName: c.name, isAI: true, connected: true, aiCharacterId: c.id };
    });
    await save(newRound({ ...g, players, scoreLimit: g.scoreLimit || scoreLimit }, { first: true }));
  };
  const nextRound = async () => { const g = await fetchRoom(game.room_code) || game; if (g.phase === 'round_over') await save(newRound(g)); };
  const playAgain = async () => { const g = await fetchRoom(game.room_code) || game; await save(newRound({ ...g, roundWinner: null }, { first: true })); };
  const endGame = async () => { if (!window.confirm('End this game for everyone?')) return; await save({ ...game, phase: 'game_over', status: 'finished' }); };

  const hostPlay = async (id, side) => {
    const fresh = await fetchRoom(game.room_code);
    if (!fresh) return 'Lost connection to the room';
    const next = applyPlay(fresh, 0, id, side);
    if (next.error) return next.error;
    await save(next); return null;
  };
  const hostPass = async () => {
    const fresh = await fetchRoom(game.room_code);
    if (!fresh) return 'Lost connection to the room';
    const next = applyPass(fresh, 0);
    if (next.error) return next.error;
    await save(next); return null;
  };

  // ── Create a room ─────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 50% 0%,#1a0b33,#050505 70%)' }}>
        <Header />
        <div className="tnd-root"><div className="tnd-lobby">
          <div className="tnd-panel" style={{ textAlign: 'center' }}>
            <h1>DOMINOES</h1>
            <p className="tnd-sub">Texas-style partners · double-six · All Fives scoring</p>
          </div>
          <div className="tnd-panel">
            <h3>TNG Host (Seat 1)</h3>
            <p className="tnd-sub" style={{ marginTop: 8 }}>
              Playing as <b style={{ color: '#FFD700' }}>{hostName || (identity.loading ? 'Loading profile…' : 'TNG profile unavailable')}</b>
            </p>
            {identity.error && <p className="tnd-sub" style={{ color: '#fca5a5', marginTop: 8 }}>{identity.error}</p>}
            <h3 style={{ marginTop: 16 }}>Play to</h3>
            <div className="tnd-seg">{LIMITS.map(v => <button key={v} type="button" aria-pressed={scoreLimit === v} onClick={() => setScoreLimit(v)}>{v}</button>)}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button type="button" className="tnd-btn primary" style={{ flex: 1, padding: 16, fontSize: 18 }} disabled={loading || identity.loading || !hostName.trim()} onClick={createRoom}>{loading ? 'Opening…' : 'Create room & sit down'}</button>
              {savedRoomAuthorized && <button type="button" className="tnd-btn" disabled={loading} onClick={resumeRoom}>Resume room {savedRoom}</button>}
            </div>
            {hostError && (
              <p className="tnd-sub" style={{ color: '#fca5a5', marginTop: 12 }}>
                {hostError}
              </p>
            )}
          </div>
          <div className="tnd-panel">
            <h3>How it plays</h3>
            <ul className="tnd-rules">
              <li><b>Partners:</b> Seats 1 &amp; 3 are Team A, seats 2 &amp; 4 are Team B. Empty seats get CPU players.</li>
              <li><b>Match the pips</b> on any open end. The first double played is the <b>spinner</b> — once both its sides are covered, it opens up and down too.</li>
              <li><b>Score as you play:</b> if the open ends add up to 5, 10, 15… your team scores that many.</li>
              <li><b>Domino!</b> Go out first and your team scores the other team’s pips (rounded to 5). Nobody can move? The lighter team takes the round.</li>
              <li>Can’t play? <b>Knock</b> to pass.</li>
            </ul>
          </div>
        </div></div>
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/games/dominoes?room=${game.room_code}`;
  const copy = async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } };

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (game.phase === 'waiting') {
    return (
      <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 50% 0%,#1a0b33,#050505 70%)' }}>
        <Header />
        <TestFeedbackButton gameId="dominoes" roomCode={game.room_code} testerName={hostName} />
        <div className="tnd-root"><div className="tnd-lobby">
          <div className="tnd-panel">
            <h3>Room code</h3>
            <div className="tnd-share">
              <span className="tnd-bigcode">{game.room_code}</span>
              <button type="button" className="tnd-btn" onClick={copy}>{copied ? 'Link copied!' : 'Copy invite link'}</button>
            </div>
            <p className="tnd-sub" style={{ marginTop: 8 }}>Friends open the invite link (or go to Dominoes and enter the code) to take a seat.</p>
          </div>
          <div className="tnd-panel">
            <h3>Seats</h3>
            <div className="tnd-seats">
              {game.players.map((p, seat) => (
                <div key={seat} className="tnd-seatbox" style={{ '--tc': TEAM_COLORS[getTeam(seat)] }}>
                  <SeatAvatar p={p} seat={seat} />
                  <div className="who"><b>{p.playerName || 'Open seat'}{p.isAI ? ' · CPU' : ''}</b><span>Seat {seat + 1} · {TEAM_NAMES[getTeam(seat)]}{seat === 0 ? ' · Host' : ''}</span></div>
                  {seat !== 0 && !p.playerId && <button type="button" className="tnd-btn" onClick={() => addAI(seat)}>+ CPU</button>}
                  {seat !== 0 && p.playerId && <button type="button" className="tnd-btn danger" onClick={() => clearSeat(seat)}>{p.isAI ? 'Remove' : 'Kick'}</button>}
                </div>
              ))}
            </div>
            <h3 style={{ marginTop: 16 }}>Play to</h3>
            <div className="tnd-seg">{LIMITS.map(v => <button key={v} type="button" aria-pressed={(game.scoreLimit || scoreLimit) === v} onClick={() => setLimit(v)}>{v}</button>)}</div>
            <button type="button" className="tnd-btn primary" style={{ width: '100%', marginTop: 18, padding: 16, fontSize: 18 }} onClick={startGame}>Start game{game.players.some(p => !p.playerId) ? ' (CPU fills empty seats)' : ''}</button>
          </div>
        </div></div>
      </div>
    );
  }

  // ── Table ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 50% 0%,#1a0b33,#050505 70%)' }}>
      <Header />
      <TestFeedbackButton gameId="dominoes" roomCode={game.room_code} testerName={hostName} />
      <DominoTable game={game} mySeat={0} isHost roomCode={game.room_code}
        onPlay={hostPlay} onPass={hostPass} onNextRound={nextRound} onPlayAgain={playAgain}
        onLeave={() => { window.location.href = '/games'; }}
        headerRight={<>
          <button type="button" className="tnd-btn ghosty" onClick={copy} title={shareUrl}>{copied ? 'Copied!' : 'Invite'}</button>
          {game.phase !== 'game_over' && <button type="button" className="tnd-btn ghosty danger" onClick={endGame}>End</button>}
        </>} />
    </div>
  );
}
