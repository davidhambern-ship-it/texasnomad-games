import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDDomino from '@/components/domino/TXDDomino';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  DOMINO_SET, generateRoomCode, deal, findHighestDouble,
  canPlay, getPlaySide, getPlayableDominoes, playDomino,
  calculateRoundScores, aiChoosePlay, checkBlocked, pipTotal,
} from '@/lib/txdDominoEngine';

const HAND_TILE_W = 56;

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

  // ── Derived state ──────────────────────────────────────────────────────────
  const myIndex = game?.players?.findIndex(p => p.playerId === playerId) ?? -1;
  const myPlayer = myIndex >= 0 ? game?.players?.[myIndex] : null;
  const isMyTurn = game?.phase === 'playing' && game?.currentPlayerIndex === myIndex;
  const myHand = myPlayer?.hand || [];
  const playable = getPlayableDominoes(myHand, game?.leftEnd ?? null, game?.rightEnd ?? null);
  const playableIds = new Set(playable.map(d => d.id));
  const currentPlayer = game?.players?.[game?.currentPlayerIndex];

  const flash = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2500);
  };

  // ── Load / poll ────────────────────────────────────────────────────────────
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

  // ── AI turn ────────────────────────────────────────────────────────────────
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

  // ── Join ───────────────────────────────────────────────────────────────────
  const joinGame = async () => {
    if (!nameInput.trim() || !game) return;
    let user = null; try { user = await base44.auth.me(); } catch (_) {}
    const pid = user?.id || `p_${Date.now()}`;
    // Already in game?
    if (game.players?.find(p => p.playerId === pid)) {
      setPlayerId(pid);
      return;
    }
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

  // ── Play a domino ──────────────────────────────────────────────────────────
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

  // ── Draw / Pass ────────────────────────────────────────────────────────────
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
    flash('Drew a tile from the boneyard', 'info');
  };

  const startNextRound = async () => {
    const g = game;
    const active = g.players.filter(p => p.status === 'active');
    const { hands, boneyard } = deal(DOMINO_SET, active.length);
    const { startPlayerIndex } = findHighestDouble(hands);
    let hi = 0;
    const players = g.players.map(p =>
      p.status !== 'active' ? p : { ...p, hand: hands[hi++], roundScore: 0 }
    );
    const updated = {
      ...g, board: [], leftEnd: null, rightEnd: null, boneyard, players,
      currentPlayerIndex: startPlayerIndex,
      roundNumber: (g.roundNumber || 1) + 1,
      phase: 'playing', roundWinner: null,
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-midnight-void flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-cyber-purple border-t-outlaw-gold rounded-full animate-spin" />
    </div>
  );

  if (!game) return (
    <div className="min-h-screen bg-midnight-void flex items-center justify-center text-white/50 font-body">
      Room not found: {roomCode}
    </div>
  );

  // Join screen
  if (!playerId) {
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center p-4">
        <div className="max-w-sm w-full border-2 border-cyber-purple rounded-2xl p-8 bg-black/60"
          style={{ boxShadow: '0 0 30px rgba(188,19,254,0.3)' }}>
          <h1 className="text-3xl font-heading text-outlaw-gold text-center tracking-widest mb-1">TXD DOMINOES</h1>
          <p className="text-white/40 text-center font-body text-sm mb-6">Room: <span className="text-cyber-purple font-mono">{roomCode}</span></p>
          <input
            type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
            placeholder="YOUR NAME" maxLength={20}
            className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/50 text-white font-body text-lg mb-4 focus:outline-none focus:border-outlaw-gold"
            onKeyDown={e => e.key === 'Enter' && joinGame()}
          />
          <button onClick={joinGame} disabled={!nameInput.trim()}
            className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase bg-gradient-to-r from-cyber-purple to-purple-800 text-white disabled:opacity-40 hover:opacity-90 transition-all">
            JOIN GAME
          </button>
          {feedback && <p className="mt-3 text-center text-red-400 text-sm font-body">{feedback.msg}</p>}
        </div>
      </div>
    );
  }

  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;
  const isHost = myPlayer?.isHost;

  return (
    <div className="min-h-screen bg-midnight-void text-white flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d0518 0%, #050505 60%)' }}>
      <Header />

      {/* Scoreboard */}
      <div className="border-b border-cyber-purple/30 bg-black/50 px-4 py-2">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-heading text-outlaw-gold tracking-widest">TXD</span>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple font-mono text-xs">{roomCode}</span>
            <span className="text-white/30 text-xs font-body">Round {game.roundNumber || 1}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {game.players?.map((p, i) => (
              <div key={p.playerId}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-body transition-all
                  ${game.currentPlayerIndex === i && game.phase === 'playing'
                    ? 'bg-cyber-purple/20 border border-cyber-purple/60 text-white'
                    : 'bg-white/5 text-white/60'}`}>
                {p.isAI && '🤖'}
                {p.isHost && '👑'}
                <span className={p.playerId === playerId ? 'text-outlaw-gold font-bold' : ''}>{p.playerName}</span>
                <span className="text-emerald-400 font-mono font-bold">{p.score || 0}</span>
                <span className="text-white/30">({p.hand?.length ?? 0})</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-white/30 font-body hidden sm:block">
            Boneyard: {game.boneyard?.length || 0} &nbsp;|&nbsp; Ends: {game.leftEnd ?? '?'} — {game.rightEnd ?? '?'}
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

      {/* Other players' face-down tiles */}
      <div className="flex flex-wrap gap-4 px-4 py-2 border-b border-cyber-purple/20 bg-black/30">
        {game.players?.filter(p => p.playerId !== playerId).map((p) => {
          const idx = game.players.indexOf(p);
          const isActive = game.currentPlayerIndex === idx && game.phase === 'playing';
          return (
            <div key={p.playerId} className={`flex items-center gap-2 text-xs font-body ${isActive ? 'text-cyber-purple' : 'text-white/40'}`}>
              {isActive && <span>▶</span>}
              {p.isAI && <span>🤖</span>}
              <span>{p.playerName}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(p.hand?.length || 0, 14) }).map((_, j) => (
                  <TXDDomino key={j} top={0} bottom={0} width={10} faceDown />
                ))}
              </div>
              <span className="text-white/25">({p.hand?.length || 0})</span>
            </div>
          );
        })}
      </div>

      {/* My hand */}
      <div className="flex-1 px-4 py-4 bg-black/40">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-body">
            {game.phase === 'waiting'
              ? <span className="text-white/40">Waiting for host to start…</span>
              : isMyTurn
              ? <span className="text-emerald-400 font-bold tracking-wider">▶ YOUR TURN</span>
              : <span className="text-white/50">{currentPlayer?.playerName}'s turn</span>}
          </div>
          <span className="text-xs text-white/30 font-mono">{myHand.length} tiles</span>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {myHand.map(d => (
            <TXDDomino
              key={d.id}
              top={d.top} bottom={d.bottom}
              width={HAND_TILE_W}
              playable={isMyTurn && playableIds.has(d.id)}
              selected={selectedDomino?.id === d.id}
              onClick={() => {
                if (!isMyTurn) return;
                if (!playableIds.has(d.id)) { flash("That tile can't be played right now", 'error'); return; }
                setSelectedDomino(prev => prev?.id === d.id ? null : d);
              }}
            />
          ))}
          {myHand.length === 0 && game.phase === 'playing' && (
            <div className="text-white/30 font-body text-sm py-6">No tiles in hand</div>
          )}
        </div>

        {/* Action buttons */}
        {isMyTurn && (
          <div className="flex flex-wrap gap-2 justify-center">
            {/* No board yet — single play button */}
            {selectedDomino && game.board?.length === 0 && (
              <button onClick={() => doPlay('first')}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-heading tracking-wider text-sm transition-all">
                PLAY DOMINO
              </button>
            )}
            {/* Board exists — check fit side */}
            {selectedDomino && (game.board?.length || 0) > 0 && (() => {
              const side = getPlaySide(selectedDomino, game.leftEnd, game.rightEnd);
              if (!side) return <span className="text-red-400 text-xs font-body">Doesn't fit either end</span>;
              if (side === 'both') return (
                <>
                  <button onClick={() => doPlay('left')} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-heading text-sm">
                    PLAY LEFT ({game.leftEnd})
                  </button>
                  <button onClick={() => doPlay('right')} className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-heading text-sm">
                    PLAY RIGHT ({game.rightEnd})
                  </button>
                </>
              );
              const label = side === 'left' ? `PLAY LEFT (${game.leftEnd})` : `PLAY RIGHT (${game.rightEnd})`;
              return <button onClick={() => doPlay(side)} className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-heading text-sm">{label}</button>;
            })()}
            {!selectedDomino && (
              <button onClick={doDraw}
                className="px-6 py-2.5 rounded-lg bg-cyber-purple/70 hover:bg-cyber-purple text-white font-heading tracking-wider text-sm transition-all">
                {(game.boneyard?.length || 0) > 0 ? `DRAW (${game.boneyard.length})` : 'PASS TURN'}
              </button>
            )}
            {selectedDomino && (
              <button onClick={() => setSelectedDomino(null)}
                className="px-4 py-2.5 rounded-lg border border-white/20 text-white/50 font-heading text-sm hover:border-white/40">
                CANCEL
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-lg font-body text-sm z-50 pointer-events-none
          ${feedback.type === 'error' ? 'bg-red-900/90 border border-red-500 text-red-200' : 'bg-black/80 border border-cyber-purple/50 text-white'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Round Over Modal */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center"
            style={{ boxShadow: '0 0 30px rgba(255,215,0,0.4)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && (
              <p className="text-white/70 font-body mb-4">
                {game.roundWinner.playerName} wins +{game.roundWinner.points} pts
              </p>
            )}
            <div className="space-y-1 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map(p => (
                <div key={p.playerId} className="flex justify-between text-sm font-body px-4">
                  <span>{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0}</span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button onClick={startNextRound}
                className="w-full py-2.5 rounded-lg bg-outlaw-gold text-black font-heading tracking-wider hover:opacity-90">
                NEXT ROUND
              </button>
            ) : (
              <p className="text-white/40 text-sm font-body">Waiting for host to start next round…</p>
            )}
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && game.phase !== 'round_over' && (
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
            <button onClick={() => navigate('/games')}
              className="w-full py-2.5 rounded-lg border border-white/30 text-white font-heading tracking-wider hover:bg-white/10">
              BACK TO GAMES
            </button>
          </div>
        </div>
      )}
    </div>
  );
}