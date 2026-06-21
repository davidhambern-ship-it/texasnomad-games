import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Header from '@/components/home/Header';
import DominoBoard from '@/components/domino/DominoBoard';
import DominoTile from '@/components/domino/DominoTile';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import {
  getTeam, getLegalMoves, getPlayableEnds, buildEntry,
  getOpenEnds, calcRoundPoints, calcEndScore, pipCount, isBlocked,
} from '@/lib/dominoEngine';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const TEAM_COLORS = ['#BC13FE', '#FF5F1F'];
const TEAM_NAMES  = ['Team A', 'Team B'];

// Seat 0 = bottom, 1 = left, 2 = top, 3 = right (relative to the current player)
// We rotate this so MY seat is always at the bottom
function getRelativePosition(mySeat, targetSeat) {
  const offset = (targetSeat - mySeat + 4) % 4;
  return ['bottom', 'left', 'top', 'right'][offset];
}

function OpponentSeat({ player, seat, isTurn, position }) {
  const team = getTeam(seat);
  const color = TEAM_COLORS[team];
  const char = TEXASNOMAD_CHARACTERS.find(c => c.id === player?.aiCharacterId);

  const posClass = {
    top:   'absolute top-2 left-1/2 -translate-x-1/2',
    left:  'absolute left-2 top-1/2 -translate-y-1/2',
    right: 'absolute right-2 top-1/2 -translate-y-1/2',
  }[position] || '';

  const isHoriz = position === 'left' || position === 'right';

  return (
    <div className={posClass}>
      <div className={`flex ${isHoriz ? 'flex-col' : 'flex-row'} items-center gap-1.5 px-2 py-1.5 rounded-xl border transition-all`}
        style={{
          borderColor: isTurn ? '#4ade80' : `${color}40`,
          background: isTurn ? 'rgba(74,222,128,0.1)' : `${color}08`,
          boxShadow: isTurn ? '0 0 12px rgba(74,222,128,0.3)' : 'none',
        }}>
        {char ? (
          <img src={char.avatar} alt={char.name} style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${color}`, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${color}40`, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 14 }}>{player?.playerId ? '👤' : '○'}</span>
          </div>
        )}
        <div>
          <div className="text-[10px] font-body font-bold truncate max-w-[90px]" style={{ color: player?.playerId ? 'white' : 'rgba(255,255,255,0.25)' }}>
            {player?.playerName || `Seat ${seat + 1}`}
          </div>
          <div style={{ ...PS2, fontSize: 5, color }}>{TEAM_NAMES[team]}</div>
          <div className="text-[9px] font-mono" style={{ color: isTurn ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
            {isTurn && <span className="animate-pulse">▶ </span>}{player?.hand?.length ?? 0} tiles
          </div>
          {/* Face-down tile strip */}
          <div className="flex gap-0.5 mt-1 overflow-hidden max-w-[100px]">
            {(player?.hand || []).slice(0, 5).map((_, ti) => (
              <DominoTile key={ti} a={0} b={0} unit={10} vertical faceDown />
            ))}
            {(player?.hand?.length || 0) > 5 && <span className="text-white/30 text-[9px] self-end">+{player.hand.length - 5}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const myTeam = mySeat !== null ? getTeam(mySeat) : 0;

  const flash = (msg, type = 'error') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2800);
  };

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

  // Rejoin
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
    // Find first empty non-host seat (host takes seat 0, players take 1-3)
    const emptySeat = game.players?.slice(1).findIndex(p => !p.playerId);
    const actualSeat = emptySeat >= 0 ? emptySeat + 1 : -1;
    if (actualSeat < 0) { flash('Room is full'); return; }
    const pid = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const players = game.players.map((p, i) => i === actualSeat
      ? { ...p, playerId: pid, playerName: nameInput.trim(), isAI: false, connected: true }
      : p);
    const updated = { ...game, players };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    setMySeat(actualSeat);
    localStorage.setItem(`dom_seat_${roomCode}`, actualSeat);
    localStorage.setItem(`dom_pid_${roomCode}`, pid);
  };

  const playOnEnd = async (side) => {
    if (!isMyTurn || !selectedDomino || !game) return;
    const domino = myHand.find(d => d.id === selectedDomino.id);
    if (!domino) return;
    const ends = getPlayableEnds(domino, board);
    if (!ends.includes(side)) { flash("That tile doesn't fit there"); return; }

    // Re-fetch latest state to avoid stale score overwrites
    const rows = await base44.entities.DominoGame.filter({ room_code: game.room_code });
    const fresh = rows[0];
    if (!fresh || fresh.currentSeat !== mySeat || fresh.phase !== 'playing') return;

    const freshBoard = fresh.board || [];
    const entry = buildEntry(domino, side, freshBoard);
    const newBoard = [...freshBoard, entry];
    const newHand  = fresh.players[mySeat].hand.filter(d => d.id !== domino.id);
    const nextSeat = (mySeat + 1) % 4;
    let players = fresh.players.map((p, i) => i === mySeat ? { ...p, hand: newHand } : p);
    let updated;

    const endPts = calcEndScore(newBoard);
    const playTeam = getTeam(mySeat);
    const baseScores = {
      teamA: (fresh.teamScores?.teamA || 0) + (playTeam === 0 ? endPts : 0),
      teamB: (fresh.teamScores?.teamB || 0) + (playTeam === 1 ? endPts : 0),
    };

    if (newHand.length === 0) {
      const pts = calcRoundPoints(players, mySeat);
      const winTeam = getTeam(mySeat);
      const teamScores = { teamA: baseScores.teamA + (winTeam === 0 ? pts : 0), teamB: baseScores.teamB + (winTeam === 1 ? pts : 0) };
      updated = { ...fresh, board: newBoard, players, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts, playerName: fresh.players[mySeat].playerName, winnerSeat: mySeat } };
    } else {
      updated = { ...fresh, board: newBoard, players, currentSeat: nextSeat, teamScores: baseScores };
    }

    await base44.entities.DominoGame.update(fresh.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const playFirst = async (domino) => {
    if (!isMyTurn || board.length !== 0) return;
    // Re-fetch to get latest scores before writing
    const rows = await base44.entities.DominoGame.filter({ room_code: game.room_code });
    const fresh = rows[0];
    if (!fresh || fresh.currentSeat !== mySeat || fresh.phase !== 'playing') return;
    const entry = buildEntry(domino, 'first', []);
    const newBoard = [entry];
    const newHand = fresh.players[mySeat].hand.filter(d => d.id !== domino.id);
    const nextSeat = (mySeat + 1) % 4;
    const players = fresh.players.map((p, i) => i === mySeat ? { ...p, hand: newHand } : p);
    const endPts = calcEndScore(newBoard);
    const playTeam = getTeam(mySeat);
    const teamScores = {
      teamA: (fresh.teamScores?.teamA || 0) + (playTeam === 0 ? endPts : 0),
      teamB: (fresh.teamScores?.teamB || 0) + (playTeam === 1 ? endPts : 0),
    };
    const updated = { ...fresh, board: newBoard, players, currentSeat: nextSeat, teamScores };
    await base44.entities.DominoGame.update(fresh.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const doDraw = async () => {
    if (!isMyTurn || !game) return;
    const boneyard = [...(game.boneyard || [])];
    if (boneyard.length === 0) { flash('Boneyard is empty — knock instead'); return; }
    const drawn = boneyard.pop();
    const players = game.players.map((p, i) => i === mySeat ? { ...p, hand: [...p.hand, drawn] } : p);
    const updated = { ...game, boneyard, players };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const doKnock = async () => {
    if (!isMyTurn || !game) return;
    if (hasLegalMove) { flash("You have playable tiles!"); return; }
    const nextSeat = (mySeat + 1) % 4;
    const updated = { ...game, currentSeat: nextSeat };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    flash('You knocked — turn passed', 'info');
  };

  const handleTileClick = (domino) => {
    if (!isMyTurn) return;
    if (!playableDominoIds.has(domino.id)) { flash("That tile doesn't fit any open end"); return; }
    if (board.length === 0) { playFirst(domino); return; }
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
    const openSeats = game.players?.slice(1).filter(p => !p.playerId).length || 0;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0d0518,#050505)' }}>
        <div className="max-w-sm w-full text-center">
          <h1 className="text-4xl font-heading text-outlaw-gold tracking-widest mb-2">DOMINOES</h1>
          <p className="text-white/40 font-body text-sm mb-2">Draw Dominoes · 2v2 Partners</p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-white/40 text-sm font-body">Room</span>
            <span className="px-3 py-1 rounded-lg bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple font-mono tracking-widest">{roomCode}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {game.players?.map((p, i) => {
              const team = getTeam(i);
              const color = TEAM_COLORS[team];
              const char = TEXASNOMAD_CHARACTERS.find(c => c.id === p?.aiCharacterId);
              return (
                <div key={i} className="rounded-xl p-2 border text-center" style={{ borderColor: `${color}30`, background: `${color}08` }}>
                  <div style={{ ...PS2, fontSize: 5, color: `${color}60` }}>Seat {i + 1}{i === 0 ? ' · HOST' : ''} · {TEAM_NAMES[team]}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {char && <img src={char.avatar} alt={char.name} style={{ width: 20, height: 20, borderRadius: '50%' }} />}
                    <span className="text-xs font-body" style={{ color: p.playerId ? 'white' : 'rgba(255,255,255,0.2)' }}>
                      {p.isAI ? '🤖' : p.playerId ? '👤' : '○'} {p.playerName || 'Open'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {openSeats === 0
            ? <p className="text-red-400 font-body mb-4">No seats available</p>
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
  return (
    <div className="min-h-screen flex flex-col text-white" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0d0518,#050505)' }}>
      <Header />

      {/* Top bar */}
      <div className="border-b border-cyber-purple/30 bg-black/60 px-4 py-2">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-heading text-outlaw-gold tracking-widest">DOMINOES</span>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple font-mono text-xs">{roomCode}</span>
            <span className="text-white/30 text-xs font-body">R{game.roundNumber || 1}</span>
          </div>
          <div className="flex items-center gap-3">
            {[0, 1].map(t => (
              <span key={t} className="text-xs font-mono font-bold" style={{ color: TEAM_COLORS[t] }}>
                {TEAM_NAMES[t]}: {t === 0 ? (game.teamScores?.teamA || 0) : (game.teamScores?.teamB || 0)}
              </span>
            ))}
            {board.length > 0 && (() => {
              const total = (openEnds.left ?? 0) + (openEnds.right ?? 0) + (openEnds.top ?? 0) + (openEnds.bottom ?? 0);
              const pts = calcEndScore(board);
              return (
                <span className="text-xs font-mono px-2 py-0.5 rounded border" style={{ borderColor: pts > 0 ? '#FFD70060' : 'rgba(255,255,255,0.1)', color: pts > 0 ? '#FFD700' : 'rgba(255,255,255,0.3)' }}>
                  Board: {total}{pts > 0 && <span className="text-emerald-400 ml-1">✓</span>}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Turn banner */}
      <div className={`border-b px-4 py-1.5 text-center ${isMyTurn ? 'border-emerald-600/40 bg-emerald-900/20' : 'border-white/5'}`}>
        <span className={`text-xs font-body ${isMyTurn ? 'text-emerald-400 font-bold animate-pulse' : 'text-white/40'}`}>
          {game.phase === 'waiting' ? '⏳ Waiting for host to start…'
            : isMyTurn ? (hasLegalMove ? '⚡ YOUR TURN — tap a tile, then tap the board end' : (game.boneyard?.length > 0 ? '⚡ No moves — DRAW a tile' : '⚡ No moves — KNOCK to pass'))
            : game.phase === 'playing' ? `${currentPlayer?.playerName || '…'} is playing…`
            : game.phase?.replace('_', ' ')}
        </span>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 py-3 gap-3">

        {/* Table */}
        <div className="relative rounded-3xl overflow-hidden flex-1"
          style={{
            minHeight: 300, aspectRatio: '4/3',
            background: 'radial-gradient(ellipse at center,rgba(255,140,30,0.5) 0%,rgba(200,80,10,0.4) 50%,rgba(120,40,0,0.55) 100%)',
            border: '4px solid rgba(255,160,50,0.5)',
            boxShadow: 'inset 0 0 60px rgba(255,120,20,0.12)',
          }}>

          {/* Board in center */}
          <div className="absolute inset-20 sm:inset-24" style={{ zIndex: 1 }}>
            <DominoBoard
              board={board}
              openEnds={openEnds}
              playableEnds={playableEnds}
              onEndClick={isMyTurn && selectedDomino ? playOnEnd : undefined}
              interactive={isMyTurn && !!selectedDomino}
            />
          </div>

          {/* Opponent seats (all seats except mine) */}
          {game.players?.map((p, seat) => {
            if (seat === mySeat) return null;
            const pos = getRelativePosition(mySeat, seat);
            return (
              <OpponentSeat
                key={seat}
                player={p}
                seat={seat}
                isTurn={game.currentSeat === seat && game.phase === 'playing'}
                position={pos}
              />
            );
          })}

          {/* My seat label at bottom */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <div className="px-3 py-1 rounded-lg border text-xs font-body font-bold"
              style={{ borderColor: `${TEAM_COLORS[myTeam]}50`, background: `${TEAM_COLORS[myTeam]}15`, color: TEAM_COLORS[myTeam] }}>
              {myPlayer?.playerName} · {TEAM_NAMES[myTeam]}
              {isMyTurn && <span className="text-emerald-400 animate-pulse ml-2">▶ YOUR TURN</span>}
            </div>
          </div>
        </div>

        {/* My hand */}
        <div className="rounded-2xl p-3"
          style={{ background: 'rgba(12,6,30,0.94)', border: `2px solid ${TEAM_COLORS[myTeam]}60` }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ ...PS2, fontSize: 6, color: TEAM_COLORS[myTeam] }}>YOUR HAND · {myHand.length} tiles</span>
            <span className="text-[9px] font-body text-white/30">Boneyard: {game.boneyard?.length || 0}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'thin' }}>
            {myHand.map(d => {
              const isPlayable = isMyTurn && playableDominoIds.has(d.id);
              const isSelected = selectedDomino?.id === d.id;
              return (
                <div key={d.id} className="flex-shrink-0"
                  style={{ opacity: isMyTurn && !isPlayable ? 0.3 : 1, cursor: isMyTurn ? 'pointer' : 'default' }}
                  onClick={() => handleTileClick(d)}>
                  <DominoTile a={d.a} b={d.b} unit={40} vertical playable={isPlayable} selected={isSelected} />
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
                    ? <span className="text-emerald-400">Tap a glowing zone on the board ↑</span>
                    : <span className="text-red-400">Tile [{selectedDomino.id}] has no matching end</span>}
                </span>
              )}
              {!hasLegalMove && (game.boneyard?.length || 0) > 0 && (
                <button onClick={doDraw} className="px-4 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white border-2 border-emerald-500 hover:bg-emerald-500/20">
                  📦 DRAW
                </button>
              )}
              {!hasLegalMove && (game.boneyard?.length || 0) === 0 && (
                <button onClick={doKnock} className="px-5 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-black font-bold"
                  style={{ background: 'linear-gradient(135deg,#FFD700,#f59e0b)' }}>
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
                <div key={t} className="text-center p-3 rounded-xl" style={{ border: myTeam === t ? `1px solid ${TEAM_COLORS[t]}50` : undefined }}>
                  <div style={{ ...PS2, fontSize: 7, color: TEAM_COLORS[t] }}>{TEAM_NAMES[t]}{myTeam === t ? ' (You)' : ''}</div>
                  <div className="font-mono text-2xl font-bold mt-1" style={{ color: TEAM_COLORS[t] }}>
                    {t === 0 ? (game.teamScores?.teamA || 0) : (game.teamScores?.teamB || 0)}
                  </div>
                </div>
              ))}
            </div>
            {gameOver ? (
              <>
                <p className="text-2xl font-heading mb-4" style={{ color: TEAM_COLORS[game.teamScores?.teamA >= game.scoreLimit ? 0 : 1] }}>
                  {TEAM_NAMES[game.teamScores?.teamA >= game.scoreLimit ? 0 : 1] === TEAM_NAMES[myTeam] ? '🏆 YOUR TEAM WINS!' : '😔 YOUR TEAM LOST'}
                </p>
                <button onClick={() => navigate('/games')} className="w-full py-3 rounded-xl border border-white/30 text-white font-heading hover:bg-white/10">← BACK TO GAMES</button>
              </>
            ) : (
              <p className="text-white/40 font-body text-sm">Waiting for host to start next round…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}