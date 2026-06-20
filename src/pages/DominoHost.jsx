import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import Header from '@/components/home/Header';
import DominoBoard from '@/components/domino/DominoBoard';
import DominoTile from '@/components/domino/DominoTile';
import {
  generateRoomCode, dealHands, findStarter, getTeam,
  getLegalMoves, getPlayableEnds, buildEntry, getOpenEnds,
  calcRoundPoints, pipCount, isBlocked,
} from '@/lib/dominoEngine';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const TEAM_COLORS = ['#BC13FE', '#FF5F1F'];
const TEAM_NAMES  = ['Team A', 'Team B'];
const AI_NAMES    = ['Dexter', 'Duchess', 'Ranger', 'Maverick'];

function Pill({ children, color = '#BC13FE' }) {
  return (
    <span style={{ ...PS2, fontSize: 6, padding: '3px 8px', borderRadius: 20, border: `1px solid ${color}50`, background: `${color}12`, color }}>
      {children}
    </span>
  );
}

function ActionBtn({ children, onClick, color = '#BC13FE', disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-lg font-heading tracking-wider uppercase text-xs transition-all active:scale-95 disabled:opacity-40"
      style={{ border: `2px solid ${color}`, color, background: 'transparent' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}20`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}

export default function DominoHost() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [scoreLimit, setScoreLimit] = useState(100);
  const pollRef = useRef(null);

  const flash = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2800);
  };

  // Subscribe to realtime + poll fallback
  useEffect(() => {
    if (!game?.id) return;
    const unsub = base44.entities.DominoGame.subscribe(ev => {
      if (ev.data && ev.id === game.id) setGame(ev.data);
    });
    pollRef.current = setInterval(async () => {
      try {
        const rows = await base44.entities.DominoGame.filter({ room_code: game.room_code });
        if (rows[0]) setGame(rows[0]);
      } catch (_) {}
    }, 3000);
    return () => { unsub(); clearInterval(pollRef.current); };
  }, [game?.id]);

  // AI turns
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const seat = game.currentSeat;
    const player = game.players?.[seat];
    if (!player?.isAI) return;
    const t = setTimeout(() => doAITurn(game), 1200);
    return () => clearTimeout(t);
  }, [game?.currentSeat, game?.phase, game?.board?.length]);

  const doAITurn = async (g) => {
    const seat = g.currentSeat;
    const player = g.players[seat];
    const board = g.board || [];
    const moves = getLegalMoves(player.hand, board);
    const nextSeat = (seat + 1) % 4;
    let updated;

    if (moves.length === 0) {
      // draw or knock
      if ((g.boneyard || []).length > 0) {
        const boneyard = [...g.boneyard];
        const drawn = boneyard.pop();
        const players = g.players.map((p, i) => i === seat ? { ...p, hand: [...p.hand, drawn] } : p);
        const log = [`🤖 ${player.playerName} drew from boneyard`, ...(g.activityLog || [])].slice(0, 30);
        updated = { ...g, players, boneyard, activityLog: log };
      } else {
        // knock — check if blocked
        const players = g.players.map(p => p);
        const blocked = isBlocked(players, board);
        if (blocked) {
          // Count pips, award to team with fewer
          const teamPips = [0, 1].map(team =>
            players.filter((_, i) => getTeam(i) === team).reduce((s, p) => s + pipCount(p.hand), 0)
          );
          const winTeam = teamPips[0] <= teamPips[1] ? 0 : 1;
          const pts = teamPips[1 - winTeam];
          const teamScores = {
            teamA: (g.teamScores?.teamA || 0) + (winTeam === 0 ? pts : 0),
            teamB: (g.teamScores?.teamB || 0) + (winTeam === 1 ? pts : 0),
          };
          const log = [`🔒 Blocked! ${TEAM_NAMES[winTeam]} wins round (+${pts})`, ...(g.activityLog || [])].slice(0, 30);
          updated = { ...g, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts }, activityLog: log };
        } else {
          const log = [`🤖 ${player.playerName} knocked`, ...(g.activityLog || [])].slice(0, 30);
          updated = { ...g, currentSeat: nextSeat, activityLog: log };
        }
      }
    } else {
      // play highest pip total first
      const best = [...moves].sort((a, b) => (b.domino.a + b.domino.b) - (a.domino.a + a.domino.b))[0];
      const entry = buildEntry(best.domino, best.side, board);
      const newBoard = [...board, entry];
      const newHand = player.hand.filter(d => d.id !== best.domino.id);
      const players = g.players.map((p, i) => i === seat ? { ...p, hand: newHand } : p);
      const log = [`🤖 ${player.playerName} played [${best.domino.id}]`, ...(g.activityLog || [])].slice(0, 30);

      if (newHand.length === 0) {
        // round over
        const pts = calcRoundPoints(players, seat);
        const winTeam = getTeam(seat);
        const teamScores = {
          teamA: (g.teamScores?.teamA || 0) + (winTeam === 0 ? pts : 0),
          teamB: (g.teamScores?.teamB || 0) + (winTeam === 1 ? pts : 0),
        };
        updated = { ...g, board: newBoard, players, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts, playerName: player.playerName }, activityLog: log };
      } else {
        updated = { ...g, board: newBoard, players, currentSeat: nextSeat, activityLog: log };
      }
    }

    await base44.entities.DominoGame.update(g.id, updated);
    setGame(updated);
  };

  const createRoom = async () => {
    setLoading(true);
    const code = generateRoomCode();
    const slots = Array.from({ length: 4 }, (_, i) => ({
      seat: i, playerId: null, playerName: null, hand: [], isAI: false, connected: false,
    }));
    const created = await base44.entities.DominoGame.create({
      room_code: code, status: 'waiting', phase: 'waiting',
      players: slots, board: [], boneyard: [],
      currentSeat: 0, roundNumber: 1,
      teamScores: { teamA: 0, teamB: 0 },
      scoreLimit, activityLog: [`Room ${code} created`],
    });
    setGame(created);
    setLoading(false);
  };

  const addAI = async (seat) => {
    if (!game || game.players[seat].playerId) return;
    const aiCount = game.players.filter(p => p.isAI).length;
    const players = game.players.map((p, i) => i === seat
      ? { ...p, playerId: `ai_${Date.now()}_${seat}`, playerName: AI_NAMES[aiCount] || `CPU${seat}`, isAI: true, connected: true }
      : p);
    const updated = { ...game, players };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const removeAI = async (seat) => {
    if (!game || !game.players[seat].isAI) return;
    const players = game.players.map((p, i) => i === seat
      ? { seat: i, playerId: null, playerName: null, hand: [], isAI: false, connected: false }
      : p);
    const updated = { ...game, players };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const kickPlayer = async (seat) => {
    if (!game) return;
    const players = game.players.map((p, i) => i === seat
      ? { seat: i, playerId: null, playerName: null, hand: [], isAI: false, connected: false }
      : p);
    const updated = { ...game, players };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const startGame = async () => {
    if (!game) return;
    const filled = game.players.filter(p => p.playerId);
    if (filled.length < 2) { flash('Need at least 2 players', 'error'); return; }
    // Fill empty seats with AI
    let aiCount = game.players.filter(p => p.isAI).length;
    const players = game.players.map(p => {
      if (p.playerId) return p;
      const ai = { ...p, playerId: `ai_${Date.now()}_${p.seat}`, playerName: AI_NAMES[aiCount++] || `CPU${p.seat}`, isAI: true, connected: true };
      return ai;
    });

    const { hands, boneyard } = dealHands();
    const playersWithHands = players.map((p, i) => ({ ...p, hand: hands[i] }));
    const starter = findStarter(playersWithHands.map(p => p.hand));
    const log = [`🎮 Game started! ${playersWithHands[starter.playerIndex].playerName} goes first`];
    const updated = {
      ...game, status: 'active', phase: 'playing',
      players: playersWithHands, board: [], boneyard,
      currentSeat: starter.playerIndex, roundNumber: 1,
      teamScores: { teamA: 0, teamB: 0 }, roundWinner: null, activityLog: log,
    };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const startNextRound = async () => {
    if (!game) return;
    const { hands, boneyard } = dealHands();
    const players = game.players.map((p, i) => ({ ...p, hand: hands[i] }));
    const starter = findStarter(players.map(p => p.hand));
    const rn = (game.roundNumber || 1) + 1;
    const log = [`🎮 Round ${rn} started! ${players[starter.playerIndex].playerName} goes first`];
    const updated = {
      ...game, phase: 'playing', board: [], boneyard,
      players, currentSeat: starter.playerIndex, roundNumber: rn,
      roundWinner: null, activityLog: log,
    };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const forceTurn = async (seat) => {
    const updated = { ...game, currentSeat: seat };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const endGame = async () => {
    const updated = { ...game, phase: 'game_over', status: 'finished' };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  // ── No room yet ───────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="min-h-screen bg-midnight-void">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="inline-block px-3 py-1 rounded mb-4 border border-cyber-purple/40 bg-cyber-purple/10 text-cyber-purple text-[7px] tracking-widest" style={PS2}>🎛 HOST PANEL</div>
          <h1 className="text-5xl font-heading text-outlaw-gold tracking-widest mb-2">DOMINOES</h1>
          <p className="text-white/40 font-body text-sm mb-10">Draw Dominoes · 2v2 Partners</p>

          <div className="p-4 rounded-xl border border-cyber-purple/30 bg-black/40 mb-6">
            <p className="text-[7px] text-white/40 uppercase tracking-widest mb-3" style={PS2}>Score Limit</p>
            <div className="flex gap-2 justify-center">
              {[50, 100, 150, 200].map(v => (
                <button key={v} onClick={() => setScoreLimit(v)}
                  className={`flex-1 py-2 rounded-lg font-heading tracking-widest text-sm transition-all ${scoreLimit === v ? 'bg-cyber-purple text-white' : 'border border-white/20 text-white/50 hover:border-cyber-purple'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button onClick={createRoom} disabled={loading}
            className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#BC13FE,#7c3aed)', boxShadow: '0 0 24px rgba(188,19,254,0.4)' }}>
            {loading ? '⚙ Creating…' : '⚡ CREATE ROOM'}
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const openEnds = getOpenEnds(game.board || []);
  const currentPlayer = game.players?.[game.currentSeat];
  const gameOver = (game.teamScores?.teamA || 0) >= (game.scoreLimit || 100) || (game.teamScores?.teamB || 0) >= (game.scoreLimit || 100);

  return (
    <div className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0a0318,#050505)' }}>
      <Header />

      {/* Command bar */}
      <div className="sticky top-16 z-40 border-b border-cyber-purple/40 bg-black/80 backdrop-blur px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span style={PS2} className="text-[7px] px-2 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple tracking-widest">🎛 HOST</span>
            <span className="font-mono text-outlaw-gold text-lg font-bold tracking-widest">{game.room_code}</span>
            <span className={`text-[7px] px-2 py-0.5 rounded uppercase tracking-widest border ${game.phase === 'playing' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40' : 'bg-white/5 text-white/40 border-white/10'}`} style={PS2}>
              {game.phase?.replace('_', ' ') || 'waiting'}
            </span>
            <span className="text-white/30 text-xs font-body">R{game.roundNumber || 1}</span>
          </div>
          <div className="flex gap-2">
            {game.phase === 'waiting' && (
              <ActionBtn onClick={startGame} color="#4ade80">▶ START GAME</ActionBtn>
            )}
            {game.phase === 'round_over' && !gameOver && (
              <ActionBtn onClick={startNextRound} color="#FFD700">▶ NEXT ROUND</ActionBtn>
            )}
            {game.phase === 'playing' && (
              <ActionBtn onClick={endGame} color="#ef4444">🏁 END GAME</ActionBtn>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── LEFT column ── */}
        <div className="space-y-3">

          {/* Join link */}
          <div className="rounded-xl border border-outlaw-gold/30 bg-black/50 p-3">
            <p style={PS2} className="text-[6px] text-outlaw-gold/60 uppercase tracking-widest mb-2">Player Join Link</p>
            <code className="text-outlaw-gold font-mono text-[10px] break-all block bg-black/40 px-2 py-1.5 rounded border border-white/10 select-all">
              {window.location.origin}/games/dominoes?room={game.room_code}
            </code>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/games/dominoes?room=${game.room_code}`); flash('Link copied!'); }}
              className="mt-2 text-[7px] px-3 py-1 rounded border border-outlaw-gold/40 text-outlaw-gold hover:bg-outlaw-gold/10 font-heading w-full">
              📋 COPY LINK
            </button>
          </div>

          {/* Team scores */}
          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <p style={PS2} className="text-[7px] text-white/40 uppercase tracking-widest mb-3">🏆 Scores (Goal: {game.scoreLimit})</p>
            {[0, 1].map(team => {
              const score = team === 0 ? (game.teamScores?.teamA || 0) : (game.teamScores?.teamB || 0);
              const pct = Math.min(100, (score / (game.scoreLimit || 100)) * 100);
              return (
                <div key={team} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span style={{ ...PS2, fontSize: 7, color: TEAM_COLORS[team] }}>{TEAM_NAMES[team]}</span>
                    <span className="font-mono text-sm font-bold" style={{ color: TEAM_COLORS[team] }}>{score}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: TEAM_COLORS[team] }} />
                  </div>
                  <div className="flex gap-2 mt-1">
                    {game.players?.filter((_, i) => getTeam(i) === team).map(p => (
                      <span key={p.seat} className="text-[9px] font-body text-white/50">{p.isAI ? '🤖' : p.playerName ? '👤' : '○'} {p.playerName || 'Empty'}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seats */}
          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <p style={PS2} className="text-[7px] text-white/40 uppercase tracking-widest mb-3">👥 Seats</p>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map(seat => {
                const p = game.players?.[seat];
                const isTurn = game.currentSeat === seat && game.phase === 'playing';
                const team = getTeam(seat);
                const color = TEAM_COLORS[team];
                return (
                  <div key={seat} className="rounded-xl p-2 text-center border" style={{ borderColor: `${color}30`, background: `${color}07` }}>
                    <div style={{ ...PS2, fontSize: 5, color: `${color}70` }} className="mb-1">
                      Seat {seat + 1} · {TEAM_NAMES[team]}
                    </div>
                    {p?.playerId ? (
                      <>
                        <div className="text-xs font-body text-white font-bold truncate">
                          {p.isAI ? '🤖' : '👤'} {p.playerName}
                        </div>
                        <div className="text-[9px] font-mono mt-0.5" style={{ color }}>
                          {p.hand?.length ?? 0} tiles
                        </div>
                        {isTurn && <div style={PS2} className="text-[6px] text-emerald-400 mt-1 animate-pulse">▶ PLAYING</div>}
                        <div className="flex gap-1 mt-1 justify-center">
                          <button onClick={() => forceTurn(seat)} style={PS2} className="text-[5px] px-1.5 py-0.5 rounded border border-cyber-purple/40 text-cyber-purple hover:bg-cyber-purple/20">TURN</button>
                          {p.isAI
                            ? <button onClick={() => removeAI(seat)} style={PS2} className="text-[5px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">✕</button>
                            : <button onClick={() => kickPlayer(seat)} style={PS2} className="text-[5px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">KICK</button>
                          }
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-white/20 text-xs font-body mb-2">Empty</div>
                        {game.phase === 'waiting' && (
                          <button onClick={() => addAI(seat)} style={PS2} className="text-[5px] px-2 py-1 rounded border border-cyber-purple/30 text-cyber-purple hover:bg-cyber-purple/10">+CPU</button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity log */}
          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <p style={PS2} className="text-[7px] text-white/40 uppercase tracking-widest mb-2">📋 Log</p>
            <div className="space-y-1 max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {(game.activityLog || []).map((entry, i) => (
                <div key={i} className="text-[9px] font-body text-white/50 border-l-2 border-cyber-purple/30 pl-2">{entry}</div>
              ))}
            </div>
          </div>

          {/* Open ends info */}
          {game.phase === 'playing' && (
            <div className="rounded-xl border border-white/10 bg-black/50 p-3">
              <p style={PS2} className="text-[7px] text-white/40 uppercase tracking-widest mb-2">Open Ends</p>
              <div className="flex gap-3 flex-wrap text-xs font-mono">
                <span>← <span className="text-emerald-400 font-bold">{openEnds.left ?? '—'}</span></span>
                <span>→ <span className="text-emerald-400 font-bold">{openEnds.right ?? '—'}</span></span>
                {openEnds.hasSpinner && <>
                  <span>↑ <span className="text-outlaw-gold font-bold">{openEnds.top ?? '—'}</span></span>
                  <span>↓ <span className="text-outlaw-gold font-bold">{openEnds.bottom ?? '—'}</span></span>
                </>}
              </div>
              <p className="text-[9px] font-body text-white/30 mt-1">Boneyard: {game.boneyard?.length || 0} tiles</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Board + hands overview ── */}
        <div className="lg:col-span-2 space-y-3">

          {/* Board */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{
              aspectRatio: '16/9', minHeight: 200,
              background: 'radial-gradient(ellipse at center,rgba(255,140,30,0.5) 0%,rgba(200,80,10,0.4) 50%,rgba(120,40,0,0.55) 100%)',
              border: '4px solid rgba(255,160,50,0.5)',
              boxShadow: 'inset 0 0 60px rgba(255,120,20,0.12)',
            }}>
            <div className="absolute inset-0" style={{ zIndex: 1 }}>
              <DominoBoard board={game.board || []} openEnds={openEnds} interactive={false} />
            </div>
            {game.phase === 'playing' && currentPlayer && (
              <div className="absolute bottom-2 right-3 z-10 text-[8px] font-body" style={PS2}>
                <span style={{ color: TEAM_COLORS[getTeam(game.currentSeat)] }}>
                  {currentPlayer.playerName}'s turn
                </span>
              </div>
            )}
          </div>

          {/* All 4 hands (face-down for non-host seats) */}
          <div className="grid grid-cols-2 gap-3">
            {game.players?.map((p, i) => {
              const isTurn = game.currentSeat === i && game.phase === 'playing';
              const team = getTeam(i);
              const color = TEAM_COLORS[team];
              return (
                <div key={i} className="rounded-xl p-3 border"
                  style={{ borderColor: isTurn ? color : `${color}25`, background: isTurn ? `${color}08` : 'rgba(0,0,0,0.4)', boxShadow: isTurn ? `0 0 16px ${color}20` : 'none' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-body font-bold" style={{ color }}>
                      {p.isAI ? '🤖' : p.playerId ? '👤' : '○'} {p.playerName || `Seat ${i + 1}`}
                    </span>
                    {isTurn && <span style={PS2} className="text-[6px] text-emerald-400 animate-pulse">▶ TURN</span>}
                    <Pill color={color}>{TEAM_NAMES[team]}</Pill>
                  </div>
                  {p.hand?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {/* Host sees all tiles face-up */}
                      {p.hand.map(d => <DominoTile key={d.id} a={d.a} b={d.b} unit={20} />)}
                    </div>
                  ) : (
                    <div className="text-white/20 text-xs font-body">{game.phase === 'waiting' ? 'No tiles yet' : '0 tiles'}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl font-body text-sm z-50 pointer-events-none border ${feedback.type === 'error' ? 'bg-red-950 border-red-500 text-red-200' : 'bg-black/90 border-cyber-purple/50 text-white'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Round over overlay */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-sm w-full border-2 border-outlaw-gold rounded-2xl p-6 bg-black text-center" style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <h2 className="text-3xl font-heading text-outlaw-gold mb-2">ROUND OVER!</h2>
            {game.roundWinner && (
              <p className="text-white/70 font-body mb-1">
                <span style={{ color: TEAM_COLORS[game.roundWinner.team] }} className="font-bold">{TEAM_NAMES[game.roundWinner.team]}</span> wins +{game.roundWinner.points} pts
              </p>
            )}
            <div className="flex gap-4 justify-center my-4">
              {[0, 1].map(t => (
                <div key={t} className="text-center">
                  <div style={{ ...PS2, fontSize: 7, color: TEAM_COLORS[t] }}>{TEAM_NAMES[t]}</div>
                  <div className="font-mono text-2xl font-bold" style={{ color: TEAM_COLORS[t] }}>
                    {t === 0 ? (game.teamScores?.teamA || 0) : (game.teamScores?.teamB || 0)}
                  </div>
                </div>
              ))}
            </div>
            {gameOver
              ? <p className="text-outlaw-gold font-heading text-lg">GAME OVER! {TEAM_NAMES[game.teamScores?.teamA >= game.scoreLimit ? 0 : 1]} WINS!</p>
              : <ActionBtn onClick={startNextRound} color="#FFD700">▶ NEXT ROUND</ActionBtn>}
          </div>
        </div>
      )}
    </div>
  );
}