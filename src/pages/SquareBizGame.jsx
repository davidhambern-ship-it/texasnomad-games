import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import RoleSelector from '@/components/game/RoleSelector.jsx';

export default function SquareBizGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <SquareBizViewer roomCode={roomCode} />;
}

function checkWinner(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,c,d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function SquareBizViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'square-biz', 'viewer');
  const gs = room?.game_state || {};
  const roomPlayers = gs.players || [];
  const sbPlayers = gs.sb_players || [];
  const sbQueue = gs.sb_queue || [];

  // Role selection state
  const [chosenRole, setChosenRole] = useState(null); // 'participant' | 'watcher' | null
  const [roleLoading, setRoleLoading] = useState(false);

  // Universal seat assignment — now requires chosenRole
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'square-biz', updateState, false, chosenRole);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const displayMode = gs.display_mode;
  const createdFromHostPanel = room?.created_from_host_panel || false;

  // Auto-assign X/O based on room creation type and player choice
  useEffect(() => {
    if (!isSeated || !playerId || chosenRole !== 'participant') return;
    if (displayMode !== 'board') return;

    const xPlayer = sbPlayers.find(p => p.role === 'X');
    const oPlayer = sbPlayers.find(p => p.role === 'O');
    const myRecord = sbPlayers.find(p => p.playerId === playerId);
    
    // Already assigned a marker or someone else is assigning
    if (myRecord && (myRecord.role === 'X' || myRecord.role === 'O')) return;

    const xTaken = !!xPlayer;
    const oTaken = !!oPlayer;

    // Debounce to prevent rate limiting
    const timeoutId = setTimeout(async () => {
      const newPlayers = sbPlayers.map(p => 
        p.playerId === playerId ? { ...p, role: xTaken ? 'O' : 'X', marker: xTaken ? 'O' : 'X', lastActionAt: Date.now() } : p
      );
      await updateState({ sb_players: newPlayers });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isSeated, playerId, chosenRole, displayMode, createdFromHostPanel, sbPlayers.length]);

  const handleChooseRole = async (role) => {
    setRoleLoading(true);
    setChosenRole(role);
    // Role assignment happens in usePlayerSeat
    setTimeout(() => setRoleLoading(false), 1000);
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#05030b] text-white flex flex-col relative">
      {/* Role Selection Modal */}
      {!chosenRole && isSeated && displayMode === 'board' && !loading && (
        <RoleSelector
          seatNumber={seatNumber}
          isSeated={isSeated}
          onChooseRole={handleChooseRole}
          loading={roleLoading}
        />
      )}

      <header className="sticky top-0 z-40 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FF5F1F] uppercase text-[10px] tracking-widest" style={{ fontFamily: "'Press Start 2P', monospace" }}>Square Biz!</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span className="text-[9px] tracking-widest text-[#BC13FE] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>ROOM {roomCode}</span>
            </div>
            {room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[8px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                🔴 HOST LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
            <Link to="/" className="px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[8px] tracking-widest uppercase hidden sm:block" style={{ fontFamily: "'Press Start 2P', monospace" }}>← LOBBY</Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-3 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[8px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#8a22ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !displayMode ? (
        <WaitingForHost />
      ) : displayMode === 'panel' ? (
        <PanelModeBoard gs={gs} />
      ) : (
        <BoardModeBoard gs={gs} updateState={updateState} playerId={playerId} seatNumber={seatNumber} isSeated={isSeated} chosenRole={chosenRole} />
      )}
    </div>
  );
}

function WaitingForHost() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8">
      <div className="w-16 h-16 border-4 border-[#8a22ff]/40 border-t-[#8a22ff] rounded-full animate-spin" />
      <div className="font-heading text-2xl tracking-widest text-white/40 uppercase">Waiting for Host…</div>
    </div>
  );
}

