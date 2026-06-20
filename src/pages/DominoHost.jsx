import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import Header from '@/components/home/Header';
import DominoBoard from '@/components/domino/DominoBoard';
import DominoTile from '@/components/domino/DominoTile';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import {
  generateRoomCode, dealHands, findStarter, getTeam,
  getLegalMoves, buildEntry, getOpenEnds, getPlayableEnds,
  calcRoundPoints, calcEndScore, pipCount, isBlocked,
} from '@/lib/dominoEngine';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const TEAM_COLORS = ['#BC13FE', '#FF5F1F'];
const TEAM_NAMES  = ['Team A', 'Team B'];

// Seat positions on the table (Host is always seat 0 = "Seat 1")
// Layout: top=seat2(opponent), left=seat1(partner opp), right=seat3(partner opp), bottom=seat0(host)
const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'];

function ActionBtn({ children, onClick, color = '#BC13FE', disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-4 py-2 rounded-lg font-heading tracking-wider uppercase text-sm transition-all active:scale-95 disabled:opacity-40"
      style={{ border: `2px solid ${color}`, color, background: 'transparent' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}20`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}

function SeatCard({ player, seat, isTurn, position, gamePhase }) {
  const team = getTeam(seat);
  const color = TEAM_COLORS[team];
  const isHost = seat === 0;
  const char = TEXASNOMAD_CHARACTERS.find(c => c.id === player?.aiCharacterId);

  const posStyles = {
    bottom: 'absolute bottom-2 left-1/2 -translate-x-1/2',
    top:    'absolute top-2 left-1/2 -translate-x-1/2',
    left:   'absolute left-2 top-1/2 -translate-y-1/2',
    right:  'absolute right-2 top-1/2 -translate-y-1/2',
  };

  const isHoriz = position === 'left' || position === 'right';

  return (
    <div className={posStyles[position]}>
      <div className={`flex ${isHoriz ? 'flex-col' : 'flex-row'} items-center gap-2 px-3 py-2 rounded-xl border transition-all`}
        style={{
          borderColor: isTurn ? '#4ade80' : `${color}40`,
          background: isTurn ? 'rgba(74,222,128,0.1)' : `${color}08`,
          boxShadow: isTurn ? '0 0 14px rgba(74,222,128,0.3)' : 'none',
          minWidth: isHoriz ? 0 : 160,
        }}>
        {/* Avatar */}
        {char ? (
          <img src={char.avatar} alt={char.name}
            style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}`, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}40`, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 16 }}>{player?.playerId ? '👤' : '○'}</span>
          </div>
        )}
        <div>
          <div className="text-xs font-body font-bold truncate max-w-[100px]" style={{ color: player?.playerId ? 'white' : 'rgba(255,255,255,0.25)' }}>
            {player?.playerName || (isHost ? 'HOST (Seat 1)' : 'Empty')}
          </div>
          <div style={{ ...PS2, fontSize: 5, color }} className="mt-0.5">
            {TEAM_NAMES[team]}{isHost ? ' · HOST' : ''}
          </div>
          {player?.hand?.length >= 0 && gamePhase !== 'waiting' && (
            <div className="text-[9px] font-mono mt-0.5" style={{ color: isTurn ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
              {isTurn && <span className="animate-pulse">▶ </span>}{player.hand?.length ?? 0} tiles
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DominoHost() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scoreLimit, setScoreLimit] = useState(100);
  const [hostName, setHostName] = useState('');
  const [selectedDomino, setSelectedDomino] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const pollRef = useRef(null);
  const gameRef = useRef(null);
  useEffect(() => { gameRef.current = game; }, [game]);

  const flash = (msg, type = 'error') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 2800);
  };

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

  // AI auto-play — always use latest game from ref to avoid stale closures
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const seat = game.currentSeat;
    const player = game.players?.[seat];
    if (!player?.isAI) return;
    const t = setTimeout(() => doAITurn(gameRef.current), 1400);
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
      if ((g.boneyard || []).length > 0) {
        const boneyard = [...g.boneyard];
        const drawn = boneyard.pop();
        const players = g.players.map((p, i) => i === seat ? { ...p, hand: [...p.hand, drawn] } : p);
        updated = { ...g, players, boneyard };
      } else {
        const players = g.players;
        const blocked = isBlocked(players, board);
        if (blocked) {
          const teamPips = [0, 1].map(team => players.filter((_, i) => getTeam(i) === team).reduce((s, p) => s + pipCount(p.hand), 0));
          const winTeam = teamPips[0] <= teamPips[1] ? 0 : 1;
          const pts = teamPips[1 - winTeam];
          const teamScores = { teamA: (g.teamScores?.teamA || 0) + (winTeam === 0 ? pts : 0), teamB: (g.teamScores?.teamB || 0) + (winTeam === 1 ? pts : 0) };
          updated = { ...g, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts } };
        } else {
          updated = { ...g, currentSeat: nextSeat };
        }
      }
    } else {
      const best = [...moves].sort((a, b) => (b.domino.a + b.domino.b) - (a.domino.a + a.domino.b))[0];
      const entry = buildEntry(best.domino, best.side, board);
      const newBoard = [...board, entry];
      const newHand = player.hand.filter(d => d.id !== best.domino.id);
      const players = g.players.map((p, i) => i === seat ? { ...p, hand: newHand } : p);
      const endPts = calcEndScore(newBoard);
      const playTeam = getTeam(seat);
      const baseScores = {
        teamA: (g.teamScores?.teamA || 0) + (playTeam === 0 ? endPts : 0),
        teamB: (g.teamScores?.teamB || 0) + (playTeam === 1 ? endPts : 0),
      };
      if (newHand.length === 0) {
        const pts = calcRoundPoints(players, seat);
        const winTeam = getTeam(seat);
        const teamScores = { teamA: baseScores.teamA + (winTeam === 0 ? pts : 0), teamB: baseScores.teamB + (winTeam === 1 ? pts : 0) };
        updated = { ...g, board: newBoard, players, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts, playerName: player.playerName } };
      } else {
        updated = { ...g, board: newBoard, players, currentSeat: nextSeat, teamScores: baseScores };
      }
    }

    await base44.entities.DominoGame.update(g.id, updated);
    setGame(updated);
  };

  const createRoom = async () => {
    if (!hostName.trim()) return;
    setLoading(true);
    const code = generateRoomCode();
    const hostPid = `host_${Date.now()}`;
    // Host sits in seat 0
    const slots = Array.from({ length: 4 }, (_, i) => i === 0
      ? { seat: 0, playerId: hostPid, playerName: hostName.trim(), hand: [], isAI: false, connected: true, isHost: true }
      : { seat: i, playerId: null, playerName: null, hand: [], isAI: false, connected: false }
    );
    const created = await base44.entities.DominoGame.create({
      room_code: code, status: 'waiting', phase: 'waiting',
      players: slots, board: [], boneyard: [],
      currentSeat: 0, roundNumber: 1,
      teamScores: { teamA: 0, teamB: 0 },
      scoreLimit,
    });
    setGame(created);
    setLoading(false);
  };

  const addAI = async (seat) => {
    if (!game || game.players[seat].playerId) return;
    // Pick a TN character not already used in this game
    const usedIds = game.players.filter(p => p.aiCharacterId).map(p => p.aiCharacterId);
    const available = TEXASNOMAD_CHARACTERS.filter(c => !usedIds.includes(c.id));
    const pool = available.length > 0 ? available : TEXASNOMAD_CHARACTERS;
    const char = pool[Math.floor(Math.random() * pool.length)];
    const players = game.players.map((p, i) => i === seat
      ? { ...p, playerId: `ai_${seat}_${char.id}`, playerName: char.name, isAI: true, connected: true, aiCharacterId: char.id }
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
    // Fill empty seats with unique TN AI characters
    const usedIds = game.players.filter(p => p.aiCharacterId).map(p => p.aiCharacterId);
    // Shuffle remaining characters so seat assignment is random each game
    const available = TEXASNOMAD_CHARACTERS
      .filter(c => !usedIds.includes(c.id))
      .sort(() => Math.random() - 0.5);
    let pickIdx = 0;
    const players = game.players.map(p => {
      if (p.playerId) return p;
      // Cycle through available pool (if somehow more empty seats than chars)
      const char = available[pickIdx % available.length] || TEXASNOMAD_CHARACTERS[pickIdx % TEXASNOMAD_CHARACTERS.length];
      pickIdx++;
      return { ...p, playerId: `ai_${p.seat}_${char.id}`, playerName: char.name, isAI: true, connected: true, aiCharacterId: char.id };
    });
    const { hands, boneyard } = dealHands();
    const playersWithHands = players.map((p, i) => ({ ...p, hand: hands[i] }));
    const starter = findStarter(playersWithHands.map(p => p.hand));
    const updated = {
      ...game, status: 'active', phase: 'playing',
      players: playersWithHands, board: [], boneyard,
      currentSeat: starter.playerIndex, roundNumber: 1,
      teamScores: { teamA: 0, teamB: 0 }, roundWinner: null,
    };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const startNextRound = async () => {
    if (!game) return;
    const { hands, boneyard } = dealHands();
    const players = game.players.map((p, i) => ({ ...p, hand: hands[i] }));
    const starter = findStarter(players.map(p => p.hand));
    const updated = {
      ...game, phase: 'playing', board: [], boneyard,
      players, currentSeat: starter.playerIndex,
      roundNumber: (game.roundNumber || 1) + 1, roundWinner: null,
    };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  // ── Host play actions (seat 0) ────────────────────────────────────────────
  const hostPlayOnEnd = async (side) => {
    if (!game || game.currentSeat !== 0 || game.phase !== 'playing' || !selectedDomino) return;
    const hostHand = game.players[0].hand;
    const domino = hostHand.find(d => d.id === selectedDomino.id);
    if (!domino) return;
    const board = game.board || [];
    const ends = getPlayableEnds(domino, board);
    if (!ends.includes(side)) { flash("That tile doesn't fit there"); return; }

    const entry = buildEntry(domino, side, board);
    const newBoard = [...board, entry];
    const newHand = hostHand.filter(d => d.id !== domino.id);
    const nextSeat = 1;
    let players = game.players.map((p, i) => i === 0 ? { ...p, hand: newHand } : p);
    let updated;

    const endPts = calcEndScore(newBoard);
    const playTeam = getTeam(0);
    const baseScores = {
      teamA: (game.teamScores?.teamA || 0) + (playTeam === 0 ? endPts : 0),
      teamB: (game.teamScores?.teamB || 0) + (playTeam === 1 ? endPts : 0),
    };

    if (newHand.length === 0) {
      const pts = calcRoundPoints(players, 0);
      const winTeam = getTeam(0);
      const teamScores = { teamA: baseScores.teamA + (winTeam === 0 ? pts : 0), teamB: baseScores.teamB + (winTeam === 1 ? pts : 0) };
      updated = { ...game, board: newBoard, players, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts, playerName: game.players[0].playerName } };
    } else if (isBlocked(players, newBoard)) {
      const teamPips = [0, 1].map(team => players.filter((_, i) => getTeam(i) === team).reduce((s, p) => s + pipCount(p.hand), 0));
      const winTeam = teamPips[0] <= teamPips[1] ? 0 : 1;
      const pts = Math.round(teamPips[1 - winTeam] / 5) * 5;
      const teamScores = { teamA: baseScores.teamA + (winTeam === 0 ? pts : 0), teamB: baseScores.teamB + (winTeam === 1 ? pts : 0) };
      updated = { ...game, board: newBoard, players, phase: 'round_over', teamScores, roundWinner: { team: winTeam, points: pts } };
    } else {
      updated = { ...game, board: newBoard, players, currentSeat: nextSeat, teamScores: baseScores };
    }
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const hostPlayFirst = async (domino) => {
    if (!game || game.currentSeat !== 0 || game.phase !== 'playing' || (game.board || []).length !== 0) return;
    const board = game.board || [];
    const entry = buildEntry(domino, 'first', board);
    const newBoard = [entry];
    const newHand = game.players[0].hand.filter(d => d.id !== domino.id);
    const players = game.players.map((p, i) => i === 0 ? { ...p, hand: newHand } : p);
    const endPts = calcEndScore(newBoard);
    const playTeam = getTeam(0);
    const teamScores = {
      teamA: (game.teamScores?.teamA || 0) + (playTeam === 0 ? endPts : 0),
      teamB: (game.teamScores?.teamB || 0) + (playTeam === 1 ? endPts : 0),
    };
    const updated = { ...game, board: newBoard, players, currentSeat: 1, teamScores };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    setSelectedDomino(null);
  };

  const hostDraw = async () => {
    if (!game || game.currentSeat !== 0 || game.phase !== 'playing') return;
    const boneyard = [...(game.boneyard || [])];
    if (boneyard.length === 0) { flash('Boneyard is empty'); return; }
    const drawn = boneyard.pop();
    const players = game.players.map((p, i) => i === 0 ? { ...p, hand: [...p.hand, drawn] } : p);
    const updated = { ...game, boneyard, players };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
  };

  const hostKnock = async () => {
    if (!game || game.currentSeat !== 0 || game.phase !== 'playing') return;
    const hostHand = game.players[0].hand;
    const board = game.board || [];
    if (getLegalMoves(hostHand, board).length > 0) { flash("You have playable tiles!"); return; }
    const updated = { ...game, currentSeat: 1 };
    await base44.entities.DominoGame.update(game.id, updated);
    setGame(updated);
    flash('You knocked — turn passed', 'info');
  };

  const handleHostTileClick = (domino) => {
    if (!game || game.currentSeat !== 0 || game.phase !== 'playing') return;
    const board = game.board || [];
    const hostHand = game.players[0].hand;
    const legalMoves = getLegalMoves(hostHand, board);
    const playableIds = new Set(legalMoves.map(m => m.domino.id));
    if (!playableIds.has(domino.id)) { flash("That tile doesn't fit any open end"); return; }
    if (board.length === 0) { hostPlayFirst(domino); return; }
    setSelectedDomino(prev => prev?.id === domino.id ? null : domino);
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
          <p className="text-white/40 font-body text-sm mb-8">Draw Dominoes · 2v2 Partners</p>

          <div className="p-4 rounded-xl border border-outlaw-gold/30 bg-black/40 mb-4">
            <p className="text-[7px] text-white/40 uppercase tracking-widest mb-3" style={PS2}>Your Name (Host · Seat 1)</p>
            <input
              type="text" value={hostName} onChange={e => setHostName(e.target.value)}
              placeholder="ENTER YOUR NAME" maxLength={20}
              className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-outlaw-gold/50 text-white font-body text-lg text-center tracking-wider focus:outline-none focus:border-outlaw-gold"
              onKeyDown={e => e.key === 'Enter' && createRoom()}
            />
          </div>

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
          <button onClick={createRoom} disabled={loading || !hostName.trim()}
            className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#BC13FE,#7c3aed)', boxShadow: '0 0 24px rgba(188,19,254,0.4)' }}>
            {loading ? '⚙ Creating…' : '⚡ CREATE ROOM & SIT DOWN'}
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const openEnds = getOpenEnds(game.board || []);
  const currentPlayer = game.players?.[game.currentSeat];
  const gameOver = (game.teamScores?.teamA || 0) >= (game.scoreLimit || 100) || (game.teamScores?.teamB || 0) >= (game.scoreLimit || 100);
  const isHostTurn = game.phase === 'playing' && game.currentSeat === 0;
  const hostHand = game.players?.[0]?.hand || [];
  const hostLegalMoves = isHostTurn ? getLegalMoves(hostHand, game.board || []) : [];
  const hostPlayableIds = new Set(hostLegalMoves.map(m => m.domino.id));
  const hostHasLegalMove = hostLegalMoves.length > 0;
  const hostPlayableEnds = selectedDomino ? new Set(getPlayableEnds(selectedDomino, game.board || [])) : new Set();

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: 'radial-gradient(ellipse at 50% 0%,#0a0318,#050505)' }}>
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
            <span className="text-white/30 text-xs font-body">Round {game.roundNumber || 1}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Score display */}
            {[0, 1].map(t => (
              <span key={t} className="text-sm font-mono font-bold px-2 py-0.5 rounded border" style={{ color: TEAM_COLORS[t], borderColor: `${TEAM_COLORS[t]}40`, background: `${TEAM_COLORS[t]}10` }}>
                {TEAM_NAMES[t]}: {t === 0 ? (game.teamScores?.teamA || 0) : (game.teamScores?.teamB || 0)}/{game.scoreLimit}
              </span>
            ))}
            {game.phase === 'waiting' && <ActionBtn onClick={startGame} color="#4ade80">▶ START</ActionBtn>}
            {game.phase === 'round_over' && !gameOver && <ActionBtn onClick={startNextRound} color="#FFD700">▶ NEXT ROUND</ActionBtn>}
            {game.phase === 'playing' && <ActionBtn onClick={endGame} color="#ef4444">🏁 END</ActionBtn>}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-3 py-4 gap-4">

        {/* ── LEFT: Seat setup panel ── */}
        <div className="lg:w-56 space-y-3 flex-shrink-0">
          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <p style={PS2} className="text-[6px] text-white/40 uppercase tracking-widest mb-3">Seats · {game.room_code}</p>
            <div className="space-y-2">
              {[0, 1, 2, 3].map(seat => {
                const p = game.players?.[seat];
                const isTurn = game.currentSeat === seat && game.phase === 'playing';
                const team = getTeam(seat);
                const color = TEAM_COLORS[team];
                const char = TEXASNOMAD_CHARACTERS.find(c => c.id === p?.aiCharacterId);
                return (
                  <div key={seat} className="rounded-lg p-2 border" style={{ borderColor: isTurn ? '#4ade80' : `${color}25`, background: isTurn ? 'rgba(74,222,128,0.06)' : `${color}07` }}>
                    <div className="flex items-center gap-2 mb-1">
                      {char && <img src={char.avatar} alt={char.name} style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${color}` }} />}
                      <div>
                        <div style={{ ...PS2, fontSize: 5, color }} className="leading-tight">Seat {seat + 1} · {TEAM_NAMES[team]}{seat === 0 ? ' · HOST' : ''}</div>
                        <div className="text-[9px] font-body text-white truncate max-w-[110px]">
                          {p?.playerName || 'Empty'}
                        </div>
                      </div>
                      {isTurn && <span style={PS2} className="text-[5px] text-emerald-400 ml-auto animate-pulse">▶</span>}
                    </div>
                    <div className="flex gap-1">
                      {!p?.playerId && game.phase === 'waiting' && (
                        <button onClick={() => addAI(seat)} style={PS2} className="text-[5px] px-1.5 py-0.5 rounded border border-cyber-purple/40 text-cyber-purple hover:bg-cyber-purple/10 flex-1">+CPU</button>
                      )}
                      {p?.isAI && game.phase === 'waiting' && (
                        <button onClick={() => removeAI(seat)} style={PS2} className="text-[5px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">✕</button>
                      )}
                      {p?.playerId && !p.isAI && game.phase === 'waiting' && (
                        <button onClick={() => kickPlayer(seat)} style={PS2} className="text-[5px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">KICK</button>
                      )}
                      {p?.hand?.length > 0 && (
                        <span className="text-[9px] font-mono ml-auto" style={{ color }}>{p.hand.length}🁣</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Open ends */}
          {game.phase === 'playing' && (
            <div className="rounded-xl border border-white/10 bg-black/50 p-3">
              <p style={PS2} className="text-[6px] text-white/40 uppercase tracking-widest mb-2">Open Ends</p>
              <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                <span>← <span className="text-emerald-400 font-bold">{openEnds.left ?? '—'}</span></span>
                <span>→ <span className="text-emerald-400 font-bold">{openEnds.right ?? '—'}</span></span>
                {openEnds.hasSpinner && <>
                  <span>↑ <span className="text-outlaw-gold font-bold">{openEnds.top ?? '—'}</span></span>
                  <span>↓ <span className="text-outlaw-gold font-bold">{openEnds.bottom ?? '—'}</span></span>
                </>}
              </div>
              <p className="text-[9px] font-body text-white/30 mt-1">Boneyard: {game.boneyard?.length || 0}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Table ── */}
        <div className="flex-1 flex flex-col gap-3">

          {/* Table with seat positions */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{
              aspectRatio: '4/3', minHeight: 340,
              background: 'radial-gradient(ellipse at center,rgba(255,140,30,0.5) 0%,rgba(200,80,10,0.4) 50%,rgba(120,40,0,0.55) 100%)',
              border: '4px solid rgba(255,160,50,0.5)',
              boxShadow: 'inset 0 0 60px rgba(255,120,20,0.12)',
            }}>

            {/* Board in center */}
            <div className="absolute inset-16" style={{ zIndex: 1 }}>
              <DominoBoard
                board={game.board || []}
                openEnds={openEnds}
                playableEnds={hostPlayableEnds}
                onEndClick={isHostTurn && selectedDomino ? hostPlayOnEnd : undefined}
                interactive={isHostTurn && !!selectedDomino}
              />
            </div>

            {/* Seat overlays */}
            {game.players?.map((p, seat) => (
              <SeatCard
                key={seat}
                player={p}
                seat={seat}
                isTurn={game.currentSeat === seat && game.phase === 'playing'}
                position={SEAT_POSITIONS[seat]}
                gamePhase={game.phase}
              />
            ))}
          </div>

          {/* Host hand (seat 0) — interactive when it's host's turn */}
          <div className="rounded-2xl p-3"
            style={{ background: 'rgba(12,6,30,0.94)', border: `2px solid ${isHostTurn ? '#4ade80' : TEAM_COLORS[0]}60`, boxShadow: isHostTurn ? '0 0 14px rgba(74,222,128,0.2)' : 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ ...PS2, fontSize: 6, color: isHostTurn ? '#4ade80' : TEAM_COLORS[0] }}>
                YOUR HAND (Seat 1) · {hostHand.length} tiles
                {isHostTurn && <span className="animate-pulse ml-2">▶ YOUR TURN</span>}
              </span>
              <span className="text-[9px] font-body text-white/30">Boneyard: {game.boneyard?.length || 0}</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {hostHand.map(d => {
                const isPlayable = isHostTurn && hostPlayableIds.has(d.id);
                const isSelected = selectedDomino?.id === d.id;
                return (
                  <div key={d.id} style={{ opacity: isHostTurn && !isPlayable ? 0.35 : 1, cursor: isHostTurn ? 'pointer' : 'default' }}
                    onClick={() => handleHostTileClick(d)}>
                    <DominoTile a={d.a} b={d.b} unit={32} vertical playable={isPlayable} selected={isSelected} />
                  </div>
                );
              })}
              {!hostHand.length && (
                <span className="text-white/20 text-xs font-body">{game.phase === 'waiting' ? 'Tiles dealt when game starts' : 'No tiles'}</span>
              )}
            </div>
            {isHostTurn && (
              <div className="flex flex-wrap gap-2 items-center">
                {selectedDomino && (
                  <span className="text-xs font-body">
                    {hostPlayableEnds.size > 0
                      ? <span className="text-emerald-400">Tap a glowing zone on the board ↑</span>
                      : <span className="text-red-400">No matching end for this tile</span>}
                  </span>
                )}
                {!hostHasLegalMove && (game.boneyard?.length || 0) > 0 && (
                  <button onClick={hostDraw} className="px-4 py-1.5 rounded-xl font-heading text-sm tracking-widest uppercase text-white border-2 border-emerald-500 hover:bg-emerald-500/20">📦 DRAW</button>
                )}
                {!hostHasLegalMove && (game.boneyard?.length || 0) === 0 && (
                  <button onClick={hostKnock} className="px-4 py-1.5 rounded-xl font-heading text-sm tracking-widest uppercase text-black font-bold" style={{ background: 'linear-gradient(135deg,#FFD700,#f59e0b)' }}>🤜 KNOCK</button>
                )}
                {selectedDomino && (
                  <button onClick={() => setSelectedDomino(null)} className="px-3 py-1.5 rounded-xl font-heading text-sm uppercase text-white/40 border border-white/15 hover:border-white/30">CANCEL</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl font-body text-sm z-50 pointer-events-none border ${feedback.type === 'error' ? 'bg-red-950 border-red-500 text-red-200' : 'bg-black/90 border-emerald-500/50 text-emerald-300'}`}>
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