import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDDomino from '@/components/domino/TXDDomino';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  getPlaySide, getPlayableDominoes, playDomino,
  calculateRoundScores, aiChoosePlay, findHighestDoubleStarter,
} from '@/lib/txdDominoEngine';

const HAND_TILE_W = 54;

// Seat layout: seat index → table position class
const SEAT_POS = {
  0: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', // Seat 1 (Host) — bottom
  1: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',   // Seat 2 — left
  2: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',   // Seat 3 — top
  3: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',   // Seat 4 — right
};

function SeatLabel({ player, isTurn, isMe, tileCount, seatIdx }) {
  return (
    <div className={`absolute z-10 ${SEAT_POS[seatIdx]}`}>
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body whitespace-nowrap
        ${isTurn ? 'bg-emerald-900/90 border border-emerald-400 text-emerald-300' : isMe ? 'bg-cyber-purple/80 border border-cyber-purple text-white' : 'bg-black/80 border border-white/20 text-white/70'}`}
        style={{ boxShadow: isTurn ? '0 0 12px rgba(16,185,129,0.5)' : 'none' }}>
        {isTurn && <span className="text-emerald-400">▶</span>}
        {player.isAI && <span>🤖</span>}
        {player.isHost && <span>👑</span>}
        <span className={isMe ? 'text-outlaw-gold font-bold' : ''}>{player.playerName}</span>
        <span className="text-white/40">·</span>
        <span className="font-mono">{tileCount}</span>
        <span className="text-white/30 text-[10px]">tiles</span>
        <span className="text-white/40">·</span>
        <span className="text-emerald-400 font-mono font-bold">{player.score || 0}</span>
      </div>
    </div>
  );
}

export default function TXDGame() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('room')?.toUpperCase();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedDomino, setSelectedDomino] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [shakeTile, setShakeTile] = useState(null);
  const pollRef = useRef(null);

  const myIndex = game?.players?.findIndex(p => p.playerId === playerId) ?? -1;
  const myPlayer = myIndex >= 0 ? game?.players?.[myIndex] : null;
  const isMyTurn = game?.phase === 'playing' && game?.currentPlayerIndex === myIndex;
  const myHand = myPlayer?.hand || [];
  const playable = getPlayableDominoes(myHand, game?.leftEnd ?? null, game?.rightEnd ?? null);
  const playableIds = new Set(playable.map(d => d.id));
  const currentPlayer = game?.players?.[game?.currentPlayerIndex];

  const flash = (msg, type = 'error') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2500);
  };

  const shakeInvalid = (id) => {
    setShakeTile(id);
    setTimeout(() => setShakeTile(null), 500);
  };

  useEffect(() => {
    if (!roomCode) { setLoading(false); return; }
    fetchGame();
    pollRef.current = setInterval(fetchGame, 2000);
    return () => clearInterval(pollRef.current);
  }, [roomCode]);

  const fetchGame = async () => {
    try {
      const rooms = await base44.entities.TXDGame.filter({ room_code: roomCode });
      if (rooms.length > 0) {
        setGame(prev => {
          const fresh = rooms[0];
          if (!prev) return fresh;
          const ft = new Date(fresh.updated_date || 0).getTime();
          const pt = new Date(prev.updated_date || 0).getTime();
          return ft > pt ? fresh : prev;
        });
      }
      setLoading(false);
    } catch (_) { setLoading(false); }
  };

  // AI turns
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const current = game.players?.[game.currentPlayerIndex];
    if (!current?.isAI) return;
    const t = setTimeout(() => runAI(game, current, game.currentPlayerIndex), 1400);
    return () => clearTimeout(t);
  }, [game?.currentPlayerIndex, game?.phase, game?.id]);

  const runAI = async (g, aiPlayer, aiIdx) => {
    const next = (aiIdx + 1) % g.players.length;
    const choice = aiChoosePlay(aiPlayer.hand, g.leftEnd ?? null, g.rightEnd ?? null, g.startingDominoLocked);
    let updated;
    if (!choice) {
      if (g.boneyard?.length > 0) {
        const [drawn, ...boneyard] = g.boneyard;
        const players = g.players.map((p, i) => i === aiIdx ? { ...p, hand: [...p.hand, drawn] } : p);
        updated = { ...g, boneyard, players, currentPlayerIndex: next, lastAction: { type: 'draw', player: aiPlayer.playerName } };
      } else {
        updated = { ...g, currentPlayerIndex: next, lastAction: { type: 'pass', player: aiPlayer.playerName } };
      }
    } else {
      const { domino, side } = choice;
      const isFirstPlay = (g.board?.length || 0) === 0;
      const { newLeftEnd, newRightEnd, isSpinner, newSpinnerActive } = playDomino(
        domino, g.leftEnd ?? null, g.rightEnd ?? null, side, g.spinnerActive || false
      );
      const newHand = aiPlayer.hand.filter(d => d.id !== domino.id);
      const boardEntry = { ...domino, side, isSpinner };
      const newBoard = side === 'left' ? [boardEntry, ...(g.board || [])] : [...(g.board || []), boardEntry];
      const players = g.players.map((p, i) => i === aiIdx ? { ...p, hand: newHand } : p);
      const roundOver = newHand.length === 0;
      const pts = roundOver ? calculateRoundScores(players, aiIdx) : 0;
      if (roundOver) players[aiIdx] = { ...players[aiIdx], score: (players[aiIdx].score || 0) + pts };
      updated = {
        ...g, board: newBoard, leftEnd: newLeftEnd, rightEnd: newRightEnd, players,
        currentPlayerIndex: roundOver ? aiIdx : next,
        phase: roundOver ? 'round_over' : 'playing',
        roundWinner: roundOver ? { playerName: aiPlayer.playerName, playerId: aiPlayer.playerId, points: pts } : null,
        lastAction: { type: 'play', player: aiPlayer.playerName, domino },
        spinnerActive: newSpinnerActive,
        startingDominoLocked: isFirstPlay ? null : g.startingDominoLocked,
      };
    }
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const joinGame = async () => {
    if (!nameInput.trim() || !game) return;
    let user = null; try { user = await base44.auth.me(); } catch (_) {}
    const pid = user?.id || `p_${Date.now()}`;
    if (game.players?.find(p => p.playerId === pid)) { setPlayerId(pid); return; }
    // Seat 1 is always host — players start at seat 2+
    const humanNonHost = game.players?.filter(p => !p.isHost) || [];
    if (humanNonHost.length >= 3) { flash('Room is full (3 player slots)', 'error'); return; }
    const newPlayer = {
      playerId: pid,
      seatNumber: humanNonHost.length + 2, // seat 2, 3, 4
      playerName: nameInput.trim(),
      hand: [], score: 0, roundScore: 0,
      status: 'active', isAI: false, isHost: false,
    };
    const updated = { ...game, players: [...(game.players || []), newPlayer] };
    await base44.entities.TXDGame.update(game.id, updated);
    setPlayerId(pid);
    setGame(updated);
  };

  const doPlay = async (side) => {
    if (!selectedDomino || !isMyTurn || !game) return;
    const g = game;
    const isFirstPlay = (g.board?.length || 0) === 0;
    const actualSide = isFirstPlay ? 'first' : side;

    // Enforce locked starting domino if set
    if (isFirstPlay && g.startingDominoLocked && selectedDomino.id !== g.startingDominoLocked) {
      shakeInvalid(selectedDomino.id);
      flash(`Must start with [${g.startingDominoLocked}]!`, 'error');
      return;
    }

    const fits = actualSide === 'first' || getPlaySide(selectedDomino, g.leftEnd, g.rightEnd) !== null;
    if (!fits) { shakeInvalid(selectedDomino.id); flash("That tile doesn't fit!", 'error'); return; }
    const { newLeftEnd, newRightEnd, isSpinner, newSpinnerActive } = playDomino(
      selectedDomino, g.leftEnd ?? null, g.rightEnd ?? null, actualSide, g.spinnerActive || false
    );
    const newHand = myPlayer.hand.filter(d => d.id !== selectedDomino.id);
    const boardEntry = { ...selectedDomino, side: actualSide, isSpinner };
    const newBoard = actualSide === 'left' ? [boardEntry, ...(g.board || [])] : [...(g.board || []), boardEntry];
    let ni = (myIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== myIndex) ni = (ni + 1) % g.players.length;
    const players = g.players.map((p, i) => i === myIndex ? { ...p, hand: newHand } : p);
    const roundOver = newHand.length === 0;
    const pts = roundOver ? calculateRoundScores(players, myIndex) : 0;
    if (roundOver) players[myIndex] = { ...players[myIndex], score: (players[myIndex].score || 0) + pts };
    const feed = [...(g.activityFeed || [])];
    feed.unshift(`${myPlayer.playerName} played ${selectedDomino.top}-${selectedDomino.bottom}`);
    const updated = {
      ...g, board: newBoard, leftEnd: newLeftEnd, rightEnd: newRightEnd, players,
      currentPlayerIndex: roundOver ? myIndex : ni,
      phase: roundOver ? 'round_over' : 'playing',
      roundWinner: roundOver ? { playerName: myPlayer.playerName, playerId: myPlayer.playerId, points: pts } : null,
      lastAction: { type: 'play', player: myPlayer.playerName, domino: selectedDomino },
      activityFeed: feed.slice(0, 20),
      spinnerActive: newSpinnerActive,
      startingDominoLocked: isFirstPlay ? null : g.startingDominoLocked,
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const doDraw = async () => {
    if (!isMyTurn || !game) return;
    const g = game;
    let ni = (myIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== myIndex) ni = (ni + 1) % g.players.length;
    if (!g.boneyard?.length) {
      const feed = [...(g.activityFeed || [])];
      feed.unshift(`${myPlayer.playerName} passed`);
      const updated = { ...g, currentPlayerIndex: ni, lastAction: { type: 'pass', player: myPlayer.playerName }, activityFeed: feed.slice(0, 20) };
      await base44.entities.TXDGame.update(g.id, updated);
      setGame(updated);
      flash('Boneyard empty — turn passed', 'info');
      return;
    }
    const [drawn, ...boneyard] = g.boneyard;
    const players = g.players.map((p, i) => i === myIndex ? { ...p, hand: [...p.hand, drawn] } : p);
    const feed = [...(g.activityFeed || [])];
    feed.unshift(`${myPlayer.playerName} drew from boneyard`);
    const updated = { ...g, boneyard, players, lastAction: { type: 'draw', player: myPlayer.playerName }, activityFeed: feed.slice(0, 20) };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    flash('Drew a tile!', 'info');
  };

  const doSort = () => {
    if (!game || !myPlayer) return;
    const sorted = [...myHand].sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom));
    const players = game.players.map((p, i) => i === myIndex ? { ...p, hand: sorted } : p);
    setGame({ ...game, players });
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
        <p className="text-white/40 font-body text-lg mb-4">Room not found: <span className="text-red-400 font-mono">{roomCode}</span></p>
        <button onClick={() => navigate('/games')} className="px-5 py-2 border border-white/30 text-white/60 font-heading rounded-lg hover:bg-white/10">← Back</button>
      </div>
    </div>
  );

  // ── Join Screen ────────────────────────────────────────────────────────────
  if (!playerId) {
    const nonHostPlayers = game.players?.filter(p => !p.isHost) || [];
    const isFull = nonHostPlayers.length >= 3;
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d0518, #050505)' }}>
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-heading text-outlaw-gold tracking-widest mb-1" style={{ textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
              TXD DOMINOES
            </h1>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-white/40 font-body text-sm">Room</span>
              <span className="px-3 py-1 rounded-lg bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple font-mono tracking-widest">{roomCode}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              {game.players?.map(p => (
                <span key={p.playerId} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50 text-xs font-body">
                  {p.isHost ? '👑 ' : p.isAI ? '🤖 ' : '👤 '}{p.playerName}
                </span>
              ))}
            </div>
            <p className="text-white/30 text-xs font-body">{nonHostPlayers.length}/3 player seats filled</p>
            <p className="text-white/20 text-[10px] font-body mt-1">Seat 1 is reserved for the Host Panel</p>
          </div>
          <div className="border-2 border-cyber-purple/40 rounded-2xl p-6 bg-black/60"
            style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}>
            {isFull ? (
              <div className="text-center">
                <p className="text-red-400 font-body mb-4">All player seats are full</p>
                <button onClick={() => navigate('/games')} className="w-full py-3 rounded-lg border border-white/30 text-white font-heading tracking-wider hover:bg-white/10">← Back</button>
              </div>
            ) : (
              <>
                <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                  placeholder="ENTER YOUR NAME" maxLength={20}
                  className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/50 text-white font-body text-xl mb-4 text-center tracking-wider focus:outline-none focus:border-outlaw-gold"
                  onKeyDown={e => e.key === 'Enter' && joinGame()}
                />
                <button onClick={joinGame} disabled={!nameInput.trim()}
                  className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase text-white disabled:opacity-40 hover:opacity-90 transition-all"
                  style={{ background: 'linear-gradient(135deg, #BC13FE, #7c3aed)', boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}>
                  SIT DOWN
                </button>
                {game.phase !== 'waiting' && (
                  <p className="text-center text-outlaw-gold/60 text-xs font-body mt-3">Game in progress — you'll play next round</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main Game View ─────────────────────────────────────────────────────────
  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;
  // All 4 possible seats (pad to 4 for layout)
  const allSeats = Array.from({ length: 4 }, (_, i) => game.players?.[i] || null);

  return (
    <div className="min-h-screen text-white flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d0518, #050505)' }}>
      <Header />

      {/* ── Top bar ── */}
      <div className="border-b border-cyber-purple/30 bg-black/60 px-4 py-2">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-heading text-outlaw-gold tracking-widest">TXD: TEXAS DOMINOES</span>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple font-mono text-xs">{roomCode}</span>
            <span className="text-white/30 text-xs font-body">Round {game.roundNumber || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            {isMyTurn && <span className="text-emerald-400 text-xs font-body animate-pulse">⚡ YOUR TURN</span>}
            {!isMyTurn && game.phase === 'playing' && <span className="text-white/40 text-xs font-body">{currentPlayer?.playerName}'s turn</span>}
            <button onClick={() => navigate('/games')} className="px-3 py-1.5 rounded-lg border border-white/20 text-white/40 text-xs font-heading hover:border-white/40">LOBBY ←</button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-2 py-4 gap-4">

        {/* ── Game Table ── */}
        <div className="relative w-full rounded-3xl overflow-visible"
          style={{
            aspectRatio: '4/3',
            background: 'radial-gradient(ellipse at center, rgba(255,140,30,0.55) 0%, rgba(200,80,10,0.45) 50%, rgba(120,40,0,0.6) 100%)',
            backdropFilter: 'blur(12px)',
            border: '4px solid rgba(255,160,50,0.6)',
            boxShadow: 'inset 0 0 60px rgba(255,120,20,0.15), inset 0 0 30px rgba(255,180,60,0.1), 0 10px 40px rgba(255,100,0,0.3), 0 0 80px rgba(255,120,0,0.15)',
            isolation: 'isolate',
          }}>

          {/* Glass sheen overlay */}
          <div className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(255,220,100,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)' }} />

          {/* Center logo watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 1 }}>
            <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png"
              alt="TN" className="object-contain" style={{ opacity: 0.25, width: 120, height: 120 }} />
          </div>

          {/* Seat labels around table */}
          {allSeats.map((p, i) => {
            if (!p) return (
              <div key={i} className={`absolute z-10 ${SEAT_POS[i]}`}>
                <div className="px-3 py-1.5 rounded-full text-xs font-body bg-black/50 border border-white/10 text-white/20 whitespace-nowrap">
                  Seat {i + 1} — Empty
                </div>
              </div>
            );
            const isTurn = game.currentPlayerIndex === i && game.phase === 'playing';
            const isMe = p.playerId === playerId;
            return (
              <SeatLabel key={i} player={p} isTurn={isTurn} isMe={isMe}
                tileCount={p.hand?.length ?? 0} seatIdx={i} />
            );
          })}

          {/* Opponents' face-down tiles inside table */}
          {allSeats.map((p, i) => {
            if (!p || p.playerId === playerId) return null;
            const count = p.hand?.length || 0;
            if (count === 0) return null;
            const posMap = {
              0: 'bottom-6 left-1/2 -translate-x-1/2',
              1: 'left-6 top-1/2 -translate-y-1/2',
              2: 'top-6 left-1/2 -translate-x-1/2',
              3: 'right-6 top-1/2 -translate-y-1/2',
            };
            const isVert = i === 1 || i === 3;
            return (
              <div key={i} className={`absolute ${posMap[i]} z-5 flex ${isVert ? 'flex-col' : 'flex-row'} gap-0.5`}>
                {Array.from({ length: Math.min(count, 10) }).map((_, j) => (
                  <TXDDomino key={j} top={0} bottom={0} width={isVert ? 16 : 14}
                    orientation={isVert ? 'vertical' : 'horizontal'} faceDown />
                ))}
                {count > 10 && <span className="text-white/30 text-[9px] font-body text-center">+{count - 10}</span>}
              </div>
            );
          })}

          {/* Play chain — centered in table */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <TXDBoard board={game.board || []} leftEnd={game.leftEnd} rightEnd={game.rightEnd} />
          </div>

          {/* Boneyard — top-left corner */}
          <div className="absolute left-3 top-3 z-20 flex flex-col items-center gap-0.5">
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: Math.min(game.boneyard?.length || 0, 6) }).map((_, i) => (
                <TXDDomino key={i} top={0} bottom={0} width={16} faceDown />
              ))}
            </div>
            <span className="text-white/50 text-[9px] font-body font-mono mt-0.5">{game.boneyard?.length || 0}</span>
            <span className="text-white/30 text-[8px] font-body">BONEYARD</span>
          </div>

          {/* Open ends display */}
          {game.phase === 'playing' && (game.leftEnd !== null || game.rightEnd !== null) && (
            <div className="absolute bottom-3 right-4 flex items-center gap-2 z-10">
              <span className="text-emerald-400/60 text-[9px] font-body">ENDS:</span>
              <span className="text-emerald-400 font-mono font-bold text-xs">{game.leftEnd ?? '?'}</span>
              <span className="text-white/20 text-xs">↔</span>
              <span className="text-emerald-400 font-mono font-bold text-xs">{game.rightEnd ?? '?'}</span>
            </div>
          )}
        </div>

        {/* ── Player Controls ── */}
        <div className="rounded-2xl p-4"
          style={{
            background: 'rgba(12,6,30,0.94)',
            border: '2px solid rgba(188,19,254,0.55)',
            boxShadow: '0 0 20px rgba(188,19,254,0.2)',
          }}>

          {/* Status */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-body">
              {game.phase === 'waiting'
                ? <span className="text-white/30">⏳ Waiting for host to start…</span>
                : isMyTurn
                ? <span className="text-emerald-400 font-bold tracking-widest animate-pulse">⚡ YOUR TURN — select a tile</span>
                : <span className="text-white/40">{currentPlayer?.playerName || '...'} is playing…</span>}
            </div>
            <span className="text-xs text-white/30 font-mono">{myHand.length} tiles</span>
          </div>

          {/* Hand */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE40 transparent' }}>
            {myHand.map(d => {
              const isPlayable = isMyTurn && playableIds.has(d.id);
              const isSelected = selectedDomino?.id === d.id;
              const isShaking = shakeTile === d.id;
              return (
                <div key={d.id} className={`flex-shrink-0 transition-all duration-150 ${isShaking ? 'animate-shake' : ''}`}
                  style={{ transform: isSelected ? 'translateY(-10px) scale(1.05)' : 'none' }}>
                  <TXDDomino
                    top={d.top} bottom={d.bottom}
                    width={HAND_TILE_W}
                    playable={isPlayable}
                    selected={isSelected}
                    onClick={() => {
                      if (!isMyTurn) return;
                      if (!playableIds.has(d.id)) {
                        shakeInvalid(d.id);
                        flash("That tile doesn't fit!", 'error');
                        return;
                      }
                      setSelectedDomino(prev => prev?.id === d.id ? null : d);
                    }}
                  />
                </div>
              );
            })}
            {myHand.length === 0 && game.phase === 'playing' && (
              <div className="text-white/20 font-body text-sm py-4 px-2">Hand is empty</div>
            )}
            {game.phase === 'waiting' && (
              <div className="text-white/20 font-body text-sm py-4 px-2">Tiles will be dealt when the game starts</div>
            )}
          </div>

          {/* Action buttons */}
          {isMyTurn && (
            <div className="flex flex-wrap gap-2">
              {/* Empty board — enforce locked starter if set */}
              {selectedDomino && game.board?.length === 0 && (
                (!game.startingDominoLocked || selectedDomino.id === game.startingDominoLocked)
                  ? <button onClick={() => doPlay('first')}
                      className="px-5 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 0 12px rgba(22,163,74,0.4)' }}>
                      {selectedDomino.top === selectedDomino.bottom ? `PLAY SPINNER [${selectedDomino.id}]` : `PLAY [${selectedDomino.id}]`}
                    </button>
                  : <span className="text-amber-400/80 text-xs font-body py-2 animate-pulse">⚠ Must start with [{game.startingDominoLocked}]</span>
              )}
              {!selectedDomino && game.board?.length === 0 && (
                <span className="text-white/40 text-xs font-body py-2">
                  {game.startingDominoLocked ? `Select [${game.startingDominoLocked}] to start` : 'Select a tile to start'}
                </span>
              )}
              {/* Board exists */}
              {selectedDomino && (game.board?.length || 0) > 0 && (() => {
                const side = getPlaySide(selectedDomino, game.leftEnd, game.rightEnd);
                if (!side) return <span className="text-red-400 text-xs font-body py-2">Doesn't fit — pick another or draw</span>;
                return (
                  <>
                    {(side === 'left' || side === 'both') && (
                      <button onClick={() => doPlay('left')}
                        className="px-4 py-2 rounded-xl font-heading text-sm tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-600 transition-all">
                        PLAY LEFT ({game.leftEnd})
                      </button>
                    )}
                    {(side === 'right' || side === 'both') && (
                      <button onClick={() => doPlay('right')}
                        className="px-4 py-2 rounded-xl font-heading text-sm tracking-wider uppercase text-white bg-emerald-800 hover:bg-emerald-700 transition-all">
                        PLAY RIGHT ({game.rightEnd})
                      </button>
                    )}
                  </>
                );
              })()}
              {!selectedDomino && (
                <button onClick={doDraw}
                  className="px-5 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                  {(game.boneyard?.length || 0) > 0 ? `DRAW (${game.boneyard.length})` : 'PASS'}
                </button>
              )}
              <button onClick={doSort}
                className="px-4 py-2 rounded-xl font-heading text-sm tracking-wider uppercase text-white/60 border border-white/20 hover:border-white/40 transition-all">
                SORT
              </button>
              {selectedDomino && (
                <button onClick={() => setSelectedDomino(null)}
                  className="px-4 py-2 rounded-xl font-heading text-sm tracking-wider uppercase text-white/50 border border-white/15 hover:border-white/30 transition-all">
                  CANCEL
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl font-body text-sm z-50 pointer-events-none
          ${feedback.type === 'error' ? 'bg-red-950 border border-red-500 text-red-200' : 'bg-black/90 border border-emerald-500/50 text-emerald-300'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Round Over */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && <p className="text-white/70 font-body mb-4 text-sm"><span className="text-white font-bold">{game.roundWinner.playerName}</span> wins +{game.roundWinner.points} pts</p>}
            <div className="space-y-2 mb-5">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className={`flex justify-between items-center px-4 py-2 rounded-lg font-body ${p.playerId === playerId ? 'bg-outlaw-gold/10 border border-outlaw-gold/30' : 'bg-white/5'}`}>
                  <span className="text-sm">{i === 0 ? '🥇 ' : ''}{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs font-body">Waiting for host to start next round…</p>
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameOver && game.phase !== 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center">
            <h2 className="text-4xl font-heading text-outlaw-gold mb-1">GAME OVER!</h2>
            <p className="text-2xl font-heading text-white mb-5">{gameWinner?.playerId === playerId ? '🏆 YOU WIN!' : `🏆 ${gameWinner?.playerName} WINS!`}</p>
            <div className="space-y-2 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className={`flex justify-between font-body px-4 py-2 rounded-lg ${p.playerId === playerId ? 'bg-outlaw-gold/10 border border-outlaw-gold/30' : 'bg-white/5'}`}>
                  <span className="text-sm">{i === 0 ? '👑 ' : ''}{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/games')} className="w-full py-3 rounded-xl border border-white/30 text-white font-heading tracking-wider hover:bg-white/10 transition-all">← BACK TO GAMES</button>
          </div>
        </div>
      )}
    </div>
  );
}