/* ── PANEL MODE ── */
function PanelModeBoard({ gs }) {
  const board = gs.board || Array(9).fill('');
  const popup = gs.popup;

  const cellDisplay = (v, idx) => {
    const isSelected = gs.selected_square === idx;
    if (v === 'X') return { char: 'X', color: '#BC13FE', border: '#BC13FE', glow: '0 0 20px rgba(188,19,254,0.8), inset 0 0 15px rgba(188,19,254,0.2)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', border: '#FF5F1F', glow: '0 0 20px rgba(255,95,31,0.8), inset 0 0 15px rgba(255,95,31,0.2)' };
    if (isSelected) return { char: '', color: '#FFD700', border: '#FFD700', glow: '0 0 24px rgba(255,215,0,0.6)' };
    return { char: '', color: '#ffffff80', border: '#FF5F1F', glow: '0 0 15px rgba(188,19,254,0.5), inset 0 0 10px rgba(255,95,31,0.15)' };
  };

  return (
    <div className="flex-1 flex items-stretch p-4 gap-4 relative">
      {popup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="font-heading text-8xl md:text-9xl tracking-widest uppercase animate-pulse"
            style={{ color: popup === 'correct' ? '#4ade80' : '#ef4444', textShadow: `0 0 40px ${popup === 'correct' ? '#4ade80' : '#ef4444'}` }}>
            {popup === 'correct' ? 'CORRECT!' : 'WRONG!'}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {gs.show_choices && gs.current_choices ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#8a22ff]/70 uppercase mb-1">Choices</div>
            {['A','B','C','D'].map((letter) => {
              const text = gs.current_choices?.[letter];
              if (!text) return null;
              return (
                <div key={letter} className="px-5 py-4 rounded-xl border-2 font-heading text-lg tracking-wide"
                  style={{ borderColor: '#8a22ff40', background: '#8a22ff10', color: '#ffffffcc' }}>
                  <span className="text-[#8a22ff] mr-3">{letter}.</span>{text}
                </div>
              );
            })}
          </>
        ) : <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase">Choices will appear here</div>}
      </div>
      <div className="flex flex-col items-center justify-center gap-4 shrink-0">
        <div className="text-center">
          <div className="font-heading text-xs tracking-[0.25em] text-white/40 uppercase mb-1">Turn</div>
          <div className="font-heading text-4xl font-bold"
            style={{ color: gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 24px ${gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            {gs.current_turn || 'X'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3" style={{ width: 'clamp(240px, 30vw, 400px)' }}>
          {board.map((cell, idx) => {
            const { char, color, border, glow } = cellDisplay(cell, idx);
            return (
              <div key={idx} className="aspect-square flex items-center justify-center rounded-xl border-4 font-heading transition-all"
                style={{ fontSize: 'clamp(2rem, 5vw, 5rem)', borderColor: border || '#FF5F1F', color, background: cell ? `${color}20` : '#0a0a0a', boxShadow: glow, fontWeight: cell ? 'bold' : 'normal' }}>
                {char}
              </div>
            );
          })}
        </div>
        {gs.winner && (
          <div className="font-heading text-3xl tracking-widest uppercase"
            style={{ color: gs.winner === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 30px ${gs.winner === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            🏆 {gs.winner} WINS!
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {gs.show_question && gs.current_question ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/70 uppercase mb-1">Question</div>
            <div className="px-5 py-5 rounded-xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5 font-heading text-xl tracking-wide text-white leading-snug"
              style={{ boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
              {gs.current_question}
            </div>
          </>
        ) : <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase">Question will appear here</div>}
      </div>
    </div>
  );
}

/* ── BOARD MODE ── */
function BoardModeBoard({ gs, updateState, playerId, seatNumber, isSeated, chosenRole }) {
  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const boardLocked = gs.board_locked !== false;
  const popup = gs.popup;
  const sty = { fontFamily: "'Press Start 2P', monospace" };

  // Determine my role from game state
  const sbPlayers = gs.sb_players || [];
  const sbQueue = gs.sb_queue || [];
  const myRecord = sbPlayers.find(p => p.playerId === playerId);
  const myRole = myRecord?.role || null; // 'X' | 'O' | 'viewer' | null (unassigned)
  const myQueueRecord = sbQueue.find(p => p.playerId === playerId);
  const myQueuePos = myQueueRecord?.queuePosition || null;

  const [roleChoice, setRoleChoice] = useState(null); // 'queue' | 'viewer' | null — for the prompt
  const [joinedQueue, setJoinedQueue] = useState(false);

  const xPlayer = sbPlayers.find(p => p.role === 'X');
  const oPlayer = sbPlayers.find(p => p.role === 'O');

  // Auto-assign role when joining board mode (only if chosenRole is 'participant')
  useEffect(() => {
    if (!isSeated || !playerId || myRole) return;
    if (gs.display_mode !== 'board') return;
    if (chosenRole !== 'participant') return;

    const xTaken = !!xPlayer;
    const oTaken = !!oPlayer;

    // First participant gets X, second gets O
    if (!xTaken) {
      const newPlayers = [...sbPlayers, { playerId, seatNumber, role: 'X', joinedAt: Date.now(), lastActionAt: Date.now() }];
      updateState({ sb_players: newPlayers });
    } else if (!oTaken) {
      const newPlayers = [...sbPlayers, { playerId, seatNumber, role: 'O', joinedAt: Date.now(), lastActionAt: Date.now() }];
      updateState({ sb_players: newPlayers });
    }
    // else: both taken — show the prompt (myRole stays null)
  }, [isSeated, playerId, gs.display_mode, sbPlayers, chosenRole, xPlayer, oPlayer]);

  const handleJoinQueue = async () => {
    const nextPos = sbQueue.length + 1;
    const newQueue = [...sbQueue, { playerId, seatNumber, joinedQueueAt: Date.now(), queuePosition: nextPos }];
    const newPlayers = [...sbPlayers, { playerId, seatNumber, role: 'queued', joinedAt: Date.now(), lastActionAt: Date.now() }];
    await updateState({ sb_queue: newQueue, sb_players: newPlayers });
    setRoleChoice('queue');
    setJoinedQueue(true);
  };

  const handleWatchOnly = async () => {
    const newPlayers = [...sbPlayers, { playerId, seatNumber, role: 'viewer', joinedAt: Date.now(), lastActionAt: Date.now() }];
    await updateState({ sb_players: newPlayers });
    setRoleChoice('viewer');
  };

  const handleCellClick = async (idx) => {
    if (boardLocked || board[idx] || gs.winner) return;
    if (myRole !== currentTurn) return; // not your turn

    const newBoard = [...board];
    newBoard[idx] = currentTurn;
    const winner = checkWinner(newBoard);
    const nextTurn = currentTurn === 'X' ? 'O' : 'X';

    const updatedPlayers = sbPlayers.map(p => p.playerId === playerId ? { ...p, lastActionAt: Date.now() } : p);

    await updateState({
      board: newBoard,
      current_turn: nextTurn,
      winner: winner || null,
      board_locked: true,
      show_question: false,
      show_choices: false,
      answer_result: null,
      last_action_seat: seatNumber,
      last_action_player_id: playerId,
      sb_players: updatedPlayers,
      ...(winner ? {} : { auto_next_question: Date.now() }),
    });
  };

  const handlePlayClick = async () => {
    if (myRole !== 'O') return; // Only O player can click PLAY
    // Trigger auto-fetch and show question
    await updateState({ auto_next_question: Date.now(), show_question: false, show_choices: false, answer_result: null });
  };

  const cellDisplay = (v, idx) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE', border: '#BC13FE', glow: '0 0 20px rgba(188,19,254,0.8), inset 0 0 15px rgba(188,19,254,0.2)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', border: '#FF5F1F', glow: '0 0 20px rgba(255,95,31,0.8), inset 0 0 15px rgba(255,95,31,0.2)' };
    // Empty square - bright with orange border and purple glow
    const isHovered = isMyTurn && canControl && !gs.winner;
    return { 
      char: '', 
      color: '#ffffff80', 
      border: '#FF5F1F', 
      glow: isHovered 
        ? '0 0 25px rgba(188,19,254,0.9), inset 0 0 20px rgba(255,95,31,0.3)' 
        : '0 0 15px rgba(188,19,254,0.5), inset 0 0 10px rgba(255,95,31,0.15)'
    };
  };

  const isMyTurn = myRole === currentTurn;
  // PLAY button: Only show when it's O's turn, board is locked, question is showing, no popup, no winner
  const showPlayButton = myRole === 'O' && boardLocked && gs.show_question && !gs.show_choices && !gs.winner && !popup && isMyTurn;
  const canControl = myRole === 'X' || myRole === 'O';
  const showPrompt = isSeated && !myRole && !myQueueRecord && xTaken && oTaken && roleChoice === null;

  const roleColor = myRole === 'X' ? '#BC13FE' : myRole === 'O' ? '#FF5F1F' : myRole === 'queued' ? '#FFD700' : '#ffffff40';
  const roleLabel = myRole === 'X' ? 'You are X' : myRole === 'O' ? 'You are O' : myRole === 'queued' ? `Queued — Position ${myQueuePos}` : myRole === 'viewer' ? 'You are Viewer' : null;

  return (
    <div className="flex-1 flex items-stretch p-4 gap-4 relative">
      {/* Popup overlay */}
      {popup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="font-heading text-8xl md:text-9xl tracking-widest uppercase animate-pulse"
            style={{ color: popup === 'correct' ? '#4ade80' : '#ef4444', textShadow: `0 0 40px ${popup === 'correct' ? '#4ade80' : '#ef4444'}` }}>
            {popup === 'correct' ? 'CORRECT!' : 'WRONG!'}
          </div>
        </div>
      )}

      {/* Role prompt — both slots taken */}
      {showPrompt && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-sm w-full mx-4 p-8 rounded-2xl border-2 border-[#FFD700]/40 bg-black text-center space-y-5"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.15)' }}>
            <div className="font-heading text-lg tracking-widest text-white uppercase">Game In Progress</div>
            <p className="font-body text-white/60 text-sm">This game already has two active players. Would you like to join the queue to play next?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleJoinQueue}
                className="py-4 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ borderColor: '#FFD700', color: '#FFD700', background: '#FFD70010' }}>
                Join Queue
              </button>
              <button onClick={handleWatchOnly}
                className="py-4 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ borderColor: '#ffffff20', color: '#ffffff50', background: 'transparent' }}>
                Watch Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT — Question + Choices + Role badge */}
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {/* My role badge */}
        {roleLabel && (
          <div className="px-4 py-3 rounded-xl border-2 text-center mb-2"
            style={{ borderColor: `${roleColor}50`, background: `${roleColor}10` }}>
            <div className="font-heading text-base tracking-widest uppercase" style={{ color: roleColor, ...sty, fontSize: '10px' }}>{roleLabel}</div>
            {canControl && (
              <div className="text-[7px] tracking-widest text-white/30 uppercase mt-1" style={sty}>
                {isMyTurn ? '▶ Your turn' : 'Waiting for your turn…'}
              </div>
            )}
          </div>
        )}

        {/* Viewer join queue button */}
        {myRole === 'viewer' && !myQueueRecord && (
          <button onClick={handleJoinQueue}
            className="px-4 py-3 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{ borderColor: '#FFD70060', color: '#FFD700', background: '#FFD70008' }}>
            Join Queue
          </button>
        )}

        {gs.show_question && gs.current_question ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/70 uppercase mb-1">Question</div>
            <div className="px-5 py-5 rounded-xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5 font-heading text-xl tracking-wide text-white leading-snug"
              style={{ boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
              {gs.current_question}
            </div>
            {/* Show Choices button - only for O player, when choices not yet shown */}
            {isMyTurn && !gs.show_choices && !popup && (
              <button
                onClick={() => updateState({ show_choices: true })}
                className="mt-2 px-6 py-3 rounded-xl border-2 border-[#8a22ff] text-[#8a22ff] font-heading text-sm tracking-widest uppercase hover:bg-[#8a22ff]/20 transition-all active:scale-95"
                style={{ boxShadow: '0 0 15px rgba(138,34,255,0.3)' }}>
                Show Choices
              </button>
            )}
          </>
        ) : null}

        {gs.show_choices && gs.current_choices && (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#8a22ff]/70 uppercase mb-1 mt-3">Choices</div>
            {['A','B','C','D'].map((letter) => {
              const text = gs.current_choices[letter];
              if (!text) return null;
              return (
                <div key={letter} className="px-5 py-4 rounded-xl border-2 font-heading text-lg tracking-wide"
                  style={{ borderColor: '#8a22ff40', background: '#8a22ff10', color: '#ffffffcc' }}>
                  <span className="text-[#8a22ff] mr-3">{letter}.</span>{text}
                </div>
              );
            })}
          </>
        )}

        {/* Not your turn message */}
        {canControl && !isMyTurn && !gs.winner && (
          <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-center">
            <div className="text-[8px] tracking-widest text-white/30 uppercase" style={sty}>
              It is not your turn
            </div>
          </div>
        )}
      </div>

      {/* CENTER — Board */}
      <div className="flex flex-col items-center justify-center gap-4 shrink-0">
        {/* Player slots */}
        <div className="flex gap-3">
          {[{ role: 'X', color: '#BC13FE', player: xPlayer }, { role: 'O', color: '#FF5F1F', player: oPlayer }].map(({ role, color, player }) => (
            <div key={role} className="px-3 py-2 rounded-lg border text-center min-w-[80px]"
              style={{ borderColor: currentTurn === role ? color : `${color}30`, background: currentTurn === role ? `${color}15` : 'transparent' }}>
              <div className="font-heading text-lg" style={{ color, textShadow: currentTurn === role ? `0 0 12px ${color}` : 'none' }}>{role}</div>
              <div className="text-[7px] text-white/40 uppercase" style={sty}>
                {player ? `Seat ${player.seatNumber}` : 'Open'}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <div className="font-heading text-xs tracking-[0.25em] text-white/40 uppercase mb-1">Turn</div>
          <div className="font-heading text-4xl font-bold"
            style={{ color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 24px ${currentTurn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            {currentTurn}
          </div>
        </div>

        <div className="relative" style={{ width: 'clamp(240px, 30vw, 400px)' }}>
          <div className="grid grid-cols-3 gap-3">
            {board.map((cell, idx) => {
              const { char, color, border, glow } = cellDisplay(cell, idx);
              const canClick = !boardLocked && !cell && !gs.winner && isMyTurn && canControl;
              return (
                <div key={idx}
                  onClick={() => canClick && handleCellClick(idx)}
                  className={`aspect-square flex items-center justify-center rounded-xl border-4 font-heading transition-all ${canClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                  style={{ 
                    fontSize: 'clamp(2rem, 5vw, 5rem)', 
                    borderColor: cell ? border : border, 
                    color, 
                    background: cell ? `${color}20` : '#0a0a0a', 
                    boxShadow: glow,
                    fontWeight: cell ? 'bold' : 'normal'
                  }}>
                  {char}
                </div>
              );
            })}
          </div>

          {/* PLAY button */}
          {showPlayButton && canControl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
              <button
                onClick={handlePlayClick}
                className="px-8 py-4 rounded-xl border-2 border-[#FFD700] text-[#FFD700] font-heading text-2xl tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
                style={{ boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}>
                ▶ PLAY
              </button>
            </div>
          )}

          {/* Board open indicator */}
          {!boardLocked && !gs.winner && isMyTurn && canControl && (
            <div className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ boxShadow: '0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.3)' }} />
          )}
        </div>

        {gs.winner && (
          <div className="font-heading text-3xl tracking-widest uppercase"
            style={{ color: gs.winner === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 30px ${gs.winner === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            🏆 {gs.winner} WINS!
          </div>
        )}

        <div className="text-center">
          <div className="text-[9px] tracking-widest uppercase font-heading"
            style={{ color: boardLocked ? '#ffffff30' : '#4ade80', fontFamily: "'Press Start 2P', monospace" }}>
            {boardLocked ? '🔒 BOARD LOCKED' : '🟢 PLACE MARKER'}
          </div>
        </div>

        {/* Queue count */}
        {sbQueue.length > 0 && (
          <div className="text-[7px] text-white/30 uppercase tracking-widest text-center" style={sty}>
            {sbQueue.length} in queue
          </div>
        )}
      </div>

      <div className="flex-1" />
    </div>
  );
}