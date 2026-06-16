import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDDomino from '@/components/domino/TXDDomino';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  getPlaySide, getPlayableDominoes, playDomino,
  calculateRoundScores, aiChoosePlay,
} from '@/lib/txdDominoEngine';

const HAND_TILE_W = 60;

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
  const pollRef = useRef(null);

  // Derived
  const myIndex = game?.players?.findIndex(p => p.playerId === playerId) ?? -1;
  const myPlayer = myIndex >= 0 ? game?.players?.[myIndex] : null;
  const isMyTurn = game?.phase === 'playing' && game?.currentPlayerIndex === myIndex;
  const myHand = myPlayer?.hand || [];
  const playable = getPlayableDominoes(myHand, game?.leftEnd ?? null, game?.rightEnd ?? null);
  const playableIds = new Set(playable.map(d => d.id));
  const currentPlayer = game?.players?.[game?.currentPlayerIndex];
  const opponents = game?.players?.filter(p => p.playerId !== playerId) || [];

  const flash = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2500);
  };

  // Load & poll
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

  // AI automation (runs on player side too when AI is current)
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const current = game.players?.[game.currentPlayerIndex];
    if (!current?.isAI) return;
    const t = setTimeout(() => runAI(game, current, game.currentPlayerIndex), 1200);
    return () => clearTimeout(t);
  }, [game?.currentPlayerIndex, game?.phase, game?.id]);

  const runAI = async (g, aiPlayer, aiIdx) => {
    const next = (aiIdx + 1) % g.players.length;
    const choice = aiChoosePlay(aiPlayer.hand, g.leftEnd ?? null, g.rightEnd ?? null);
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
      const { newLeftEnd, newRightEnd } = playDomino(domino, g.leftEnd ?? null, g.rightEnd ?? null, side);
      const newHand = aiPlayer.hand.filter(d => d.id !== domino.id);
      const boardEntry = { ...domino, side };
      const newBoard = side === 'left' ? [boardEntry, ...(g.board || [])] : [...(g.board || []), boardEntry];
      const players = g.players.map((p, i) => i === aiIdx ? { ...p, hand: newHand } : p);
      const roundOver = newHand.length === 0;
      const pts = roundOver ? calculateRoundScores(players, aiIdx) : 0;
      if (roundOver) players[aiIdx] = { ...players[aiIdx], score: (players[aiIdx].score || 0) + pts };
      updated = {
        ...g, board: newBoard, leftEnd: newLeftEnd, rightEnd: newRightEnd, players,
        currentPlayerIndex: roundOver ? aiIdx : next,
        phase: roundOver ? 'round_over' : 'playing',
        roundWinner: roundOver ? { playerName: aiPlayer.playerName, points: pts } : null,
        lastAction: { type: 'play', player: aiPlayer.playerName, domino },
      };
    }
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  // Join
  const joinGame = async () => {
    if (!nameInput.trim() || !game) return;
    let user = null; try { user = await base44.auth.me(); } catch (_) {}
    const pid = user?.id || `p_${Date.now()}`;
    if (game.players?.find(p => p.playerId === pid)) { setPlayerId(pid); return; }
    if ((game.players?.length || 0) >= 4) { flash('Room is full', 'error'); return; }
    const newPlayer = {
      playerId: pid, seatNumber: (game.players?.length || 0) + 1,
      playerName: nameInput.trim(), hand: [], score: 0, roundScore: 0,
      status: 'active', isAI: false, isHost: false,
    };
    const updated = { ...game, players: [...(game.players || []), newPlayer] };
    await base44.entities.TXDGame.update(game.id, updated);
    setPlayerId(pid);
    setGame(updated);
  };

  // Play domino
  const doPlay = async (side) => {
    if (!selectedDomino || !isMyTurn || !game) return;
    const g = game;
    const actualSide = g.board?.length === 0 ? 'first' : side;
    const { newLeftEnd, newRightEnd } = playDomino(selectedDomino, g.leftEnd ?? null, g.rightEnd ?? null, actualSide);
    const newHand = myPlayer.hand.filter(d => d.id !== selectedDomino.id);
    const boardEntry = { ...selectedDomino, side: actualSide };
    const newBoard = actualSide === 'left' ? [boardEntry, ...(g.board || [])] : [...(g.board || []), boardEntry];
    let ni = (myIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== myIndex) ni = (ni + 1) % g.players.length;
    const players = g.players.map((p, i) => i === myIndex ? { ...p, hand: newHand } : p);
    const roundOver = newHand.length === 0;
    const pts = roundOver ? calculateRoundScores(players, myIndex) : 0;
    if (roundOver) players[myIndex] = { ...players[myIndex], score: (players[myIndex].score || 0) + pts };
    const updated = {
      ...g, board: newBoard, leftEnd: newLeftEnd, rightEnd: newRightEnd, players,
      currentPlayerIndex: roundOver ? myIndex : ni,
      phase: roundOver ? 'round_over' : 'playing',
      roundWinner: roundOver ? { playerName: myPlayer.playerName, points: pts } : null,
      lastAction: { type: 'play', player: myPlayer.playerName, domino: selectedDomino },
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  // Draw / Pass
  const doDraw = async () => {
    if (!isMyTurn || !game) return;
    const g = game;
    let ni = (myIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== myIndex) ni = (ni + 1) % g.players.length;
    if (!g.boneyard?.length) {
      const updated = { ...g, currentPlayerIndex: ni, lastAction: { type: 'pass', player: myPlayer.playerName } };
      await base44.entities.TXDGame.update(g.id, updated);
      setGame(updated);
      flash('Boneyard empty — turn passed', 'info');
      return;
    }
    const [drawn, ...boneyard] = g.boneyard;
    const players = g.players.map((p, i) => i === myIndex ? { ...p, hand: [...p.hand, drawn] } : p);
    const updated = { ...g, boneyard, players, lastAction: { type: 'draw', player: myPlayer.playerName } };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    flash('Drew a tile!', 'info');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-midnight-void flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyber-purple border-t-outlaw-gold rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/40 font-body">Connecting to room…</p>
      </div>
    </div>
  );

  if (!game) return (
    <div className="min-h-screen bg-midnight-void flex items-center justify-center text-center p-4">
      <div>
        <p className="text-white/40 font-body text-lg mb-4">Room not found: <span className="text-red-400 font-mono">{roomCode}</span></p>
        <button onClick={() => navigate('/games')} className="px-5 py-2 border border-white/30 text-white/60 font-heading rounded-lg hover:bg-white/10">← Back to Games</button>
      </div>
    </div>
  );

  // ── Join Screen ────────────────────────────────────────────────────────────
  if (!playerId) {
    const playerCount = game.players?.length || 0;
    const isFull = playerCount >= 4;
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center p-4"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d0518 0%, #050505 70%)' }}>
        <div className="max-w-sm w-full">
          {/* Room info */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-heading text-outlaw-gold tracking-widest mb-1" style={{ textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
              TXD DOMINOES
            </h1>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-white/40 font-body text-sm">Room</span>
              <span className="px-3 py-1 rounded-lg bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple font-mono tracking-widest text-sm">{roomCode}</span>
            </div>
            {/* Current players in room */}
            {playerCount > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-2">
                {game.players.map(p => (
                  <span key={p.playerId} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50 text-xs font-body">
                    {p.isAI ? '🤖 ' : '👤 '}{p.playerName}
                  </span>
                ))}
              </div>
            )}
            <p className="text-white/30 text-xs font-body">{playerCount}/4 players</p>
          </div>

          {/* Join form */}
          <div className="border-2 border-cyber-purple/40 rounded-2xl p-6 bg-black/60"
            style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}>
            {isFull ? (
              <div className="text-center">
                <p className="text-red-400 font-body mb-4">This room is full (4/4 players)</p>
                <button onClick={() => navigate('/games')} className="w-full py-3 rounded-lg border border-white/30 text-white font-heading tracking-wider hover:bg-white/10">
                  ← BACK TO GAMES
                </button>
              </div>
            ) : game.phase !== 'waiting' ? (
              <div className="text-center">
                <p className="text-outlaw-gold/80 font-body mb-2 text-sm">Game already in progress</p>
                <p className="text-white/40 font-body text-xs mb-4">You can still join and play next round</p>
                <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                  placeholder="YOUR NAME" maxLength={20}
                  className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/50 text-white font-body text-lg mb-3 focus:outline-none focus:border-outlaw-gold"
                  onKeyDown={e => e.key === 'Enter' && joinGame()}
                />
                <button onClick={joinGame} disabled={!nameInput.trim()}
                  className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase bg-gradient-to-r from-cyber-purple to-purple-800 text-white disabled:opacity-40 hover:opacity-90 transition-all">
                  JOIN ANYWAY
                </button>
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
                  JOIN GAME
                </button>
              </>
            )}
          </div>
          {feedback && <p className="mt-3 text-center text-red-400 text-sm font-body">{feedback.msg}</p>}
        </div>
      </div>
    );
  }

  // ── Main Game View ─────────────────────────────────────────────────────────
  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;

  return (
    <div className="min-h-screen bg-midnight-void text-white flex flex-col select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d0518 0%, #050505 60%)' }}>
      <Header />

      {/* ── Top status bar ── */}
      <div className="border-b border-cyber-purple/30 bg-black/60 px-4 py-2">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-heading text-outlaw-gold tracking-widest">TXD</span>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple font-mono text-xs">{roomCode}</span>
            <span className="text-white/30 text-xs font-body">Round {game.roundNumber || 1}</span>
          </div>
          {/* Player score pills */}
          <div className="flex flex-wrap gap-2">
            {game.players?.map((p, i) => {
              const isTurn = game.currentPlayerIndex === i && game.phase === 'playing';
              const isMe = p.playerId === playerId;
              return (
                <div key={p.playerId}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body transition-all
                    ${isTurn ? 'bg-emerald-900/50 border border-emerald-500/60 text-white' : isMe ? 'bg-cyber-purple/20 border border-cyber-purple/40 text-white' : 'bg-white/5 border border-white/10 text-white/50'}`}>
                  {isTurn && <span className="text-emerald-400">▶</span>}
                  {p.isAI && <span>🤖</span>}
                  <span className={isMe ? 'text-outlaw-gold font-bold' : ''}>{p.playerName}</span>
                  <span className={`font-mono font-bold ${isMe ? 'text-outlaw-gold' : 'text-emerald-400'}`}>{p.score || 0}</span>
                  <span className="text-white/30">({p.hand?.length ?? 0})</span>
                </div>
              );
            })}
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-white/30 font-body">
            <span>Boneyard: <span className="text-white/50 font-mono">{game.boneyard?.length || 0}</span></span>
            <span>Ends: <span className="font-mono">{game.leftEnd ?? '?'}</span> — <span className="font-mono">{game.rightEnd ?? '?'}</span></span>
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="border-b border-cyber-purple/20 bg-black/30 relative" style={{ minHeight: 130, maxHeight: 190 }}>
        <TXDBoard board={game.board || []} leftEnd={game.leftEnd} rightEnd={game.rightEnd} />
        {game.board?.length === 0 && game.phase !== 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 font-body text-sm pointer-events-none">
            No tiles played yet — first player starts
          </div>
        )}
        {game.lastAction && (
          <span className="absolute bottom-1 right-3 text-[10px] text-white/25 font-body italic pointer-events-none">
            {game.lastAction.player} {game.lastAction.type === 'play' ? 'played' : game.lastAction.type === 'draw' ? 'drew' : 'passed'}
          </span>
        )}
      </div>

      {/* ── Opponents' hands (face-down) ── */}
      {opponents.length > 0 && (
        <div className="border-b border-cyber-purple/10 bg-black/20 px-4 py-2">
          <div className="flex flex-wrap gap-5 justify-center">
            {opponents.map(p => {
              const idx = game.players.indexOf(p);
              const isTurn = game.currentPlayerIndex === idx && game.phase === 'playing';
              return (
                <div key={p.playerId}
                  className={`flex flex-col items-center gap-1 transition-all ${isTurn ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`text-[10px] font-body tracking-widest flex items-center gap-1
                    ${isTurn ? 'text-emerald-400' : 'text-white/40'}`}>
                    {isTurn && <span>▶</span>}
                    {p.isAI && <span>🤖</span>}
                    <span>{p.playerName}</span>
                    <span className="text-white/30">({p.hand?.length || 0})</span>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(p.hand?.length || 0, 16) }).map((_, j) => (
                      <TXDDomino key={j} top={0} bottom={0} width={12} faceDown />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Turn indicator ── */}
      <div className={`px-4 py-2 text-center text-sm font-body transition-all
        ${isMyTurn ? 'bg-emerald-900/20 border-b border-emerald-700/30' : 'border-b border-white/5'}`}>
        {game.phase === 'waiting'
          ? <span className="text-white/30 tracking-wider">⏳ Waiting for the host to start the game…</span>
          : isMyTurn
          ? <span className="text-emerald-400 font-bold tracking-widest animate-pulse">⚡ YOUR TURN — Select a tile to play</span>
          : currentPlayer
          ? <span className="text-white/40">{currentPlayer.isAI ? '🤖 ' : ''}<span className="text-white/70">{currentPlayer.playerName}</span> is thinking…</span>
          : null}
      </div>

      {/* ── My Hand ── */}
      <div className="flex-1 px-4 py-5 bg-black/30">
        {/* Hand label */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-outlaw-gold font-heading text-sm tracking-widest uppercase">YOUR HAND</span>
            <span className="text-white/30 text-xs font-body font-mono">({myHand.length} tiles)</span>
          </div>
          {isMyTurn && playable.length === 0 && (
            <span className="text-kinetic-orange text-xs font-body">No playable tiles — draw or pass</span>
          )}
        </div>

        {/* Tiles */}
        <div className="flex flex-wrap gap-3 justify-center mb-6 min-h-[80px]">
          {myHand.map(d => (
            <TXDDomino
              key={d.id}
              top={d.top} bottom={d.bottom}
              width={HAND_TILE_W}
              playable={isMyTurn && playableIds.has(d.id)}
              selected={selectedDomino?.id === d.id}
              onClick={() => {
                if (!isMyTurn) return;
                if (!playableIds.has(d.id)) { flash("That tile doesn't fit right now", 'error'); return; }
                setSelectedDomino(prev => prev?.id === d.id ? null : d);
              }}
            />
          ))}
          {myHand.length === 0 && game.phase === 'playing' && (
            <div className="flex items-center justify-center w-full text-white/20 font-body text-sm py-4">
              Your hand is empty
            </div>
          )}
          {game.phase === 'waiting' && myHand.length === 0 && (
            <div className="flex items-center justify-center w-full text-white/20 font-body text-sm py-4">
              Tiles will be dealt when the host starts the game
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isMyTurn && (
          <div className="flex flex-wrap gap-3 justify-center">
            {/* First tile on empty board */}
            {selectedDomino && game.board?.length === 0 && (
              <button onClick={() => doPlay('first')}
                className="px-8 py-3 rounded-xl font-heading text-base tracking-widest uppercase text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 0 15px rgba(22,163,74,0.4)' }}>
                PLAY TILE
              </button>
            )}
            {/* Board exists */}
            {selectedDomino && (game.board?.length || 0) > 0 && (() => {
              const side = getPlaySide(selectedDomino, game.leftEnd, game.rightEnd);
              if (!side) return (
                <span className="text-red-400 text-sm font-body py-2">
                  This tile doesn't fit either end — pick another or draw
                </span>
              );
              if (side === 'both') return (
                <>
                  <button onClick={() => doPlay('left')}
                    className="px-6 py-3 rounded-xl font-heading text-sm tracking-widest uppercase text-white bg-emerald-700 hover:bg-emerald-600 transition-all">
                    PLAY LEFT ({game.leftEnd})
                  </button>
                  <button onClick={() => doPlay('right')}
                    className="px-6 py-3 rounded-xl font-heading text-sm tracking-widest uppercase text-white bg-emerald-800 hover:bg-emerald-700 transition-all">
                    PLAY RIGHT ({game.rightEnd})
                  </button>
                </>
              );
              return (
                <button onClick={() => doPlay(side)}
                  className="px-8 py-3 rounded-xl font-heading text-base tracking-widest uppercase text-white bg-emerald-700 hover:bg-emerald-600 transition-all"
                  style={{ boxShadow: '0 0 12px rgba(22,163,74,0.4)' }}>
                  PLAY {side.toUpperCase()} END ({side === 'left' ? game.leftEnd : game.rightEnd})
                </button>
              );
            })()}
            {/* No tile selected — draw/pass */}
            {!selectedDomino && (
              <button onClick={doDraw}
                className="px-8 py-3 rounded-xl font-heading text-base tracking-widest uppercase text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 0 12px rgba(124,58,237,0.4)' }}>
                {(game.boneyard?.length || 0) > 0 ? `DRAW FROM BONEYARD (${game.boneyard.length})` : 'PASS TURN'}
              </button>
            )}
            {selectedDomino && (
              <button onClick={() => setSelectedDomino(null)}
                className="px-5 py-3 rounded-xl border border-white/20 text-white/50 font-heading text-sm hover:border-white/40 hover:text-white/70 transition-all">
                CANCEL
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl font-body text-sm z-50 pointer-events-none shadow-lg
          ${feedback.type === 'error' ? 'bg-red-950 border border-red-500 text-red-200' : 'bg-black/90 border border-cyber-purple/50 text-white'}`}>
          {feedback.msg}
        </div>
      )}

      {/* ── Round Over Modal ── */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && (
              <p className="text-white/70 font-body mb-5 text-sm">
                <span className="text-white font-bold">{game.roundWinner.playerName}</span> wins this round +{game.roundWinner.points} pts
              </p>
            )}
            <div className="space-y-2 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId}
                  className={`flex justify-between items-center px-4 py-2 rounded-lg font-body
                    ${p.playerId === playerId ? 'bg-outlaw-gold/10 border border-outlaw-gold/30' : 'bg-white/5'}`}>
                  <span className="text-sm">{i === 0 ? '🥇 ' : ''}{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
                </div>
              ))}
            </div>
            <p className="text-white/30 text-sm font-body">Waiting for host to start next round…</p>
          </div>
        </div>
      )}

      {/* ── Game Over Modal ── */}
      {gameOver && game.phase !== 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center">
            <h2 className="text-4xl font-heading text-outlaw-gold mb-1">GAME OVER!</h2>
            <p className="text-2xl font-heading text-white mb-5">
              {gameWinner?.playerId === playerId ? '🏆 YOU WIN!' : `🏆 ${gameWinner?.playerName} WINS!`}
            </p>
            <div className="space-y-2 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId}
                  className={`flex justify-between font-body px-4 py-2 rounded-lg
                    ${p.playerId === playerId ? 'bg-outlaw-gold/10 border border-outlaw-gold/30' : 'bg-white/5'}`}>
                  <span className="text-sm">{i === 0 ? '👑 ' : ''}{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/games')}
              className="w-full py-3 rounded-xl border border-white/30 text-white font-heading tracking-wider hover:bg-white/10 transition-all">
              ← BACK TO GAMES
            </button>
          </div>
        </div>
      )}
    </div>
  );
}