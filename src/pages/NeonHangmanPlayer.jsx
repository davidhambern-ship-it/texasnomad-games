import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import { TngNotificationToaster } from '@/components/social/TngNotificationToaster';

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

  async function submitWholeWord() {
    if (!canAct || !wordGuess.trim() || busy) return;
    const ok = await act('guess_word', { guess: wordGuess.trim() });
    if (ok) setWordGuess('');
  }

  async function submitBoard() {
    if (!canSetBoard || !setterWord.trim() || busy) return;

    const ok = await act('set_board', {
      word: setterWord,
      category: setterCategory,
      hint: setterHint,
    });

    if (ok) {
      setSetterWord('');
      setSetterCategory('');
      setSetterHint('');
    }
  }

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

  const statusColor = canSetBoard
    ? '#BC13FE'
    : canAct
      ? '#4ade80'
      : '#FFD700';

  return (
    <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-[#070311] text-white">
      <TngNotificationToaster />
      <div className="mx-auto flex min-h-screen md:h-full max-w-[1500px] flex-col gap-2 p-2 md:min-h-0">

        {/* Compact top bar */}
        <header className="shrink-0 rounded-xl border border-[#BC13FE]/30 bg-black/60 px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[6px] sm:text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>
              TEXASNOMAD HANGMAN
            </div>
            <div className="mt-1 flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-base sm:text-lg tracking-[0.15em] text-[#FFD700]">{roomCode}</span>
              <span className="text-[11px] text-white/40">Seat {seatNumber || '—'}</span>
              <span className="hidden sm:inline text-[11px] text-white/25">Round {gameState.roundNumber || 1}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              className="rounded-lg border px-2.5 py-2 text-[6px] sm:text-[7px] tracking-widest uppercase"
              style={{ ...PS2, borderColor: statusColor, color: statusColor }}
            >
              {statusLabel}
            </div>
            <Link
              to="/"
              replace
              className="rounded-lg border border-white/15 px-2.5 py-2 text-[6px] tracking-widest uppercase text-white/40"
              style={PS2}
            >
              EXIT
            </Link>
          </div>
        </header>

        {error && (
          <div className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Game console: board left, controls/info right */}
        <main className="min-h-0 flex-1 grid gap-2 md:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]">

          {/* LEFT: board + keyboard */}
          <section className="min-h-0 flex flex-col gap-2">
            <div className="min-h-[360px] md:min-h-0 md:flex-1 rounded-xl border border-[#FFD700]/25 bg-black/55 p-3 flex flex-col">

              <div className="shrink-0 text-center">
                <div className="text-[6px] tracking-widest uppercase text-white/25" style={PS2}>CATEGORY</div>
                <div className="mt-1 text-sm sm:text-base text-[#FFD700]">{gameState.category || '—'}</div>
              </div>

              <div className="min-h-0 flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
                <div className="shrink-0 flex items-center">
                  <svg
                    viewBox="0 0 180 200"
                    className="h-[145px] w-[130px] lg:h-[180px] lg:w-[162px]"
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

                  <div className="ml-1 text-center">
                    <div className="text-2xl lg:text-3xl text-[#FF5F1F]" style={PS2}>{wrongGuesses.length}</div>
                    <div className="mt-1 text-[6px] tracking-widest uppercase text-white/35" style={PS2}>WRONG</div>
                    <div className="mt-1 text-[10px] text-white/20" style={PS2}>/ {gameState.maxWrong || 6}</div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 flex flex-col items-center justify-center">
                  <div className="flex max-w-full flex-wrap justify-center gap-x-2 gap-y-3 lg:gap-x-3">
                    {maskedLetters.length > 0 ? maskedLetters.map((character, index) => (
                      character === ' '
                        ? <div key={index} className="w-3 sm:w-5" />
                        : (
                          <div key={index} className="flex flex-col items-center gap-1">
                            <span
                              className="min-w-[1.35ch] text-center text-2xl sm:text-3xl lg:text-4xl font-bold text-[#FFD700]"
                              style={{
                                ...PS2,
                                textShadow: character !== '_' ? '0 0 12px rgba(255,215,0,0.45)' : 'none',
                              }}
                            >
                              {character}
                            </span>
                            <div className="h-0.5 w-full bg-[#FFD700]/40 rounded" />
                          </div>
                        )
                    )) : (
                      <div className="text-sm text-white/25">Waiting for the Board Setter…</div>
                    )}
                  </div>

                  {gameState.hintRevealed && (
                    <div className="mt-4 max-w-lg rounded-lg border border-[#BC13FE]/25 bg-[#BC13FE]/5 px-3 py-2 text-center">
                      <span className="text-[6px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>HINT · </span>
                      <span className="text-xs text-white/65">{gameState.hint}</span>
                    </div>
                  )}
                </div>
              </div>

              {phase === 'finished' && (
                <div className="shrink-0 rounded-lg border border-green-400/25 bg-green-400/5 px-3 py-2 text-center">
                  <span className="text-[7px] text-green-400 uppercase tracking-widest" style={PS2}>
                    {gameState.roundResult === 'stumped'
                      ? `STUMPED · SEAT ${setterSeat} +50`
                      : gameState.winnerSeat
                        ? `SEAT ${gameState.winnerSeat} SOLVED IT`
                        : 'ROUND COMPLETE'}
                  </span>
                  <span className="ml-3 text-[11px] text-white/45">
                    Seat {nextSetterSeat} sets next.
                  </span>
                </div>
              )}
            </div>

            {/* Letter controls stay under the board */}
            <div className="shrink-0 rounded-xl border border-[#FFD700]/20 bg-black/60 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[6px] tracking-widest uppercase text-white/30" style={PS2}>
                  {isSetter && phase === 'playing'
                    ? 'YOU SET THIS BOARD'
                    : canAct
                      ? 'YOUR TURN · CORRECT = KEEP GOING'
                      : currentTurnSeat
                        ? `WAITING FOR SEAT ${currentTurnSeat}`
                        : 'LETTER BOARD'}
                </div>
                <div className="text-[6px] text-white/20" style={PS2}>
                  +10 / LETTER
                </div>
              </div>

              <div
                className="grid gap-1 sm:gap-1.5"
                style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
              >
                {ALPHABET.map((letter) => {
                  const isCorrect = guessed.includes(letter);
                  const isWrong = wrongGuesses.includes(letter);
                  const used = isCorrect || isWrong;

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!canAct || used || busy}
                      onClick={() => act('guess_letter', { letter })}
                      className="h-8 lg:h-9 rounded-md border text-[9px] lg:text-[10px] transition-all disabled:opacity-25"
                      style={{
                        ...PS2,
                        borderColor: isCorrect ? '#4ade80' : isWrong ? '#ef4444' : '#FFD700',
                        color: isCorrect ? '#4ade80' : isWrong ? '#ef4444' : '#FFD700',
                        background: isCorrect
                          ? 'rgba(74,222,128,.08)'
                          : isWrong
                            ? 'rgba(239,68,68,.08)'
                            : 'transparent',
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  value={wordGuess}
                  onChange={(event) => setWordGuess(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitWholeWord();
                  }}
                  disabled={!canAct || busy}
                  className="min-w-0 flex-1 rounded-lg border border-[#BC13FE]/30 bg-black/70 px-3 py-2 text-xs text-white outline-none"
                  placeholder={canAct ? 'Guess the whole word…' : 'Whole-word guess unlocks on your turn'}
                />
                <button
                  type="button"
                  disabled={!canAct || !wordGuess.trim() || busy}
                  onClick={submitWholeWord}
                  className="rounded-lg border border-[#BC13FE] px-3 py-2 text-[#BC13FE] disabled:opacity-25"
                  style={{ ...PS2, fontSize: 6 }}
                >
                  GUESS +50
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: all controls + information */}
          <aside className="min-h-0 flex flex-col gap-2">

            {/* Turn / role card */}
            <section
              className="shrink-0 rounded-xl border bg-black/60 px-3 py-3"
              style={{ borderColor: `${statusColor}55` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[6px] text-white/25 uppercase tracking-widest" style={PS2}>YOUR STATUS</div>
                  <div className="mt-1 text-[9px]" style={{ ...PS2, color: statusColor }}>{statusLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-[6px] text-white/25 uppercase" style={PS2}>SETTER</div>
                  <div className="mt-1 text-sm text-[#BC13FE]" style={PS2}>S{setterSeat}</div>
                </div>
              </div>
            </section>

            {/* Compact scoreboard doubles as player list */}
            <section className="shrink-0 rounded-xl border border-white/10 bg-black/50 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[6px] text-white/25 uppercase tracking-widest" style={PS2}>SCORES / PLAYERS</span>
                <span className="text-[6px] text-white/20 uppercase" style={PS2}>ROUND {gameState.roundNumber || 1}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {players.map((player) => {
                  const seat = Number(player.seatNumber);
                  const playerIsSetter = seat === setterSeat;
                  const playerIsTurn = seat === currentTurnSeat;
                  const isMe = seat === seatNumber;

                  return (
                    <div
                      key={player.playerId}
                      className="rounded-lg border px-2 py-2"
                      style={{
                        borderColor: isMe
                          ? '#FFD700'
                          : playerIsSetter
                            ? '#BC13FE'
                            : playerIsTurn
                              ? '#4ade80'
                              : 'rgba(255,255,255,.10)',
                        background: playerIsSetter
                          ? 'rgba(188,19,254,.05)'
                          : playerIsTurn
                            ? 'rgba(74,222,128,.04)'
                            : 'rgba(255,255,255,.015)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[6px] text-white/25 uppercase" style={PS2}>SEAT {seat}</div>
                          <div className="mt-1 truncate text-[11px] text-white/70">{player.name || `Seat ${seat}`}</div>
                        </div>
                        <div className="text-lg text-[#FFD700]" style={PS2}>{Number(scores?.[String(seat)] || 0)}</div>
                      </div>
                      <div
                        className="mt-1 text-[5px] uppercase tracking-widest"
                        style={{
                          ...PS2,
                          color: playerIsSetter ? '#BC13FE' : playerIsTurn ? '#4ade80' : 'rgba(255,255,255,.20)',
                        }}
                      >
                        {playerIsSetter ? 'BOARD SETTER' : playerIsTurn ? 'CURRENT TURN' : isMe ? 'YOU' : 'WAITING'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Setter gets setup controls in the right panel */}
            {canSetBoard ? (
              <section className="min-h-0 flex-1 rounded-xl border-2 border-[#BC13FE]/40 bg-[#BC13FE]/5 p-3 flex flex-col">
                <div className="shrink-0">
                  <div className="text-[7px] text-[#BC13FE] tracking-widest uppercase" style={PS2}>
                    {phase === 'finished' ? '🏆 SET THE NEXT BOARD' : '⚙ SET THE BOARD'}
                  </div>
                  <div className="mt-1 text-[10px] text-white/35">Only you can see and submit the new word.</div>
                </div>

                <div className="mt-3 flex flex-1 min-h-0 flex-col justify-center gap-2">
                  <input
                    value={setterWord}
                    onChange={(event) => setSetterWord(event.target.value.toUpperCase())}
                    placeholder="SECRET WORD OR PHRASE"
                    className="w-full rounded-lg border-2 border-[#FFD700]/35 bg-black/70 px-3 py-2.5 text-[#FFD700] font-mono text-sm tracking-[0.12em] uppercase outline-none"
                  />
                  <input
                    value={setterCategory}
                    onChange={(event) => setSetterCategory(event.target.value)}
                    placeholder="Category"
                    className="w-full rounded-lg border border-white/15 bg-black/70 px-3 py-2.5 text-xs text-white outline-none"
                  />
                  <input
                    value={setterHint}
                    onChange={(event) => setSetterHint(event.target.value)}
                    placeholder="Optional hint"
                    className="w-full rounded-lg border border-white/15 bg-black/70 px-3 py-2.5 text-xs text-white outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={!setterWord.trim() || busy}
                  onClick={submitBoard}
                  className="shrink-0 mt-2 w-full rounded-lg bg-[#BC13FE] px-3 py-3 text-black disabled:opacity-40"
                  style={{ ...PS2, fontSize: 7 }}
                >
                  {busy ? 'SETTING…' : 'START BOARD'}
                </button>
              </section>
            ) : (
              <section className="min-h-0 flex-1 rounded-xl border border-white/10 bg-black/45 p-3 flex flex-col justify-between gap-2">
                <div>
                  <div className="text-[6px] text-white/25 uppercase tracking-widest" style={PS2}>ROUND INFO</div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/8 bg-white/[.02] p-2 text-center">
                      <div className="text-[5px] text-white/25 uppercase" style={PS2}>WRONG</div>
                      <div className="mt-1 text-xl text-[#FF5F1F]" style={PS2}>{wrongGuesses.length}/{gameState.maxWrong || 6}</div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[.02] p-2 text-center">
                      <div className="text-[5px] text-white/25 uppercase" style={PS2}>YOUR SCORE</div>
                      <div className="mt-1 text-xl text-[#FFD700]" style={PS2}>{Number(scores?.[String(seatNumber)] || 0)}</div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-[#FFD700]/15 bg-[#FFD700]/5 p-2">
                    <div className="text-[5px] text-[#FFD700]/60 uppercase tracking-widest" style={PS2}>POINTS</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-white/40">
                      +10 per revealed letter · +50 solve bonus · +50 to setter for a stump.
                    </div>
                  </div>

                  {gameState.lastAction && gameState.lastAction.type !== 'board_set' && (
                    <div className="mt-3 rounded-lg border border-white/8 bg-white/[.02] p-2">
                      <div className="text-[5px] text-white/25 uppercase tracking-widest" style={PS2}>LAST PLAY</div>
                      <div className="mt-1 text-[11px] text-white/50">
                        Seat {gameState.lastAction.seatNumber}{' '}
                        <span className="text-[#FFD700]">
                          {gameState.lastAction.letter || gameState.lastAction.guess || gameState.lastAction.type}
                        </span>{' '}
                        · {gameState.lastAction.result || 'done'}
                        {Number(gameState.lastAction.points || 0) > 0 && (
                          <span className="text-green-400"> · +{gameState.lastAction.points}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {phase === 'finished' && (
                  <div className="rounded-lg border border-green-400/20 bg-green-400/5 p-2 text-center">
                    <div className="text-[6px] text-green-400 uppercase tracking-widest" style={PS2}>ROUND COMPLETE</div>
                    <div className="mt-1 text-[10px] text-white/40">
                      {gameState.roundResult === 'stumped'
                        ? `Seat ${setterSeat} stumped the table and keeps the board.`
                        : gameState.winnerSeat
                          ? `Seat ${gameState.winnerSeat} sets the next board.`
                          : `Seat ${nextSetterSeat} sets next.`}
                    </div>
                  </div>
                )}
              </section>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
