import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDDomino from '@/components/domino/TXDDomino';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  DOMINO_SET, deal, findHighestDoubleStarter,
  playDomino, calculateRoundScores, aiChoosePlay,
  getLegalMoves, getPlayableEnds, drawFromBoneyard,
} from '@/lib/txdDominoEngine';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function gameStateFromGame(g) {
  return {
    leftEnd:       g.leftEnd       ?? null,
    rightEnd:      g.rightEnd      ?? null,
    topEnd:        g.topEnd        ?? null,
    bottomEnd:     g.bottomEnd     ?? null,
    spinnerPlayed: g.spinnerPlayed ?? false,
  };
}

export default function TXDGame() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('room')?.toUpperCase();

  const [game, setGame]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [playerId, setPlayerId]     = useState(null);
  const [nameInput, setNameInput]   = useState('');
  const [selectedDomino, setSelectedDomino] = useState(null);
  const [feedback, setFeedback]     = useState(null);
  const [orientPicker, setOrientPicker] = useState(null);
  const pollRef = useRef(null);

  const myIndex   = game?.players?.findIndex(p => p.playerId === playerId) ?? -1;
  const myPlayer  = myIndex >= 0 ? game?.players?.[myIndex] : null;
  const isMyTurn  = game?.phase === 'playing' && game?.currentPlayerIndex === myIndex;
  const myHand    = myPlayer?.hand || [];
  const gs        = game ? gameStateFromGame(game) : { leftEnd: null, rightEnd: null, topEnd: null, bottomEnd: null, spinnerPlayed: false };
  const legalMoves       = isMyTurn ? getLegalMoves(myHand, gs) : [];
  const playableDominoIds = new Set(legalMoves.map(m => m.domino.id));
  const hasLegalMove     = legalMoves.length > 0;
  const currentPlayer    = game?.players?.[game?.currentPlayerIndex];
  const playableEnds     = selectedDomino ? new Set(getPlayableEnds(selectedDomino, gs)) : new Set();

  const flash = (msg, type = 'error') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2800);
  };

  // Poll
  useEffect(() => {
    if (!roomCode) { setLoading(false); return; }
    fetchGame();
    pollRef.current = setInterval(fetchGame, 2000);
    return () => clearInterval(pollRef.current);
  }, [roomCode]);

  const fetchGame = async () => {
    try {
      const rows = await base44.entities.TXDGame.filter({ room_code: roomCode });
      if (rows.length > 0) setGame(rows[0]);
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
  }, [game?.currentPlayerIndex, game?.phase, game?.board?.length]);

  const runAI = async (g, aiPlayer, aiIdx) => {
    const gs = gameStateFromGame(g);
    const next = (aiIdx + 1) % g.players.length;
    const choice = aiChoosePlay(aiPlayer.hand, gs, g.startingDominoLocked);
    let updated;
    if (!choice) {
      if ((g.boneyard || []).length > 0) {
        const { drawn, newBoneyard } = drawFromBoneyard(g.boneyard);
        const players = g.players.map((p, i) => i === aiIdx ? { ...p, hand: [...p.hand, drawn] } : p);
        const feed = [...(g.activityFeed || [])]; feed.unshift(`🤖 ${aiPlayer.playerName} drew`);
        updated = { ...g, boneyard: newBoneyard, players, activityFeed: feed.slice(0, 20) };
      } else {
        const feed = [...(g.activityFeed || [])]; feed.unshift(`🤖 ${aiPlayer.playerName} knocked`);
        updated = { ...g, currentPlayerIndex: next, activityFeed: feed.slice(0, 20) };
      }
    } else {
      const { domino, side } = choice;
      const result = playDomino(domino, gs, side);
      const { entry, newLeftEnd, newRightEnd, newTopEnd, newBottomEnd, newSpinnerPlayed } = result;
      const newHand = aiPlayer.hand.filter(d => d.id !== domino.id);
      const newBoard = [...(g.board || []), { ...entry, isSpinner: newSpinnerPlayed && !g.spinnerPlayed }];
      const players = g.players.map((p, i) => i === aiIdx ? { ...p, hand: newHand } : p);
      const roundOver = newHand.length === 0;
      const pts = roundOver ? calculateRoundScores(players, aiIdx) : 0;
      if (roundOver) players[aiIdx] = { ...players[aiIdx], score: (players[aiIdx].score || 0) + pts };
      const feed = [...(g.activityFeed || [])]; feed.unshift(`🤖 ${aiPlayer.playerName} played [${domino.id}]`);
      updated = {
        ...g, board: newBoard,
        leftEnd: newLeftEnd, rightEnd: newRightEnd, topEnd: newTopEnd, bottomEnd: newBottomEnd, spinnerPlayed: newSpinnerPlayed,
        players, currentPlayerIndex: roundOver ? aiIdx : next,
        phase: roundOver ? 'round_over' : 'playing',
        roundWinner: roundOver ? { playerName: aiPlayer.playerName, playerId: aiPlayer.playerId, points: pts } : null,
        activityFeed: feed.slice(0, 20),
        startingDominoLocked: gs.leftEnd === null ? null : g.startingDominoLocked,
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
    const humanNonHost = game.players?.filter(p => !p.isHost) || [];
    if (humanNonHost.length >= 3) { flash('Room is full', 'error'); return; }
    const newPlayer = { playerId: pid, seatNumber: humanNonHost.length + 2, playerName: nameInput.trim(), hand: [], score: 0, status: 'active', isAI: false, isHost: false };
    const updated = { ...game, players: [...(game.players || []), newPlayer] };
    await base44.entities.TXDGame.update(game.id, updated);
    setPlayerId(pid);
    setGame(updated);
  };

  // Play on an end
  const doPlayOnEnd = async (side, chosenOrientation = null) => {
    if (!isMyTurn || !selectedDomino || !game) return;
    const g = game;
    const domino = myHand.find(d => d.id === selectedDomino.id);
    if (!domino) return;

    if (gs.leftEnd === null && g.startingDominoLocked && domino.id !== g.startingDominoLocked) {
      flash(`Must start with [${g.startingDominoLocked}]`); return;
    }
    if (gs.leftEnd === null && domino.top === domino.bottom && !chosenOrientation) {
      setOrientPicker({ domino, side }); return;
    }

    const result = playDomino(domino, gs, side, chosenOrientation);
    const { entry, newLeftEnd, newRightEnd, newTopEnd, newBottomEnd, newSpinnerPlayed } = result;
    const newHand = myPlayer.hand.filter(d => d.id !== domino.id);
    const newBoard = [...(g.board || []), { ...entry, isSpinner: newSpinnerPlayed && !g.spinnerPlayed }];
    let ni = (myIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== myIndex) ni = (ni + 1) % g.players.length;
    const players = g.players.map((p, i) => i === myIndex ? { ...p, hand: newHand } : p);
    const roundOver = newHand.length === 0;
    const pts = roundOver ? calculateRoundScores(players, myIndex) : 0;
    if (roundOver) players[myIndex] = { ...players[myIndex], score: (players[myIndex].score || 0) + pts };
    const feed = [...(g.activityFeed || [])]; feed.unshift(`${myPlayer.playerName} played [${domino.id}]`);
    const updated = {
      ...g, board: newBoard,
      leftEnd: newLeftEnd, rightEnd: newRightEnd, topEnd: newTopEnd, bottomEnd: newBottomEnd, spinnerPlayed: newSpinnerPlayed,
      players, currentPlayerIndex: roundOver ? myIndex : ni,
      phase: roundOver ? 'round_over' : 'playing',
      roundWinner: roundOver ? { playerName: myPlayer.playerName, playerId: myPlayer.playerId, points: pts } : null,
      activityFeed: feed.slice(0, 20),
      startingDominoLocked: gs.leftEnd === null ? null : g.startingDominoLocked,
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const doDraw = async () => {
    if (!isMyTurn || !game) return;
    if ((game.boneyard || []).length === 0) { flash('Boneyard is empty'); return; }
    const { drawn, newBoneyard } = drawFromBoneyard(game.boneyard);
    const players = game.players.map((p, i) => i === myIndex ? { ...p, hand: [...p.hand, drawn] } : p);
    const feed = [...(game.activityFeed || [])]; feed.unshift(`${myPlayer.playerName} drew from boneyard`);
    const updated = { ...game, boneyard: newBoneyard, players, activityFeed: feed.slice(0, 20) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const doKnock = async () => {
    if (!isMyTurn || !game) return;
    if (hasLegalMove) { flash("You have a playable tile!"); return; }
    const ni = (myIndex + 1) % game.players.length;
    const feed = [...(game.activityFeed || [])]; feed.unshift(`${myPlayer.playerName} knocked`);
    const updated = { ...game, currentPlayerIndex: ni, activityFeed: feed.slice(0, 20) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
    flash('You knocked — turn passed', 'info');
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

  // ── Join screen ────────────────────────────────────────────────────────────
  if (!playerId) {
    const nonHostPlayers = game.players?.filter(p => !p.isHost) || [];
    const isFull = nonHostPlayers.length >= 3;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0d0518,#050505)' }}>
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-heading text-outlaw-gold tracking-widest mb-2">TXD DOMINOES</h1>
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
          </div>
          <div className="border-2 border-cyber-purple/40 rounded-2xl p-6 bg-black/60">
            {isFull ? (
              <div className="text-center">
                <p className="text-red-400 font-body mb-4">Room is full</p>
                <button onClick={() => navigate('/games')} className="w-full py-3 rounded-lg border border-white/30 text-white font-heading hover:bg-white/10">← Back</button>
              </div>
            ) : (
              <>
                <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                  placeholder="ENTER YOUR NAME" maxLength={20}
                  className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/50 text-white font-body text-xl mb-4 text-center tracking-wider focus:outline-none focus:border-outlaw-gold"
                  onKeyDown={e => e.key === 'Enter' && joinGame()} />
                <button onClick={joinGame} disabled={!nameInput.trim()}
                  className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#BC13FE,#7c3aed)', boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}>
                  SIT DOWN
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main game view ─────────────────────────────────────────────────────────
  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0d0518,#050505)' }}>
      <Header />

      {/* Top bar */}
      <div className="border-b border-cyber-purple/30 bg-black/60 px-4 py-2">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-heading text-outlaw-gold tracking-widest">TXD DOMINOES</span>
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

      {/* Scoreboard strip */}
      <div className="border-b border-white/5 bg-black/40 px-4 py-1.5">
        <div className="max-w-4xl mx-auto flex gap-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {game.players?.map((p, i) => {
            const isTurn = game.currentPlayerIndex === i && game.phase === 'playing';
            const isMe = p.playerId === playerId;
            return (
              <div key={p.playerId} className={`flex items-center gap-1.5 text-xs font-body flex-shrink-0 px-2 py-0.5 rounded ${isTurn ? 'bg-emerald-900/40 text-emerald-300' : isMe ? 'bg-cyber-purple/20 text-white' : 'text-white/50'}`}>
                {isTurn && <span className="text-emerald-400">▶</span>}
                {p.isHost ? '👑' : p.isAI ? '🤖' : ''}
                <span className={isMe ? 'text-outlaw-gold font-bold' : ''}>{p.playerName}</span>
                <span className="text-white/30">·</span>
                <span className="font-mono">{p.hand?.length ?? 0}🁣</span>
                <span className="text-white/30">·</span>
                <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 py-3 gap-3">

        {/* Game table */}
        <div className="relative rounded-3xl overflow-hidden flex-1"
          style={{
            minHeight: 220,
            background: 'radial-gradient(ellipse at center,rgba(255,140,30,0.55) 0%,rgba(200,80,10,0.45) 50%,rgba(120,40,0,0.6) 100%)',
            border: '4px solid rgba(255,160,50,0.6)',
            boxShadow: 'inset 0 0 60px rgba(255,120,20,0.15),0 10px 40px rgba(255,100,0,0.3)',
          }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
            <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png" alt="" style={{ opacity: 0.12, width: 90 }} />
          </div>
          <div className="absolute inset-0" style={{ zIndex: 1 }}>
            <TXDBoard
              board={game.board || []}
              gameState={gs}
              selectedDomino={selectedDomino}
              playableEnds={playableEnds}
              onPlayEnd={isMyTurn && selectedDomino ? doPlayOnEnd : undefined}
              interactive={isMyTurn && !!selectedDomino}
            />
          </div>
          {game.phase === 'playing' && gs.leftEnd !== null && (
            <div className="absolute bottom-2 right-3 z-20 text-[9px] font-body text-emerald-400/60">
              {gs.leftEnd} ↔ {gs.rightEnd}{gs.topEnd !== null ? ` · ↕ ${gs.topEnd}` : ''}
            </div>
          )}
        </div>

        {/* Player hand & controls */}
        <div className="rounded-2xl p-3 sm:p-4"
          style={{ background: 'rgba(12,6,30,0.94)', border: '2px solid rgba(188,19,254,0.55)', boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}>

          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-body">
              {game.phase === 'waiting'
                ? <span className="text-white/30">⏳ Waiting for host to start…</span>
                : isMyTurn
                  ? hasLegalMove
                    ? <span className="text-emerald-400 font-bold animate-pulse">⚡ YOUR TURN — tap a tile then tap where to play</span>
                    : (game.boneyard || []).length > 0
                      ? <span className="text-amber-400 font-bold animate-pulse">⚡ No moves — DRAW a tile</span>
                      : <span className="text-amber-400 font-bold animate-pulse">⚡ No moves — KNOCK to pass</span>
                  : <span className="text-white/40">{currentPlayer?.playerName || '...'} is playing…</span>}
            </div>
            <span className="text-xs text-white/30 font-mono">{myHand.length} tiles · boneyard: {game.boneyard?.length || 0}</span>
          </div>

          {/* Hand */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE40 transparent' }}>
            {myHand.map(d => {
              const isPlayable = isMyTurn && playableDominoIds.has(d.id);
              const isSelected = selectedDomino?.id === d.id;
              return (
                <div key={d.id} className="flex-shrink-0 transition-all duration-150 cursor-pointer"
                  style={{ transform: isSelected ? 'translateY(-10px) scale(1.08)' : 'none', opacity: isMyTurn && !isPlayable ? 0.35 : 1 }}
                  onClick={() => {
                    if (!isMyTurn) return;
                    if (!isPlayable) { flash("That tile doesn't fit!"); return; }
                    if (gs.leftEnd === null) {
                      if (game.startingDominoLocked && d.id !== game.startingDominoLocked) {
                        flash(`Must start with [${game.startingDominoLocked}]`); return;
                      }
                      if (d.top === d.bottom) { setSelectedDomino(d); setOrientPicker({ domino: d, side: 'first' }); return; }
                      setSelectedDomino(d);
                      // Single end — auto-play
                      setTimeout(() => {
                        setSelectedDomino(d);
                        doPlayOnEndWith(d, 'first', null);
                      }, 20);
                      return;
                    }
                    setSelectedDomino(prev => prev?.id === d.id ? null : d);
                  }}
                >
                  <TXDDomino top={d.top} bottom={d.bottom} width={44} playable={isPlayable} selected={isSelected} />
                </div>
              );
            })}
            {myHand.length === 0 && (
              <div className="text-white/20 font-body text-sm py-4 px-2">
                {game.phase === 'waiting' ? 'Tiles dealt when game starts' : 'No tiles in hand'}
              </div>
            )}
          </div>

          {/* Actions */}
          {isMyTurn && (
            <div className="flex flex-wrap gap-2 items-center">
              {selectedDomino && gs.leftEnd !== null && (
                <span className="text-xs font-body py-1">
                  {playableEnds.size > 0
                    ? <span className="text-emerald-400">Tap a glowing zone to place [{selectedDomino.id}]</span>
                    : <span className="text-red-400">Tile doesn't fit any open end</span>}
                </span>
              )}
              {!hasLegalMove && (game.boneyard || []).length > 0 && (
                <button onClick={doDraw}
                  className="px-4 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white border-2 border-emerald-500 hover:bg-emerald-500/20"
                  style={{ boxShadow: '0 0 10px rgba(16,185,129,0.4)' }}>
                  📦 DRAW FROM BONEYARD
                </button>
              )}
              {!hasLegalMove && (game.boneyard || []).length === 0 && (
                <button onClick={doKnock}
                  className="px-5 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-black"
                  style={{ background: 'linear-gradient(135deg,#FFD700,#f59e0b)', boxShadow: '0 0 12px rgba(255,215,0,0.5)' }}>
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
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl font-body text-sm z-50 pointer-events-none ${feedback.type === 'error' ? 'bg-red-950 border border-red-500 text-red-200' : 'bg-black/90 border border-emerald-500/50 text-emerald-300'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Orientation picker */}
      {orientPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-xs w-full border-2 border-cyber-purple rounded-2xl p-6 bg-black text-center" style={{ boxShadow: '0 0 30px rgba(188,19,254,0.4)' }}>
            <p className="text-[8px] text-cyber-purple tracking-widest uppercase mb-4" style={PS2}>Choose orientation for [{orientPicker.domino.id}]</p>
            <div className="flex justify-center gap-8 mb-5">
              {['horizontal', 'vertical'].map(ori => (
                <div key={ori} className="flex flex-col items-center gap-2 cursor-pointer group"
                  onClick={() => { doPlayOnEndWith(orientPicker.domino, orientPicker.side, ori); setOrientPicker(null); }}>
                  <div className="p-2 rounded-xl border border-white/10 group-hover:border-cyber-purple/60 group-hover:bg-cyber-purple/10 transition-all">
                    <TXDDomino top={orientPicker.domino.top} bottom={orientPicker.domino.bottom} width={34} orientation={ori} />
                  </div>
                  <span className="text-white/60 font-body text-xs group-hover:text-white capitalize">{ori}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setOrientPicker(null)} className="text-white/30 font-body text-xs hover:text-white/60">Cancel</button>
          </div>
        </div>
      )}

      {/* Round over */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center" style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
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

      {/* Game over */}
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
            <button onClick={() => navigate('/games')} className="w-full py-3 rounded-xl border border-white/30 text-white font-heading tracking-wider hover:bg-white/10">← BACK TO GAMES</button>
          </div>
        </div>
      )}
    </div>
  );

  // Helper: play a specific domino on an end (used by orient picker)
  async function doPlayOnEndWith(domino, side, chosenOrientation) {
    if (!isMyTurn || !game) return;
    const g = game;
    const result = playDomino(domino, gs, side, chosenOrientation);
    const { entry, newLeftEnd, newRightEnd, newTopEnd, newBottomEnd, newSpinnerPlayed } = result;
    const newHand = myPlayer.hand.filter(d => d.id !== domino.id);
    const newBoard = [...(g.board || []), { ...entry, isSpinner: newSpinnerPlayed && !g.spinnerPlayed }];
    let ni = (myIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== myIndex) ni = (ni + 1) % g.players.length;
    const players = g.players.map((p, i) => i === myIndex ? { ...p, hand: newHand } : p);
    const roundOver = newHand.length === 0;
    const pts = roundOver ? calculateRoundScores(players, myIndex) : 0;
    if (roundOver) players[myIndex] = { ...players[myIndex], score: (players[myIndex].score || 0) + pts };
    const feed = [...(g.activityFeed || [])]; feed.unshift(`${myPlayer.playerName} played [${domino.id}]`);
    const updated = {
      ...g, board: newBoard,
      leftEnd: newLeftEnd, rightEnd: newRightEnd, topEnd: newTopEnd, bottomEnd: newBottomEnd, spinnerPlayed: newSpinnerPlayed,
      players, currentPlayerIndex: roundOver ? myIndex : ni,
      phase: roundOver ? 'round_over' : 'playing',
      roundWinner: roundOver ? { playerName: myPlayer.playerName, playerId: myPlayer.playerId, points: pts } : null,
      activityFeed: feed.slice(0, 20),
      startingDominoLocked: gs.leftEnd === null ? null : g.startingDominoLocked,
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  }
}