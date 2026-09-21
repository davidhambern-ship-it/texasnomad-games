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
import { getCardBack, getCardImage } from '@/lib/spadesCardImages';

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
  const wordCharacters = (state.maskedWord || '').split('');
  const finished = state.phase === 'finished';

  if (state.phase === 'setup') {
    return (
      <div
        className="relative z-10 h-full w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: '40% 60%',
          alignItems: 'center',
          padding: '28px 54px 36px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <HangmanBoard wrongCount={0} maxWrong={maxWrong} />
        </div>

        <div style={{ paddingLeft: 30 }}>
          <div
            style={{
              ...PS2,
              fontSize: 8,
              letterSpacing: '0.2em',
              color: '#BC13FE',
              marginBottom: 18,
            }}
          >
            HANGMAN
          </div>

          <div
            style={{
              fontSize: 'clamp(42px, 4.5vw, 78px)',
              lineHeight: 1,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            Stand By
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 'clamp(18px, 1.5vw, 28px)',
              color: 'rgba(255,255,255,.42)',
            }}
          >
            The Host is setting up the next puzzle.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative z-10 h-full w-full"
      style={{
        display: 'grid',
        gridTemplateColumns: '38% 62%',
        gridTemplateRows: '1fr auto',
        padding: '18px 42px 26px',
        columnGap: 34,
        rowGap: 16,
      }}
    >
      <div
        style={{
          gridRow: '1 / span 2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <HangmanBoard wrongCount={wrong.length} maxWrong={maxWrong} />
      </div>

      <div
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: 4,
        }}
      >
        {state.category && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                ...PS2,
                fontSize: 7,
                letterSpacing: '0.18em',
                color: 'rgba(255,255,255,.28)',
                marginBottom: 8,
              }}
            >
              CATEGORY
            </div>
            <div
              style={{
                fontSize: 'clamp(28px, 2.5vw, 46px)',
                lineHeight: 1,
                color: '#FFD700',
              }}
            >
              {state.category}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: '10px 12px',
            marginBottom: 26,
          }}
        >
          {wordCharacters.map((character, index) => {
            if (character === ' ') {
              return <div key={index} style={{ width: 24 }} />;
            }

            const revealed = character !== '_';

            return (
              <div
                key={index}
                style={{
                  width: 'clamp(36px, 3.7vw, 64px)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    minHeight: 'clamp(48px, 4.4vw, 76px)',
                    fontFamily: 'monospace',
                    fontSize: 'clamp(42px, 4vw, 70px)',
                    lineHeight: 1,
                    fontWeight: 700,
                    color: '#FFD700',
                    textShadow: revealed
                      ? '0 0 18px rgba(255,215,0,.45)'
                      : 'none',
                  }}
                >
                  {character}
                </div>
                <div
                  style={{
                    height: 3,
                    width: '100%',
                    marginTop: 5,
                    borderRadius: 99,
                    background: revealed
                      ? '#FFD700'
                      : 'rgba(255,215,0,.28)',
                  }}
                />
              </div>
            );
          })}
        </div>

        {state.hintRevealed && state.hint && (
          <div
            style={{
              marginBottom: 20,
              fontSize: 'clamp(16px, 1.25vw, 22px)',
              color: 'rgba(255,255,255,.7)',
            }}
          >
            <span style={{ color: '#BC13FE', fontWeight: 700 }}>HINT:</span>{' '}
            {state.hint}
          </div>
        )}

        <div>
          <div
            style={{
              ...PS2,
              fontSize: 7,
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,.25)',
              marginBottom: 10,
            }}
          >
            WRONG GUESSES
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              minHeight: 42,
              alignItems: 'center',
            }}
          >
            {wrong.length === 0 ? (
              <span style={{ color: 'rgba(255,255,255,.2)', fontSize: 14 }}>
                None yet
              </span>
            ) : (
              wrong.map((letter) => (
                <div
                  key={letter}
                  style={{
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(239,68,68,.55)',
                    borderRadius: 8,
                    background: 'rgba(239,68,68,.05)',
                    color: '#ef4444',
                    fontFamily: 'monospace',
                    fontSize: 20,
                  }}
                >
                  {letter}
                </div>
              ))
            )}
          </div>
        </div>

        {finished && (
          <div
            style={{
              marginTop: 18,
              ...PS2,
              fontSize: 9,
              letterSpacing: '0.18em',
              color: '#4ade80',
            }}
          >
            ROUND COMPLETE
          </div>
        )}
      </div>

      <div
        style={{
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(13, minmax(0, 1fr))',
          gap: 6,
          alignSelf: 'end',
        }}
      >
        {ALPHABET.map((letter) => {
          const isCorrect = guessed.includes(letter);
          const isWrong = wrong.includes(letter);

          return (
            <div
              key={letter}
              style={{
                height: 'clamp(36px, 3.1vw, 52px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 7,
                border: isCorrect
                  ? '1px solid #4ade80'
                  : isWrong
                    ? '1px solid #ef4444'
                    : '1px solid rgba(255,255,255,.09)',
                background: isCorrect
                  ? 'rgba(74,222,128,.07)'
                  : isWrong
                    ? 'rgba(239,68,68,.07)'
                    : 'rgba(255,255,255,.015)',
                color: isCorrect
                  ? '#4ade80'
                  : isWrong
                    ? '#ef4444'
                    : 'rgba(255,255,255,.28)',
                fontFamily: 'monospace',
                fontSize: 'clamp(12px, .95vw, 17px)',
              }}
            >
              {letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function SpadesSeat({ seat, player, state, position }) {
  const team = seat === 1 || seat === 3 ? 1 : 2;
  const isTurn = state.currentTurnSeat === seat;
  const isDealer = state.dealerSeat === seat;
  const positionClass = {
    top: 'absolute left-1/2 top-4 -translate-x-1/2',
    bottom: 'absolute bottom-4 left-1/2 -translate-x-1/2',
    left: 'absolute left-5 top-1/2 -translate-y-1/2',
    right: 'absolute right-5 top-1/2 -translate-y-1/2',
  }[position];

  return (
    <div className={positionClass + ' z-20'}>
      <div
        className="min-w-[150px] rounded-xl border bg-black/75 px-4 py-3 text-center backdrop-blur-sm"
        style={{
          borderColor: isTurn
            ? '#FFD700'
            : team === 1
              ? 'rgba(188,19,254,.45)'
              : 'rgba(255,95,31,.45)',
          boxShadow: isTurn ? '0 0 24px rgba(255,215,0,.18)' : 'none',
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-[7px] uppercase tracking-[0.16em] text-white/30" style={PS2}>
            SEAT {seat}
          </span>
          {isDealer && (
            <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[6px] text-white/45" style={PS2}>
              D
            </span>
          )}
        </div>

        <div className="mt-2 text-base text-white">
          {player?.name || 'Waiting…'}
        </div>

        <div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-white/30" style={PS2}>
          TEAM {team}
          {player?.playerType === 'cpu' ? ' · CPU' : ''}
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <img
            src={getCardBack()}
            alt=""
            className="h-12 w-9 rounded object-contain opacity-80"
          />
          <div className="text-left">
            <div className="font-mono text-xl text-[#FFD700]">
              {player?.cardCount || 0}
            </div>
            <div className="text-[6px] uppercase tracking-[0.12em] text-white/25" style={PS2}>
              CARDS
            </div>
          </div>
        </div>

        {(player?.bid != null || player?.tricksWon > 0) && (
          <div className="mt-2 text-xs text-white/45">
            Bid {player?.bid ?? '-'} · Books {player?.tricksWon || 0}
          </div>
        )}

        {isTurn && (
          <div className="mt-2 text-[7px] uppercase tracking-[0.14em] text-[#FFD700]" style={PS2}>
            ▶ TURN
          </div>
        )}
      </div>
    </div>
  );
}

function SpadesDisplay({ room }) {
  const state = room.state || {};
  const players = state.players || [];
  const trick = state.currentTrick || [];
  const phaseLabel = {
    setup: 'SETTING TABLE',
    dealt: 'CARDS DEALT',
    bidding: 'BIDDING',
    playing: 'PLAYING',
    round_over: 'ROUND OVER',
  }[state.phase] || String(state.phase || 'WAITING').toUpperCase();

  const playerAt = (seat) => players.find((player) => player.seatNumber === seat);

  return (
    <div className="relative z-10 h-full w-full px-8 py-5">
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between px-3">
          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-[#BC13FE]" style={PS2}>
              TEXASNOMAD SPADES
            </div>
            <div className="mt-1 text-sm text-white/30">
              Hand {state.handNumber || 0} · {phaseLabel}
            </div>
          </div>

          <div className="flex gap-5 text-right">
            <div>
              <div className="text-[6px] uppercase tracking-[0.15em] text-white/25" style={PS2}>
                {state.team1Name || 'Team 1'}
              </div>
              <div className="mt-1 text-2xl text-[#BC13FE]">{state.score1 || 0}</div>
            </div>
            <div>
              <div className="text-[6px] uppercase tracking-[0.15em] text-white/25" style={PS2}>
                {state.team2Name || 'Team 2'}
              </div>
              <div className="mt-1 text-2xl text-[#FF5F1F]">{state.score2 || 0}</div>
            </div>
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          <div
            className="absolute inset-3 rounded-[42%] border-[10px] border-[#3d2817] bg-[#0a2a17]"
            style={{
              boxShadow:
                'inset 0 0 90px rgba(0,0,0,.78), 0 0 40px rgba(0,0,0,.35)',
            }}
          >
            <div
              className="absolute inset-4 rounded-[42%] border border-white/[0.05]"
              style={{
                background:
                  'radial-gradient(circle at 50% 45%, rgba(28,105,63,.4), rgba(4,38,20,.5) 55%, rgba(0,0,0,.28) 100%)',
              }}
            />

            <SpadesSeat seat={3} player={playerAt(3)} state={state} position="top" />
            <SpadesSeat seat={2} player={playerAt(2)} state={state} position="left" />
            <SpadesSeat seat={4} player={playerAt(4)} state={state} position="right" />
            <SpadesSeat seat={1} player={playerAt(1)} state={state} position="bottom" />

            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              {trick.length === 0 ? (
                <div className="text-center">
                  <div className="text-6xl">♠</div>
                  <div className="mt-3 text-[8px] uppercase tracking-[0.18em] text-white/25" style={PS2}>
                    {state.phase === 'dealt' ? 'PRIVATE DEAL VERIFIED' : phaseLabel}
                  </div>
                  {state.phase === 'dealt' && (
                    <div className="mt-2 text-sm text-green-400/70">
                      No hidden hands are sent to this display.
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative h-40 w-52">
                  {trick.map((play, index) => {
                    const positions = [
                      { left: 78, top: 82, transform: 'rotate(0deg)' },
                      { left: 22, top: 48, transform: 'rotate(-90deg)' },
                      { left: 78, top: 10, transform: 'rotate(180deg)' },
                      { left: 136, top: 48, transform: 'rotate(90deg)' },
                    ];
                    const pos = positions[index] || positions[0];

                    return (
                      <img
                        key={play.card?.id || index}
                        src={getCardImage(play.card)}
                        alt=""
                        className="absolute h-20 w-14 rounded object-contain shadow-xl"
                        style={pos}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4 px-3">
          <div className="rounded-lg border border-[#BC13FE]/20 bg-[#BC13FE]/[0.04] px-4 py-2 text-center">
            <span className="text-xs text-white/35">
              {state.team1Name || 'Team 1'} · Bid {state.bid1 ?? '-'} · Books {state.books1 || 0}
            </span>
          </div>
          <div className="rounded-lg border border-[#FF5F1F]/20 bg-[#FF5F1F]/[0.04] px-4 py-2 text-center">
            <span className="text-xs text-white/35">
              {state.team2Name || 'Team 2'} · Bid {state.bid2 ?? '-'} · Books {state.books2 || 0}
            </span>
          </div>
        </div>
      </div>
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
        {room?.gameId === 'spades' && <SpadesDisplay room={room} />}

        {room && !['hangman', 'spades'].includes(room.gameId) && (
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
            'radial-gradient(circle at 20% 52%, rgba(188,19,254,.07), transparent 30%), radial-gradient(circle at 75% 48%, rgba(255,215,0,.025), transparent 34%)',
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
