import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDDomino from '@/components/domino/TXDDomino';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  DOMINO_SET, generateRoomCode, deal, findDoubleSixHolder,
  getPlaySide, getPlayableDominoes, playDomino,
  calculateRoundScores, aiChoosePlay,
} from '@/lib/txdDominoEngine';

const HAND_TILE_W = 50;
const AI_NAMES = ['Dexter', 'Duchess', 'Ranger', 'Maverick'];
const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const Btn = ({ children, onClick, color = '#BC13FE', disabled = false, size = 'sm' }) => {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${pad} rounded-lg border-2 font-heading tracking-wider uppercase transition-all active:scale-95 disabled:opacity-40`}
      style={{ borderColor: color, color }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}20`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
};

// Seat badge displayed around the host table
function HostSeatBadge({ player, isTurn, seatNumber, onKick, onForce }) {
  const colors = {
    host: '#BC13FE',
    ai: '#22d3ee',
    player: '#4ade80',
    empty: '#ffffff20',
  };
  const type = !player ? 'empty' : player.isHost ? 'host' : player.isAI ? 'ai' : 'player';
  const color = colors[type];
  return (
    <div className="p-2 rounded-xl border text-center min-w-[100px]" style={{ borderColor: `${color}40`, background: `${color}08` }}>
      <div className="text-[8px] uppercase tracking-widest mb-1 font-body" style={{ color: `${color}80` }}>Seat {seatNumber}</div>
      {player ? (
        <>
          <div className="text-white text-xs font-body font-bold truncate">
            {player.isHost ? '👑 ' : player.isAI ? '🤖 ' : '👤 '}{player.playerName}
          </div>
          <div className="text-[9px] font-mono mt-0.5" style={{ color }}>{player.score || 0} pts · {player.hand?.length ?? 0} tiles</div>
          {isTurn && <div className="text-[8px] text-emerald-400 mt-0.5 animate-pulse">▶ PLAYING</div>}
          <div className="flex gap-1 mt-1.5 justify-center">
            {!player.isHost && (
              <button onClick={() => onForce()} className="text-[8px] px-1.5 py-0.5 rounded border border-cyber-purple/40 text-cyber-purple hover:bg-cyber-purple/20 font-heading">TURN</button>
            )}
            {!player.isHost && !player.isAI && (
              <button onClick={() => onKick()} className="text-[8px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 font-heading">KICK</button>
            )}
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
  const pollRef = useRef(null);

  // Derived — Host is always player index 0 (seat 1)
  const hostIndex = game?.players?.findIndex(p => p.isHost) ?? -1;
  const hostPlayer = hostIndex >= 0 ? game?.players?.[hostIndex] : null;
  const isHostTurn = game?.phase === 'playing' && game?.currentPlayerIndex === hostIndex;
  const hostHand = hostPlayer?.hand || [];
  const playable = getPlayableDominoes(hostHand, game?.leftEnd ?? null, game?.rightEnd ?? null);
  const playableIds = new Set(playable.map(d => d.id));
  const currentPlayer = game?.players?.[game?.currentPlayerIndex];

  const flash = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2500);
  };

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

  // AI automation
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const current = game.players?.[game.currentPlayerIndex];
    if (!current?.isAI) return;
    const t = setTimeout(() => runAI(game, current, game.currentPlayerIndex), 1400);
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
      const isFirstPlay = (g.board?.length || 0) === 0;
      const { newLeftEnd, newRightEnd } = playDomino(domino, g.leftEnd ?? null, g.rightEnd ?? null, side);
      const newHand = aiPlayer.hand.filter(d => d.id !== domino.id);
      const boardEntry = { ...domino, side, isSpinner: isFirstPlay && domino.top === domino.bottom };
      const newBoard = side === 'left' ? [boardEntry, ...(g.board || [])] : [...(g.board || []), boardEntry];
      const players = g.players.map((p, i) => i === aiIdx ? { ...p, hand: newHand } : p);
      const roundOver = newHand.length === 0;
      const pts = roundOver ? calculateRoundScores(players, aiIdx) : 0;
      if (roundOver) players[aiIdx] = { ...players[aiIdx], score: (players[aiIdx].score || 0) + pts };
      const feed = [...(g.activityFeed || [])];
      feed.unshift(`🤖 ${aiPlayer.playerName} played ${domino.top}-${domino.bottom}`);
      updated = {
        ...g, board: newBoard, leftEnd: newLeftEnd, rightEnd: newRightEnd, players,
        currentPlayerIndex: roundOver ? aiIdx : next,
        phase: roundOver ? 'round_over' : 'playing',
        roundWinner: roundOver ? { playerName: aiPlayer.playerName, points: pts } : null,
        lastAction: { type: 'play', player: aiPlayer.playerName, domino },
        activityFeed: feed.slice(0, 30),
      };
    }
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  // ── Room Creation ──────────────────────────────────────────────────────────
  const createRoom = async () => {
    setLoading(true);
    let user = null; try { user = await base44.auth.me(); } catch (_) {}
    const pid = user?.id || `host_${Date.now()}`;
    const code = generateRoomCode();
    // Seat 1 = Host
    const hostObj = {
      playerId: pid, seatNumber: 1, playerName: 'Host',
      hand: [], score: 0, roundScore: 0,
      status: 'active', isAI: false, isHost: true,
    };
    const created = await base44.entities.TXDGame.create({
      room_code: code, status: 'waiting',
      players: [hostObj],
      board: [], boneyard: [], leftEnd: null, rightEnd: null,
      currentPlayerIndex: 0, roundNumber: 1, phase: 'waiting',
      scoreLimit, activityFeed: [`Room ${code} created`],
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
    } catch (_) { flash('Error', 'error'); }
    setLoading(false);
  };

  // ── Player/CPU Management ──────────────────────────────────────────────────
  const addCPU = async () => {
    const g = game;
    if ((g.players?.length || 0) >= 4) { flash('Max 4 players', 'error'); return; }
    const aiCount = g.players.filter(p => p.isAI).length;
    const ai = {
      playerId: `ai_${Date.now()}`,
      seatNumber: g.players.length + 1,
      playerName: AI_NAMES[aiCount] || `CPU${aiCount + 1}`,
      hand: [], score: 0, roundScore: 0, status: 'active', isAI: true, isHost: false,
    };
    const feed = [...(g.activityFeed || [])];
    feed.unshift(`🤖 ${ai.playerName} added to Seat ${ai.seatNumber}`);
    const updated = { ...g, players: [...g.players, ai], activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const removeCPU = async () => {
    const g = game;
    const last = [...g.players].reverse().find(p => p.isAI);
    if (!last) return;
    const feed = [...(g.activityFeed || [])];
    feed.unshift(`🤖 ${last.playerName} removed`);
    const updated = { ...g, players: g.players.filter(p => p.playerId !== last.playerId), activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const kickPlayer = async (pid) => {
    const p = game.players.find(pl => pl.playerId === pid);
    if (!p) return;
    const feed = [...(game.activityFeed || [])];
    feed.unshift(`⚡ ${p.playerName} was kicked`);
    const updated = { ...game, players: game.players.filter(pl => pl.playerId !== pid), activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const overrideTurn = async (idx) => {
    const p = game.players[idx];
    const feed = [...(game.activityFeed || [])];
    feed.unshift(`⚡ Host forced turn to ${p?.playerName}`);
    const updated = { ...game, currentPlayerIndex: idx, activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
    flash(`Turn forced to ${p?.playerName}`, 'info');
  };

  const skipTurn = async () => {
    const g = game;
    const ni = (g.currentPlayerIndex + 1) % g.players.length;
    const skipped = g.players[g.currentPlayerIndex];
    const feed = [...(g.activityFeed || [])];
    feed.unshift(`⚡ Host skipped ${skipped?.playerName}'s turn`);
    const updated = { ...g, currentPlayerIndex: ni, activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  // ── Game Controls ──────────────────────────────────────────────────────────
  const startGame = async () => {
    const g = game;
    const active = g.players.filter(p => p.status === 'active');
    if (active.length < 2) { flash('Need at least 2 players', 'error'); return; }
    const { hands, boneyard } = deal(DOMINO_SET, active.length);
    let hi = 0;
    const players = g.players.map(p => p.status !== 'active' ? p : { ...p, hand: hands[hi++], roundScore: 0 });
    const startPlayerIndex = findDoubleSixHolder(players.map(p => p.hand || []));
    const starterName = players[startPlayerIndex >= 0 ? startPlayerIndex : 0]?.playerName;
    const feed = [`🎮 Game started — ${starterName} has [6-6] and goes first`, ...( g.activityFeed || [])];
    const updated = {
      ...g, status: 'active', boneyard, players, board: [], leftEnd: null, rightEnd: null,
      currentPlayerIndex: startPlayerIndex >= 0 ? startPlayerIndex : 0, phase: 'playing', roundWinner: null,
      activityFeed: feed.slice(0, 30),
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const startNextRound = async () => {
    const g = game;
    const active = g.players.filter(p => p.status === 'active');
    const { hands, boneyard } = deal(DOMINO_SET, active.length);
    let hi = 0;
    const players = g.players.map(p => p.status !== 'active' ? p : { ...p, hand: hands[hi++], roundScore: 0 });
    const startPlayerIndex = findDoubleSixHolder(players.map(p => p.hand || []));
    const rn = (g.roundNumber || 1) + 1;
    const starterName = players[startPlayerIndex >= 0 ? startPlayerIndex : 0]?.playerName;
    const feed = [`🎮 Round ${rn} — ${starterName} has [6-6]`, ...(g.activityFeed || [])];
    const updated = {
      ...g, board: [], leftEnd: null, rightEnd: null, boneyard, players,
      currentPlayerIndex: startPlayerIndex >= 0 ? startPlayerIndex : 0, roundNumber: rn,
      phase: 'playing', roundWinner: null, activityFeed: feed.slice(0, 30),
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const resetRound = async () => {
    const g = game;
    const active = g.players.filter(p => p.status === 'active');
    const { hands, boneyard } = deal(DOMINO_SET, active.length);
    let hi = 0;
    const players = g.players.map(p => p.status !== 'active' ? p : { ...p, hand: hands[hi++], roundScore: 0 });
    const startPlayerIndex = findDoubleSixHolder(players.map(p => p.hand || []));
    const feed = [`↺ Host reset round ${g.roundNumber || 1}`, ...(g.activityFeed || [])];
    const updated = {
      ...g, board: [], leftEnd: null, rightEnd: null, boneyard, players,
      currentPlayerIndex: startPlayerIndex >= 0 ? startPlayerIndex : 0, phase: 'playing', roundWinner: null,
      activityFeed: feed.slice(0, 30),
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const endGame = async () => {
    const feed = [`🏁 Host ended the game`, ...(game.activityFeed || [])];
    const updated = { ...game, phase: 'game_over', status: 'finished', activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const resetScores = async () => {
    const updated = { ...game, players: game.players.map(p => ({ ...p, score: 0 })) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  // ── Host Play Actions ──────────────────────────────────────────────────────
  const doPlay = async (side) => {
    if (!selectedDomino || !isHostTurn || !game) return;
    const g = game;
    const isFirstPlay = (g.board?.length || 0) === 0;
    const actualSide = isFirstPlay ? 'first' : side;

    // Enforce Double 6 as first play
    if (isFirstPlay && selectedDomino.id !== '6-6') {
      flash('Double 6 must be played first!', 'error');
      return;
    }

    const { newLeftEnd, newRightEnd } = playDomino(selectedDomino, g.leftEnd ?? null, g.rightEnd ?? null, actualSide);
    const newHand = hostPlayer.hand.filter(d => d.id !== selectedDomino.id);
    const boardEntry = { ...selectedDomino, side: actualSide, isSpinner: isFirstPlay && selectedDomino.top === selectedDomino.bottom };
    const newBoard = actualSide === 'left' ? [boardEntry, ...(g.board || [])] : [...(g.board || []), boardEntry];
    let ni = (hostIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== hostIndex) ni = (ni + 1) % g.players.length;
    const players = g.players.map((p, i) => i === hostIndex ? { ...p, hand: newHand } : p);
    const roundOver = newHand.length === 0;
    const pts = roundOver ? calculateRoundScores(players, hostIndex) : 0;
    if (roundOver) players[hostIndex] = { ...players[hostIndex], score: (players[hostIndex].score || 0) + pts };
    const feed = [...(g.activityFeed || [])];
    feed.unshift(`👑 Host played ${selectedDomino.top}-${selectedDomino.bottom}`);
    const updated = {
      ...g, board: newBoard, leftEnd: newLeftEnd, rightEnd: newRightEnd, players,
      currentPlayerIndex: roundOver ? hostIndex : ni,
      phase: roundOver ? 'round_over' : 'playing',
      roundWinner: roundOver ? { playerName: 'Host', points: pts } : null,
      lastAction: { type: 'play', player: 'Host', domino: selectedDomino },
      activityFeed: feed.slice(0, 30),
    };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const doDraw = async () => {
    if (!isHostTurn || !game) return;
    const g = game;
    let ni = (hostIndex + 1) % g.players.length;
    while (g.players[ni]?.status !== 'active' && ni !== hostIndex) ni = (ni + 1) % g.players.length;
    if (!g.boneyard?.length) {
      const feed = [...(g.activityFeed || [])];
      feed.unshift(`👑 Host passed (boneyard empty)`);
      const updated = { ...g, currentPlayerIndex: ni, lastAction: { type: 'pass', player: 'Host' }, activityFeed: feed.slice(0, 30) };
      await base44.entities.TXDGame.update(g.id, updated);
      setGame(updated);
      return;
    }
    const [drawn, ...boneyard] = g.boneyard;
    const players = g.players.map((p, i) => i === hostIndex ? { ...p, hand: [...p.hand, drawn] } : p);
    const feed = [...(g.activityFeed || [])];
    feed.unshift(`👑 Host drew from boneyard`);
    const updated = { ...g, boneyard, players, lastAction: { type: 'draw', player: 'Host' }, activityFeed: feed.slice(0, 30) };
    await base44.entities.TXDGame.update(g.id, updated);
    setGame(updated);
  };

  const doSort = () => {
    if (!game || !hostPlayer) return;
    const sorted = [...hostHand].sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom));
    const players = game.players.map((p, i) => i === hostIndex ? { ...p, hand: sorted } : p);
    setGame({ ...game, players });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/games/txd?room=${game.room_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Landing ────────────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="min-h-screen bg-midnight-void">
        <Header />
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple text-[9px] tracking-widest uppercase mb-3" style={PS2}>🎛 HOST CONTROL CENTER</div>
            <h1 className="text-5xl font-heading text-outlaw-gold tracking-widest mb-1">TXD DOMINOES</h1>
            <p className="text-white/40 font-body text-sm">Texas Dominoes — Host Command Dashboard</p>
          </div>

          <div className="p-4 rounded-xl border border-cyber-purple/30 bg-black/40 mb-5">
            <label className="text-[9px] text-white/40 uppercase tracking-widest font-body block mb-2" style={PS2}>Score Limit (Points to Win)</label>
            <div className="flex gap-2">
              {[50, 100, 150, 200].map(v => (
                <button key={v} onClick={() => setScoreLimit(v)}
                  className={`flex-1 py-2 rounded-lg font-heading text-sm tracking-widest transition-all
                    ${scoreLimit === v ? 'bg-cyber-purple text-white' : 'border border-white/20 text-white/50 hover:border-cyber-purple/60'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={createRoom} disabled={loading}
              className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase text-white disabled:opacity-50 hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #BC13FE, #7c3aed)', boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}>
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
                className="px-5 py-3 rounded-lg border-2 border-outlaw-gold text-outlaw-gold font-heading tracking-wider hover:bg-outlaw-gold hover:text-black transition-all disabled:opacity-40">JOIN</button>
            </div>
          </div>
          {feedback && <p className="mt-4 text-center text-red-400 text-sm font-body">{feedback.msg}</p>}
        </div>
      </div>
    );
  }

  // ── Host Command Dashboard ─────────────────────────────────────────────────
  const allSeats = [
    game.players?.find(p => p.seatNumber === 1 || p.isHost) || null,
    game.players?.find(p => p.seatNumber === 2 && !p.isHost) || null,
    game.players?.find(p => p.seatNumber === 3) || null,
    game.players?.find(p => p.seatNumber === 4) || null,
  ];
  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;

  return (
    <div className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a0318, #050505)' }}>
      <Header />

      {/* ── Command Header ── */}
      <div className="border-b border-cyber-purple/40 bg-black/70 px-4 py-2.5 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[9px] px-2 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple tracking-widest uppercase" style={PS2}>🎛 HOST</span>
            <span className="font-mono text-outlaw-gold text-xl font-bold tracking-widest">{game.room_code}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest
              ${game.phase === 'playing' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-600/30'
              : game.phase === 'round_over' ? 'bg-outlaw-gold/20 text-outlaw-gold border border-outlaw-gold/30'
              : 'bg-white/5 text-white/40 border border-white/10'}`} style={PS2}>
              {game.phase?.replace('_', ' ')}
            </span>
            <span className="text-white/30 text-xs font-body">Round {game.roundNumber || 1}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={copyLink} className="px-3 py-1.5 rounded-lg border border-outlaw-gold/50 text-outlaw-gold text-xs font-heading hover:bg-outlaw-gold/10 transition-all">
              {copied ? '✓ COPIED!' : '📋 COPY JOIN LINK'}
            </button>
            <button onClick={() => setGame(null)} className="px-3 py-1.5 rounded-lg border border-white/20 text-white/40 text-xs font-heading hover:border-white/40">✕</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── LEFT: Command Center ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Room Status */}
          <div className="rounded-xl border border-cyber-purple/30 bg-black/60 p-4">
            <h3 className="font-heading text-xs tracking-widest text-cyber-purple uppercase mb-3">📡 Room Status</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-body">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-white/40 text-[9px] uppercase mb-0.5">Players</div>
                <div className="text-white font-mono font-bold">{game.players?.length || 0}/4</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-white/40 text-[9px] uppercase mb-0.5">Boneyard</div>
                <div className="text-white font-mono font-bold">{game.boneyard?.length || 0}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-white/40 text-[9px] uppercase mb-0.5">Left End</div>
                <div className="text-emerald-400 font-mono font-bold">{game.leftEnd ?? '—'}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-white/40 text-[9px] uppercase mb-0.5">Right End</div>
                <div className="text-emerald-400 font-mono font-bold">{game.rightEnd ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Seat Management */}
          <div className="rounded-xl border border-cyber-purple/30 bg-black/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-xs tracking-widest text-cyber-purple uppercase">👥 Seats</h3>
              <div className="flex gap-1">
                <Btn onClick={addCPU} disabled={(game.players?.length || 0) >= 4}>+ CPU</Btn>
                <Btn onClick={removeCPU} color="#ffffff">− CPU</Btn>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allSeats.map((p, i) => (
                <HostSeatBadge key={i} player={p} seatNumber={i + 1}
                  isTurn={game.currentPlayerIndex === game.players?.indexOf(p) && game.phase === 'playing'}
                  onKick={() => kickPlayer(p?.playerId)}
                  onForce={() => overrideTurn(game.players?.indexOf(p))}
                />
              ))}
            </div>
          </div>

          {/* Scoreboard */}
          <div className="rounded-xl border border-outlaw-gold/30 bg-black/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-xs tracking-widest text-outlaw-gold uppercase">🏆 Scores</h3>
              <Btn onClick={resetScores} color="#ef4444" size="sm">RESET</Btn>
            </div>
            <div className="space-y-1.5">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => {
                const pct = Math.min(100, ((p.score || 0) / (game.scoreLimit || 100)) * 100);
                return (
                  <div key={p.playerId} className="flex items-center gap-2">
                    <span className="text-white/30 text-[10px] w-3">{i + 1}.</span>
                    <span className="text-xs font-body truncate flex-1">{p.isHost ? '👑 ' : p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyber-purple to-outlaw-gold rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-outlaw-gold font-mono text-xs font-bold w-10 text-right">{p.score || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Game Controls */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-4">
            <h3 className="font-heading text-xs tracking-widest text-white/40 uppercase mb-3">🎛 Game Controls</h3>
            <div className="flex flex-wrap gap-2">
              {game.phase === 'waiting' && (
                <Btn onClick={startGame} color="#4ade80" size="sm" disabled={(game.players?.length || 0) < 2}>▶ START</Btn>
              )}
              {game.phase === 'round_over' && (
                <Btn onClick={startNextRound} color="#FFD700" size="sm">▶ NEXT ROUND</Btn>
              )}
              {game.phase === 'playing' && (
                <>
                  <Btn onClick={skipTurn} color="#22d3ee" size="sm">⏭ SKIP TURN</Btn>
                  <Btn onClick={resetRound} color="#FF5F1F" size="sm">↺ RESET ROUND</Btn>
                </>
              )}
              <Btn onClick={endGame} color="#ef4444" size="sm">🏁 END GAME</Btn>
            </div>
            {game.phase === 'playing' && (
              <div className="mt-3">
                <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1.5" style={PS2}>Override Turn</div>
                <div className="flex flex-wrap gap-1.5">
                  {game.players?.map((p, i) => (
                    <button key={p.playerId} onClick={() => overrideTurn(i)}
                      className={`px-2 py-1 rounded text-[9px] font-body transition-all
                        ${game.currentPlayerIndex === i ? 'bg-cyber-purple text-white' : 'border border-white/20 text-white/40 hover:border-cyber-purple/50'}`}>
                      {p.isAI ? '🤖' : p.isHost ? '👑' : '👤'} {p.playerName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-4">
            <h3 className="font-heading text-xs tracking-widest text-white/40 uppercase mb-3">📋 Activity Feed</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {(game.activityFeed || []).length === 0 && (
                <p className="text-white/20 text-xs font-body">No activity yet</p>
              )}
              {(game.activityFeed || []).map((entry, i) => (
                <div key={i} className="text-xs font-body text-white/50 border-l border-cyber-purple/30 pl-2 py-0.5">{entry}</div>
              ))}
            </div>
          </div>

          {/* Join Link */}
          <div className="rounded-xl border border-cyber-purple/20 bg-black/30 p-3">
            <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1" style={PS2}>Player Join Link</p>
            <code className="text-outlaw-gold font-mono text-[10px] break-all block bg-black/40 px-2 py-1.5 rounded border border-white/10 select-all">
              {window.location.origin}/games/txd?room={game.room_code}
            </code>
          </div>
        </div>

        {/* ── RIGHT: Live Table + Host Hand ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Live Board */}
          <div className="relative rounded-3xl overflow-visible"
            style={{
              aspectRatio: '4/3',
              background: 'radial-gradient(ellipse at center, rgba(255,140,30,0.55) 0%, rgba(200,80,10,0.45) 50%, rgba(120,40,0,0.6) 100%)',
              backdropFilter: 'blur(12px)',
              border: '4px solid rgba(255,160,50,0.6)',
              boxShadow: 'inset 0 0 60px rgba(255,120,20,0.15), inset 0 0 30px rgba(255,180,60,0.1), 0 10px 40px rgba(255,100,0,0.3)',
              isolation: 'isolate',
            }}>
            {/* Glass sheen */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(255,220,100,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)' }} />
            {/* Logo watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 1 }}>
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png"
                alt="TN" className="object-contain" style={{ opacity: 0.2, width: 100, height: 100 }} />
            </div>
            {/* Board chain — centered in table */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <TXDBoard board={game.board || []} leftEnd={game.leftEnd} rightEnd={game.rightEnd} />
            </div>
            {/* Boneyard — top-left corner */}
            <div className="absolute left-3 top-3 z-20 flex flex-col items-center gap-0.5">
              {Array.from({ length: Math.min(game.boneyard?.length || 0, 5) }).map((_, i) => (
                <TXDDomino key={i} top={0} bottom={0} width={14} faceDown />
              ))}
              <span className="text-white/50 text-[8px] font-mono mt-0.5">{game.boneyard?.length || 0}</span>
              <span className="text-white/25 text-[7px] font-body">BONEYARD</span>
            </div>
            {/* Turn / ends overlay */}
            <div className="absolute bottom-2 right-3 z-10 flex items-center gap-2 text-[9px] font-body">
              {game.phase === 'playing' && game.leftEnd !== null && (
                <span className="text-emerald-400/80">Ends: <span className="font-mono font-bold">{game.leftEnd}</span> ↔ <span className="font-mono font-bold">{game.rightEnd}</span></span>
              )}
              <span className={`px-2 py-0.5 rounded ${isHostTurn ? 'text-emerald-400 bg-black/60' : 'text-white/30 bg-black/40'}`}>
                {isHostTurn ? '▶ YOUR TURN' : currentPlayer ? currentPlayer.playerName : '—'}
              </span>
            </div>
            {game.lastAction && (
              <div className="absolute top-2 right-3 z-10 text-[9px] text-white/25 font-body italic">
                {game.lastAction.player} {game.lastAction.type === 'play' ? 'played' : game.lastAction.type === 'draw' ? 'drew' : 'passed'}
              </div>
            )}
          </div>

          {/* Host Hand + Controls */}
          <div className="rounded-2xl p-4"
            style={{
              background: 'rgba(12,6,30,0.95)',
              border: '2px solid rgba(188,19,254,0.6)',
              boxShadow: '0 0 20px rgba(188,19,254,0.2)',
            }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-cyber-purple uppercase tracking-widest" style={PS2}>👑 HOST HAND</span>
                <span className="text-white/30 text-xs font-body font-mono">({hostHand.length} tiles)</span>
              </div>
              {game.phase === 'waiting' && (
                <span className="text-white/30 text-xs font-body italic">Start game to receive tiles</span>
              )}
              {game.phase === 'playing' && (
                <span className={`text-xs font-body ${isHostTurn ? 'text-emerald-400 animate-pulse font-bold' : 'text-white/40'}`}>
                  {isHostTurn ? '⚡ YOUR TURN' : `Waiting for ${currentPlayer?.playerName}…`}
                </span>
              )}
            </div>

            {/* Hand */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE40 transparent' }}>
              {hostHand.map(d => {
                const isPlayable = isHostTurn && playableIds.has(d.id);
                const isSelected = selectedDomino?.id === d.id;
                return (
                  <div key={d.id} className="flex-shrink-0 transition-all duration-150"
                    style={{ transform: isSelected ? 'translateY(-10px) scale(1.05)' : 'none' }}>
                    <TXDDomino
                      top={d.top} bottom={d.bottom}
                      width={HAND_TILE_W}
                      playable={isPlayable}
                      selected={isSelected}
                      onClick={() => {
                        if (!isHostTurn) return;
                        if (!playableIds.has(d.id)) { flash("Doesn't fit right now", 'error'); return; }
                        setSelectedDomino(prev => prev?.id === d.id ? null : d);
                      }}
                    />
                  </div>
                );
              })}
              {hostHand.length === 0 && game.phase === 'playing' && (
                <div className="text-white/20 font-body text-sm py-4">No tiles in hand</div>
              )}
              {hostHand.length === 0 && game.phase === 'waiting' && (
                <div className="text-white/20 font-body text-sm py-4">Tiles appear here after game starts</div>
              )}
            </div>

            {/* Play buttons */}
            {isHostTurn && (
              <div className="flex flex-wrap gap-2">
                {selectedDomino && game.board?.length === 0 && (
                  selectedDomino.id === '6-6'
                    ? <button onClick={() => doPlay('first')}
                        className="px-5 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 0 10px rgba(22,163,74,0.4)' }}>
                        PLAY SPINNER [6-6]
                      </button>
                    : <span className="text-amber-400/80 text-xs font-body py-2 animate-pulse">⚠ Double 6 must be played first</span>
                )}
                {!selectedDomino && game.board?.length === 0 && isHostTurn && (
                  <span className="text-white/40 text-xs font-body py-2">Select the [6-6] tile to start</span>
                )}
                {selectedDomino && (game.board?.length || 0) > 0 && (() => {
                  const side = getPlaySide(selectedDomino, game.leftEnd, game.rightEnd);
                  if (!side) return <span className="text-red-400 text-xs font-body py-2">Doesn't fit</span>;
                  return (
                    <>
                      {(side === 'left' || side === 'both') && (
                        <button onClick={() => doPlay('left')}
                          className="px-4 py-2 rounded-xl font-heading text-sm uppercase text-white bg-emerald-700 hover:bg-emerald-600">
                          PLAY LEFT ({game.leftEnd})
                        </button>
                      )}
                      {(side === 'right' || side === 'both') && (
                        <button onClick={() => doPlay('right')}
                          className="px-4 py-2 rounded-xl font-heading text-sm uppercase text-white bg-emerald-800 hover:bg-emerald-700">
                          PLAY RIGHT ({game.rightEnd})
                        </button>
                      )}
                    </>
                  );
                })()}
                {!selectedDomino && (
                  <button onClick={doDraw}
                    className="px-5 py-2 rounded-xl font-heading text-sm tracking-widest uppercase text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                    {(game.boneyard?.length || 0) > 0 ? `DRAW (${game.boneyard.length})` : 'PASS'}
                  </button>
                )}
                <button onClick={doSort}
                  className="px-4 py-2 rounded-xl font-heading text-sm uppercase text-white/60 border border-white/20 hover:border-white/40">
                  SORT
                </button>
                {selectedDomino && (
                  <button onClick={() => setSelectedDomino(null)}
                    className="px-4 py-2 rounded-xl font-heading text-sm uppercase text-white/40 border border-white/10 hover:border-white/20">
                    CANCEL
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Other players' tile counts */}
          {game.players?.filter(p => !p.isHost).length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <h3 className="font-heading text-[9px] tracking-widest text-white/30 uppercase mb-2" style={PS2}>Opponent Tile Counts</h3>
              <div className="flex flex-wrap gap-3">
                {game.players.filter(p => !p.isHost).map(p => {
                  const idx = game.players.indexOf(p);
                  const isTurn = game.currentPlayerIndex === idx && game.phase === 'playing';
                  return (
                    <div key={p.playerId} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-body
                      ${isTurn ? 'bg-emerald-900/30 border border-emerald-600/40' : 'bg-white/5 border border-white/10'}`}>
                      {isTurn && <span className="text-emerald-400">▶</span>}
                      {p.isAI && <span>🤖</span>}
                      <span className={isTurn ? 'text-white' : 'text-white/60'}>{p.playerName}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(p.hand?.length || 0, 10) }).map((_, j) => (
                          <TXDDomino key={j} top={0} bottom={0} width={10} faceDown />
                        ))}
                      </div>
                      <span className="text-white/40 font-mono">({p.hand?.length || 0})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center" style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && <p className="text-white/70 font-body mb-4">{game.roundWinner.playerName} wins +{game.roundWinner.points} pts</p>}
            <div className="space-y-2 mb-5">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className="flex justify-between items-center px-4 py-2 rounded-lg font-body bg-white/5">
                  <span className="text-sm">{i === 0 ? '🥇 ' : ''}{p.isAI ? '🤖 ' : p.isHost ? '👑 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0} pts</span>
                </div>
              ))}
            </div>
            <button onClick={startNextRound}
              className="w-full py-3 rounded-xl font-heading tracking-widest uppercase text-black text-lg"
              style={{ background: '#FFD700', boxShadow: '0 0 15px rgba(255,215,0,0.4)' }}>
              START NEXT ROUND
            </button>
          </div>
        </div>
      )}

      {/* Game Over */}
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
}