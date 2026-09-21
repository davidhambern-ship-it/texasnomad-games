import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Monitor } from 'lucide-react';

import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function savedDisplay() {
  try {
    const deviceId = localStorage.getItem('tng_display_device_id');
    const token = localStorage.getItem('tng_display_token');
    return deviceId && token ? { deviceId, token } : null;
  } catch {
    return null;
  }
}

function HangmanDisplay({ room }) {
  const state = room.state || {};
  const wrong = state.wrongLetters || [];
  const guessed = state.guessedLetters || [];
  const maxWrong = state.maxWrong || 6;
  const masked = state.maskedWord || '';
  const wordCharacters = masked.split('');

  return (
    <div className="w-full max-w-5xl mx-auto text-center">
      <div className="mb-2 text-[8px] uppercase tracking-[0.25em] text-[#BC13FE]" style={PS2}>
        TEXASNOMAD HANGMAN
      </div>

      <div className="font-mono text-sm text-white/35 tracking-[0.2em] mb-7">
        ROOM {room.roomCode}
      </div>

      {state.phase === 'setup' && (
        <div className="py-16">
          <div className="text-6xl mb-6">🔤</div>
          <h1 className="text-4xl mb-3">Hangman</h1>
          <p className="text-white/45">
            The Host is setting up the word. Game begins shortly.
          </p>
        </div>
      )}

      {state.phase !== 'setup' && (
        <>
          {state.category && (
            <div className="mb-6">
              <div className="text-[8px] uppercase tracking-widest text-white/30 mb-2" style={PS2}>
                Category
              </div>
              <div className="text-2xl text-[#FFD700]">{state.category}</div>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {wordCharacters.map((character, index) => {
              if (character === ' ') return <div key={index} className="w-6" />;

              return (
                <div key={index} className="min-w-[34px]">
                  <div
                    className="text-4xl md:text-5xl font-mono text-[#FFD700]"
                    style={{ textShadow: character !== '_' ? '0 0 18px rgba(255,215,0,.45)' : 'none' }}
                  >
                    {character}
                  </div>
                  <div className="h-0.5 bg-[#FFD700]/30 mt-2" />
                </div>
              );
            })}
          </div>

          {state.hintRevealed && state.hint && (
            <div className="mb-8 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 px-5 py-4">
              <span className="text-[#BC13FE]">💡 Hint:</span>{' '}
              <span className="text-white/70">{state.hint}</span>
            </div>
          )}

          <div className="mb-6">
            <div className="text-[8px] uppercase tracking-widest text-white/30 mb-3" style={PS2}>
              Wrong Guesses — {wrong.length}/{maxWrong}
            </div>
            <div className="flex justify-center flex-wrap gap-2">
              {wrong.length === 0
                ? <span className="text-white/25">None yet</span>
                : wrong.map((letter) => (
                  <span
                    key={letter}
                    className="w-10 h-10 rounded-lg border border-red-500/50 text-red-400 flex items-center justify-center font-mono text-xl"
                  >
                    {letter}
                  </span>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-9 sm:grid-cols-13 gap-2 max-w-3xl mx-auto">
            {ALPHABET.map((letter) => {
              const isCorrect = guessed.includes(letter);
              const isWrong = wrong.includes(letter);
              const used = isCorrect || isWrong;

              return (
                <div
                  key={letter}
                  className="aspect-square rounded-md border flex items-center justify-center text-xs sm:text-sm font-mono"
                  style={{
                    borderColor: isCorrect
                      ? '#4ade80'
                      : isWrong
                        ? '#ef4444'
                        : 'rgba(255,255,255,.12)',
                    color: isCorrect
                      ? '#4ade80'
                      : isWrong
                        ? '#ef4444'
                        : 'rgba(255,255,255,.35)',
                    opacity: used ? 1 : 0.7,
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>

          {state.phase === 'finished' && (
            <div className="mt-8 text-lg text-green-400" style={PS2}>
              ROUND COMPLETE
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function GameDisplay() {
  const initial = useMemo(savedDisplay, []);
  const [code, setCode] = useState('');
  const [display, setDisplay] = useState(initial);
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState(initial ? 'connecting' : 'unpaired');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!display?.deviceId || !display?.token) return undefined;

    let cancelled = false;

    async function refresh() {
      try {
        const payload = await tngApi.display.getState(display.deviceId, display.token);
        if (cancelled) return;

        setStatus(payload.status || 'connected');
        setRoom(payload.room || null);
        setError('');
      } catch (stateError) {
        if (cancelled) return;

        setError(stateError.message || 'The Game Display connection was lost.');

        if (stateError.status === 401) {
          localStorage.removeItem('tng_display_device_id');
          localStorage.removeItem('tng_display_token');
          setDisplay(null);
          setRoom(null);
          setStatus('unpaired');
        }
      }
    }

    refresh();
    const interval = window.setInterval(refresh, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [display?.deviceId, display?.token]);

  async function submit(event) {
    event.preventDefault();
    setError('');

    try {
      const payload = await tngApi.display.pair(code);
      const paired = {
        deviceId: payload.display.deviceId,
        token: payload.display.token,
      };

      localStorage.setItem('tng_display_device_id', paired.deviceId);
      localStorage.setItem('tng_display_token', paired.token);

      setDisplay(paired);
      setStatus('connecting');
      setCode('');
    } catch (pairError) {
      setError(pairError.message || 'The display could not be paired.');
    }
  }

  if (!display) {
    return (
      <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md text-center">
          <Monitor className="w-14 h-14 text-[#FFD700] mx-auto mb-4" />
          <h1 className="text-3xl mb-4">Pair This Screen</h1>
          <p className="text-white/40 mb-6">
            Enter the six-digit code shown on the Host Controller.
          </p>

          <input
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            className="w-full h-16 bg-black border-2 border-[#FFD700]/50 rounded-xl text-center text-4xl font-mono tracking-[0.25em]"
            placeholder="000000"
            autoFocus
          />

          {error && <p className="text-red-400 mt-3">{error}</p>}

          <button
            disabled={code.length !== 6}
            className="w-full mt-5 h-12 bg-[#FFD700] text-black rounded-lg disabled:opacity-40"
          >
            CONNECT DISPLAY
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05030b] text-white p-6 flex items-center justify-center">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 rounded-lg border border-red-500/40 bg-black/90 px-4 py-2 text-red-400">
          {error}
        </div>
      )}

      {!room && (
        <div className="text-center">
          {status === 'connecting'
            ? <Loader2 className="w-12 h-12 animate-spin text-[#BC13FE] mx-auto mb-5" />
            : <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-5" />}

          <h1 className="text-4xl">Game Display Ready</h1>
          <p className="text-white/45 mt-4">
            {status === 'waiting_for_room'
              ? 'Waiting for the Host to choose a game…'
              : 'Connected to the Host Controller.'}
          </p>
        </div>
      )}

      {room?.gameId === 'hangman' && <HangmanDisplay room={room} />}

      {room && room.gameId !== 'hangman' && (
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-4xl">{room.gameId}</h1>
          <p className="text-white/45 mt-4">
            This game is connected. Its Neon display renderer is next in the migration queue.
          </p>
        </div>
      )}
    </div>
  );
}
