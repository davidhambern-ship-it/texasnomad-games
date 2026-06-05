import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';

export default function HangmanGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) {
    window.location.href = '/';
    return null;
  }
  return <HangmanViewer roomCode={roomCode} />;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function HangmanViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'hangman', 'viewer');
  const gs = room?.game_state || {};

  // Universal seat system
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'hangman', updateState);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const notifTimerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Watch for new last_action in game_state to display notification
  const lastActionRef = useRef(null);
  useEffect(() => {
    const action = gs.last_action;
    if (!action) return;
    if (JSON.stringify(action) === JSON.stringify(lastActionRef.current)) return;
    lastActionRef.current = action;

    setNotification({ seatNumber: action.seatNumber, letter: action.letter, result: action.result });
    clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 2800);
  }, [gs.last_action]);

  const word = gs.secret_word || '';
  const guessed = gs.guessed_letters || [];
  const wrong = gs.wrong_letters || [];
  const maxWrong = gs.max_wrong || 7;
  const wrongCount = wrong.length;
  const maskedWord = word.split('').map(ch => ch === ' ' ? ' ' : (guessed.includes(ch) || gs.word_revealed ? ch : '_'));

  // Go-round tracking
  const currentGoRound = gs.current_go_round || 1;
  const seatsThatChose = gs.seats_that_chose || [];
  const players = gs.players || [];
  const connectedSeats = players.map(p => p.seatNumber);
  const alreadyChosen = seatNumber ? seatsThatChose.includes(seatNumber) : false;

  // Small room: host counts as 1, plus players
  const totalPeople = players.length + 1;
  const isGoRoundMode = totalPeople >= 4;

  const canGuess =
    isSeated &&
    seatNumber !== null &&
    gs.phase === 'playing' &&
    !gs.word_revealed &&
    (isGoRoundMode ? !alreadyChosen : true);

  const handleGuessLetter = async (letter) => {
    if (!canGuess) return;
    if (guessed.includes(letter) || wrong.includes(letter)) return;

    const secretWord = (gs.secret_word || '').toUpperCase();
    const isCorrect = secretWord.includes(letter);
    const newGuessed = isCorrect ? [...guessed, letter] : guessed;
    const newWrong = !isCorrect ? [...wrong, letter] : wrong;

    // Win/lose check
    const allRevealed = secretWord.split('').every(ch => ch === ' ' || newGuessed.includes(ch));
    const newPhase = allRevealed ? 'finished' : (newWrong.length >= maxWrong ? 'finished' : 'playing');

    // Go-round management — only in go-round mode (4+ people)
    let nextGoRound = currentGoRound;
    let nextSeatsThatChose = seatsThatChose;
    if (isGoRoundMode) {
      const newSeatsThatChose = [...seatsThatChose, seatNumber];
      const allChosen = connectedSeats.length > 0 && connectedSeats.every(s => newSeatsThatChose.includes(s));
      nextGoRound = allChosen ? currentGoRound + 1 : currentGoRound;
      nextSeatsThatChose = allChosen ? [] : newSeatsThatChose;
    }

    const last_action = {
      playerId,
      seatNumber,
      letter,
      result: isCorrect ? 'correct' : 'wrong',
      goRound: currentGoRound,
      timestamp: Date.now(),
    };

    // Update players lastActionAt
    const updatedPlayers = (gs.players || []).map(p =>
      p.playerId === playerId ? { ...p, lastActionAt: Date.now() } : p
    );

    await updateState({
      guessed_letters: newGuessed,
      wrong_letters: newWrong,
      phase: newPhase,
      word_revealed: newPhase === 'finished' && !allRevealed ? false : (newPhase === 'finished' ? true : false),
      last_action,
      current_go_round: nextGoRound,
      seats_that_chose: nextSeatsThatChose,
      players: updatedPlayers,
    });
  };

  // Hangman SVG parts
  const parts = [
    <circle key="head" cx="120" cy="75" r="15" stroke="#FFD700" strokeWidth="3" fill="none" />,
    <line key="body" x1="120" y1="90" x2="120" y2="140" stroke="#FFD700" strokeWidth="3" />,
    <line key="arm-l" x1="120" y1="100" x2="90" y2="125" stroke="#FFD700" strokeWidth="3" />,
    <line key="arm-r" x1="120" y1="100" x2="150" y2="125" stroke="#FFD700" strokeWidth="3" />,
    <line key="leg-l" x1="120" y1="140" x2="90" y2="175" stroke="#FFD700" strokeWidth="3" />,
    <line key="leg-r" x1="120" y1="140" x2="150" y2="175" stroke="#FFD700" strokeWidth="3" />,
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      {/* Notification overlay */}
      <SeatNotification notification={notification} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#070311]/90 backdrop-blur-xl">
        <div className="px-4 h-12 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="shrink-0">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FFD700] uppercase text-[9px] tracking-widest hidden sm:block" style={{ fontFamily: "'Press Start 2P', monospace" }}>Hangman</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse shrink-0" />
              <span className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>ROOM {roomCode}</span>
            </div>
            {room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[7px] tracking-widest uppercase hidden sm:inline" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                🔴 HOST LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} alreadyChosen={isGoRoundMode && alreadyChosen} />
            <Link to="/" className="px-2 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[7px] tracking-widest uppercase hidden sm:block" style={{ fontFamily: "'Press Start 2P', monospace" }}>← LOBBY</Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[7px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !gs.phase || gs.phase === 'setup' ? (
        <WaitingScreen isSeated={isSeated} seatNumber={seatNumber} players={players} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          {/* Mode indicator */}
          {gs.phase === 'playing' && (
            <div className="flex items-center gap-4">
              {/* Mode badge */}
              <div className="px-4 py-1.5 rounded-lg border text-center"
                style={{ borderColor: isGoRoundMode ? '#FFD700' : '#4ade80', background: isGoRoundMode ? 'rgba(255,215,0,0.05)' : 'rgba(74,222,128,0.05)' }}>
                <div className="text-[7px] tracking-widest text-white/40 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>Mode</div>
                <div className="text-[9px] mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace", color: isGoRoundMode ? '#FFD700' : '#4ade80' }}>
                  {isGoRoundMode ? 'Go-Round' : 'Free Play'}
                </div>
              </div>
              {/* Go-round counter + seats (only in go-round mode) */}
              {isGoRoundMode && (
                <>
                  <div className="px-4 py-1.5 rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
                    <div className="text-[7px] tracking-widest text-white/40 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>Go-Round</div>
                    <div className="text-lg text-[#FFD700]" style={{ fontFamily: "'Press Start 2P', monospace" }}>{currentGoRound}</div>
                  </div>
                  <div className="flex gap-1.5">
                    {connectedSeats.map(seat => (
                      <div key={seat}
                        className="w-7 h-7 rounded flex items-center justify-center border text-[7px]"
                        style={{
                          fontFamily: "'Press Start 2P', monospace",
                          borderColor: seatsThatChose.includes(seat) ? '#4ade80' : '#ffffff20',
                          color: seatsThatChose.includes(seat) ? '#4ade80' : '#ffffff30',
                          background: seatsThatChose.includes(seat) ? '#4ade8015' : 'transparent',
                        }}>
                        {seat}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Category */}
          {gs.category && (
            <div className="text-center">
              <div className="text-[8px] tracking-[0.25em] text-white/40 uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>Category</div>
              <div className="text-base tracking-widest text-[#BC13FE] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>{gs.category}</div>
            </div>
          )}

          {/* Hangman SVG + wrong count */}
          <div className="flex items-center gap-8">
            <svg width="180" height="200" className="shrink-0">
              <line x1="20" y1="190" x2="160" y2="190" stroke="#ffffff15" strokeWidth="3" />
              <line x1="60" y1="190" x2="60" y2="10" stroke="#ffffff15" strokeWidth="3" />
              <line x1="60" y1="10" x2="120" y2="10" stroke="#ffffff15" strokeWidth="3" />
              <line x1="120" y1="10" x2="120" y2="20" stroke="#ffffff15" strokeWidth="3" />
              {parts.slice(0, wrongCount > 0 ? wrongCount + 1 : 0).map((p, i) => i < wrongCount ? p : null)}
            </svg>
            <div className="text-center">
              <div className="text-4xl text-[#FF5F1F]" style={{ fontFamily: "'Press Start 2P', monospace" }}>{wrongCount}</div>
              <div className="text-[8px] tracking-widest text-white/40 uppercase mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>Wrong</div>
              <div className="text-sm text-white/20 mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>/ {maxWrong}</div>
            </div>
          </div>

          {/* Masked Word */}
          <div className="flex gap-2 flex-wrap justify-center">
            {maskedWord.map((ch, i) => (
              ch === ' ' ? (
                <div key={i} className="w-4" />
              ) : (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-bold text-[#FFD700] min-w-[1.5ch] text-center"
                    style={{ fontFamily: "'Press Start 2P', monospace", textShadow: ch !== '_' ? '0 0 15px rgba(255,215,0,0.5)' : 'none' }}>
                    {ch}
                  </span>
                  <div className="w-full h-0.5 bg-[#FFD700]/40 rounded" />
                </div>
              )
            ))}
          </div>

          {/* Hint */}
          {gs.hint_revealed && gs.hint && (
            <div className="px-6 py-3 border border-[#BC13FE]/40 rounded-xl bg-[#BC13FE]/10 text-center max-w-sm">
              <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>💡 Hint</div>
              <div className="text-sm text-white tracking-wide" style={{ fontFamily: "'Press Start 2P', monospace" }}>{gs.hint}</div>
            </div>
          )}

          {/* Wrong Letters */}
          {wrong.length > 0 && (
            <div className="text-center">
              <div className="text-[8px] tracking-widest text-white/40 uppercase mb-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>Wrong Letters</div>
              <div className="flex gap-2 flex-wrap justify-center">
                {wrong.map((l) => (
                  <span key={l} className="font-mono text-lg text-red-400 line-through">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Alphabet — interactive for players */}
          <div className="w-full max-w-lg">
            {isGoRoundMode && alreadyChosen && gs.phase === 'playing' && (
              <div className="text-center mb-3 px-4 py-2 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/10">
                <span className="text-[8px] tracking-widest text-[#FF5F1F] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  You already chose a letter this round. Waiting for next go-round…
                </span>
              </div>
            )}
            {!isSeated && gs.phase === 'playing' && (
              <div className="text-center mb-3 px-4 py-2 rounded-lg border border-white/10 bg-white/5">
                <span className="text-[8px] tracking-widest text-white/30 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  Joining game, please wait…
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {ALPHABET.map((l) => {
                const isWrong = wrong.includes(l);
                const isGuessedCorrect = guessed.includes(l) && !isWrong;
                const used = isWrong || isGuessedCorrect;
                const disabled = used || !canGuess || gs.phase !== 'playing';
                return (
                  <button key={l}
                    onClick={() => handleGuessLetter(l)}
                    disabled={disabled}
                    className="w-9 h-9 rounded-lg border-2 text-sm tracking-widest transition-all active:scale-90 disabled:cursor-not-allowed"
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      borderColor: isWrong ? '#ef4444' : isGuessedCorrect ? '#4ade80' : canGuess ? '#FFD700' : '#ffffff20',
                      color: isWrong ? '#ef4444' : isGuessedCorrect ? '#4ade80' : canGuess ? '#FFD700' : '#ffffff25',
                      background: isWrong ? '#ef444415' : isGuessedCorrect ? '#4ade8015' : 'transparent',
                      opacity: disabled && !used ? 0.35 : 1,
                      textDecoration: isWrong ? 'line-through' : 'none',
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Win/Lose state */}
          {gs.phase === 'finished' && (
            <div className="text-center p-5 border-2 border-[#FFD700] rounded-2xl bg-[#FFD700]/10 max-w-sm">
              <div className="text-xl tracking-widest text-[#FFD700] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                {gs.word_revealed ? '🏳 Revealed' : '🎉 Complete!'}
              </div>
              <div className="text-2xl text-white mt-3 tracking-[0.3em]" style={{ fontFamily: "'Press Start 2P', monospace" }}>{gs.secret_word}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WaitingScreen({ isSeated, seatNumber, players }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4">
      <div className="space-y-5">
        <div className="text-6xl">🔤</div>
        <div className="text-lg tracking-widest text-white/40 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>Waiting for Host…</div>
        {isSeated ? (
          <div className="px-6 py-4 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/10"
            style={{ boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}>
            <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>You are</div>
            <div className="text-3xl text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>SEAT {seatNumber}</div>
          </div>
        ) : (
          <div className="text-[8px] tracking-widest text-white/20 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>Assigning seat…</div>
        )}
        {players.length > 0 && (
          <div>
            <div className="text-[8px] tracking-widest text-white/30 uppercase mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>{players.length} player{players.length !== 1 ? 's' : ''} in lobby</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {players.map(p => (
                <div key={p.playerId} className="px-3 py-1.5 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/5 text-[8px] text-[#FFD700]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  SEAT {p.seatNumber}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}