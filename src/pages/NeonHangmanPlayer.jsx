import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function NeonHangmanPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wordGuess, setWordGuess] = useState('');

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const seatNumber = Number(participant?.seatNumber || 0);
  const phase = gameState.phase || 'setup';
  const guessed = Array.isArray(gameState.guessedLetters) ? gameState.guessedLetters : [];
  const wrongGuesses = Array.isArray(gameState.wrongGuesses) ? gameState.wrongGuesses : [];
  const seatsThatChose = Array.isArray(gameState.seatsThatChose) ? gameState.seatsThatChose : [];
  const alreadyChosen = seatNumber > 0 && seatsThatChose.includes(seatNumber);
  const isGoRoundMode = gameState.isGoRoundMode === true;
  const canAct =
    phase === 'playing' &&
    seatNumber > 0 &&
    (!isGoRoundMode || !alreadyChosen);

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
    if (!deviceId || !roomCode || busy) return;
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
    } catch (actionError) {
      setError(actionError?.message || 'That Hangman action could not be completed.');
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
    phase === 'setup'
      ? 'WAITING ON HOST'
      : phase === 'finished'
        ? 'ROUND COMPLETE'
        : isGoRoundMode && alreadyChosen
          ? 'WAITING FOR OTHER PLAYERS'
          : isGoRoundMode
            ? 'YOUR CHOICE'
            : 'FREE PLAY';

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
                borderColor: canAct ? '#4ade80' : 'rgba(255,255,255,.15)',
                color: canAct ? '#4ade80' : 'rgba(255,255,255,.45)',
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

        <section className="rounded-2xl border border-[#FFD700]/25 bg-black/55 p-5 text-center">
          <div className="text-[7px] tracking-widest uppercase text-white/30 mb-2" style={PS2}>
            CATEGORY
          </div>
          <div className="text-lg text-[#FFD700]">{gameState.category || '—'}</div>

          <div className="mt-7 flex justify-center flex-wrap gap-2 sm:gap-3">
            {maskedLetters.length > 0 ? maskedLetters.map((character, index) => (
              character === ' '
                ? <div key={index} className="w-4" />
                : (
                  <div
                    key={index}
                    className="min-w-9 border-b-2 border-white/30 pb-2 text-2xl sm:text-3xl"
                    style={PS2}
                  >
                    {character}
                  </div>
                )
            )) : (
              <div className="text-white/30">Waiting for Host to set the board…</div>
            )}
          </div>

          {gameState.hintRevealed && (
            <div className="mt-5 rounded-lg border border-[#BC13FE]/25 bg-[#BC13FE]/5 p-3">
              <div className="text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>HINT</div>
              <div className="mt-2 text-white/65">{gameState.hint}</div>
            </div>
          )}
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
              {isGoRoundMode ? 'GO-ROUND' : 'FREE PLAY'}
            </div>
          </div>
        </section>

        {phase === 'playing' && (
          <>
            <section className="rounded-xl border border-[#FFD700]/20 bg-black/55 p-4">
              <div className="mb-3 text-center text-[7px] tracking-widest uppercase text-white/30" style={PS2}>
                {canAct
                  ? 'CHOOSE A LETTER'
                  : isGoRoundMode
                    ? 'YOU ALREADY CHOSE THIS GO-ROUND'
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
                  placeholder={canAct ? 'Type your guess…' : 'Wait for next go-round…'}
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
              {gameState.winnerSeat
                ? `Seat ${gameState.winnerSeat} solved it.`
                : 'The word was revealed.'}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-white/10 bg-black/45 p-4">
          <div className="text-[7px] tracking-widest uppercase text-white/30 mb-3" style={PS2}>
            PLAYERS
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(gameState.players || []).map((player) => {
              const chose = seatsThatChose.includes(Number(player.seatNumber));
              return (
                <div
                  key={player.playerId}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: Number(player.seatNumber) === seatNumber
                      ? '#FFD700'
                      : chose
                        ? '#4ade80'
                        : 'rgba(255,255,255,.12)',
                  }}
                >
                  <div className="text-sm text-white/75">{player.name || `Seat ${player.seatNumber}`}</div>
                  <div className="mt-1 text-[10px] text-white/30">
                    Seat {player.seatNumber}{chose ? ' · CHOSE' : ''}
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
