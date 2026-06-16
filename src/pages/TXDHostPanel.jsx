import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TXDBoard from '@/components/domino/TXDBoard';
import Header from '@/components/home/Header';
import {
  DOMINO_SET, generateRoomCode, deal, findHighestDouble,
  calculateRoundScores, aiChoosePlay, playDomino,
} from '@/lib/txdDominoEngine';

const AI_NAMES = ['Dexter', 'Duchess', 'Ranger', 'Maverick'];
const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const Btn = ({ children, onClick, color = '#BC13FE', disabled = false, className = '' }) => (
  <button onClick={onClick} disabled={disabled}
    className={`px-4 py-2 rounded-lg border-2 font-heading tracking-wider text-sm uppercase transition-all active:scale-95 disabled:opacity-40 ${className}`}
    style={{ borderColor: color, color }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}20`; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
    {children}
  </button>
);

export default function TXDHostPanel() {
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [scoreLimit, setScoreLimit] = useState(100);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  const flash = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2500);
  };

  // Poll for live updates
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

  // AI turn automation
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

  // ── Room Actions ────────────────────────────────────────────────────────────
  const createRoom = async () => {
    setLoading(true);
    const code = generateRoomCode();
    const created = await base44.entities.TXDGame.create({
      room_code: code, status: 'waiting', players: [],
      board: [], boneyard: [], leftEnd: null, rightEnd: null,
      currentPlayerIndex: 0, roundNumber: 1, phase: 'waiting',
      scoreLimit, lastAction: null,
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
    } catch (_) { flash('Error joining room', 'error'); }
    setLoading(false);
  };

  const addCPU = async () => {
    const g = game;
    if ((g.players?.length || 0) >= 4) { flash('Max 4 players', 'error'); return; }
    const aiCount = g.players.filter(p => p.isAI).length;
    const ai = {
      playerId: `ai_${Date.now()}`, seatNumber: g.players.length + 1,
      playerName: AI_NAMES[aiCount] || `CPU${aiCount + 1}`,
      hand: [], score: 0, roundScore: 0, status: 'active', isAI: true, isHost: false,
    };
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

  const kickPlayer = async (playerId) => {
    const updated = { ...game, players: game.players.filter(p => p.playerId !== playerId) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
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
  };

  const overrideTurn = async (idx) => {
    const updated = { ...game, currentPlayerIndex: idx };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const resetScores = async () => {
    const updated = { ...game, players: game.players.map(p => ({ ...p, score: 0, roundScore: 0 })) };
    await base44.entities.TXDGame.update(game.id, updated);
    setGame(updated);
  };

  const copyJoinLink = () => {
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
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple text-[9px] tracking-widest uppercase mb-3" style={PS2}>
              🎛 HOST CONTROL
            </div>
            <h1 className="text-5xl font-heading text-outlaw-gold tracking-widest mb-1">TXD DOMINOES</h1>
            <p className="text-white/40 font-body text-sm">Texas Dominoes — Game Master Dashboard</p>
          </div>

          {/* Score limit */}
          <div className="p-4 rounded-xl border border-cyber-purple/30 bg-black/40 mb-6">
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
              className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase transition-all disabled:opacity-50 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #BC13FE, #7c3aed)', color: 'white', boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}>
              {loading ? '⚙ Creating…' : '⚡ CREATE NEW ROOM'}
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/30 text-xs font-body">or join existing</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE" maxLength={8}
                className="flex-1 px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/40 text-white font-mono uppercase tracking-widest text-lg focus:outline-none focus:border-outlaw-gold"
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

  // ── Active Dashboard ────────────────────────────────────────────────────────
  const currentPlayer = game.players?.[game.currentPlayerIndex];
  const gameOver = game.players?.some(p => (p.score || 0) >= (game.scoreLimit || 100));
  const gameWinner = gameOver ? [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;

  return (
    <div className="min-h-screen bg-midnight-void text-white">
      <Header />

      {/* Top bar */}
      <div className="border-b border-cyber-purple/40 bg-black/70 px-4 py-3 sticky top-16 z-40">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[9px] px-2 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple tracking-widest uppercase" style={PS2}>🎛 HOST</span>
            <span className="font-mono text-outlaw-gold text-xl font-bold tracking-widest">{game.room_code}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-body
              ${game.phase === 'playing' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-600/30'
              : game.phase === 'round_over' ? 'bg-outlaw-gold/20 text-outlaw-gold border border-outlaw-gold/30'
              : 'bg-white/5 text-white/40 border border-white/10'}`} style={PS2}>
              {game.phase?.replace('_', ' ')}
            </span>
            <span className="text-white/30 text-xs font-body">Round {game.roundNumber || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyJoinLink}
              className="px-3 py-1.5 rounded-lg border border-outlaw-gold/50 text-outlaw-gold text-xs font-heading tracking-wider hover:bg-outlaw-gold/10 transition-all">
              {copied ? '✓ COPIED!' : '📋 COPY JOIN LINK'}
            </button>
            <button onClick={() => setGame(null)}
              className="px-3 py-1.5 rounded-lg border border-white/20 text-white/40 text-xs font-heading hover:border-white/40 transition-all">
              ✕ CLOSE ROOM
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Board Overview (Spectator) ── */}
        <div className="rounded-xl border border-cyber-purple/30 bg-black/50 overflow-hidden">
          <div className="px-4 py-2 border-b border-cyber-purple/20 flex items-center justify-between">
            <h2 className="font-heading text-xs tracking-widest text-cyber-purple uppercase">🁢 Live Board</h2>
            <div className="text-xs text-white/30 font-body">
              Ends: <span className="text-white font-mono">{game.leftEnd ?? '—'}</span>
              <span className="mx-2">↔</span>
              <span className="text-white font-mono">{game.rightEnd ?? '—'}</span>
              <span className="ml-4">Boneyard: <span className="text-white font-mono">{game.boneyard?.length || 0}</span></span>
            </div>
          </div>
          <div className="min-h-[100px] max-h-[180px] overflow-hidden relative">
            <TXDBoard board={game.board || []} leftEnd={game.leftEnd} rightEnd={game.rightEnd} />
            {game.board?.length === 0 && game.phase === 'waiting' && (
              <div className="absolute inset-0 flex items-center justify-center text-white/20 font-body text-sm">
                Board is empty — start the game to deal tiles
              </div>
            )}
          </div>
          {game.lastAction && (
            <div className="px-4 py-1.5 border-t border-white/5 text-xs text-white/30 font-body italic">
              Last: <span className="text-white/50">{game.lastAction.player}</span> {game.lastAction.type === 'play' ? 'played a tile' : game.lastAction.type === 'draw' ? 'drew from boneyard' : 'passed turn'}
            </div>
          )}
        </div>

        {/* ── Player Seats ── */}
        <div className="rounded-xl border border-cyber-purple/30 bg-black/50">
          <div className="px-4 py-3 border-b border-cyber-purple/20 flex items-center justify-between">
            <h2 className="font-heading text-xs tracking-widest text-cyber-purple uppercase">👥 Players ({game.players?.length || 0}/4)</h2>
            <div className="flex gap-2">
              <Btn onClick={addCPU} color="#BC13FE" disabled={(game.players?.length || 0) >= 4}>+ ADD CPU</Btn>
              <Btn onClick={removeCPU} color="#ffffff">− REMOVE CPU</Btn>
            </div>
          </div>
          <div className="p-4">
            {game.players?.length === 0 ? (
              <div className="text-center py-6 text-white/30 font-body text-sm">
                No players yet. Share the join link below to invite players, or add CPU opponents.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {game.players.map((p, i) => {
                  const isActive = game.currentPlayerIndex === i && game.phase === 'playing';
                  return (
                    <div key={p.playerId}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all
                        ${isActive ? 'border-emerald-500/60 bg-emerald-900/10' : 'border-white/10 bg-white/3'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${isActive ? 'bg-emerald-600' : p.isAI ? 'bg-cyber-purple/40' : 'bg-white/10'}`}>
                          {isActive ? '▶' : p.isAI ? '🤖' : p.playerName?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-body text-sm font-medium">{p.playerName}</div>
                          <div className="text-xs text-white/40 font-body">
                            {p.isAI ? 'CPU' : 'Human'} · {p.hand?.length ?? 0} tiles · {p.score || 0} pts
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && <span className="text-[9px] text-emerald-400 font-body uppercase tracking-widest">TURN</span>}
                        <button onClick={() => overrideTurn(i)}
                          className="px-2 py-1 rounded border border-white/20 text-white/40 text-xs font-heading hover:border-cyber-purple/60 hover:text-cyber-purple transition-all"
                          title="Force turn to this player">
                          FORCE
                        </button>
                        {!p.isAI && (
                          <button onClick={() => kickPlayer(p.playerId)}
                            className="px-2 py-1 rounded border border-red-500/30 text-red-400 text-xs font-heading hover:bg-red-500/10 transition-all">
                            KICK
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Scoreboard ── */}
        <div className="rounded-xl border border-outlaw-gold/30 bg-black/50">
          <div className="px-4 py-3 border-b border-outlaw-gold/20 flex items-center justify-between">
            <h2 className="font-heading text-xs tracking-widest text-outlaw-gold uppercase">🏆 Scoreboard</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30 font-body">Limit: <span className="text-outlaw-gold font-mono">{game.scoreLimit || 100}</span> pts</span>
              <Btn onClick={resetScores} color="#ef4444">RESET SCORES</Btn>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => {
                const pct = Math.min(100, ((p.score || 0) / (game.scoreLimit || 100)) * 100);
                return (
                  <div key={p.playerId} className="flex items-center gap-3">
                    <span className="text-white/40 text-xs w-4 font-mono">{i + 1}.</span>
                    <span className="font-body text-sm w-24 truncate">{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyber-purple to-outlaw-gold rounded-full transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-outlaw-gold font-mono font-bold text-sm w-16 text-right">{p.score || 0} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Game Controls ── */}
        <div className="rounded-xl border border-white/10 bg-black/50">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="font-heading text-xs tracking-widest text-white/50 uppercase">🎛 Game Controls</h2>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {game.phase === 'waiting' && (
              <button onClick={startGame} disabled={(game.players?.length || 0) < 2}
                className="px-6 py-3 rounded-xl font-heading text-base tracking-widest uppercase disabled:opacity-40 hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', boxShadow: '0 0 15px rgba(22,163,74,0.4)' }}>
                ▶ START GAME
              </button>
            )}
            {game.phase === 'round_over' && (
              <button onClick={startNextRound}
                className="px-6 py-3 rounded-xl font-heading text-base tracking-widest uppercase hover:opacity-90 transition-all"
                style={{ background: '#FFD700', color: 'black', boxShadow: '0 0 15px rgba(255,215,0,0.4)' }}>
                ▶ NEXT ROUND
              </button>
            )}
            <Btn onClick={resetRound} color="#FF5F1F">↺ RESET ROUND</Btn>
            <Btn onClick={resetScores} color="#ef4444">RESET SCORES</Btn>
          </div>
        </div>

        {/* ── Join Link ── */}
        <div className="rounded-xl border border-cyber-purple/20 bg-black/30 p-4">
          <p className="text-[9px] text-white/30 uppercase tracking-widest font-body mb-2" style={PS2}>Player Join Link</p>
          <div className="flex gap-3 items-center">
            <code className="flex-1 text-outlaw-gold font-mono text-xs break-all bg-black/40 px-3 py-2 rounded border border-white/10">
              {window.location.origin}/games/txd?room={game.room_code}
            </code>
            <button onClick={copyJoinLink}
              className="px-4 py-2 rounded-lg border-2 border-outlaw-gold text-outlaw-gold font-heading text-sm tracking-wider hover:bg-outlaw-gold/10 transition-all whitespace-nowrap">
              {copied ? '✓ DONE' : 'COPY'}
            </button>
          </div>
        </div>

      </div>

      {/* Feedback */}
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
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && <p className="text-white/70 font-body mb-5">{game.roundWinner.playerName} wins +{game.roundWinner.points} pts</p>}
            <div className="space-y-2 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className="flex justify-between items-center font-body px-4 py-1.5 rounded-lg bg-white/5">
                  <span className="text-sm">{i === 0 ? '🥇 ' : ''}{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
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

      {/* Game Over Modal */}
      {gameOver && game.phase !== 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center">
            <h2 className="text-4xl font-heading text-outlaw-gold mb-2">GAME OVER!</h2>
            <p className="text-2xl font-heading text-white mb-5">🏆 {gameWinner?.playerName} WINS!</p>
            <div className="space-y-2 mb-6">
              {[...game.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.playerId} className="flex justify-between font-body px-4 py-1.5 rounded-lg bg-white/5">
                  <span className="text-sm">{i === 0 ? '👑 ' : ''}{p.isAI ? '🤖 ' : ''}{p.playerName}</span>
                  <span className="text-outlaw-gold font-mono font-bold">{p.score || 0} pts</span>
                </div>
              ))}
            </div>
            <button onClick={() => setGame(null)}
              className="w-full py-2.5 rounded-lg border border-white/30 text-white font-heading hover:bg-white/10 transition-all">
              NEW GAME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}