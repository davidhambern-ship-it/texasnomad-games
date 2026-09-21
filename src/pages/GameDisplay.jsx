import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Expand,
  Loader2,
  Minimize2,
  Monitor,
  Radio,
  Wifi,
} from 'lucide-react';

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

function savedDisplay() {
  try {
    const deviceId = localStorage.getItem('tng_display_device_id');
    const token = localStorage.getItem('tng_display_token');
    return deviceId && token ? { deviceId, token } : null;
  } catch {
    return null;
  }
}

function HangmanBoard({ wrongCount, maxWrong }) {
  const danger = wrongCount >= maxWrong;

  return (
    <div className="relative flex items-center justify-center">
      <div
        className="absolute inset-8 rounded-full blur-3xl opacity-20"
        style={{
          background: danger
            ? 'radial-gradient(circle, #ef4444 0%, transparent 70%)'
            : 'radial-gradient(circle, #BC13FE 0%, transparent 70%)',
        }}
      />

      <svg
        viewBox="0 0 300 320"
        className="relative z-10 w-[clamp(260px,29vw,430px)] h-auto"
        aria-label={'Hangman board: ' + wrongCount + ' of ' + maxWrong + ' wrong guesses'}
      >
        <defs>
          <filter id="yellowGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line x1="28" y1="294" x2="260" y2="294" stroke="#ffffff32" strokeWidth="6" strokeLinecap="round" />
        <line x1="76" y1="294" x2="76" y2="30" stroke="#ffffff32" strokeWidth="6" strokeLinecap="round" />
        <line x1="76" y1="30" x2="170" y2="30" stroke="#ffffff32" strokeWidth="6" strokeLinecap="round" />
        <line x1="76" y1="30" x2="112" y2="67" stroke="#ffffff18" strokeWidth="5" strokeLinecap="round" />
        <line x1="170" y1="30" x2="170" y2="89" stroke="#BC13FE" strokeWidth="5" strokeLinecap="round" />

        <g filter="url(#yellowGlow)">
          {HANGMAN_PARTS.slice(0, wrongCount)}
        </g>
      </svg>

      <div className="absolute bottom-1 right-[6%] z-20 rounded-xl border border-[#FF5F1F]/40 bg-black/80 px-4 py-3 text-center shadow-[0_0_25px_rgba(255,95,31,.12)]">
        <div
          className="text-2xl"
          style={{
            ...PS2,
            color: danger ? '#ef4444' : '#FF5F1F',
            textShadow: danger ? '0 0 14px rgba(239,68,68,.5)' : '0 0 14px rgba(255,95,31,.35)',
          }}
        >
          {wrongCount}/{maxWrong}
        </div>
        <div className="mt-1 text-[6px] uppercase tracking-[0.2em] text-white/30" style={PS2}>
          WRONG
        </div>
      </div>
    </div>
  );
}

