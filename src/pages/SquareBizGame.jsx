import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat';
import SeatBadge from '@/components/game/SeatBadge.jsx';

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

  // Universal seat assignment
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'square-biz', updateState);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const displayMode = gs.display_mode;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#05030b] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
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
        <BoardModeBoard gs={gs} updateState={updateState} playerId={playerId} seatNumber={seatNumber} isSeated={isSeated} />
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
    if (v === 'X') return { char: 'X', color: '#BC13FE', glow: '0 0 24px rgba(188,19,254,0.7)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', glow: '0 0 24px rgba(255,95,31,0.7)' };
    if (isSelected) return { char: '', color: '#FFD700', glow: '0 0 16px rgba(255,215,0,0.5)' };
    return { char: '', color: '#ffffff10', glow: 'none' };
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
            const { char, color, glow } = cellDisplay(cell, idx);
            return (
              <div key={idx} className="aspect-square flex items-center justify-center rounded-xl border-2 font-heading transition-all"
                style={{ fontSize: 'clamp(2rem, 5vw, 5rem)', borderColor: cell ? color : gs.selected_square === idx ? '#FFD700' : '#ffffff10', color, background: cell ? `${color}15` : '#00000060', boxShadow: glow }}>
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
function BoardModeBoard({ gs, updateState, playerId, seatNumber, isSeated }) {
  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const boardLocked = gs.board_locked !== false; // default locked
  const popup = gs.popup;

  const handleCellClick = async (idx) => {
    if (boardLocked || board[idx] || gs.winner) return;

    const newBoard = [...board];
    newBoard[idx] = currentTurn;
    const winner = checkWinner(newBoard);
    const nextTurn = currentTurn === 'X' ? 'O' : 'X';

    await updateState({
      board: newBoard,
      current_turn: nextTurn,
      winner: winner || null,
      board_locked: true,       // lock immediately after placement
      show_question: false,
      show_choices: false,
      answer_result: null,
      last_action_seat: seatNumber,
      last_action_player_id: playerId,
      // Signal host panel to fetch next question (unless game is won)
      ...(winner ? {} : { auto_next_question: Date.now() }),
    });
  };

  const handlePlayClick = async () => {
    // Fetch a question via auto_next_question signal
    await updateState({ auto_next_question: Date.now(), show_question: false, answer_result: null });
  };

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE', glow: '0 0 24px rgba(188,19,254,0.7)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', glow: '0 0 24px rgba(255,95,31,0.7)' };
    return { char: '', color: '#ffffff10', glow: 'none' };
  };

  // Show PLAY button when board is locked and no question is showing and no winner yet
  const showPlayButton = boardLocked && !gs.show_question && !gs.winner && !popup;

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

      {/* LEFT — Question + Choices */}
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {gs.show_question && gs.current_question ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/70 uppercase mb-1">Question</div>
            <div className="px-5 py-5 rounded-xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5 font-heading text-xl tracking-wide text-white leading-snug"
              style={{ boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
              {gs.current_question}
            </div>
            {gs.show_choices && gs.current_choices && (
              <div className="space-y-2 mt-2">
                {['A','B','C','D'].map((letter) => {
                  const text = gs.current_choices?.[letter];
                  if (!text) return null;
                  return (
                    <div key={letter} className="px-4 py-3 rounded-lg border font-heading text-base"
                      style={{ borderColor: '#8a22ff60', background: '#8a22ff10', color: '#ffffffcc' }}>
                      <span className="text-[#8a22ff] mr-2">{letter}.</span>{text}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* CENTER — Board */}
      <div className="flex flex-col items-center justify-center gap-4 shrink-0">
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
              const { char, color, glow } = cellDisplay(cell);
              const canClick = !boardLocked && !cell && !gs.winner;
              return (
                <div key={idx}
                  onClick={() => handleCellClick(idx)}
                  className={`aspect-square flex items-center justify-center rounded-xl border-2 font-heading transition-all ${canClick ? 'cursor-pointer hover:scale-105 hover:border-white/40' : 'cursor-default'}`}
                  style={{ fontSize: 'clamp(2rem, 5vw, 5rem)', borderColor: cell ? color : '#ffffff10', color, background: cell ? `${color}15` : '#00000060', boxShadow: glow }}>
                  {char}
                </div>
              );
            })}
          </div>

          {/* PLAY button — shown when board is locked and no active question */}
          {showPlayButton && (
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
          {!boardLocked && !gs.winner && (
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

        {/* Board status */}
        <div className="text-center">
          <div className="text-[9px] tracking-widest uppercase font-heading"
            style={{ color: boardLocked ? '#ffffff30' : '#4ade80', fontFamily: "'Press Start 2P', monospace" }}>
            {boardLocked ? '🔒 BOARD LOCKED' : '🟢 PLACE MARKER'}
          </div>
        </div>
      </div>

      <div className="flex-1" />
    </div>
  );
}