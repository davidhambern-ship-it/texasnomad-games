import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';

export default function SquareBizGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) {
    window.location.href = '/';
    return null;
  }
  return <SquareBizViewer roomCode={roomCode} />;
}

function SquareBizViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'square-biz', 'viewer');
  const gs = room?.game_state || {};
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
            <Link to="/" className="flex items-center gap-2 text-[#FFD700]">
              <div className="w-7 h-7 rounded-full bg-[#8a22ff]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-[10px]">TN</span>
              </div>
            </Link>
            <span className="font-heading text-lg tracking-widest text-[#ff8a00] uppercase">Square Biz!</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#ff2bd6] animate-pulse" />
              <span className="font-heading text-[10px] tracking-widest text-[#ff2bd6] uppercase">ROOM {roomCode}</span>
            </div>
            {room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 font-heading text-[9px] tracking-widest uppercase">
                🔴 HOST LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 font-heading text-xs tracking-widest uppercase rounded hover:bg-[#FFD700]/10 transition-all">← LOBBY</Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-3 py-1 bg-[#FF5F1F] text-white font-heading text-xs tracking-widest uppercase rounded hover:bg-[#FF5F1F]/80 transition-all">
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
        <BoardModeBoard gs={gs} updateState={updateState} />
      )}
    </div>
  );
}

