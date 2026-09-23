import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import { getPublicTngName } from '@/lib/publicTngName';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PARTS = [
  <circle key="head" cx="120" cy="75" r="15" stroke="#FFD700" strokeWidth="3" fill="none" />,
  <line key="body" x1="120" y1="90" x2="120" y2="140" stroke="#FFD700" strokeWidth="3" />,
  <line key="arm-l" x1="120" y1="100" x2="90" y2="125" stroke="#FFD700" strokeWidth="3" />,
  <line key="arm-r" x1="120" y1="100" x2="150" y2="125" stroke="#FFD700" strokeWidth="3" />,
  <line key="leg-l" x1="120" y1="140" x2="90" y2="175" stroke="#FFD700" strokeWidth="3" />,
  <line key="leg-r" x1="120" y1="140" x2="150" y2="175" stroke="#FFD700" strokeWidth="3" />,
];

function Scoreboard({ players, scores, setterSeat, currentTurnSeat }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {players.map((player) => {
        const seat = Number(player.seatNumber);
        const isSetter = seat === Number(setterSeat);
        const isTurn = seat === Number(currentTurnSeat);
        return (
          <div
            key={player.playerId}
            className="rounded-xl border p-3 text-center"
            style={{
              borderColor: isSetter ? '#BC13FE' : isTurn ? '#4ade80' : 'rgba(255,255,255,.12)',
              background: isSetter ? 'rgba(188,19,254,.07)' : isTurn ? 'rgba(74,222,128,.06)' : 'rgba(0,0,0,.35)',
            }}
          >
            <div className="text-[7px] text-white/30 uppercase" style={PS2}>Seat {seat}</div>
            <div className="mt-2 text-sm text-white/75 truncate">{getPublicTngName(player, `Seat ${seat}`)}</div>
            <div className="mt-2 text-2xl text-[#FFD700]" style={PS2}>{Number(scores?.[String(seat)] || 0)}</div>
            <div className="mt-2 text-[6px] uppercase tracking-widest" style={{ ...PS2, color: isSetter ? '#BC13FE' : isTurn ? '#4ade80' : 'rgba(255,255,255,.25)' }}>
              {isSetter ? 'BOARD SETTER' : isTurn ? 'TURN' : 'WAITING'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HangmanHostPanel({ controllerId }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [word, setWord] = useState('');
  const [category, setCategory] = useState('');
  const [hint, setHint] = useState('');
  const [wordGuess, setWordGuess] = useState('');

  const gs = room?.gameState || {};
  const phase = gs.phase || 'setup';
  const players = Array.isArray(gs.players) ? gs.players : [];
  const scores = gs.scores || {};
  const guessed = Array.isArray(gs.guessedLetters) ? gs.guessedLetters : [];
  const wrong = Array.isArray(gs.wrongGuesses) ? gs.wrongGuesses : [];
  const setterSeat = Number(gs.wordSetterSeat || 1);
  const nextSetterSeat = Number(gs.nextSetterSeat || setterSeat);
  const currentTurnSeat = Number(gs.currentTurnSeat || 0);
  const hostIsSetter = setterSeat === 1;
  const hostCanSetBoard = gs.canSetBoard === true;
  const hostCanGuess = phase === 'playing' && !hostIsSetter && currentTurnSeat === 1;

  const maskedLetters = useMemo(
    () => String(gs.maskedWord || '').split(''),
    [gs.maskedWord],
  );

  const refresh = useCallback(async () => {
    if (!controllerId) return;
    try {
      const payload = await tngApi.hangman.getHostState(controllerId);
      setRoom(payload.room || null);
      setError('');
    } catch (refreshError) {
      setError(refreshError?.message || 'Could not load the Hangman Host state.');
    }
  }, [controllerId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const act = useCallback(async (action, payload = {}) => {
    if (!controllerId || busy) return false;
    setBusy(true);
    setError('');
    try {
      const result = await tngApi.hangman.hostAction(controllerId, action, payload);
      setRoom(result.room || null);
      return true;
    } catch (actionError) {
      setError(actionError?.message || 'That Hangman action could not be completed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, controllerId]);

  async function submitBoard() {
    const ok = await act('set_board', { word, category, hint });
    if (ok) {
      setWord('');
      setCategory('');
      setHint('');
    }
  }

  if (!room && !error) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#BC13FE]" />
        <span className="text-sm text-white/40">Loading Hangman controls…</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[#BC13FE]/30 bg-black/60 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="text-[8px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>HANGMAN MATCH</div>
            <div className="mt-2 text-sm text-white/45">
              Round {gs.roundNumber || 1} · Board Setter: Seat {setterSeat}
            </div>
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-[7px] tracking-widest uppercase"
            style={{
              ...PS2,
              borderColor: hostCanSetBoard ? '#BC13FE' : hostCanGuess ? '#4ade80' : 'rgba(255,255,255,.15)',
              color: hostCanSetBoard ? '#BC13FE' : hostCanGuess ? '#4ade80' : 'rgba(255,255,255,.4)',
            }}
          >
            {hostCanSetBoard
              ? 'YOU SET THE BOARD'
              : hostCanGuess
                ? 'YOUR TURN'
                : hostIsSetter && phase === 'playing'
                  ? 'YOU ARE SETTER'
                  : phase === 'finished'
                    ? `NEXT SETTER: SEAT ${nextSetterSeat}`
                    : currentTurnSeat
                      ? `SEAT ${currentTurnSeat} TURN`
                      : 'WAITING'}
          </div>
        </div>

        <Scoreboard
          players={players}
          scores={scores}
          setterSeat={setterSeat}
          currentTurnSeat={currentTurnSeat}
        />
      </div>

      {hostCanSetBoard && (
        <div className="rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/5 p-5">
          <div className="text-[9px] text-[#BC13FE] tracking-widest uppercase mb-4" style={PS2}>
            {phase === 'finished' ? '🏆 SET THE NEXT BOARD' : '⚙ SET THE FIRST BOARD'}
          </div>
          <div className="space-y-3">
            <input
              value={word}
              onChange={(event) => setWord(event.target.value.toUpperCase())}
              placeholder="SECRET WORD OR PHRASE"
              className="w-full rounded-lg border-2 border-[#FFD700]/40 bg-black/70 px-4 py-3 text-[#FFD700] font-mono text-xl tracking-[0.18em] uppercase outline-none"
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Category"
              className="w-full rounded-lg border border-white/15 bg-black/70 px-4 py-3 text-white outline-none"
            />
            <input
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder="Optional hint"
              className="w-full rounded-lg border border-white/15 bg-black/70 px-4 py-3 text-white outline-none"
            />
            <button
              type="button"
              disabled={!word.trim() || busy}
              onClick={submitBoard}
              className="w-full rounded-lg bg-[#BC13FE] px-4 py-4 text-black disabled:opacity-40"
              style={{ ...PS2, fontSize: 9 }}
            >
              {busy ? 'SETTING BOARD…' : 'START BOARD'}
            </button>
          </div>
        </div>
      )}

      {phase !== 'setup' && (
        <div className="rounded-2xl border border-[#FFD700]/25 bg-black/55 p-5">
          <div className="text-center">
            <div className="text-[7px] tracking-widest uppercase text-white/30 mb-2" style={PS2}>CATEGORY</div>
            <div className="text-lg text-[#FFD700]">{gs.category || '—'}</div>
          </div>

          <div className="mt-5 flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 180 200" className="w-[180px] h-[200px] shrink-0">
                <line x1="20" y1="190" x2="160" y2="190" stroke="#ffffff15" strokeWidth="3" />
                <line x1="60" y1="190" x2="60" y2="10" stroke="#ffffff15" strokeWidth="3" />
                <line x1="60" y1="10" x2="120" y2="10" stroke="#ffffff15" strokeWidth="3" />
                <line x1="120" y1="10" x2="120" y2="20" stroke="#ffffff15" strokeWidth="3" />
                <line x1="120" y1="20" x2="120" y2="60" stroke="#BC13FE" strokeWidth="3" />
                {PARTS.slice(0, wrong.length)}
              </svg>
              <div className="text-center">
                <div className="text-4xl text-[#FF5F1F]" style={PS2}>{wrong.length}</div>
                <div className="mt-1 text-[8px] text-white/35 uppercase" style={PS2}>WRONG</div>
                <div className="mt-1 text-sm text-white/20" style={PS2}>/ {gs.maxWrong || 6}</div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-center flex-wrap gap-2">
                {maskedLetters.map((character, index) => (
                  character === ' '
                    ? <div key={index} className="w-4" />
                    : (
                      <div key={index} className="flex flex-col items-center gap-1">
                        <span className="min-w-[1.5ch] text-center text-3xl text-[#FFD700]" style={PS2}>{character}</span>
                        <div className="w-full h-0.5 bg-[#FFD700]/40 rounded" />
                      </div>
                    )
                ))}
              </div>

              {gs.hintRevealed && (
                <div className="mt-5 rounded-lg border border-[#BC13FE]/25 bg-[#BC13FE]/5 p-3 text-center">
                  <div className="text-[7px] text-[#BC13FE] uppercase" style={PS2}>HINT</div>
                  <div className="mt-2 text-white/65">{gs.hint}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hostCanGuess && (
        <>
          <div className="rounded-xl border border-[#4ade80]/25 bg-[#4ade80]/5 p-4">
            <div className="mb-3 text-center text-[8px] text-[#4ade80] uppercase tracking-widest" style={PS2}>
              YOUR TURN — CORRECT LETTERS KEEP YOUR TURN
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {ALPHABET.map((letter) => {
                const used = guessed.includes(letter) || wrong.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={used || busy}
                    onClick={() => act('guess_letter', { letter })}
                    className="h-10 w-10 rounded-lg border-2 text-sm disabled:opacity-25"
                    style={{
                      ...PS2,
                      borderColor: guessed.includes(letter) ? '#4ade80' : wrong.includes(letter) ? '#ef4444' : '#FFD700',
                      color: guessed.includes(letter) ? '#4ade80' : wrong.includes(letter) ? '#ef4444' : '#FFD700',
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#BC13FE]/25 bg-black/55 p-4">
            <div className="flex gap-2">
              <input
                value={wordGuess}
                onChange={(event) => setWordGuess(event.target.value)}
                placeholder="Guess the whole word…"
                className="flex-1 rounded-lg border border-[#BC13FE]/30 bg-black/70 px-4 py-3 text-white outline-none"
              />
              <button
                type="button"
                disabled={!wordGuess.trim() || busy}
                onClick={async () => {
                  const ok = await act('guess_word', { guess: wordGuess.trim() });
                  if (ok) setWordGuess('');
                }}
                className="rounded-lg border border-[#BC13FE] px-4 py-3 text-[#BC13FE] disabled:opacity-30"
                style={{ ...PS2, fontSize: 7 }}
              >
                GUESS
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'finished' && (
        <div className="rounded-xl border border-green-400/30 bg-green-400/5 p-5 text-center">
          <div className="text-[8px] text-green-400 uppercase tracking-widest" style={PS2}>
            {gs.roundResult === 'stumped'
              ? `STUMPED! SEAT ${setterSeat} +50`
              : gs.roundResult === 'solved'
                ? `SEAT ${gs.winnerSeat} SOLVED IT`
                : 'ROUND ENDED'}
          </div>
          <div className="mt-3 text-3xl text-[#FFD700] tracking-[0.18em]" style={PS2}>{gs.maskedWord}</div>
          <div className="mt-3 text-sm text-white/45">Seat {nextSetterSeat} sets the next board.</div>
        </div>
      )}

      {phase === 'playing' && (
        <div className="rounded-xl border border-white/10 bg-black/45 p-4">
          <div className="text-[7px] text-white/25 uppercase tracking-widest mb-3" style={PS2}>HOST ADMIN OVERRIDES</div>
          <div className="grid sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!gs.hintAvailable || gs.hintRevealed || busy}
              onClick={() => act('reveal_hint')}
              className="rounded-lg border border-[#BC13FE]/40 px-3 py-3 text-[#BC13FE] disabled:opacity-30"
            >
              Reveal Hint
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act('reveal_word')}
              className="rounded-lg border border-[#FF5F1F]/40 px-3 py-3 text-[#FF5F1F]"
            >
              Reveal / End Board
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act('reset_round')}
              className="rounded-lg border border-[#FFD700]/40 px-3 py-3 text-[#FFD700]"
            >
              Reset Board
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => act('new_game')}
        className="w-full rounded-lg border border-white/20 px-4 py-3 text-white/50"
      >
        New Hangman Match / Reset Scores
      </button>
    </div>
  );
}
