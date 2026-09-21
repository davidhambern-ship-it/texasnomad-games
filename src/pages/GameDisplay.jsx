import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import SpadesShuffleAnimation from '@/components/spades/SpadesShuffleAnimation';
import SpadesDealAnimation from '@/components/spades/SpadesDealAnimation';

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


function SpadesSeat({ seat, player, state, position, scale = 1, visualCardCount = null }) {
  const team = seat === 1 || seat === 3 ? 1 : 2;
  const teamColor = team === 1 ? '#BC13FE' : '#FF5F1F';
  const isTurn = state.currentTurnSeat === seat;
  const isDealer = state.dealerSeat === seat;
  const cardCount = visualCardCount ?? Number(player?.cardCount || 0);
  const compactGameplay = state.phase === 'playing' || state.phase === 'resolving';
  const effectiveScale = scale * (compactGameplay ? 0.82 : 1);

  const positionStyle = {
    top: {
      left: '50%',
      top: 6,
      transform: `translateX(-50%) scale(${effectiveScale})`,
      transformOrigin: 'top center',
    },
    bottom: {
      left: '50%',
      bottom: 6,
      transform: `translateX(-50%) scale(${effectiveScale})`,
      transformOrigin: 'bottom center',
    },
    left: {
      left: 22,
      top: '50%',
      transform: `translateY(-50%) scale(${effectiveScale})`,
      transformOrigin: 'left center',
    },
    right: {
      right: 22,
      top: '50%',
      transform: `translateY(-50%) scale(${effectiveScale})`,
      transformOrigin: 'right center',
    },
  }[position];

  const fanCards = cardCount > 0 ? [0, 1, 2] : [];

  return (
    <div
      className="absolute z-20"
      style={{
        ...positionStyle,
        width: compactGameplay
          ? (position === 'left' || position === 'right' ? 160 : 172)
          : (position === 'left' || position === 'right' ? 176 : 190),
      }}
    >
      <div
        className="rounded-xl border bg-black/88 px-4 py-3 backdrop-blur-md"
        style={{
          borderColor: isTurn ? '#FFD700' : teamColor + '66',
          boxShadow: isTurn
            ? '0 0 26px rgba(255,215,0,.22)'
            : '0 0 18px rgba(0,0,0,.38)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div
            className="text-[6px] uppercase tracking-[0.16em] text-white/28"
            style={PS2}
          >
            SEAT {seat}
          </div>

          <div className="flex items-center gap-1.5">
            {isDealer && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white/15 px-1 text-[6px] text-white/45"
                style={PS2}
              >
                D
              </span>
            )}

            {isTurn && (
              <span
                className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-2 py-1 text-[6px] text-[#FFD700]"
                style={PS2}
              >
                TURN
              </span>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg leading-none text-white">
              {player?.name || 'Waiting…'}
            </div>
            <div
              className="mt-2 text-[6px] uppercase tracking-[0.12em]"
              style={{ ...PS2, color: teamColor }}
            >
              TEAM {team}{player?.playerType === 'cpu' ? ' · CPU' : ''}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-mono text-2xl leading-none text-[#FFD700]">
              {cardCount}
            </div>
            <div
              className="mt-1 text-[5px] uppercase tracking-[0.1em] text-white/25"
              style={PS2}
            >
              CARDS
            </div>
          </div>
        </div>

        {cardCount > 0 && !compactGameplay && (
          <div className="relative mt-3 h-9">
            {fanCards.map((cardIndex) => (
              <img
                key={cardIndex}
                src={getCardBack()}
                alt=""
                className="absolute h-9 w-7 rounded-sm object-contain shadow-md"
                style={{
                  left: `${52 + cardIndex * 14}px`,
                  transform: `rotate(${(cardIndex - 1) * 8}deg)`,
                  transformOrigin: 'bottom center',
                  opacity: 0.88,
                }}
              />
            ))}
          </div>
        )}

        {(player?.bid != null || player?.tricksWon > 0) && (
          <div className="mt-2 border-t border-white/[0.06] pt-2 text-center text-xs text-white/40">
            Bid {player?.bid ?? '-'} · Books {player?.tricksWon || 0}
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
  const playAreaRef = useRef(null);
  const [tableSize, setTableSize] = useState(null);
  const handNumber = Number(state.handNumber || 0);
  const lastAnimatedHandRef = useRef(handNumber);
  const [dealVisualPhase, setDealVisualPhase] = useState('idle');
  const [visualCardCounts, setVisualCardCounts] = useState(null);

  const publicDealSequence = useMemo(
    () => Array.from({ length: 52 }, (_, index) => ({
      id: `public-deal-${handNumber}-${index}`,
    })),
    [handNumber],
  );

  useEffect(() => {
    const playArea = playAreaRef.current;
    if (!playArea) return undefined;

    const TARGET_ASPECT = 1.9;
    const fitTable = () => {
      const availableWidth = playArea.clientWidth;
      const availableHeight = playArea.clientHeight;
      if (!availableWidth || !availableHeight) return;

      // Keep the game-display table taller and less stretched while still
      // scaling cleanly across televisions, desktops, tablets, and phones.
      const widthFraction =
        availableWidth < 760 ? 0.98 :
        availableWidth < 1100 ? 0.90 :
        availableWidth < 1450 ? 0.82 :
        0.76;

      const maxWidth = availableWidth * widthFraction;
      const maxHeight = availableHeight * 0.96;

      let width = maxWidth;
      let height = width / TARGET_ASPECT;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * TARGET_ASPECT;
      }

      setTableSize({
        width: Math.round(width),
        height: Math.round(height),
        scale: Math.max(0.68, Math.min(1, width / 1120)),
      });
    };

    fitTable();

    const observer = new ResizeObserver(fitTable);
    observer.observe(playArea);
    window.addEventListener('resize', fitTable);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitTable);
    };
  }, []);

  useEffect(() => {
    const lastAnimatedHand = lastAnimatedHandRef.current;

    // A reset/setup can bring the hand number back down. Track that so the
    // next confirmed deal is eligible to animate again.
    if (handNumber < lastAnimatedHand || state.phase === 'setup') {
      lastAnimatedHandRef.current = handNumber;
      if (state.phase === 'setup') {
        setDealVisualPhase('idle');
        setVisualCardCounts(null);
      }
      return;
    }

    // The server has already completed the secure deal. This is presentation
    // only: the display animates backs and counts without receiving card IDs.
    if (state.phase === 'dealt' && handNumber > lastAnimatedHand) {
      lastAnimatedHandRef.current = handNumber;
      setVisualCardCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
      setDealVisualPhase('shuffling');
    }
  }, [handNumber, state.phase]);

  const phaseLabel = {
    setup: 'SETTING TABLE',
    dealt: 'CARDS DEALT',
    bidding: 'BIDDING',
    playing: 'PLAYING',
    resolving: 'TRICK COMPLETE',
    round_over: 'HAND COMPLETE',
  }[state.phase] || String(state.phase || 'WAITING').toUpperCase();

  const displayPhaseLabel =
    dealVisualPhase === 'shuffling'
      ? 'SHUFFLING'
      : dealVisualPhase === 'dealing'
        ? 'DEALING'
        : phaseLabel;

  const playerAt = (seat) => players.find((player) => player.seatNumber === seat);

  const trickScale = tableSize?.scale || 1;
  const trickZoneWidth = Math.min(
    420,
    Math.max(300, Math.round((tableSize?.width || 900) * 0.38)),
  );
  const trickZoneHeight = Math.min(
    300,
    Math.max(220, Math.round((tableSize?.height || 420) * 0.72)),
  );
  const trickCardWidth = Math.round(64 * trickScale);
  const trickCardHeight = Math.round(96 * trickScale);

  const trickCardPosition = (seatNumber, index) => {
    const centeredLeft = Math.round((trickZoneWidth - trickCardWidth) / 2);
    const centeredTop = Math.round((trickZoneHeight - trickCardHeight) / 2);
    const edge = Math.max(8, Math.round(12 * trickScale));

    const bySeat = {
      1: {
        left: centeredLeft,
        top: trickZoneHeight - trickCardHeight - edge,
      },
      2: {
        left: edge,
        top: centeredTop,
      },
      3: {
        left: centeredLeft,
        top: edge,
      },
      4: {
        left: trickZoneWidth - trickCardWidth - edge,
        top: centeredTop,
      },
    };

    return bySeat[seatNumber] || {
      left: centeredLeft + index * 5,
      top: centeredTop + index * 5,
    };
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col px-8 pb-5 pt-4">
      <div className="flex shrink-0 items-center justify-between gap-6 px-2 pb-3">
        <div>
          <div
            className="text-[9px] uppercase tracking-[0.2em] text-[#BC13FE]"
            style={PS2}
          >
            TEXASNOMAD SPADES
          </div>
          <div className="mt-1 text-sm text-white/30">
            Hand {state.handNumber || 0} · {displayPhaseLabel}
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <div className="min-w-[190px] rounded-lg border border-[#BC13FE]/20 bg-[#BC13FE]/[0.035] px-4 py-2.5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div
                  className="text-[6px] uppercase tracking-[0.14em] text-white/25"
                  style={PS2}
                >
                  {state.team1Name || 'Team 1'}
                </div>
                <div className="mt-1 text-xs text-white/30">
                  Bid {state.bid1 ?? '-'} · Books {state.books1 || 0}
                </div>
              </div>
              <div className="text-3xl leading-none text-[#BC13FE]">
                {state.score1 || 0}
              </div>
            </div>
          </div>

          <div className="min-w-[190px] rounded-lg border border-[#FF5F1F]/20 bg-[#FF5F1F]/[0.035] px-4 py-2.5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div
                  className="text-[6px] uppercase tracking-[0.14em] text-white/25"
                  style={PS2}
                >
                  {state.team2Name || 'Team 2'}
                </div>
                <div className="mt-1 text-xs text-white/30">
                  Bid {state.bid2 ?? '-'} · Books {state.books2 || 0}
                </div>
              </div>
              <div className="text-3xl leading-none text-[#FF5F1F]">
                {state.score2 || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={playAreaRef} className="relative min-h-0 flex-1">
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: tableSize ? `${tableSize.width}px` : '62%',
            height: tableSize ? `${tableSize.height}px` : '92%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="absolute inset-0 rounded-[42px] border-[9px] border-[#6b3518]"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255,151,45,.78) 0%, rgba(222,92,18,.70) 48%, rgba(126,42,4,.82) 100%)',
              boxShadow:
                'inset 0 0 110px rgba(72,20,0,.62), inset 0 0 34px rgba(255,206,104,.14), 0 22px 60px rgba(0,0,0,.46), 0 0 70px rgba(255,104,0,.12)',
            }}
          >
            <div
              className="absolute inset-[14px] rounded-[34px] border border-white/[0.07]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,235,172,.11) 0%, rgba(255,170,70,.025) 46%, rgba(54,10,0,.22) 100%)',
              }}
            />

            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
              style={{
                width: 'clamp(110px, 22%, 225px)',
                aspectRatio: '1 / 1',
                opacity: trick.length > 0 ? 0.16 : 0.30,
                filter: 'drop-shadow(0 0 24px rgba(255,214,110,.12))',
              }}
            >
              <img
                src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png"
                alt=""
                className="h-full w-full object-contain"
              />
            </div>

            <SpadesSeat seat={3} player={playerAt(3)} state={state} position="top" scale={tableSize?.scale || 1} visualCardCount={visualCardCounts?.[3] ?? null} />
            <SpadesSeat seat={2} player={playerAt(2)} state={state} position="left" scale={tableSize?.scale || 1} visualCardCount={visualCardCounts?.[2] ?? null} />
            <SpadesSeat seat={4} player={playerAt(4)} state={state} position="right" scale={tableSize?.scale || 1} visualCardCount={visualCardCounts?.[4] ?? null} />
            <SpadesSeat seat={1} player={playerAt(1)} state={state} position="bottom" scale={tableSize?.scale || 1} visualCardCount={visualCardCounts?.[1] ?? null} />

            <div
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: trick.length > 0 ? trickZoneWidth : 300,
                height: trick.length > 0 ? trickZoneHeight : 230,
              }}
            >
              {dealVisualPhase === 'shuffling' ? (
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `scale(${tableSize?.scale || 1})`,
                    transformOrigin: 'center',
                  }}
                >
                  <SpadesShuffleAnimation
                    phase="shuffling"
                    onComplete={() => setDealVisualPhase('dealing')}
                  />
                </div>
              ) : dealVisualPhase === 'dealing' ? (
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `scale(${tableSize?.scale || 1})`,
                    transformOrigin: 'center',
                  }}
                >
                  <SpadesDealAnimation
                    dealSequence={publicDealSequence}
                    seatedPlayers={players}
                    dealStartSeat={state.dealStartSeat || state.currentBidderSeat || state.currentTurnSeat || 1}
                    mySeatNumber={null}
                    onCardDealt={(seatNumber) => {
                      setVisualCardCounts((current) => ({
                        ...(current || { 1: 0, 2: 0, 3: 0, 4: 0 }),
                        [seatNumber]: Math.min(13, (current?.[seatNumber] || 0) + 1),
                      }));
                    }}
                    onComplete={() => {
                      setDealVisualPhase('idle');
                      setVisualCardCounts(null);
                    }}
                  />
                </div>
              ) : trick.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-end pb-3 text-center">
                  <div
                    className="text-[8px] uppercase tracking-[0.18em] text-white/40"
                    style={PS2}
                  >
                    {state.phase === 'dealt' ? 'CARDS DEALT' : displayPhaseLabel}
                  </div>
                  {state.phase === 'dealt' && (
                    <div className="mt-2 text-sm text-[#FFD7A0]/70">
                      Waiting for bidding
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative h-full w-full">
                  {trick.map((play, index) => {
                    const pos = trickCardPosition(play.seatNumber, index);

                    return (
                      <div
                        key={play.card?.id || index}
                        className="absolute"
                        style={{
                          left: pos.left,
                          top: pos.top,
                          width: trickCardWidth,
                          height: trickCardHeight,
                          filter: 'drop-shadow(0 10px 18px rgba(0,0,0,.55))',
                        }}
                      >
                        <img
                          src={getCardImage(play.card)}
                          alt=""
                          className="h-full w-full rounded-md object-contain"
                        />
                        <div
                          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[5px] text-white/45"
                          style={PS2}
                        >
                          S{play.seatNumber}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
          <div
            className="text-[6px] uppercase tracking-[0.16em] text-white/18"
            style={PS2}
          >
            {dealVisualPhase === 'shuffling'
              ? 'SHUFFLING DECK'
              : dealVisualPhase === 'dealing'
                ? 'DEALING CARDS'
                : state.phase === 'setup'
                  ? 'SET THE TABLE · THEN SHUFFLE & DEAL'
                  : state.phase === 'round_over'
                    ? `HAND COMPLETE · ${state.books1 || 0}–${state.books2 || 0} BOOKS`
                    : state.spadesBroken
                      ? 'SPADES BROKEN'
                      : 'SPADES NOT BROKEN'}
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