/* ── WAITING ── */
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
      {/* Popup overlay */}
      {popup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div
            className="font-heading text-8xl md:text-9xl tracking-widest uppercase animate-pulse"
            style={{
              color: popup === 'correct' ? '#4ade80' : '#ef4444',
              textShadow: `0 0 40px ${popup === 'correct' ? '#4ade80' : '#ef4444'}, 0 0 80px ${popup === 'correct' ? '#4ade8060' : '#ef444460'}`,
            }}
          >
            {popup === 'correct' ? 'CORRECT!' : 'WRONG!'}
          </div>
        </div>
      )}

      {/* LEFT — Choices (only shown when host sends show_choices) */}
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {gs.show_choices && gs.current_choices ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#8a22ff]/70 uppercase mb-1">Choices</div>
            {['A', 'B', 'C', 'D'].map((letter) => {
              const text = gs.current_choices?.[letter];
              if (!text) return null;
              return (
                <div key={letter}
                  className="px-5 py-4 rounded-xl border-2 font-heading text-lg tracking-wide"
                  style={{ borderColor: '#8a22ff40', background: '#8a22ff10', color: '#ffffffcc' }}>
                  <span className="text-[#8a22ff] mr-3">{letter}.</span>{text}
                </div>
              );
            })}
          </>
        ) : (
          <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase">
            Choices will appear here
          </div>
        )}
      </div>

      {/* CENTER — Board */}
      <div className="flex flex-col items-center justify-center gap-4 shrink-0">
        {/* Turn indicator */}
        <div className="text-center">
          <div className="font-heading text-xs tracking-[0.25em] text-white/40 uppercase mb-1">Turn</div>
          <div className="font-heading text-4xl font-bold"
            style={{ color: gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 24px ${gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            {gs.current_turn || 'X'}
          </div>
        </div>

        {/* 3x3 */}
        <div className="grid grid-cols-3 gap-3" style={{ width: 'clamp(240px, 30vw, 400px)' }}>
          {board.map((cell, idx) => {
            const { char, color, glow } = cellDisplay(cell, idx);
            return (
              <div key={idx}
                className="aspect-square flex items-center justify-center rounded-xl border-2 font-heading transition-all"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 5rem)',
                  borderColor: cell ? color : gs.selected_square === idx ? '#FFD700' : '#ffffff10',
                  color,
                  background: cell ? `${color}15` : gs.selected_square === idx ? '#FFD70015' : '#00000060',
                  boxShadow: glow,
                }}>
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

      {/* RIGHT — Question */}
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {gs.show_question && gs.current_question ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/70 uppercase mb-1">Question</div>
            <div className="px-5 py-5 rounded-xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5 font-heading text-xl tracking-wide text-white leading-snug"
              style={{ boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
              {gs.current_question}
            </div>
          </>
        ) : (
          <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase">
            Question will appear here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── BOARD MODE ── */
function BoardModeBoard({ gs, updateState }) {
  const board = gs.board || Array(9).fill('');
  const [showControlPanel, setShowControlPanel] = useState(false);

  const currentTurn = gs.current_turn || 'X';
  const popup = gs.popup;

  // Phase derived from game state — no timers
  // idle: show_question=false  |  question: show_question=true, show_choices=false  |  choices: show_choices=true
  const roundPhase = !gs.show_question ? 'idle' : !gs.show_choices ? 'question' : 'choices';

  const handlePlay = () => {
    if (!gs.current_question) return;
    updateState({ show_question: true, show_choices: false });
  };

  const handleShowChoices = () => {
    updateState({ show_choices: true });
  };

  const handleCellClick = (idx) => {
    if (board[idx] || gs.winner || roundPhase !== 'idle') return;
    const newBoard = [...board];
    newBoard[idx] = currentTurn;
    const nextTurn = currentTurn === 'X' ? 'O' : 'X';
    updateState({ board: newBoard, current_turn: nextTurn, show_question: false, show_choices: false });
  };

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE', glow: '0 0 24px rgba(188,19,254,0.7)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', glow: '0 0 24px rgba(255,95,31,0.7)' };
    return { char: '', color: '#ffffff10', glow: 'none' };
  };

  return (
    <div className="flex-1 flex items-stretch p-4 gap-4 relative">
      {/* Popup overlay */}
      {popup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div
            className="font-heading text-8xl md:text-9xl tracking-widest uppercase animate-pulse"
            style={{
              color: popup === 'correct' ? '#4ade80' : '#ef4444',
              textShadow: `0 0 40px ${popup === 'correct' ? '#4ade80' : '#ef4444'}`,
            }}
          >
            {popup === 'correct' ? 'CORRECT!' : 'WRONG!'}
          </div>
        </div>
      )}

      {/* LEFT — Question card: shown when show_question=true, choices when show_choices=true */}
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
                {['A', 'B', 'C', 'D'].map((letter) => {
                  const text = gs.current_choices?.[letter];
                  if (!text) return null;
                  return (
                    <div key={letter}
                      className="px-4 py-3 rounded-lg border font-heading text-base"
                      style={{ borderColor: '#8a22ff40', background: '#8a22ff10', color: '#ffffffcc' }}>
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

        {/* Board with PLAY overlay */}
        <div className="relative" style={{ width: 'clamp(240px, 30vw, 400px)' }}>
          <div className="grid grid-cols-3 gap-3">
            {board.map((cell, idx) => {
              const { char, color, glow } = cellDisplay(cell);
              return (
                <div key={idx}
                  onClick={() => roundPhase === 'idle' && handleCellClick(idx)}
                  className="aspect-square flex items-center justify-center rounded-xl border-2 font-heading transition-all cursor-pointer hover:scale-105"
                  style={{
                    fontSize: 'clamp(2rem, 5vw, 5rem)',
                    borderColor: cell ? color : '#ffffff10',
                    color,
                    background: cell ? `${color}15` : '#00000060',
                    boxShadow: glow,
                  }}>
                  {char}
                </div>
              );
            })}
          </div>

          {/* PLAY button overlay — always visible in idle phase */}
          {roundPhase === 'idle' && !gs.winner && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
              <button
                onClick={handlePlay}
                disabled={!gs.current_question}
                className="px-8 py-4 rounded-xl border-2 border-[#FFD700] text-[#FFD700] font-heading text-2xl tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95 disabled:opacity-40"
                style={{ boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}
              >
                ▶ PLAY
              </button>
            </div>
          )}
        </div>

        {/* CHOICES button — visible during question phase, disappears once choices are shown */}
        {roundPhase === 'question' && (
          <button
            onClick={handleShowChoices}
            className="px-6 py-3 rounded-xl border-2 border-[#8a22ff] text-[#8a22ff] font-heading text-lg tracking-widest uppercase hover:bg-[#8a22ff]/20 transition-all active:scale-95"
          >
            Choices →
          </button>
        )}

        {gs.winner && (
          <div className="font-heading text-3xl tracking-widest uppercase"
            style={{ color: gs.winner === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 30px ${gs.winner === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            🏆 {gs.winner} WINS!
          </div>
        )}

        {/* Control Panel button */}
        <button
          onClick={() => setShowControlPanel(!showControlPanel)}
          className="mt-2 px-4 py-2 rounded-lg border border-white/20 text-white/40 font-heading text-xs tracking-widest uppercase hover:text-white/70 hover:border-white/40 transition-all"
        >
          ⚙ Control Panel
        </button>
      </div>

      {/* RIGHT — empty or placeholder */}
      <div className="flex-1" />

      {/* Control Panel drawer */}
      {showControlPanel && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 w-80 p-5 rounded-2xl border border-white/20 bg-[#05030b]/95 backdrop-blur-xl space-y-3"
          style={{ boxShadow: '0 0 30px rgba(0,0,0,0.8)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-heading text-sm tracking-widest text-white/60 uppercase">Control Panel</span>
            <button onClick={() => setShowControlPanel(false)} className="text-white/30 hover:text-white/60 text-lg">✕</button>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-heading text-xs tracking-widest text-white/50 uppercase">Music</span>
            <button
              onClick={() => updateState({ music_on: !(gs.music_on !== false) })}
              className={`px-3 py-1.5 rounded border-2 font-heading text-xs tracking-widest uppercase transition-all ${gs.music_on !== false ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-white/20 text-white/30'}`}>
              {gs.music_on !== false ? 'ON' : 'OFF'}
            </button>
          </div>
          <button onClick={() => { updateState({ board: Array(9).fill(''), current_turn: 'X', winner: null, show_question: false, show_choices: false }); }}
            className="w-full py-2 rounded-lg border border-[#FF5F1F]/40 text-[#FF5F1F] font-heading text-xs tracking-widest uppercase hover:bg-[#FF5F1F]/10 transition-all">
            ↺ Clear Board
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => updateState({ current_turn: 'X' })}
              className="py-2 rounded-lg border border-[#BC13FE]/40 text-[#BC13FE] font-heading text-xs tracking-widest uppercase hover:bg-[#BC13FE]/10 transition-all">
              X Turn
            </button>
            <button onClick={() => updateState({ current_turn: 'O' })}
              className="py-2 rounded-lg border border-[#FF5F1F]/40 text-[#FF5F1F] font-heading text-xs tracking-widest uppercase hover:bg-[#FF5F1F]/10 transition-all">
              O Turn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}