function DisplayHud({ room, isFullscreen, onToggleFullscreen }) {
  return (
    <div className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] bg-black/35 px-5 sm:px-8 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div>
          <div
            className="text-[9px] uppercase tracking-[0.28em] text-[#BC13FE]"
            style={{ ...PS2, textShadow: '0 0 14px rgba(188,19,254,.45)' }}
          >
            TEXASNOMAD GAMES
          </div>
          <div className="mt-1 text-[7px] uppercase tracking-[0.22em] text-white/30" style={PS2}>
            GAME DISPLAY
          </div>
        </div>

        <div className="hidden h-8 w-px bg-white/10 sm:block" />

        <div className="hidden items-center gap-2 rounded-full border border-green-400/25 bg-green-400/[0.06] px-3 py-1.5 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          <span className="text-[7px] uppercase tracking-[0.18em] text-green-400" style={PS2}>
            LIVE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {room && (
          <div className="hidden text-right md:block">
            <div className="text-[6px] uppercase tracking-[0.18em] text-white/25" style={PS2}>
              ROOM
            </div>
            <div className="mt-1 font-mono text-sm tracking-[0.22em] text-[#FFD700]">
              {room.roomCode}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-white/60 transition hover:border-[#BC13FE]/50 hover:bg-[#BC13FE]/10 hover:text-white"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          <span className="hidden text-[7px] uppercase tracking-[0.14em] sm:inline" style={PS2}>
            {isFullscreen ? 'EXIT' : 'FULLSCREEN'}
          </span>
        </button>
      </div>
    </div>
  );
}

function HangmanDisplay({ room }) {
  const state = room.state || {};
  const wrong = state.wrongLetters || [];
  const guessed = state.guessedLetters || [];
  const maxWrong = state.maxWrong || 6;
  const masked = state.maskedWord || '';
  const wordCharacters = masked.split('');
  const finished = state.phase === 'finished';

  return (
    <div className="relative z-10 flex h-full min-h-0 w-full flex-col">
      {state.phase === 'setup' ? (
        <div className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <HangmanBoard wrongCount={0} maxWrong={maxWrong} />

            <div className="text-center lg:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#BC13FE]/30 bg-[#BC13FE]/[0.06] px-4 py-2">
                <Radio className="h-4 w-4 text-[#BC13FE]" />
                <span className="text-[7px] uppercase tracking-[0.18em] text-[#BC13FE]" style={PS2}>
                  HOST SETUP
                </span>
              </div>

              <h1
                className="text-5xl font-semibold uppercase tracking-tight text-white sm:text-6xl"
                style={{ fontFamily: "'Rye', serif" }}
              >
                Hangman
              </h1>
              <p className="mt-4 max-w-xl text-lg text-white/40">
                The Host is setting up the next puzzle.
              </p>

              <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#FFD700]" />
                <span className="text-[8px] uppercase tracking-[0.18em] text-white/50" style={PS2}>
                  STAND BY
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 items-center gap-4 px-5 py-4 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-8 lg:px-10">
          <div className="flex min-h-0 items-center justify-center">
            <HangmanBoard wrongCount={wrong.length} maxWrong={maxWrong} />
          </div>

          <div className="flex min-h-0 flex-col justify-center">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {state.category && (
                <div className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/[0.05] px-4 py-2">
                  <span className="mr-2 text-[6px] uppercase tracking-[0.16em] text-white/30" style={PS2}>
                    CATEGORY
                  </span>
                  <span className="text-lg font-medium text-[#FFD700]">
                    {state.category}
                  </span>
                </div>
              )}

              <div className="rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2">
                <span className="text-[7px] uppercase tracking-[0.16em] text-white/35" style={PS2}>
                  {wrong.length}/{maxWrong} WRONG
                </span>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              {wordCharacters.map((character, index) => {
                if (character === ' ') {
                  return <div key={index} className="w-5 sm:w-7" />;
                }

                const revealed = character !== '_';

                return (
                  <div
                    key={index}
                    className="flex min-w-[34px] flex-col items-center sm:min-w-[42px] lg:min-w-[48px]"
                  >
                    <div
                      className="text-center font-mono text-4xl font-semibold text-[#FFD700] sm:text-5xl lg:text-6xl"
                      style={{
                        textShadow: revealed
                          ? '0 0 20px rgba(255,215,0,.5)'
                          : 'none',
                      }}
                    >
                      {character}
                    </div>
                    <div
                      className="mt-1.5 h-[3px] w-full rounded-full"
                      style={{
                        background: revealed
                          ? 'linear-gradient(90deg, rgba(255,215,0,.25), #FFD700, rgba(255,215,0,.25))'
                          : 'rgba(255,215,0,.22)',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {state.hintRevealed && state.hint && (
              <div className="mb-5 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/[0.06] px-5 py-3 shadow-[0_0_28px_rgba(188,19,254,.08)]">
                <span className="text-sm text-[#BC13FE]">💡 HINT</span>
                <span className="ml-3 text-base text-white/70">{state.hint}</span>
              </div>
            )}

            <div className="mb-5">
              <div className="mb-2 text-[7px] uppercase tracking-[0.18em] text-white/25" style={PS2}>
                WRONG GUESSES
              </div>

              <div className="flex min-h-[44px] flex-wrap justify-center gap-2 lg:justify-start">
                {wrong.length === 0 ? (
                  <span className="self-center text-sm text-white/20">None yet</span>
                ) : (
                  wrong.map((letter) => (
                    <span
                      key={letter}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/50 bg-red-500/[0.05] font-mono text-lg text-red-400 shadow-[0_0_18px_rgba(239,68,68,.08)]"
                    >
                      {letter}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-13 gap-1.5">
              {ALPHABET.map((letter) => {
                const isCorrect = guessed.includes(letter);
                const isWrong = wrong.includes(letter);
                const used = isCorrect || isWrong;

                return (
                  <div
                    key={letter}
                    className="flex aspect-square items-center justify-center rounded-md border font-mono text-[11px] transition-all sm:text-xs"
                    style={{
                      borderColor: isCorrect
                        ? '#4ade80'
                        : isWrong
                          ? '#ef4444'
                          : 'rgba(255,255,255,.08)',
                      color: isCorrect
                        ? '#4ade80'
                        : isWrong
                          ? '#ef4444'
                          : 'rgba(255,255,255,.24)',
                      background: isCorrect
                        ? 'rgba(74,222,128,.08)'
                        : isWrong
                          ? 'rgba(239,68,68,.08)'
                          : 'rgba(255,255,255,.015)',
                      boxShadow: used
                        ? isCorrect
                          ? '0 0 16px rgba(74,222,128,.08)'
                          : '0 0 16px rgba(239,68,68,.08)'
                        : 'none',
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>

            {finished && (
              <div className="mt-5 rounded-xl border border-green-400/30 bg-green-400/[0.06] px-5 py-4 text-center shadow-[0_0_32px_rgba(74,222,128,.08)]">
                <div className="text-[10px] uppercase tracking-[0.2em] text-green-400" style={PS2}>
                  ROUND COMPLETE
                </div>
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
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

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
    const interval = window.setInterval(refresh, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [display?.deviceId, display?.token]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key.toLowerCase() === 'f' && display) {
        event.preventDefault();
        toggleFullscreen();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [display, isFullscreen]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (fullscreenError) {
      setError('Fullscreen was blocked by the browser. Use Chrome\'s fullscreen control instead.');
    }
  }

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
      <div className="relative min-h-[100dvh] overflow-hidden bg-[#030207] text-white">
        <AmbientBackdrop />

        <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6">
          <form className="w-full max-w-md text-center" onSubmit={submit}>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/[0.05] shadow-[0_0_40px_rgba(255,215,0,.1)]">
              <Monitor className="h-10 w-10 text-[#FFD700]" />
            </div>

            <div className="mb-2 text-[8px] uppercase tracking-[0.25em] text-[#BC13FE]" style={PS2}>
              TEXASNOMAD GAME DISPLAY
            </div>
            <h1 className="text-4xl font-semibold">Pair This Screen</h1>
            <p className="mt-3 text-white/40">
              Enter the six-digit code shown on the Host Controller.
            </p>

            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              className="mt-7 h-20 w-full rounded-xl border-2 border-[#FFD700]/40 bg-black/70 text-center font-mono text-5xl tracking-[0.28em] text-[#FFD700] outline-none transition focus:border-[#FFD700] focus:shadow-[0_0_28px_rgba(255,215,0,.12)]"
              placeholder="000000"
              autoFocus
            />

            {error && <p className="mt-4 text-red-400">{error}</p>}

            <button
              disabled={code.length !== 6}
              className="mt-6 h-14 w-full rounded-xl bg-[#FFD700] font-semibold text-black transition hover:brightness-110 disabled:opacity-35"
            >
              CONNECT DISPLAY
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#030207] text-white">
      <AmbientBackdrop />
      <DisplayHud room={room} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />

      {error && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg border border-red-500/40 bg-black/90 px-4 py-2 text-sm text-red-400 shadow-xl">
          {error}
        </div>
      )}

      <div className="relative z-10 h-[calc(100dvh-4rem)] overflow-hidden">
        {!room && (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              {status === 'connecting' ? (
                <Loader2 className="mx-auto mb-6 h-14 w-14 animate-spin text-[#BC13FE]" />
              ) : (
                <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-green-400" />
              )}

              <h1 className="text-5xl font-semibold">Game Display Ready</h1>

              <div className="mt-5 flex items-center justify-center gap-2 text-white/40">
                <Wifi className="h-4 w-4 text-green-400" />
                <span>
                  {status === 'waiting_for_room'
                    ? 'Waiting for the Host to choose a game…'
                    : 'Connected to the Host Controller.'}
                </span>
              </div>

              <p className="mt-6 text-xs uppercase tracking-[0.16em] text-white/20">
                Press F or use FULLSCREEN above for TV mode
              </p>
            </div>
          </div>
        )}

        {room?.gameId === 'hangman' && <HangmanDisplay room={room} />}

        {room && room.gameId !== 'hangman' && (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <div className="text-7xl">🎮</div>
              <h1 className="mt-5 text-5xl capitalize">{room.gameId}</h1>
              <p className="mt-4 text-white/40">
                This game is connected. Its display renderer is next in the migration queue.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AmbientBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 18% 35%, rgba(188,19,254,.09), transparent 28%), radial-gradient(circle at 82% 68%, rgba(255,95,31,.07), transparent 30%), radial-gradient(circle at 58% 12%, rgba(255,215,0,.04), transparent 22%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,.9) 0px, rgba(255,255,255,.9) 1px, transparent 1px, transparent 4px)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_rgba(0,0,0,.85)]" />
    </>
  );
}
