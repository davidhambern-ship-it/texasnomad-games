import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDDomino from '@/components/domino/TXDDomino';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  DOMINO_SET, generateRoomCode, deal, findHighestDoubleStarter,
  playDomino, calculateRoundScores, aiChoosePlay,
  getLegalMoves, getPlayableEnds, drawFromBoneyard,
} from '@/lib/txdDominoEngine';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const AI_NAMES = ['Dexter', 'Duchess', 'Ranger', 'Maverick'];

// Blank game state for board
const emptyGameState = () => ({ leftEnd: null, rightEnd: null, topEnd: null, bottomEnd: null, spinnerPlayed: false });

function gameStateFromGame(g) {
  return {
    leftEnd:       g.leftEnd       ?? null,
    rightEnd:      g.rightEnd      ?? null,
    topEnd:        g.topEnd        ?? null,
    bottomEnd:     g.bottomEnd     ?? null,
    spinnerPlayed: g.spinnerPlayed ?? false,
  };
}

function Btn({ children, onClick, color = '#BC13FE', disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-lg border-2 font-heading tracking-wider uppercase text-xs transition-all active:scale-95 disabled:opacity-40"
      style={{ borderColor: color, color }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}20`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}

function SeatBadge({ player, isTurn, seatNumber, onKick, onForce }) {
  const color = !player ? '#ffffff20' : player.isHost ? '#BC13FE' : player.isAI ? '#22d3ee' : '#4ade80';
  return (
    <div className="p-2 rounded-xl border text-center" style={{ borderColor: `${color}40`, background: `${color}08`, minWidth: 90 }}>
      <div className="text-[7px] uppercase tracking-widest mb-1 font-body" style={{ color: `${color}80` }}>Seat {seatNumber}</div>
      {player ? (
        <>
          <div className="text-white text-xs font-body font-bold truncate">
            {player.isHost ? '👑 ' : player.isAI ? '🤖 ' : '👤 '}{player.playerName}
          </div>
          <div className="text-[9px] font-mono mt-0.5" style={{ color }}>{player.score || 0} pts · {player.hand?.length ?? 0} 🁣</div>
          {isTurn && <div className="text-[7px] text-emerald-400 mt-0.5 animate-pulse">▶ PLAYING</div>}
          <div className="flex gap-1 mt-1 justify-center">
            {!player.isHost && <button onClick={onForce} className="text-[7px] px-1 py-0.5 rounded border border-cyber-purple/40 text-cyber-purple hover:bg-cyber-purple/20 font-heading">TURN</button>}
            {!player.isHost && !player.isAI && <button onClick={onKick} className="text-[7px] px-1 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 font-heading">KICK</button>}
          </div>
        </>
      ) : (
        <div className="text-white/20 text-xs font-body">Empty</div>
      )}
    </div>
  );
}

export default function TXDHostPanel() {
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [scoreLimit, setScoreLimit] = useState(100);
  const [selectedDomino, setSelectedDomino] = useState(null);
  const [copied, setCopied] = useState(false);
  const [orientPicker, setOrientPicker] = useState(null);
  const pollRef = useRef(null);

  const hostIndex = game?.players?.findIndex(p => p.isHost) ?? -1;
  const hostPlayer = hostIndex >= 0 ? game?.players?.[hostIndex] : null;
  const isHostTurn = game?.phase === 'playing' && game?.currentPlayerIndex === hostIndex;
  const hostHand = hostPlayer?.hand || [];
  const gs = game ? gameStateFromGame(game) : emptyGameState();
  const legalMoves = isHostTurn ? getLegalMoves(hostHand, gs) : [];
  const playableIds = new Set(legalMoves.map(m => m.domino.id));
  const hasLegalMove = legalMoves.length > 0;
  const playableEnds = selectedDomino ? new Set(getPlayableEnds(selectedDomino, gs)) : new Set();
  const currentPlayer = game?.players?.[game?.currentPlayerIndex];

  const flash = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2800);
  };

  // Poll for updates
  useEffect(() => {
    if (!game?.id) return;
    pollRef.current = setInterval(async () => {
      try {
        const rows = await base44.entities.TXDGame.filter({ room_code: game.room_code });
        if (rows.length > 0) setGame(rows[0]);
      } catch (_) {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [game?.id, game?.room_code]);

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
      // Try to draw from boneyard
      if ((g.boneyard || []).length > 0) {
        const { drawn, newBoneyard } = drawFromBoneyard(g.boneyard);
        const players = g.players.map((p, i) => i === aiIdx ? { ...p, hand: [...p.hand, drawn] } : p);
        const feed = [...(g.activityFeed || [])];
        feed.unshift(`🤖 ${aiPlayer.playerName} drew from boneyard`);
        updated = { ...g, boneyard: newBoneyard, players, activityFeed: feed.slice(0, 30) };
      } else {
        // Knock
        const feed = [...(g.activityFeed || [])];
        feed.unshift(`🤖 ${aiPlayer.playerName} knocked`);
        updated = { ...g, currentPlayerIndex: next, activityFeed: feed.slice(0, 30) };
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
      const feed = [...(g.activityFeed || [])];
      feed.unshift(`🤖 ${aiPlayer.playerName} played [${domino.id}]`);
      updated = {
        ...g, board: newBoard,
        leftEnd: newLeftEnd, rightEnd: newRightEnd, topEnd: newTopEnd, bottomEnd: newBottomEnd, spinnerPlayed: newSpinnerPlayed,
        players,
        currentPlayerIndex: roundOver ? aiIdx : next,
        phase: roundOver ? 'round_over' : 'playing',
        roundWinner: roundOver ? { playerName: aiPlayer.playerName, playerId: aiPlayer.playerId, points: pts } : null,
        activityFeed: feed.slice(0, 30),
        startingDominoLocked: gs.leftEnd === null ? null : g.startingDominoLocked,
      };
    }
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  // Room creation
  const createRoom = async () => {
    setLoading(true);
    let user = null; try { user = await base44.auth.me(); } catch (_) {}
    const pid = user?.id || `host_${Date.now()}`;
    const code = generateRoomCode();
    const hostObj = { playerId: pid, seatNumber: 1, playerName: 'Host', hand: [], score: 0, status: 'active', isAI: false, isHost: true };
    const created = await base44.entities.TXDGame.create({
      room_code: code, status: 'waiting', players: [hostObj],
      board: [], boneyard: [], leftEnd: null, rightEnd: null, topEnd: null, bottomEnd: null, spinnerPlayed: false,
      currentPlayerIndex: 0, roundNumber: 1, phase: 'waiting', scoreLimit, activityFeed: [`Room ${code} created`],
    });
    setGame(created);
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setLoading(true);
    try {
      const rooms = await base44.entities.TXDGame.filter({ room_code: roomCodeInput.trim().toUpperCase() });
      if (!rooms.length) { flash('Room not found', 'error'); setLoading(false); return; }
      setGame(rooms[0]);
    } catch (_) { flash('Error joining', 'error'); }
    setLoading(false);
  };

  const addCPU = async () => {
    if ((game.players?.length || 0) >= 4) { flash('Max 4 players', 'error'); return; }
    const aiCount = game.players.filter(p => p.isAI).length;
    const ai = { playerId: `ai_${Date.now()}`, seatNumber: game.players.length + 1, playerName: AI_NAMES[aiCount] || `CPU${aiCount + 1}`, hand: [], score: 0, status: 'active', isAI: true, isHost: false };
    const updated = { ...game, players: [...game.players, ai] };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const removeCPU = async () => {
    const last = [...game.players].reverse().find(p => p.isAI);
    if (!last) return;
    const updated = { ...game, players: game.players.filter(p => p.playerId !== last.playerId) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const kickPlayer = async (pid) => {
    const updated = { ...game, players: game.players.filter(p => p.playerId !== pid) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const overrideTurn = async (idx) => {
    const updated = { ...game, currentPlayerIndex: idx };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const startGame = async () => {
    const active = game.players.filter(p => p.status === 'active');
    if (active.length < 2) { flash('Need at least 2 players', 'error'); return; }
    let dealResult, players, startResult, attempts = 0;
    do {
      dealResult = deal(DOMINO_SET, active.length);
      let hi = 0;
      players = game.players.map(p => p.status !== 'active' ? p : { ...p, hand: dealResult.hands[hi++] });
      startResult = findHighestDoubleStarter(players.map(p => p.hand || []));
      attempts++;
    } while (!startResult && attempts < 10);
    const feed = [`🎮 Game started — ${players[startResult?.playerIndex || 0]?.playerName} goes first`];
    const updated = {
      ...game, status: 'active', boneyard: dealResult.boneyard, players, board: [],
      leftEnd: null, rightEnd: null, topEnd: null, bottomEnd: null, spinnerPlayed: false,
      currentPlayerIndex: startResult?.playerIndex || 0, phase: 'playing', roundNumber: 1,
      startingDominoLocked: startResult?.dominoId || null, roundWinner: null,
      activityFeed: feed,
    };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const startNextRound = async () => {
    const active = game.players.filter(p => p.status === 'active');
    const rn = (game.roundNumber || 1) + 1;
    const prevWinnerIdx = game.players.findIndex(p => p.playerId === game.roundWinner?.playerId);
    let hi = 0;
    const dealResult = deal(DOMINO_SET, active.length);
    const players = game.players.map(p => p.status !== 'active' ? p : { ...p, hand: dealResult.hands[hi++] });
    const startIdx = prevWinnerIdx >= 0 ? prevWinnerIdx : 0;
    const feed = [`🎮 Round ${rn} started — ${players[startIdx]?.playerName} goes first`];
    const updated = {
      ...game, board: [], leftEnd: null, rightEnd: null, topEnd: null, bottomEnd: null, spinnerPlayed: false,
      boneyard: dealResult.boneyard, players, currentPlayerIndex: startIdx, roundNumber: rn,
      startingDominoLocked: null, phase: 'playing', roundWinner: null, activityFeed: feed,
    };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const endGame = async () => {
    const updated = { ...game, phase: 'game_over', status: 'finished' };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const resetScores = async () => {
    const updated = { ...game, players: game.players.map(p => ({ ...p, score: 0 })) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  // Host plays a domino on a given end
  const doPlayOnEnd = async (side, chosenOrientation = null) => {
    if (!isHostTurn || !selectedDomino) return;
    const g = game;
    const domino = hostHand.find(d => d.id === selectedDomino.id);
    if (!domino) return;

    // First play locked domino check
    if (gs.leftEnd === null && g.startingDominoLocked && domino.id !== g.startingDominoLocked) {
      flash(`Must start with [${g.startingDominoLocked}]`, 'error'); return;
    }

    // Ask orientation for first-play double
    if (gs.leftEnd === null && domino.top === domino.bottom && !chosenOrientation) {
      setOrientPicker({ domino, side });
      return;
    }

    const result = playDomino(domino, gs, side, chosenOrientation);
    const { entry, newLeftEnd, newRightEnd, newTopEnd, newBottomEnd, newSpinnerPlayed } = result;
    const newHand = hostPlayer.hand.filter(d => d.id !== domino.id);
    const newBoard = [...(g.board || []), { ...entry, isSpinner: newSpinnerPlayed && !g.spinnerPlayed }];
    let ni = (hostIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== hostIndex) ni = (ni + 1) % g.players.length;
    const players = g.players.map((p, i) => i === hostIndex ? { ...p, hand: newHand } : p);
    const roundOver = newHand.length === 0;
    const pts = roundOver ? calculateRoundScores(players, hostIndex) : 0;
    if (roundOver) players[hostIndex] = { ...players[hostIndex], score: (players[hostIndex].score || 0) + pts };
    const feed = [...(g.activityFeed || [])]; feed.unshift(`👑 Host played [${domino.id}]`);
    const updated = {
      ...g, board: newBoard,
      leftEnd: newLeftEnd, rightEnd: newRightEnd, topEnd: newTopEnd, bottomEnd: newBottomEnd, spinnerPlayed: newSpinnerPlayed,
      players, currentPlayerIndex: roundOver ? hostIndex : ni,
      phase: roundOver ? 'round_over' : 'playing',
      roundWinner: roundOver ? { playerName: 'Host', playerId: hostPlayer.playerId, points: pts } : null,
      activityFeed: feed.slice(0, 30),
      startingDominoLocked: gs.leftEnd === null ? null : g.startingDominoLocked,
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const doDraw = async () => {
    if (!isHostTurn || !game) return;
    if ((game.boneyard || []).length === 0) { flash('Boneyard is empty', 'error'); return; }
    const { drawn, newBoneyard } = drawFromBoneyard(game.boneyard);
    const players = game.players.map((p, i) => i === hostIndex ? { ...p, hand: [...p.hand, drawn] } : p);
    const feed = [...(game.activityFeed || [])]; feed.unshift(`👑 Host drew from boneyard`);
    const updated = { ...game, boneyard: newBoneyard, players, activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const doKnock = async () => {
    if (!isHostTurn) return;
    if (hasLegalMove) { flash("You have a playable tile!", 'error'); return; }
    const ni = (hostIndex + 1) % game.players.length;
    const feed = [...(game.activityFeed || [])]; feed.unshift(`👑 Host knocked`);
    const updated = { ...game, currentPlayerIndex: ni, activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
    flash('Knocked — turn passed', 'info');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/games/txd?room=${game.room_code}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // ── Landing ────────────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="min-h-screen bg-midnight-void">
        <Header />
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple text-[8px] tracking-widest uppercase mb-3" style={PS2}>🎛 HOST CONTROL CENTER</div>
            <h1 className="text-5xl font-heading text-outlaw-gold tracking-widest mb-1">TXD DOMINOES</h1>
            <p className="text-white/40 font-body text-sm">Texas Dominoes — Host Command Dashboard</p>
          </div>
          <div className="p-4 rounded-xl border border-cyber-purple/30 bg-black/40 mb-5">
            <label className="text-[8px] text-white/40 uppercase tracking-widest font-body block mb-2" style={PS2}>Score Limit</label>
            <div className="flex gap-2">
              {[50, 100, 150, 200].map(v => (
                <button key={v} onClick={() => setScoreLimit(v)}
                  className={`flex-1 py-2 rounded-lg font-heading text-sm tracking-widest transition-all ${scoreLimit === v ? 'bg-cyber-purple text-white' : 'border border-white/20 text-white/50 hover:border-cyber-purple/60'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={createRoom} disabled={loading}
              className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#BC13FE,#7c3aed)', boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}>
              {loading ? '⚙ Creating…' : '⚡ CREATE ROOM (SEAT 1)'}
            </button>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/30 text-xs font-body">or join existing</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="flex gap-2">
              <input value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE" maxLength={10}
                className="flex-1 px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/40 text-white font-mono uppercase tracking-widest text-lg focus:outline-none focus:border-outlaw-gold"
                onKeyDown={e => e.key === 'Enter' && joinRoom()} />
              <button onClick={joinRoom} disabled={!roomCodeInput.trim() || loading}
                className="px-5 py-3 rounded-lg border-2 border-outlaw-gold text-outlaw-gold font-heading hover:bg-outlaw-gold hover:text-black transition-all disabled:opacity-40">JOIN</button>
            </div>
          </div>
          {feedback && <p className="mt-4 text-center text-red-400 text-sm font-body">{feedback.msg}</p>}
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;

  return (
    <div className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0a0318,#050505)' }}>
      <Header />

      {/* Sticky command bar */}
      <div className="border-b border-cyber-purple/40 bg-black/70 px-4 py-2 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[8px] px-2 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple tracking-widest uppercase" style={PS2}>🎛 HOST</span>
            <span className="font-mono text-outlaw-gold text-xl font-bold tracking-widest">{game.room_code}</span>
            <span className={`text-[8px] px-2 py-0.5 rounded uppercase tracking-widest ${game.phase === 'playing' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-600/30' : 'bg-white/5 text-white/40 border border-white/10'}`} style={PS2}>
              {game.phase?.replace('_', ' ')}
            </span>
            <span className="text-white/30 text-xs font-body">R{game.roundNumber || 1}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={copyLink} className="px-3 py-1.5 rounded-lg border border-outlaw-gold/50 text-outlaw-gold text-xs font-heading hover:bg-outlaw-gold/10">
              {copied ? '✓ COPIED!' : '📋 JOIN LINK'}
            </button>
            <button onClick={() => setGame(null)} className="px-3 py-1.5 rounded-lg border border-white/20 text-white/40 text-xs font-heading hover:border-white/40">✕</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── LEFT: Controls ── */}
        <div className="lg:col-span-1 space-y-3">

          {/* Seats */}
          <div className="rounded-xl border border-cyber-purple/30 bg-black/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading text-[9px] tracking-widest text-cyber-purple uppercase" style={PS2}>👥 Seats</h3>
              <div className="flex gap-1">
                <Btn onClick={addCPU} disabled={(game.players?.length || 0) >= 4}>+CPU</Btn>
                <Btn onClick={removeCPU} color="#fff">−CPU</Btn>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map(i => {
                const p = game.players?.[i] || null;
                return (
                  <SeatBadge key={i} player={p} seatNumber={i + 1}
                    isTurn={game.currentPlayerIndex === i && game.phase === 'playing'}
                    onKick={() => kickPlayer(p?.playerId)}
                    onForce={() => overrideTurn(i)}
                  />
                );
              })}
            </div>
          </div>

          {/* Scores */}
          <div className="rounded-xl border border-outlaw-gold/30 bg-black/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading text-[9px] tracking-widest text-outlaw-gold uppercase" style={PS2}>🏆 Scores</h3>
              <Btn onClick={resetScores} color="#ef4444">RESET</Btn>
            </div>
            <div className="space-y-1.5">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => {
                const pct = Math.min(100, ((p.score || 0) / (game.scoreLimit || 100)) * 100);
                return (
                  <div key={p.playerId} className="flex items-center gap-2">
                    <span className="text-white/30 text-[10px] w-3">{i + 1}.</span>
                    <span className="text-xs font-body truncate flex-1">{p.isHost ? '👑 ' : p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                    <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyber-purple to-outlaw-gold rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-outlaw-gold font-mono text-xs font-bold w-8 text-right">{p.score || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Game controls */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-3">
            <h3 className="font-heading text-[9px] tracking-widest text-white/40 uppercase mb-2" style={PS2}>🎛 Controls</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {game.phase === 'waiting' && <Btn onClick={startGame} color="#4ade80" disabled={(game.players?.length || 0) < 2}>▶ START</Btn>}
              {game.phase === 'round_over' && <Btn onClick={startNextRound} color="#FFD700">▶ NEXT ROUND</Btn>}
              {game.phase === 'playing' && (
                <>
                  <Btn onClick={() => overrideTurn((game.currentPlayerIndex + 1) % game.players.length)} color="#22d3ee">⏭ SKIP</Btn>
                </>
              )}
              <Btn onClick={endGame} color="#ef4444">🏁 END</Btn>
            </div>
            {/* Boneyard info */}
            <div className="flex items-center gap-2 text-xs font-body text-white/40">
              <span>Boneyard: <span className="text-white/70 font-mono">{game.boneyard?.length || 0}</span></span>
              <span>Ends: <span className="text-emerald-400 font-mono">{game.leftEnd ?? '—'} ↔ {game.rightEnd ?? '—'}</span></span>
            </div>
          </div>

          {/* Activity */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-3">
            <h3 className="font-heading text-[9px] tracking-widest text-white/40 uppercase mb-2" style={PS2}>📋 Log</h3>
            <div className="space-y-1 max-h-36 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {(game.activityFeed || []).map((entry, i) => (
                <div key={i} className="text-[10px] font-body text-white/50 border-l border-cyber-purple/30 pl-2">{entry}</div>
              ))}
            </div>
          </div>

          {/* Join link */}
          <div className="rounded-xl border border-cyber-purple/20 bg-black/30 p-3">
            <p className="text-[7px] text-white/30 uppercase tracking-widest mb-1" style={PS2}>Player Join Link</p>
            <code className="text-outlaw-gold font-mono text-[10px] break-all block bg-black/40 px-2 py-1.5 rounded border border-white/10 select-all">
              {window.location.origin}/games/txd?room={game.room_code}
            </code>
          </div>
        </div>

        {/* ── RIGHT: Table + Hand ── */}
        <div className="lg:col-span-2 space-y-3">

          {/* Game table */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{
              aspectRatio: '4/3',
              background: 'radial-gradient(ellipse at center,rgba(255,140,30,0.55) 0%,rgba(200,80,10,0.45) 50%,rgba(120,40,0,0.6) 100%)',
              border: '4px solid rgba(255,160,50,0.6)',
              boxShadow: 'inset 0 0 60px rgba(255,120,20,0.15),0 10px 40px rgba(255,100,0,0.3)',
            }}>
            {/* Logo watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png" alt="" style={{ opacity: 0.12, width: 100 }} />
            </div>
            <div className="absolute inset-0" style={{ zIndex: 1 }}>
              <TXDBoard
                board={game.board || []}
                gameState={gs}
                selectedDomino={selectedDomino}
                playableEnds={playableEnds}
                onPlayEnd={isHostTurn && selectedDomino ? doPlayOnEnd : undefined}
                interactive={isHostTurn && !!selectedDomino}
              />
            </div>
            {/* Status overlay */}
            <div className="absolute bottom-2 right-3 z-20 text-[9px] font-body">
              <span className={isHostTurn ? 'text-emerald-400 animate-pulse' : 'text-white/30'}>
                {isHostTurn ? '▶ YOUR TURN' : currentPlayer ? `${currentPlayer.playerName}'s turn` : ''}
              </span>
            </div>
          </div>

          {/* Host hand */}
          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(12,6,30,0.95)', border: '2px solid rgba(188,19,254,0.6)', boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[8px] text-cyber-purple uppercase tracking-widest font-body" style={PS2}>👑 HOST HAND ({hostHand.length} tiles)</span>
              {game.phase === 'playing' && (
                <span className={`text-xs font-body ${isHostTurn ? 'text-emerald-400 animate-pulse font-bold' : 'text-white/40'}`}>
                  {isHostTurn ? '⚡ YOUR TURN' : `${currentPlayer?.playerName || '...'} playing…`}
                </span>
              )}
            </div>

            {/* Tiles */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE40 transparent' }}>
              {hostHand.map(d => {
                const isPlayable = isHostTurn && playableIds.has(d.id);
                const isSelected = selectedDomino?.id === d.id;
                return (
                  <div key={d.id} className="flex-shrink-0 transition-all duration-150 cursor-pointer"
                    style={{ transform: isSelected ? 'translateY(-10px) scale(1.08)' : 'none', opacity: isHostTurn && !isPlayable ? 0.35 : 1 }}
                    onClick={() => {
                      if (!isHostTurn) return;
                      if (!isPlayable) { flash("That tile doesn't fit!", 'error'); return; }
                      // Non-board state: first play
                      if (gs.leftEnd === null) {
                        if (game.startingDominoLocked && d.id !== game.startingDominoLocked) {
                          flash(`Must start with [${game.startingDominoLocked}]`, 'error'); return;
                        }
                        if (d.top === d.bottom) { setOrientPicker({ domino: d, side: 'first' }); return; }
                        setSelectedDomino(d);
                        // Auto-play first tile since there's only one end
                        setTimeout(() => doPlayOnEndDirect(d, 'first'), 50);
                        return;
                      }
                      setSelectedDomino(prev => prev?.id === d.id ? null : d);
                    }}
                  >
                    <TXDDomino top={d.top} bottom={d.bottom} width={46} playable={isPlayable} selected={isSelected} />
                  </div>
                );
              })}
              {hostHand.length === 0 && <div className="text-white/20 font-body text-sm py-4">{game.phase === 'waiting' ? 'Tiles dealt when game starts' : 'No tiles'}</div>}
            </div>

            {/* Action buttons */}
            {isHostTurn && (
              <div className="flex flex-wrap gap-2 items-center">
                {selectedDomino && gs.leftEnd !== null && (
                  <span className="text-emerald-400/70 text-xs font-body">
                    {playableEnds.size > 0 ? `Tap a glowing zone to place [${selectedDomino.id}]` : <span className="text-red-400">Tile doesn't fit any end</span>}
                  </span>
                )}
                {!hasLegalMove && (game.boneyard || []).length > 0 && (
                  <button onClick={doDraw}
                    className="px-4 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white border-2 border-emerald-500 hover:bg-emerald-500/20"
                    style={{ boxShadow: '0 0 10px rgba(16,185,129,0.4)' }}>
                    📦 DRAW
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
                  <button onClick={() => setSelectedDomino(null)} className="px-3 py-2 rounded-xl font-heading text-sm uppercase text-white/40 border border-white/15 hover:border-white/30">CANCEL</button>
                )}
              </div>
            )}
          </div>

          {/* Opponents tile counts */}
          {game.players?.filter(p => !p.isHost).length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <h3 className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-2" style={PS2}>Opponents</h3>
              <div className="flex flex-wrap gap-3">
                {game.players.filter(p => !p.isHost).map((p, _) => {
                  const idx = game.players.indexOf(p);
                  const isTurn = game.currentPlayerIndex === idx && game.phase === 'playing';
                  return (
                    <div key={p.playerId} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-body ${isTurn ? 'bg-emerald-900/30 border border-emerald-600/40' : 'bg-white/5 border border-white/10'}`}>
                      {isTurn && <span className="text-emerald-400">▶</span>}
                      {p.isAI ? '🤖' : '👤'}
                      <span className={isTurn ? 'text-white font-bold' : 'text-white/60'}>{p.playerName}</span>
                      <span className="text-white/40 font-mono">({p.hand?.length || 0})</span>
                      <span className="text-outlaw-gold font-mono">{p.score || 0}pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-lg font-body text-sm z-50 pointer-events-none ${feedback.type === 'error' ? 'bg-red-900/90 border border-red-500 text-red-200' : 'bg-black/80 border border-cyber-purple/50 text-white'}`}>
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
                  onClick={() => { doPlayOnEnd(orientPicker.side, ori); setOrientPicker(null); }}>
                  <div className="p-2 rounded-xl border border-white/10 group-hover:border-cyber-purple/60 group-hover:bg-cyber-purple/10 transition-all">
                    <TXDDomino top={orientPicker.domino.top} bottom={orientPicker.domino.bottom} width={36} orientation={ori} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center" style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && <p className="text-white/70 font-body mb-4">{game.roundWinner.playerName} wins +{game.roundWinner.points} pts</p>}
            <div className="space-y-2 mb-5">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className="flex justify-between px-4 py-2 rounded-lg font-body bg-white/5">
                  <span className="text-sm">{i === 0 ? '🥇 ' : ''}{p.isAI ? '🤖 ' : p.isHost ? '👑 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0} pts</span>
                </div>
              ))}
            </div>
            <button onClick={startNextRound} className="w-full py-3 rounded-xl font-heading tracking-widest uppercase text-black text-lg" style={{ background: '#FFD700' }}>
              START NEXT ROUND
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {(gameOver || game.phase === 'game_over') && game.phase !== 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center">
            <h2 className="text-4xl font-heading text-outlaw-gold mb-2">GAME OVER!</h2>
            <p className="text-2xl font-heading text-white mb-5">🏆 {gameWinner?.playerName} WINS!</p>
            <div className="space-y-2 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className="flex justify-between font-body px-4 py-2 rounded-lg bg-white/5">
                  <span className="text-sm">{i === 0 ? '👑 ' : ''}{p.isAI ? '🤖 ' : p.isHost ? '👑 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0} pts</span>
                </div>
              ))}
            </div>
            <button onClick={() => setGame(null)} className="w-full py-2.5 rounded-lg border border-white/30 text-white font-heading hover:bg-white/10">NEW GAME</button>
          </div>
        </div>
      )}
    </div>
  );

  // Helper for first-tile direct play (no end selection needed)
  function doPlayOnEndDirect(domino, side, chosenOrientation = null) {
    setSelectedDomino(domino);
    // Use a microtask so selectedDomino state is set
    setTimeout(() => doPlayOnEnd(side, chosenOrientation), 10);
  }
}