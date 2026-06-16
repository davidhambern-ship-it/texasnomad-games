import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDDomino from '@/components/domino/TXDDomino';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  DOMINO_SET, generateRoomCode, deal, findHighestDouble,
  getPlayableDominoes, playDomino, getPlaySide,
  calculateRoundScores, aiChoosePlay,
} from '@/lib/txdDominoEngine';

const HAND_TILE_W = 52;
const AI_NAMES = ['Dexter', 'Duchess', 'Ranger', 'Maverick'];

export default function TXDHostPanel() {
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hostPlayerId, setHostPlayerId] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [selectedDomino, setSelectedDomino] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [controlsOpen, setControlsOpen] = useState(true);
  const pollRef = useRef(null);

  const hostIndex = game?.players?.findIndex(p => p.playerId === hostPlayerId) ?? -1;
  const hostPlayer = hostIndex >= 0 ? game?.players?.[hostIndex] : null;
  const isMyTurn = game?.phase === 'playing' && game?.currentPlayerIndex === hostIndex;
  const myHand = hostPlayer?.hand || [];
  const playable = getPlayableDominoes(myHand, game?.leftEnd ?? null, game?.rightEnd ?? null);
  const playableIds = new Set(playable.map(d => d.id));
  const currentPlayer = game?.players?.[game?.currentPlayerIndex];

  const flash = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2500);
  };

  // Poll
  useEffect(() => {
    if (!game?.id) return;
    pollRef.current = setInterval(async () => {
      try {
        const rooms = await base44.entities.TXDGame.filter({ room_code: game.room_code });
        if (rooms.length > 0) {
          setGame(prev => {
            const fresh = rooms[0];
            if (!prev) return fresh;
            const ft = new Date(fresh.updated_date || 0).getTime();
            const pt = new Date(prev.updated_date || 0).getTime();
            return ft > pt ? fresh : prev;
          });
        }
      } catch (_) {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [game?.id, game?.room_code]);

  // AI turns
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

  // Create room
  const createRoom = async () => {
    setLoading(true);
    let user = null; try { user = await base44.auth.me(); } catch (_) {}
    const pid = user?.id || `host_${Date.now()}`;
    const code = generateRoomCode();
    const hostObj = { playerId: pid, seatNumber: 1, playerName: 'Host', hand: [], score: 0, roundScore: 0, status: 'active', isAI: false, isHost: true };
    const created = await base44.entities.TXDGame.create({
      room_code: code, status: 'waiting', players: [hostObj],
      board: [], boneyard: [], leftEnd: null, rightEnd: null,
      currentPlayerIndex: 0, roundNumber: 1, phase: 'waiting',
      scoreLimit: 100, created_by_user_id: user?.id || null,
    });
    setHostPlayerId(pid);
    setGame(created);
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setLoading(true);
    try {
      const rooms = await base44.entities.TXDGame.filter({ room_code: roomCodeInput.trim().toUpperCase() });
      if (!rooms.length) { flash('Room not found', 'error'); setLoading(false); return; }
      let user = null; try { user = await base44.auth.me(); } catch (_) {}
      const pid = user?.id || `host_${Date.now()}`;
      const g = rooms[0];
      if (!g.players?.find(p => p.playerId === pid)) {
        const hostObj = { playerId: pid, seatNumber: (g.players?.length || 0) + 1, playerName: 'Host', hand: [], score: 0, roundScore: 0, status: 'active', isAI: false, isHost: true };
        const updated = { ...g, players: [...(g.players || []), hostObj] };
        await base44.entities.TXDGame.update(g.id, updated);
        setGame(updated);
      } else {
        setGame(g);
      }
      setHostPlayerId(pid);
    } catch (_) { flash('Error joining room', 'error'); }
    setLoading(false);
  };

  const startGame = async () => {
    const g = game;
    const active = g.players.filter(p => p.status === 'active');
    if (active.length < 2) { flash('Need at least 2 players', 'error'); return; }
    const { hands, boneyard } = deal(DOMINO_SET, active.length);
    const { startPlayerIndex } = findHighestDouble(hands);
    let hi = 0;
    const players = g.players.map(p => p.status !== 'active' ? p : { ...p, hand: hands[hi++], roundScore: 0 });
    const updated = { ...g, status: 'active', boneyard, players, board: [], leftEnd: null, rightEnd: null, currentPlayerIndex: startPlayerIndex, phase: 'playing', roundWinner: null };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const addCPU = async () => {
    const g = game;
    if ((g.players?.length || 0) >= 4) { flash('Max 4 players', 'error'); return; }
    const aiCount = g.players.filter(p => p.isAI).length;
    const ai = { playerId: `ai_${Date.now()}`, seatNumber: g.players.length + 1, playerName: AI_NAMES[aiCount] || `CPU${aiCount + 1}`, hand: [], score: 0, roundScore: 0, status: 'active', isAI: true, isHost: false };
    const updated = { ...g, players: [...g.players, ai] };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const removeCPU = async () => {
    const g = game;
    const last = [...g.players].reverse().find(p => p.isAI);
    if (!last) return;
    const updated = { ...g, players: g.players.filter(p => p.playerId !== last.playerId) };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const overrideTurn = async (idx) => {
    const updated = { ...game, currentPlayerIndex: idx };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const resetRound = async () => {
    const g = game;
    const active = g.players.filter(p => p.status === 'active');
    const { hands, boneyard } = deal(DOMINO_SET, active.length);
    const { startPlayerIndex } = findHighestDouble(hands);
    let hi = 0;
    const players = g.players.map(p => p.status !== 'active' ? p : { ...p, hand: hands[hi++], roundScore: 0 });
    const updated = { ...g, board: [], leftEnd: null, rightEnd: null, boneyard, players, currentPlayerIndex: startPlayerIndex, phase: 'playing', roundWinner: null };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const startNextRound = async () => {
    const g = game;
    const active = g.players.filter(p => p.status === 'active');
    const { hands, boneyard } = deal(DOMINO_SET, active.length);
    const { startPlayerIndex } = findHighestDouble(hands);
    let hi = 0;
    const players = g.players.map(p => p.status !== 'active' ? p : { ...p, hand: hands[hi++], roundScore: 0 });
    const updated = { ...g, board: [], leftEnd: null, rightEnd: null, boneyard, players, currentPlayerIndex: startPlayerIndex, roundNumber: (g.roundNumber || 1) + 1, phase: 'playing', roundWinner: null };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const doPlay = async (side) => {
    if (!selectedDomino || !isMyTurn || !game) return;
    const g = game;
    const actualSide = g.board?.length === 0 ? 'first' : side;
    const { newLeftEnd, newRightEnd } = playDomino(selectedDomino, g.leftEnd ?? null, g.rightEnd ?? null, actualSide);
    const newHand = hostPlayer.hand.filter(d => d.id !== selectedDomino.id);
    const boardEntry = { ...selectedDomino, side: actualSide };
    const newBoard = actualSide === 'left' ? [boardEntry, ...(g.board || [])] : [...(g.board || []), boardEntry];
    let ni = (hostIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== hostIndex) ni = (ni + 1) % g.players.length;
    const players = g.players.map((p, i) => i === hostIndex ? { ...p, hand: newHand } : p);
    const roundOver = newHand.length === 0;
    const pts = roundOver ? calculateRoundScores(players, hostIndex) : 0;
    if (roundOver) players[hostIndex] = { ...players[hostIndex], score: (players[hostIndex].score || 0) + pts };
    const updated = {
      ...g, board: newBoard, leftEnd: newLeftEnd, rightEnd: newRightEnd, players,
      currentPlayerIndex: roundOver ? hostIndex : ni,
      phase: roundOver ? 'round_over' : 'playing',
      roundWinner: roundOver ? { playerName: 'Host', points: pts } : null,
      lastAction: { type: 'play', player: 'Host', domino: selectedDomino },
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const doDraw = async () => {
    if (!isMyTurn || !game) return;
    const g = game;
    let ni = (hostIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== hostIndex) ni = (ni + 1) % g.players.length;
    if (!g.boneyard?.length) {
      const updated = { ...g, currentPlayerIndex: ni, lastAction: { type: 'pass', player: 'Host' } };
      await base44.entities.TXDGame.update(g.id, updated);
      setGame(updated);
      return;
    }
    const [drawn, ...boneyard] = g.boneyard;
    const players = g.players.map((p, i) => i === hostIndex ? { ...p, hand: [...p.hand, drawn] } : p);
    const updated = { ...g, boneyard, players, lastAction: { type: 'draw', player: 'Host' } };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  // ── Landing ────────────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="min-h-screen bg-midnight-void">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16">
          <h1 className="text-4xl font-heading text-outlaw-gold tracking-widest text-center mb-2">TXD HOST PANEL</h1>
          <p className="text-white/40 text-center font-body text-sm mb-10">Texas Dominoes</p>
          <div className="space-y-4">
            <button onClick={createRoom} disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyber-purple to-purple-800 text-white font-heading text-lg tracking-widest uppercase hover:opacity-90 transition-all disabled:opacity-50">
              {loading ? '⚙ Creating…' : '⚡ CREATE NEW ROOM'}
            </button>
            <div className="flex gap-2">
              <input value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="EXISTING ROOM CODE" maxLength={8}
                className="flex-1 px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/50 text-white font-mono uppercase tracking-widest focus:outline-none focus:border-outlaw-gold"
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
              />
              <button onClick={joinRoom} disabled={!roomCodeInput.trim() || loading}
                className="px-5 py-3 rounded-lg border-2 border-outlaw-gold text-outlaw-gold font-heading tracking-wider hover:bg-outlaw-gold hover:text-black transition-all disabled:opacity-40">
                JOIN
              </button>
            </div>
          </div>
          {feedback && <p className="mt-4 text-center text-red-400 text-sm font-body">{feedback.msg}</p>}
        </div>
      </div>
    );
  }

  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;

  return (
    <div className="min-h-screen bg-midnight-void text-white flex flex-col">
      <Header />

      {/* Scoreboard */}
      <div className="border-b border-cyber-purple/30 bg-black/50 px-4 py-2">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-heading text-outlaw-gold tracking-widest">TXD HOST</span>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple font-mono text-xs tracking-widest">{game.room_code}</span>
            <span className="text-white/30 text-xs font-body">Round {game.roundNumber || 1}</span>
            <span className={`text-xs font-body px-1.5 py-0.5 rounded ${game.phase === 'playing' ? 'text-emerald-400 bg-emerald-900/30' : 'text-white/40 bg-white/5'}`}>
              {game.phase?.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {game.players?.map((p, i) => (
              <div key={p.playerId}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-body
                  ${game.currentPlayerIndex === i && game.phase === 'playing' ? 'bg-cyber-purple/20 border border-cyber-purple/60' : 'bg-white/5 text-white/60'}`}>
                {p.isAI && '🤖'}{p.isHost && '👑'}
                <span className={p.playerId === hostPlayerId ? 'text-outlaw-gold font-bold' : ''}>{p.playerName}</span>
                <span className="text-emerald-400 font-mono font-bold">{p.score || 0}</span>
                <span className="text-white/30">({p.hand?.length ?? 0})</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-white/30 font-body hidden sm:block">
            Boneyard: {game.boneyard?.length || 0} | Ends: {game.leftEnd ?? '?'} — {game.rightEnd ?? '?'}
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="border-b border-cyber-purple/20 bg-black/20 min-h-[120px] max-h-[200px] overflow-hidden relative">
        <TXDBoard board={game.board || []} leftEnd={game.leftEnd} rightEnd={game.rightEnd} />
        {game.lastAction && (
          <span className="absolute bottom-1 right-3 text-[10px] text-white/25 font-body italic">
            {game.lastAction.player} {game.lastAction.type === 'play' ? 'played' : game.lastAction.type === 'draw' ? 'drew' : 'passed'}
          </span>
        )}
      </div>

      {/* Host hand */}
      <div className="px-4 py-4 bg-black/40 border-b border-cyber-purple/20">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-body">
            {game.phase === 'waiting'
              ? <span className="text-white/40">Start the game to deal tiles</span>
              : isMyTurn
              ? <span className="text-emerald-400 font-bold tracking-wider">▶ YOUR TURN</span>
              : <span className="text-white/50">{currentPlayer?.playerName}'s turn</span>}
          </div>
          <span className="text-xs text-white/30 font-mono">{myHand.length} tiles</span>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {myHand.map(d => (
            <TXDDomino key={d.id} top={d.top} bottom={d.bottom} width={HAND_TILE_W}
              playable={isMyTurn && playableIds.has(d.id)}
              selected={selectedDomino?.id === d.id}
              onClick={() => {
                if (!isMyTurn) return;
                if (!playableIds.has(d.id)) { flash("Doesn't fit right now", 'error'); return; }
                setSelectedDomino(prev => prev?.id === d.id ? null : d);
              }} />
          ))}
          {myHand.length === 0 && game.phase !== 'waiting' && (
            <div className="text-white/30 font-body text-sm py-4">No tiles in hand</div>
          )}
        </div>

        {isMyTurn && (
          <div className="flex flex-wrap gap-2 justify-center">
            {selectedDomino && game.board?.length === 0 && (
              <button onClick={() => doPlay('first')} className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-heading text-sm">PLAY DOMINO</button>
            )}
            {selectedDomino && (game.board?.length || 0) > 0 && (() => {
              const side = getPlaySide(selectedDomino, game.leftEnd, game.rightEnd);
              if (!side) return <span className="text-red-400 text-xs font-body">Doesn't fit</span>;
              if (side === 'both') return (
                <>
                  <button onClick={() => doPlay('left')} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-heading text-sm">PLAY LEFT ({game.leftEnd})</button>
                  <button onClick={() => doPlay('right')} className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-heading text-sm">PLAY RIGHT ({game.rightEnd})</button>
                </>
              );
              return <button onClick={() => doPlay(side)} className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-heading text-sm">
                PLAY {side.toUpperCase()} ({side === 'left' ? game.leftEnd : game.rightEnd})
              </button>;
            })()}
            {!selectedDomino && (
              <button onClick={doDraw} className="px-6 py-2.5 rounded-lg bg-cyber-purple/70 hover:bg-cyber-purple text-white font-heading tracking-wider text-sm">
                {(game.boneyard?.length || 0) > 0 ? `DRAW (${game.boneyard.length})` : 'PASS TURN'}
              </button>
            )}
            {selectedDomino && (
              <button onClick={() => setSelectedDomino(null)} className="px-4 py-2.5 rounded-lg border border-white/20 text-white/50 font-heading text-sm">CANCEL</button>
            )}
          </div>
        )}
      </div>

      {/* Host Controls */}
      <div className="border-t border-cyber-purple/30 bg-black/60">
        <button onClick={() => setControlsOpen(!controlsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-white/60 hover:text-white font-heading tracking-wider text-sm">
          <span>🎛 HOST CONTROLS</span>
          <span>{controlsOpen ? '▲' : '▼'}</span>
        </button>

        {controlsOpen && (
          <div className="px-4 pb-4 space-y-3">
            {/* Override turn */}
            <div>
              <p className="text-white/30 text-[10px] font-body uppercase tracking-widest mb-1.5">Override Turn</p>
              <div className="flex flex-wrap gap-2">
                {game.players?.map((p, i) => (
                  <button key={p.playerId} onClick={() => overrideTurn(i)}
                    className={`px-3 py-1.5 rounded text-xs font-body transition-all
                      ${game.currentPlayerIndex === i ? 'bg-cyber-purple text-white' : 'border border-white/20 text-white/50 hover:border-white/40'}`}>
                    {p.isAI ? '🤖 ' : ''}{p.playerName}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {game.phase === 'waiting' && (
                <button onClick={startGame} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-heading text-sm tracking-wider">
                  ▶ START GAME
                </button>
              )}
              {game.phase === 'round_over' && (
                <button onClick={startNextRound} className="px-4 py-2 rounded-lg bg-outlaw-gold text-black font-heading text-sm tracking-wider">
                  NEXT ROUND
                </button>
              )}
              <button onClick={addCPU} disabled={(game.players?.length || 0) >= 4}
                className="px-4 py-2 rounded-lg border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/20 font-heading text-sm tracking-wider disabled:opacity-30">
                + ADD CPU
              </button>
              <button onClick={removeCPU}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/50 hover:border-white/40 font-heading text-sm tracking-wider">
                − REMOVE CPU
              </button>
              <button onClick={resetRound}
                className="px-4 py-2 rounded-lg border border-kinetic-orange/50 text-kinetic-orange hover:bg-kinetic-orange/10 font-heading text-sm tracking-wider">
                ↺ RESET ROUND
              </button>
            </div>

            {/* Player link */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-white/30 text-[10px] font-body uppercase tracking-widest mb-1">Player Join Link</p>
              <p className="text-outlaw-gold font-mono text-xs break-all select-all">
                {window.location.origin}/games/txd?room={game.room_code}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-lg font-body text-sm z-50 pointer-events-none
          ${feedback.type === 'error' ? 'bg-red-900/90 border border-red-500 text-red-200' : 'bg-black/80 border border-cyber-purple/50 text-white'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Round Over */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center"
            style={{ boxShadow: '0 0 30px rgba(255,215,0,0.4)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && <p className="text-white/70 font-body mb-4">{game.roundWinner.playerName} wins +{game.roundWinner.points} pts</p>}
            <div className="space-y-1 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map(p => (
                <div key={p.playerId} className="flex justify-between text-sm font-body px-4">
                  <span>{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
                </div>
              ))}
            </div>
            <button onClick={startNextRound} className="w-full py-2.5 rounded-lg bg-outlaw-gold text-black font-heading tracking-wider">NEXT ROUND</button>
          </div>
        </div>
      )}

      {/* Game Over */}
      {(gameOver || game.phase === 'game_over') && game.phase !== 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center">
            <h2 className="text-4xl font-heading text-outlaw-gold mb-4">GAME OVER!</h2>
            <p className="text-2xl font-heading text-white mb-4">🏆 {gameWinner?.playerName} WINS!</p>
            <div className="space-y-1 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className="flex justify-between text-sm font-body px-4">
                  <span>{i === 0 ? '👑 ' : ''}{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setGame(null)} className="w-full py-2.5 rounded-lg border border-white/30 text-white font-heading hover:bg-white/10">NEW GAME</button>
          </div>
        </div>
      )}
    </div>
  );
}