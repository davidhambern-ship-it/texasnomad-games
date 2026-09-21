import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Monitor } from 'lucide-react';

import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HANGMAN_PARTS = [
  <circle key="head" cx="170" cy="116" r="26" stroke="#FFD700" strokeWidth="5" fill="none" />,
  <line key="body" x1="170" y1="142" x2="170" y2="222" stroke="#FFD700" strokeWidth="5" strokeLinecap="round" />,
  <line key="arm-l" x1="170" y1="158" x2="122" y2="196" stroke="#FFD700" strokeWidth="5" strokeLinecap="round" />,
  <line key="arm-r" x1="170" y1="158" x2="218" y2="196" stroke="#FFD700" strokeWidth="5" strokeLinecap="round" />,
  <line key="leg-l" x1="170" y1="222" x2="126" y2="276" stroke="#FFD700" strokeWidth="5" strokeLinecap="round" />,
  <line key="leg-r" x1="170" y1="222" x2="214" y2="276" stroke="#FFD700" strokeWidth="5" strokeLinecap="round" />,
];

function HangmanBoard({ wrongCount, maxWrong }) {
  return (
    <div className="relative">
      <svg
        viewBox="0 0 300 320"
        className="w-[280px] sm:w-[330px] lg:w-[390px] h-auto drop-shadow-[0_0_28px_rgba(188,19,254,0.14)]"
        aria-label={'Hangman board: ' + wrongCount + ' of ' + maxWrong + ' wrong guesses'}
      >
        <line x1="28" y1="294" x2="260" y2="294" stroke="#ffffff28" strokeWidth="6" strokeLinecap="round" />
        <line x1="76" y1="294" x2="76" y2="30" stroke="#ffffff28" strokeWidth="6" strokeLinecap="round" />
        <line x1="76" y1="30" x2="170" y2="30" stroke="#ffffff28" strokeWidth="6" strokeLinecap="round" />
        <line x1="76" y1="30" x2="112" y2="67" stroke="#ffffff18" strokeWidth="5" strokeLinecap="round" />
        <line x1="170" y1="30" x2="170" y2="89" stroke="#BC13FE" strokeWidth="5" strokeLinecap="round" />
        {HANGMAN_PARTS.slice(0, wrongCount)}
      </svg>

      <div className="absolute bottom-2 right-2 rounded-lg border border-[#FF5F1F]/35 bg-black/70 px-3 py-2 text-center">
        <div
          className="text-xl"
          style={{
            ...PS2,
            color: wrongCount >= maxWrong ? '#ef4444' : '#FF5F1F',
          }}
        >
          {wrongCount}/{maxWrong}
        </div>
        <div className="mt-1 text-[6px] uppercase tracking-widest text-white/30" style={PS2}>
          WRONG
        </div>
      </div>
    </div>
  );
}


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
    <div className="w-full max-w-7xl mx-auto">
      <div className="text-center mb-5">
        <div className="mb-2 text-[8px] uppercase tracking-[0.25em] text-[#BC13FE]" style={PS2}>
          TEXASNOMAD HANGMAN
        </div>
        <div className="font-mono text-sm text-white/35 tracking-[0.2em]">
          ROOM {room.roomCode}
        </div>
      </div>

      {state.phase === 'setup' && (
        <div className="min-h-[70vh] flex items-center justify-center text-center">
          <div>
            <HangmanBoard wrongCount={0} maxWrong={maxWrong} />
            <h1 className="text-4xl mt-3 mb-3">Hangman</h1>
            <p className="text-white/45">
              The Host is setting up the word. Game begins shortly.
            </p>
          </div>
        </div>
      )}

      {state.phase !== 'setup' && (
        <div className="grid lg:grid-cols-[420px_1fr] gap-8 lg:gap-12 items-center">
          <div className="flex justify-center">
            <HangmanBoard wrongCount={wrong.length} maxWrong={maxWrong} />
          </div>

          <div className="text-center lg:text-left">
            {state.category && (
              <div className="mb-5">
                <div className="text-[8px] uppercase tracking-widest text-white/30 mb-2" style={PS2}>
                  Category
                </div>
                <div className="text-3xl text-[#FFD700]">{state.category}</div>
              </div>
            )}

            <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-7">
              {wordCharacters.map((character, index) => {
                if (character === ' ') return <div key={index} className="w-7" />;

                return (
                  <div key={index} className="min-w-[34px] sm:min-w-[42px]">
                    <div
                      className="text-4xl sm:text-5xl lg:text-6xl font-mono text-[#FFD700] text-center"
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
              <div className="mb-6 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 px-5 py-4">
                <span className="text-[#BC13FE]">💡 Hint:</span>{' '}
                <span className="text-white/70">{state.hint}</span>
              </div>
            )}

            <div className="mb-7">
              <div className="text-[8px] uppercase tracking-widest text-white/30 mb-3" style={PS2}>
                Wrong Guesses
              </div>
              <div className="flex justify-center lg:justify-start flex-wrap gap-2 min-h-[42px]">
                {wrong.length === 0
                  ? <span className="text-white/25">None yet</span>
                  : wrong.map((letter) => (
                    <span
                      key={letter}
                      className="w-11 h-11 rounded-lg border border-red-500/50 text-red-400 flex items-center justify-center font-mono text-xl"
                    >
                      {letter}
                    </span>
                  ))}
              </div>
            </div>

            <div className="grid grid-cols-9 sm:grid-cols-13 gap-2">
              {ALPHABET.map((letter) => {
                const isCorrect = guessed.includes(letter);
                const isWrong = wrong.includes(letter);

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
                          : 'rgba(255,255,255,.28)',
                      background: isCorrect
                        ? 'rgba(74,222,128,.05)'
                        : isWrong
                          ? 'rgba(239,68,68,.05)'
                          : 'transparent',
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>

            {state.phase === 'finished' && (
              <div className="mt-7 text-lg text-green-400 text-center" style={PS2}>
                ROUND COMPLETE
              </div>
            )}
          </div>
        </div>
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
