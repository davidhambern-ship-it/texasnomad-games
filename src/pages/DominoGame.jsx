import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Header from '@/components/home/Header';
import DominoBoard from '@/components/domino/DominoBoard';
import DominoTile from '@/components/domino/DominoTile';
import {
  getTeam, getLegalMoves, getPlayableEnds, buildEntry,
  getOpenEnds, calcRoundPoints, pipCount, isBlocked,
} from '@/lib/dominoEngine';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const TEAM_COLORS = ['#BC13FE', '#FF5F1F'];
const TEAM_NAMES  = ['Team A', 'Team B'];

export default function DominoGame() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('room')?.toUpperCase();

  const [game, setGame]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [mySeat, setMySeat]       = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedDomino, setSelectedDomino] = useState(null);
  const [feedback, setFeedback]   = useState(null);
  const pollRef = useRef(null);

  const myPlayer    = mySeat !== null ? game?.players?.[mySeat] : null;
  const myHand      = myPlayer?.hand || [];
  const isMyTurn    = mySeat !== null && game?.phase === 'playing' && game?.currentSeat === mySeat;
  const currentPlayer = game?.players?.[game?.currentSeat];
  const board       = game?.board || [];
  const openEnds    = getOpenEnds(board);
  const legalMoves  = isMyTurn ? getLegalMoves(myHand, board) : [];
  const playableDominoIds = new Set(legalMoves.map(m => m.domino.id));
  const hasLegalMove = legalMoves.length > 0;
  const playableEnds = selectedDomino ? new Set(getPlayableEnds(selectedDomino, board)) : new Set();
  const gameOver    = (game?.teamScores?.teamA || 0) >= (game?.scoreLimit || 100) || (game?.teamScores?.teamB || 0) >= (game?.scoreLimit || 100);

  const flash = (msg, type = 'error') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2800);
  };

  // Fetch + poll
  useEffect(() => {
    if (!roomCode) { setLoading(false); return; }
    fetchGame();
    pollRef.current = setInterval(fetchGame, 2500);
    return () => clearInterval(pollRef.current);
  }, [roomCode]);

  const fetchGame = async () => {
    try {
      const rows = await base44.entities.DominoGame.filter({ room_code: roomCode });
      if (rows[0]) setGame(rows[0]);
      setLoading(false);
    } catch (_) { setLoading(false); }
  };

  // Rejoin if we have a saved seat
  useEffect(() => {
    if (!game || mySeat !== null) return;
    const saved = localStorage.getItem(`dom_seat_${roomCode}`);
    const savedId = localStorage.getItem(`dom_pid_${roomCode}`);
    if (saved !== null && savedId) {
      const seat = parseInt(saved);
      const p = game.players?.[seat];
      if (p?.playerId === savedId) setMySeat(seat);
    }
  }, [game?.id]);

  const joinGame = async () => {
    if (!nameInput.trim() || !game) return;
    // Find first empty human seat
    const emptySeat = game.players?.findIndex(p => !p.playerId);
    if (emptySeat < 0) { flash('Room is full'); return; }
    const pid = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const players = game.players.map((p, i) => i === emptySeat
      ? { ...p, playerId: pid, playerName: nameInput.trim(), isAI: false, connected: true }
      : p);
    const updated = { ...game, players };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    setMySeat(emptySeat);
    localStorage.setItem(`dom_seat_${roomCode}`, emptySeat);
    localStorage.setItem(`dom_pid_${roomCode}`, pid);
  };

  const playOnEnd = async (side) => {
    if (!isMyTurn || !selectedDomino || !game) return;
    const domino = myHand.find(d => d.id === selectedDomino.id);
    if (!domino) return;
    const ends = getPlayableEnds(domino, board);
    if (!ends.includes(side)) { flash("That tile doesn't fit there"); return; }

    const entry = buildEntry(domino, side, board);
    const newBoard = [...board, entry];
    const newHand  = myHand.filter(d => d.id !== domino.id);
    const nextSeat = (mySeat + 1) % 4;
    let players = game.players.map((p, i) => i === mySeat ? { ...p, hand: newHand } : p);
    const log = [`${myPlayer.playerName} played [${domino.id}]`, ...(game.activityLog || [])].slice(0, 30);
    let updated;

    if (newHand.length === 0) {
      const pts = calcRoundPoints(players, mySeat);
      const winTeam = getTeam(mySeat);
      const teamScores = {
        teamA: (game.teamScores?.teamA || 0) + (winTeam === 0 ? pts : 0),
        teamB: (game.teamScores?.teamB || 0) + (winTeam === 1 ? pts : 0),
      };
      updated = { ...game, board: newBoard, players, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts, playerName: myPlayer.playerName }, activityLog: log };
    } else if (isBlocked(players, newBoard)) {
      const teamPips = [0, 1].map(team => players.filter((_, i) => getTeam(i) === team).reduce((s, p) => s + pipCount(p.hand), 0));
      const winTeam = teamPips[0] <= teamPips[1] ? 0 : 1;
      const pts = teamPips[1 - winTeam];
      const teamScores = {
        teamA: (game.teamScores?.teamA || 0) + (winTeam === 0 ? pts : 0),
        teamB: (game.teamScores?.teamB || 0) + (winTeam === 1 ? pts : 0),
      };
      updated = { ...game, board: newBoard, players, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts }, activityLog: [`🔒 Blocked! ${TEAM_NAMES[winTeam]} wins round`, ...log] };
    } else {
      updated = { ...game, board: newBoard, players, currentSeat: nextSeat, activityLog: log };
    }

    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  // First play with no choice of side
  const playFirst = async (domino) => {
    if (!isMyTurn || board.length !== 0) return;
    const entry = buildEntry(domino, 'first', []);
    const newHand = myHand.filter(d => d.id !== domino.id);
    const nextSeat = (mySeat + 1) % 4;
    const players = game.players.map((p, i) => i === mySeat ? { ...p, hand: newHand } : p);
    const log = [`${myPlayer.playerName} played first: [${domino.id}]`, ...(game.activityLog || [])].slice(0, 30);
    const updated = { ...game, board: [entry], players, currentSeat: nextSeat, activityLog: log };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const doDraw = async () => {
    if (!isMyTurn || !game) return;
    const boneyard = [...(game.boneyard || [])];
    if (boneyard.length === 0) { flash('Boneyard is empty — knock instead'); return; }
    const drawn = boneyard.pop();
    const players = game.players.map((p, i) => i === mySeat ? { ...p, hand: [...p.hand, drawn] } : p);
    const log = [`${myPlayer.playerName} drew from boneyard`, ...(game.activityLog || [])].slice(0, 30);
    const updated = { ...game, boneyard, players, activityLog: log };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const doKnock = async () => {
    if (!isMyTurn || !game) return;
    if (hasLegalMove) { flash("You have playable tiles!"); return; }
    const nextSeat = (mySeat + 1) % 4;
    const log = [`${myPlayer.playerName} knocked`, ...(game.activityLog || [])].slice(0, 30);
    const updated = { ...game, currentSeat: nextSeat, activityLog: log };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    flash('You knocked — turn passed', 'info');
  };

  const handleTileClick = (domino) => {
    if (!isMyTurn) return;
    const fits = playableDominoIds.has(domino.id);
    if (!fits) { flash("That tile doesn't fit any open end"); return; }
    if (board.length === 0) {
      // First play — no end choice needed, play immediately
      playFirst(domino);
      return;
    }
    setSelectedDomino(prev => prev?.id === domino.id ? null : domino);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-midnight-void flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-cyber-purple border-t-outlaw-gold rounded-full animate-spin" />
    </div>
  );

  if (!game) return (
    <div className="min-h-screen bg-midnight-void flex items-center justify-center text-center p-6">
      <div>
        <p className="text-white/50 font-body mb-3">Room not found: <span className="text-red-400 font-mono">{roomCode}</span></p>
        <button onClick={() => navigate('/games')} className="px-4 py-2 border border-white/20 text-white/60 font-heading rounded-lg hover:bg-white/10">← Back</button>
      </div>
    </div>
  );

  // ── Join screen ────────────────────────────────────────────────────────────
  if (mySeat === null) {
    const openSeats = game.players?.filter(p => !p.playerId).length || 0;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0d0518,#050505)' }}>
        <div className="max-w-sm w-full text-center">
          <h1 className="text-4xl font-heading text-outlaw-gold tracking-widest mb-2">DOMINOES</h1>
          <p className="text-white/40 font-body text-sm mb-2">Draw Dominoes · 2v2 Partners</p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-white/40 text-sm font-body">Room</span>
            <span className="px-3 py-1 rounded-lg bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple font-mono tracking-widest">{roomCode}</span>
          </div>

          {/* Seat map */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {game.players?.map((p, i) => {
              const team = getTeam(i);
              const color = TEAM_COLORS[team];
              return (
                <div key={i} className="rounded-xl p-2 border text-center" style={{ borderColor: `${color}30`, background: `${color}08` }}>
                  <div style={{ ...PS2, fontSize: 5, color: `${color}60` }}>Seat {i + 1} · {TEAM_NAMES[team]}</div>
                  <div className="text-xs font-body mt-1" style={{ color: p.playerId ? 'white' : 'rgba(255,255,255,0.2)' }}>
                    {p.isAI ? '🤖' : p.playerId ? '👤' : '○'} {p.playerName || 'Open'}
                  </div>
                </div>
              );
            })}
          </div>

          {openSeats === 0
            ? <p className="text-red-400 font-body mb-4">Room is full</p>
            : (
              <div className="border-2 border-cyber-purple/40 rounded-2xl p-5 bg-black/60">
                <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                  placeholder="YOUR NAME" maxLength={20}
                  className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/50 text-white font-body text-xl text-center tracking-wider mb-4 focus:outline-none focus:border-outlaw-gold"
                  onKeyDown={e => e.key === 'Enter' && joinGame()} />
                <button onClick={joinGame} disabled={!nameInput.trim()}
                  className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#BC13FE,#7c3aed)', boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}>
                  SIT DOWN
                </button>
              </div>
            )}
        </div>
      </div>
    );
  }

  // ── Main game view ─────────────────────────────────────────────────────────
  const myTeam = getTeam(mySeat);
  const partnerSeat = (mySeat + 2) % 4;
  const partner = game.players?.[partnerSeat];

  return (
    <div className="min-h-screen flex flex-col text-white" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0d0518,#050505)' }}>
      <Header />

      {/* Top bar */}
      <div className="border-b border-cyber-purple/30 bg-black/60 px-4 py-2">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-heading text-outlaw-gold tracking-widest text-lg">DOMINOES</span>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple font-mono text-xs">{roomCode}</span>
            <span className="text-white/30 text-xs font-body">R{game.roundNumber || 1}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Score pills */}
            {[0, 1].map(t => (
              <span key={t} className="text-xs font-mono font-bold" style={{ color: TEAM_COLORS[t] }}>
                {TEAM_NAMES[t]}: {t === 0 ? (game.teamScores?.teamA || 0) : (game.teamScores?.teamB || 0)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Turn banner */}
      <div className={`border-b px-4 py-1.5 text-center transition-all ${isMyTurn ? 'border-emerald-600/40 bg-emerald-900/20' : 'border-white/5 bg-transparent'}`}>
        <span className={`text-xs font-body ${isMyTurn ? 'text-emerald-400 animate-pulse font-bold' : 'text-white/40'}`}>
          {game.phase === 'waiting'
            ? '⏳ Waiting for host to start…'
            : isMyTurn
              ? hasLegalMove
                ? '⚡ YOUR TURN — tap a tile to select it, then tap where to play'
                : (game.boneyard?.length > 0 ? '⚡ No moves — DRAW a tile' : '⚡ No moves — KNOCK to pass')
              : game.phase === 'playing'
                ? `${currentPlayer?.playerName || '…'} is playing…`
                : game.phase?.replace('_', ' ')}
        </span>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 py-3 gap-3">

        {/* Opponents strip */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {game.players?.filter((_, i) => i !== mySeat).map((p, _, arr) => {
            const seat = game.players.indexOf(p);
            const isTurn = game.currentSeat === seat && game.phase === 'playing';
            const isPartner = seat === partnerSeat;
            const color = TEAM_COLORS[getTeam(seat)];
            return (
              <div key={p.seat} className={`flex-1 min-w-0 rounded-xl px-3 py-2 border transition-all ${isTurn ? 'border-emerald-600/50 bg-emerald-900/20' : isPartner ? `border-[${color}]/30` : 'border-white/10 bg-black/30'}`}
                style={{ borderColor: isTurn ? undefined : `${color}30` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  {isTurn && <span className="text-emerald-400 text-xs">▶</span>}
                  <span className="text-xs font-body font-bold" style={{ color }}>{p.isAI ? '🤖' : '👤'} {p.playerName || `Seat ${seat + 1}`}</span>
                  {isPartner && <span style={{ ...PS2, fontSize: 5, color }} className="ml-1">PARTNER</span>}
                </div>
                <div className="flex gap-0.5 overflow-hidden">
                  {(p.hand || []).slice(0, 12).map(d => (
                    <DominoTile key={d.id} a={d.a} b={d.b} unit={14} faceDown />
                  ))}
                  {(p.hand?.length || 0) > 12 && <span className="text-white/30 text-xs self-end">+{p.hand.length - 12}</span>}
                </div>
                <div className="text-[9px] font-mono text-white/40 mt-1">{p.hand?.length ?? 0} tiles</div>
              </div>
            );
          })}
        </div>

        {/* Board */}
        <div className="relative rounded-3xl overflow-hidden"
          style={{
            flex: '1 1 auto', minHeight: 180,
            background: 'radial-gradient(ellipse at center,rgba(255,140,30,0.5) 0%,rgba(200,80,10,0.4) 50%,rgba(120,40,0,0.55) 100%)',
            border: '4px solid rgba(255,160,50,0.5)',
            boxShadow: 'inset 0 0 60px rgba(255,120,20,0.12)',
          }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
            <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png" alt="" style={{ opacity: 0.1, width: 80 }} />
          </div>
          <div className="absolute inset-0" style={{ zIndex: 1 }}>
            <DominoBoard
              board={board}
              openEnds={openEnds}
              playableEnds={playableEnds}
              onEndClick={isMyTurn && selectedDomino ? playOnEnd : undefined}
              interactive={isMyTurn && !!selectedDomino}
            />
          </div>
          {board.length > 0 && (
            <div className="absolute bottom-2 right-3 z-10 text-[8px] font-mono text-white/40">
              ← {openEnds.left ?? '—'} &nbsp;|&nbsp; {openEnds.right ?? '—'} →
              {openEnds.hasSpinner && ` | ↕ ${openEnds.top ?? '—'}`}
            </div>
          )}
        </div>

        {/* My hand */}
        <div className="rounded-2xl p-3 sm:p-4"
          style={{
            background: 'rgba(12,6,30,0.94)',
            border: `2px solid ${TEAM_COLORS[myTeam]}60`,
            boxShadow: `0 0 20px ${TEAM_COLORS[myTeam]}18`,
          }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ ...PS2, fontSize: 7, color: TEAM_COLORS[myTeam] }}>
              YOUR HAND · {TEAM_NAMES[myTeam]} · {myHand.length} tiles
            </span>
            <span className="text-[9px] font-body text-white/30">Boneyard: {game.boneyard?.length || 0}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: `${TEAM_COLORS[myTeam]}40 transparent` }}>
            {myHand.map(d => {
              const isPlayable = isMyTurn && playableDominoIds.has(d.id);
              const isSelected = selectedDomino?.id === d.id;
              return (
                <div key={d.id} className="flex-shrink-0 transition-all duration-150"
                  style={{ opacity: isMyTurn && !isPlayable ? 0.3 : 1, cursor: isMyTurn ? 'pointer' : 'default' }}
                  onClick={() => handleTileClick(d)}>
                  <DominoTile a={d.a} b={d.b} unit={44} playable={isPlayable} selected={isSelected} />
                </div>
              );
            })}
            {myHand.length === 0 && (
              <div className="text-white/20 font-body text-sm py-4 px-2">
                {game.phase === 'waiting' ? 'Tiles dealt when host starts the game' : 'No tiles'}
              </div>
            )}
          </div>

          {isMyTurn && (
            <div className="flex flex-wrap gap-2 items-center">
              {selectedDomino && (
                <span className="text-xs font-body">
                  {playableEnds.size > 0
                    ? <span className="text-emerald-400">Tap a glowing zone on the board to place [{selectedDomino.id}]</span>
                    : <span className="text-red-400">No open end matches [{selectedDomino.id}]</span>}
                </span>
              )}
              {!hasLegalMove && (game.boneyard?.length || 0) > 0 && (
                <button onClick={doDraw}
                  className="px-4 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white border-2 border-emerald-500 hover:bg-emerald-500/20"
                  style={{ boxShadow: '0 0 10px rgba(16,185,129,0.3)' }}>
                  📦 DRAW
                </button>
              )}
              {!hasLegalMove && (game.boneyard?.length || 0) === 0 && (
                <button onClick={doKnock}
                  className="px-5 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-black font-bold"
                  style={{ background: 'linear-gradient(135deg,#FFD700,#f59e0b)', boxShadow: '0 0 12px rgba(255,215,0,0.4)' }}>
                  🤜 KNOCK
                </button>
              )}
              {selectedDomino && (
                <button onClick={() => setSelectedDomino(null)} className="px-3 py-2 rounded-xl font-heading text-sm uppercase text-white/40 border border-white/15 hover:border-white/30">
                  CANCEL
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl font-body text-sm z-50 pointer-events-none border ${feedback.type === 'error' ? 'bg-red-950 border-red-500 text-red-200' : 'bg-black/90 border-emerald-500/50 text-emerald-300'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Round over */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center" style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-3">ROUND OVER!</h2>
            {game.roundWinner && (
              <p className="font-body text-white/70 mb-4">
                <span style={{ color: TEAM_COLORS[game.roundWinner.team] }} className="font-bold">{TEAM_NAMES[game.roundWinner.team]}</span> wins +{game.roundWinner.points} pts
              </p>
            )}
            <div className="flex gap-6 justify-center mb-4">
              {[0, 1].map(t => (
                <div key={t} className="text-center" style={{ border: myTeam === t ? `1px solid ${TEAM_COLORS[t]}50` : undefined, borderRadius: 10, padding: '8px 16px' }}>
                  <div style={{ ...PS2, fontSize: 7, color: TEAM_COLORS[t] }}>{TEAM_NAMES[t]}{myTeam === t ? ' (You)' : ''}</div>
                  <div className="font-mono text-2xl font-bold mt-1" style={{ color: TEAM_COLORS[t] }}>
                    {t === 0 ? (game.teamScores?.teamA || 0) : (game.teamScores?.teamB || 0)}
                  </div>
                </div>
              ))}
            </div>
            {gameOver
              ? (
                <>
                  <p className="text-2xl font-heading mb-4" style={{ color: TEAM_COLORS[game.teamScores?.teamA >= game.scoreLimit ? 0 : 1] }}>
                    {TEAM_NAMES[game.teamScores?.teamA >= game.scoreLimit ? 0 : 1] === TEAM_NAMES[myTeam] ? '🏆 YOUR TEAM WINS!' : '😔 YOUR TEAM LOST'}
                  </p>
                  <button onClick={() => navigate('/games')} className="w-full py-3 rounded-xl border border-white/30 text-white font-heading hover:bg-white/10">← BACK TO GAMES</button>
                </>
              )
              : <p className="text-white/40 font-body text-sm">Waiting for host to start next round…</p>}
          </div>
        </div>
      )}
    </div>
  );
}