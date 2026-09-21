import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const HANGMAN_PARTS = [
  <circle key="head" cx="120" cy="75" r="15" stroke="#FFD700" strokeWidth="3" fill="none" />,
  <line key="body" x1="120" y1="90" x2="120" y2="140" stroke="#FFD700" strokeWidth="3" />,
  <line key="arm-l" x1="120" y1="100" x2="90" y2="125" stroke="#FFD700" strokeWidth="3" />,
  <line key="arm-r" x1="120" y1="100" x2="150" y2="125" stroke="#FFD700" strokeWidth="3" />,
  <line key="leg-l" x1="120" y1="140" x2="90" y2="175" stroke="#FFD700" strokeWidth="3" />,
  <line key="leg-r" x1="120" y1="140" x2="150" y2="175" stroke="#FFD700" strokeWidth="3" />,
];

export default function NeonHangmanPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wordGuess, setWordGuess] = useState('');
  const [setterWord, setSetterWord] = useState('');
  const [setterCategory, setSetterCategory] = useState('');
  const [setterHint, setSetterHint] = useState('');

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const seatNumber = Number(participant?.seatNumber || 0);
  const phase = gameState.phase || 'setup';
  const guessed = Array.isArray(gameState.guessedLetters) ? gameState.guessedLetters : [];
  const wrongGuesses = Array.isArray(gameState.wrongGuesses) ? gameState.wrongGuesses : [];
  const currentTurnSeat = Number(gameState.currentTurnSeat || 0);
  const setterSeat = Number(gameState.wordSetterSeat || 1);
  const nextSetterSeat = Number(gameState.nextSetterSeat || setterSeat);
  const scores = gameState.scores || {};
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const canSetBoard = gameState.canSetBoard === true;
  const isSetter = gameState.isSetter === true;
  const canAct =
    phase === 'playing' &&
    seatNumber > 0 &&
    seatNumber === currentTurnSeat;

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode) return;

    try {
      const payload = await tngApi.hangman.getPlayerState(deviceId, roomCode);
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
      setError('');
    } catch (stateError) {
      setError(stateError?.message || 'The Hangman room could not be loaded.');
    }
  }, [deviceId, roomCode]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const act = useCallback(async (action, payload = {}) => {
    if (!deviceId || !roomCode || busy) return false;
    setBusy(true);
    setError('');

    try {
      const result = await tngApi.hangman.playerAction(
        deviceId,
        roomCode,
        action,
        payload,
      );
      setRoom(result.room || null);
      setParticipant(result.participant || null);
      return true;
    } catch (actionError) {
      setError(actionError?.message || 'That Hangman action could not be completed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, deviceId, roomCode]);

  const maskedLetters = useMemo(
    () => String(gameState.maskedWord || '').split(''),
    [gameState.maskedWord],
  );

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center px-4 text-center">
        <div>
          <div className="text-red-400 mb-4">Player device not registered.</div>
          <Link to={`/join/${roomCode}`} className="text-[#FFD700] underline">
            Rejoin room {roomCode}
          </Link>
        </div>
      </div>
    );
  }

  if (!room && !error) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#BC13FE]" />
          <div className="text-sm text-white/40">Connecting to Hangman room {roomCode}…</div>
        </div>
      </div>
    );
  }

  const statusLabel =
    canSetBoard
      ? 'YOU SET THE BOARD'
      : phase === 'setup'
        ? `WAITING FOR SEAT ${setterSeat}`
        : phase === 'finished'
          ? `NEXT SETTER: SEAT ${nextSetterSeat}`
          : isSetter
            ? 'YOU ARE BOARD SETTER'
            : canAct
              ? 'YOUR TURN'
              : currentTurnSeat
                ? `SEAT ${currentTurnSeat} TURN`
                : 'WAITING';

  return (
    <div className="min-h-screen bg-[#070311] text-white px-4 py-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-xl border border-[#BC13FE]/30 bg-black/55 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <div className="text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>
              TEXASNOMAD HANGMAN
            </div>
            <div className="mt-2 flex gap-3 items-center">
              <span className="font-mono text-xl tracking-[0.18em] text-[#FFD700]">{roomCode}</span>
              <span className="text-sm text-white/40">Seat {seatNumber || '—'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="rounded-lg border px-3 py-2 text-[7px] tracking-widest uppercase"
              style={{
                ...PS2,
                borderColor: canSetBoard ? '#BC13FE' : canAct ? '#4ade80' : 'rgba(255,255,255,.15)',
                color: canSetBoard ? '#BC13FE' : canAct ? '#4ade80' : 'rgba(255,255,255,.45)',
              }}
            >
              {statusLabel}
            </div>
            <Link
              to="/"
              replace
              className="rounded-lg border border-white/15 px-3 py-2 text-[7px] tracking-widest uppercase text-white/45"
              style={PS2}
            >
              EXIT VIEW
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-white/10 bg-black/45 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[7px] tracking-widest uppercase text-white/30" style={PS2}>
              SCOREBOARD
            </div>
            <div className="text-[7px] tracking-widest uppercase text-white/30" style={PS2}>
              ROUND {gameState.roundNumber || 1}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {players.map((player) => {
              const seat = Number(player.seatNumber);
              const playerIsSetter = seat === setterSeat;
              const playerIsTurn = seat === currentTurnSeat;
              return (
                <div
                  key={player.playerId}
                  className="rounded-lg border p-3 text-center"
                  style={{
                    borderColor: seat === seatNumber
                      ? '#FFD700'
                      : playerIsSetter
                        ? '#BC13FE'
                        : playerIsTurn
                          ? '#4ade80'
                          : 'rgba(255,255,255,.12)',
                  }}
                >
                  <div className="text-[7px] text-white/30 uppercase" style={PS2}>Seat {seat}</div>
                  <div className="mt-2 text-sm text-white/70 truncate">{player.name || `Seat ${seat}`}</div>
                  <div className="mt-2 text-2xl text-[#FFD700]" style={PS2}>
                    {Number(scores?.[String(seat)] || 0)}
                  </div>
                  <div
                    className="mt-2 text-[6px] uppercase tracking-widest"
                    style={{
                      ...PS2,
                      color: playerIsSetter ? '#BC13FE' : playerIsTurn ? '#4ade80' : 'rgba(255,255,255,.25)',
                    }}
                  >
                    {playerIsSetter ? 'SETTER' : playerIsTurn ? 'TURN' : 'WAITING'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {canSetBoard && (
          <section className="rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/5 p-5">
            <div className="text-[9px] text-[#BC13FE] tracking-widest uppercase mb-4" style={PS2}>
              {phase === 'finished' ? '🏆 YOU WON — SET THE NEXT BOARD' : '⚙ SET THE BOARD'}
            </div>
            <div className="space-y-3">
              <input
                value={setterWord}
                onChange={(event) => setSetterWord(event.target.value.toUpperCase())}
                placeholder="SECRET WORD OR PHRASE"
                className="w-full rounded-lg border-2 border-[#FFD700]/40 bg-black/70 px-4 py-3 text-[#FFD700] font-mono text-lg tracking-[0.16em] uppercase outline-none"
              />
              <input
                value={setterCategory}
                onChange={(event) => setSetterCategory(event.target.value)}
                placeholder="Category"
                className="w-full rounded-lg border border-white/15 bg-black/70 px-4 py-3 text-white outline-none"
              />
              <input
                value={setterHint}
                onChange={(event) => setSetterHint(event.target.value)}
                placeholder="Optional hint"
                className="w-full rounded-lg border border-white/15 bg-black/70 px-4 py-3 text-white outline-none"
              />
              <button
                type="button"
                disabled={!setterWord.trim() || busy}
                onClick={async () => {
                  const ok = await act('set_board', {
                    word: setterWord,
                    category: setterCategory,
                    hint: setterHint,
                  });
                  if (ok !== false) {
                    setSetterWord('');
                    setSetterCategory('');
                    setSetterHint('');
                  }
                }}
                className="w-full rounded-lg bg-[#BC13FE] px-4 py-4 text-black disabled:opacity-40"
                style={{ ...PS2, fontSize: 8 }}
              >
                {busy ? 'SETTING BOARD…' : 'START BOARD'}
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#FFD700]/25 bg-black/55 p-5">
          <div className="text-center">
            <div className="text-[7px] tracking-widest uppercase text-white/30 mb-2" style={PS2}>
              CATEGORY
            </div>
            <div className="text-lg text-[#FFD700]">{gameState.category || '—'}</div>
          </div>

          <div className="mt-5 flex flex-col md:flex-row items-center justify-center gap-5 md:gap-10">
            <div className="flex items-center gap-4">
              <svg
                viewBox="0 0 180 200"
                className="w-[180px] h-[200px] shrink-0"
                role="img"
                aria-label={`Hangman figure: ${wrongGuesses.length} of ${gameState.maxWrong || 6} wrong guesses`}
              >
                <line x1="20" y1="190" x2="160" y2="190" stroke="#ffffff15" strokeWidth="3" />
                <line x1="60" y1="190" x2="60" y2="10" stroke="#ffffff15" strokeWidth="3" />
                <line x1="60" y1="10" x2="120" y2="10" stroke="#ffffff15" strokeWidth="3" />
                <line x1="120" y1="10" x2="120" y2="20" stroke="#ffffff15" strokeWidth="3" />
                <line x1="120" y1="20" x2="120" y2="60" stroke="#BC13FE" strokeWidth="3" />
                {HANGMAN_PARTS.slice(0, wrongGuesses.length)}
              </svg>

              <div className="text-center">
                <div className="text-4xl text-[#FF5F1F]" style={PS2}>{wrongGuesses.length}</div>
                <div className="mt-1 text-[8px] tracking-widest uppercase text-white/40" style={PS2}>WRONG</div>
                <div className="mt-1 text-sm text-white/20" style={PS2}>/ {gameState.maxWrong || 6}</div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex justify-center flex-wrap gap-2 sm:gap-3">
                {maskedLetters.length > 0 ? maskedLetters.map((character, index) => (
                  character === ' '
                    ? <div key={index} className="w-4" />
                    : (
                      <div key={index} className="flex flex-col items-center gap-1">
                        <span
                          className="min-w-[1.5ch] text-center text-3xl sm:text-4xl font-bold text-[#FFD700]"
                          style={{
                            ...PS2,
                            textShadow: character !== '_' ? '0 0 15px rgba(255,215,0,0.5)' : 'none',
                          }}
                        >
                          {character}
                        </span>
                        <div className="h-0.5 w-full bg-[#FFD700]/40 rounded" />
                      </div>
                    )
                )) : (
                  <div className="text-white/30">Waiting for Host to set the board…</div>
                )}
              </div>

              {gameState.hintRevealed && (
                <div className="mt-5 rounded-lg border border-[#BC13FE]/25 bg-[#BC13FE]/5 p-3 text-center">
                  <div className="text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>HINT</div>
                  <div className="mt-2 text-white/65">{gameState.hint}</div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/45 p-4 text-center">
            <div className="text-[7px] text-white/30 uppercase" style={PS2}>GO-ROUND</div>
            <div className="mt-2 text-2xl text-[#FFD700]" style={PS2}>{gameState.currentGoRound || 1}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/45 p-4 text-center">
            <div className="text-[7px] text-white/30 uppercase" style={PS2}>WRONG</div>
            <div className="mt-2 text-2xl text-[#FF5F1F]" style={PS2}>
              {wrongGuesses.length}/{gameState.maxWrong || 6}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/45 p-4 text-center">
            <div className="text-[7px] text-white/30 uppercase" style={PS2}>MODE</div>
            <div className="mt-2 text-sm text-[#4ade80]" style={PS2}>
              TURN PLAY
            </div>
          </div>
        </section>

        {phase === 'playing' && (
          <>
            <section className="rounded-xl border border-[#FFD700]/20 bg-black/55 p-4">
              <div className="mb-3 text-center text-[7px] tracking-widest uppercase text-white/30" style={PS2}>
                {canAct
                  ? 'CHOOSE A LETTER — CORRECT GUESSES KEEP YOUR TURN'
                  : currentTurnSeat
                    ? `WAITING FOR SEAT ${currentTurnSeat}`
                    : 'WAITING'}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {ALPHABET.map((letter) => {
                  const used = guessed.includes(letter) || wrongGuesses.includes(letter);
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!canAct || used || busy}
                      onClick={() => act('guess_letter', { letter })}
                      className="h-10 w-10 rounded-lg border-2 text-sm transition-all disabled:opacity-25"
                      style={{
                        ...PS2,
                        borderColor: guessed.includes(letter)
                          ? '#4ade80'
                          : wrongGuesses.includes(letter)
                            ? '#ef4444'
                            : '#FFD700',
                        color: guessed.includes(letter)
                          ? '#4ade80'
                          : wrongGuesses.includes(letter)
                            ? '#ef4444'
                            : '#FFD700',
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-[#BC13FE]/20 bg-black/55 p-4">
              <div className="text-[7px] tracking-widest uppercase text-white/30 mb-3 text-center" style={PS2}>
                GUESS THE WHOLE WORD
              </div>
              <div className="flex gap-2 max-w-xl mx-auto">
                <input
                  value={wordGuess}
                  onChange={(event) => setWordGuess(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canAct && wordGuess.trim()) {
                      act('guess_word', { guess: wordGuess.trim() });
                      setWordGuess('');
                    }
                  }}
                  disabled={!canAct || busy}
                  className="flex-1 rounded-lg border border-[#BC13FE]/35 bg-black/70 px-4 py-3 text-white outline-none"
                  placeholder={canAct ? 'Type your guess…' : 'Wait for your turn…'}
                />
                <button
                  type="button"
                  disabled={!canAct || !wordGuess.trim() || busy}
                  onClick={() => {
                    act('guess_word', { guess: wordGuess.trim() });
                    setWordGuess('');
                  }}
                  className="rounded-lg border border-[#BC13FE] px-4 py-3 text-[#BC13FE] disabled:opacity-30"
                  style={PS2}
                >
                  GUESS
                </button>
              </div>
            </section>
          </>
        )}

        {phase === 'finished' && (
          <section className="rounded-xl border border-green-400/30 bg-green-400/5 p-6 text-center">
            <div className="text-[8px] tracking-widest uppercase text-green-400" style={PS2}>
              ROUND COMPLETE
            </div>
            <div className="mt-4 text-3xl tracking-[0.22em] text-[#FFD700]" style={PS2}>
              {gameState.maskedWord}
            </div>
            <div className="mt-3 text-sm text-white/45">
              {gameState.roundResult === 'stumped'
                ? `Nobody solved it. Seat ${setterSeat} earns 50 points and keeps the board.`
                : gameState.winnerSeat
                  ? `Seat ${gameState.winnerSeat} solved it and sets the next board.`
                  : `Seat ${nextSetterSeat} sets the next board.`}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-white/10 bg-black/45 p-4">
          <div className="text-[7px] tracking-widest uppercase text-white/30 mb-3" style={PS2}>
            PLAYERS
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {players.map((player) => {
              const isTurn = Number(player.seatNumber) === currentTurnSeat;
              return (
                <div
                  key={player.playerId}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: Number(player.seatNumber) === seatNumber
                      ? '#FFD700'
                      : isTurn
                        ? '#4ade80'
                        : 'rgba(255,255,255,.12)',
                  }}
                >
                  <div className="text-sm text-white/75">{player.name || `Seat ${player.seatNumber}`}</div>
                  <div className="mt-1 text-[10px] text-white/30">
                    Seat {player.seatNumber}
                    {Number(player.seatNumber) === setterSeat ? ' · SETTER' : isTurn ? ' · TURN' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {gameState.lastAction && (
          <section className="rounded-xl border border-white/10 bg-black/45 p-3 text-center text-sm text-white/50">
            Seat {gameState.lastAction.seatNumber} guessed{' '}
            <span className="text-[#FFD700]">
              {gameState.lastAction.letter || gameState.lastAction.guess}
            </span>{' '}
            — {gameState.lastAction.result}
          </section>
        )}
      </div>
    </div>
  );
}
