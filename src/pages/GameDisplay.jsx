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
import { SquareBizBoard, SquareBizCueCard, SquareBizIntro, SquareBizShowStyles } from '@/components/square-biz/SquareBizShow';
import { DisplayNotificationStack } from '@/components/social/TngNotificationToaster';
import BFFTngBoard from '@/components/bff/BFFTngBoard.jsx';
import { useBffVoiceRelay } from '@/lib/useBffVoiceRelay';
import { armBffSoundUnlock, playBffSound, preloadBffSounds } from '@/lib/bffSound';
import NeonWordSearchBoard from '@/components/word-search/NeonWordSearchBoard';

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


function SquareBizDisplay({ room }) {
  const state = room.state || {};
  const [clock, setClock] = useState(Date.now());
  const phase = state.phase || 'lobby';

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05020a]">
      <SquareBizShowStyles />

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 12% 16%, rgba(159,69,255,.18), transparent 24%), radial-gradient(circle at 86% 72%, rgba(255,21,147,.15), transparent 26%), radial-gradient(circle at 58% 46%, rgba(255,120,31,.08), transparent 42%)',
        }}
      />

      {phase === 'lobby' ? (
        <div className="relative z-10 flex h-full items-center justify-center px-8 text-center">
          <div className="w-full max-w-[1120px]">
            <div className="text-[9px] uppercase tracking-[.34em] text-[#ffd633]/65" style={PS2}>
              ROOM {room.roomCode} · STAND BY
            </div>
            <div className="mt-3">
              <SquareBizBoard
                gameState={{ ...state, canSelectSquare: false }}
                interactive={false}
                hostLabel="SHOW HOST"
              />
            </div>
            <div className="mt-4 text-lg font-semibold text-white/45">
              Contestants are connecting. The Host starts the show.
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-10">
          <div className={`absolute inset-5 flex min-h-0 min-w-0 items-center justify-center transition-all duration-300 ${['question_read','answering','result'].includes(phase) ? 'scale-[.985] blur-[2px] brightness-50' : ''}`}>
            <SquareBizBoard
              gameState={{ ...state, canSelectSquare: false }}
              interactive={false}
              hostLabel="SHOW HOST"
            />
          </div>

          <SquareBizCueCard
            gameState={{ ...state, canAnswer: false }}
            now={clock}
            busy
          />

          {phase === 'finished' && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#05020a]/32">
              <div
                className="sb-result-pop rounded-[34px] border-2 bg-[#0b0414]/92 px-12 py-8 text-center backdrop-blur-lg"
                style={{
                  borderColor: state.winner === 'X' ? '#ff1593' : '#25b9ff',
                  boxShadow: `0 0 70px ${state.winner === 'X' ? 'rgba(255,21,147,.30)' : 'rgba(37,185,255,.30)'}`,
                }}
              >
                <div className="text-[8px] uppercase tracking-[.3em] text-[#ffd633]" style={PS2}>
                  ROUND {state.roundNumber}
                </div>
                <div
                  className="mt-4 text-[clamp(4rem,9vw,8rem)] font-black uppercase leading-[.86]"
                  style={{
                    fontFamily: 'Impact, sans-serif',
                    color: state.winner === 'X' ? '#ff1593' : '#25b9ff',
                    textShadow: '0 0 30px currentColor',
                  }}
                >
                  PLAYER {state.winner}<br />TAKES THE BIZ!
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'intro' && (
        <SquareBizIntro gameState={state} now={clock} playAudio />
      )}

      {phase !== 'intro' && (
        <div className="pointer-events-none absolute right-4 top-4 z-40 rounded-full border border-white/10 bg-[#0b0414]/75 px-3 py-2 text-[6px] uppercase tracking-widest text-white/30" style={PS2}>
          ROOM {room.roomCode}
        </div>
      )}
    </div>
  );
}


function BFFDysfunctionDisplay({ gameState }) {
  const dysfunction = gameState.dysfunction || {};
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const byId = Object.fromEntries(
    players.map((player) => [String(player.playerId), player]),
  );
  const assignments = dysfunction.side_assignments || {};
  const sideA = Object.entries(assignments)
    .filter(([, side]) => side === 'A')
    .map(([id]) => byId[id])
    .filter(Boolean);
  const sideB = Object.entries(assignments)
    .filter(([, side]) => side === 'B')
    .map(([id]) => byId[id])
    .filter(Boolean);
  const defensePlayer = byId[String(dysfunction.defense_player_id || '')] || null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const defenseSeconds = gameState.answer_deadline_at
    ? Math.max(0, Math.ceil((Number(gameState.answer_deadline_at) - now) / 1000))
    : null;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#07030d] p-5 sm:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(188,19,254,.22), transparent 28%), radial-gradient(circle at 80% 20%, rgba(255,95,31,.18), transparent 28%), radial-gradient(circle at 50% 85%, rgba(255,215,0,.08), transparent 35%)',
        }}
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="text-[8px] uppercase tracking-[.28em] text-[#F472B6]" style={PS2}>
            BFF FINALE
          </div>
          <div className="mt-2 font-heading text-4xl uppercase text-white sm:text-6xl">
            FAMILY <span className="text-[#FFD700]">DYSFUNCTION</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/5 px-5 py-3 text-center">
          <div className="text-[6px] uppercase tracking-[.18em] text-[#FFD700]/60" style={PS2}>
            PROMPT
          </div>
          <div className="mt-1 font-heading text-3xl text-[#FFD700]">
            {Number(dysfunction.prompt_number) || 1}/5
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid min-h-0 flex-1 grid-cols-[1fr_minmax(280px,1.4fr)_1fr] gap-4">
        <div className="flex min-h-0 flex-col rounded-3xl border border-[#BC13FE]/35 bg-[#BC13FE]/[.06] p-4">
          <div className="text-center text-[7px] uppercase tracking-[.2em] text-[#BC13FE]" style={PS2}>
            SIDE A
          </div>
          <div className="mt-2 text-center font-heading text-5xl text-white">
            {Number(dysfunction.scoreA) || 0}
          </div>
          <div className="mt-4 space-y-2">
            {sideA.map((player) => (
              <div key={player.playerId} className="rounded-xl border border-[#BC13FE]/20 bg-black/30 px-3 py-3 text-center text-lg font-bold">
                {player.playerName || player.name || 'Player'}
              </div>
            ))}
          </div>
          {Number(dysfunction.last_pointsA) === 3 && dysfunction.votes_revealed && (
            <div className="mt-auto pt-4 text-center font-heading text-3xl text-[#FFD700]">
              DYSFUNCTION!
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/45 p-6 text-center">
          <div className="text-[7px] uppercase tracking-[.2em] text-white/30" style={PS2}>
            {gameState.round_stage === 'dysfunction_defense'
              ? 'THE DEFENSE'
              : dysfunction.votes_revealed
                ? 'VOTES REVEALED'
                : 'SECRET VOTE'}
          </div>

          <div className="mt-5 font-heading text-3xl leading-tight text-white sm:text-5xl">
            {dysfunction.prompt || 'Waiting for the next dysfunctional family prompt…'}
          </div>

          {gameState.round_stage === 'dysfunction_vote' && (
            <div className="mt-6 rounded-full border border-white/10 bg-white/[.03] px-5 py-2 text-sm text-white/40">
              Everybody is voting privately…
            </div>
          )}

          {gameState.round_stage === 'dysfunction_defense' && defensePlayer && (
            <div className="mt-7 rounded-2xl border border-[#FFD700]/40 bg-[#FFD700]/10 px-8 py-5">
              <div className="text-[7px] uppercase tracking-[.18em] text-[#FFD700]/65" style={PS2}>
                DEFEND YOURSELF
              </div>
              <div className="mt-2 font-heading text-4xl text-[#FFD700]">
                {defensePlayer.playerName || defensePlayer.name}
              </div>
              <div className="mt-2 font-heading text-5xl text-white">
                {defenseSeconds ?? 10}s
              </div>
            </div>
          )}

          {gameState.round_stage === 'dysfunction_complete' && (
            <div className="mt-7 font-heading text-4xl text-[#FFD700]">
              FAMILY DYSFUNCTION COMPLETE
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col rounded-3xl border border-[#FF5F1F]/35 bg-[#FF5F1F]/[.06] p-4">
          <div className="text-center text-[7px] uppercase tracking-[.2em] text-[#FF5F1F]" style={PS2}>
            SIDE B
          </div>
          <div className="mt-2 text-center font-heading text-5xl text-white">
            {Number(dysfunction.scoreB) || 0}
          </div>
          <div className="mt-4 space-y-2">
            {sideB.map((player) => (
              <div key={player.playerId} className="rounded-xl border border-[#FF5F1F]/20 bg-black/30 px-3 py-3 text-center text-lg font-bold">
                {player.playerName || player.name || 'Player'}
              </div>
            ))}
          </div>
          {Number(dysfunction.last_pointsB) === 3 && dysfunction.votes_revealed && (
            <div className="mt-auto pt-4 text-center font-heading text-3xl text-[#FFD700]">
              DYSFUNCTION!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BFFDisplay({ room, displayId }) {
  const [liveRoom, setLiveRoom] = useState(null);
  const [error, setError] = useState('');
  const lastSoundCueRef = useRef(null);
  const roomCode = room?.roomCode || '';

  useBffVoiceRelay({
    roomCode,
    role: 'display',
    identity: displayId,
    shouldSend: false,
    autoStart: Boolean(roomCode && displayId),
  });

  useEffect(() => {
    preloadBffSounds();
    armBffSoundUnlock();
  }, []);

  useEffect(() => {
    if (!roomCode) return undefined;

    let cancelled = false;

    async function refreshBffDisplay() {
      try {
        const payload = await tngApi.bff.getDisplayState(roomCode);
        if (cancelled) return;
        setLiveRoom(payload.room || null);
        setError('');
      } catch (displayError) {
        if (cancelled) return;
        setError(displayError?.message || 'BFF display state could not be loaded.');
      }
    }

    refreshBffDisplay();
    const interval = window.setInterval(refreshBffDisplay, 500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [roomCode]);

  const gameState = liveRoom?.gameState || {};
  const soundCue = gameState.sound_cue;

  useEffect(() => {
    if (!soundCue?.at || soundCue.at === lastSoundCueRef.current) return;

    const age = Date.now() - Number(soundCue.at);
    lastSoundCueRef.current = soundCue.at;
    if (!Number.isFinite(age) || age > 8000) return;

    playBffSound(String(soundCue.name || ''));
  }, [soundCue]);

  if (error && !liveRoom) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <div className="font-heading text-4xl text-red-400">BFF DISPLAY ERROR</div>
          <div className="mt-4 text-white/40">{error}</div>
        </div>
      </div>
    );
  }

  if (!liveRoom) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <Loader2 className="mx-auto h-14 w-14 animate-spin text-[#BC13FE]" />
          <div className="mt-5 text-[8px] uppercase tracking-[.2em] text-white/35" style={PS2}>
            LOADING BFF LIVE BOARD
          </div>
        </div>
      </div>
    );
  }

  if (String(gameState.round_stage || '').startsWith('dysfunction')) {
    return <BFFDysfunctionDisplay gameState={gameState} />;
  }

  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const activePlayer = players.find(
    (player) => String(player.playerId) === String(gameState.active_player_id || ''),
  );
  const stageLabel = {
    setup: 'GAME SETUP',
    faceoff_setup: 'SELECT FACEOFF PLAYERS',
    faceoff_ready: 'FACEOFF READY',
    faceoff_buzz: 'FACEOFF · BUZZERS LIVE',
    faceoff_answer: 'FACEOFF · ANSWERING',
    play_pass: 'PLAY OR PASS',
    family_play: 'FAMILY PLAY',
    steal_ready: 'STEAL READY',
    steal_buzz: 'STEAL · BUZZERS LIVE',
    steal_answer: 'STEAL ANSWER',
    round_complete: 'ROUND COMPLETE',
    match_tie: 'MATCH TIED',
    match_complete: 'REGULAR GAME COMPLETE',
  }[gameState.round_stage] || String(gameState.round_stage || 'BFF').replaceAll('_', ' ').toUpperCase();

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-3 sm:p-4">
      <div className="w-full max-w-[1800px]">
        <div className="mb-2 flex items-center justify-between gap-3 px-2">
          <div className="rounded-full border border-[#22D3EE]/25 bg-[#22D3EE]/[.06] px-4 py-2 text-[7px] uppercase tracking-[.18em] text-[#8DEEFF]" style={PS2}>
            {stageLabel}
          </div>

          {activePlayer && (
            <div className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/[.07] px-4 py-2 text-sm font-bold text-[#FFD700]">
              {activePlayer.playerName || activePlayer.name} IS UP
            </div>
          )}

          <div className="rounded-full border border-green-400/25 bg-green-400/[.05] px-4 py-2 text-[7px] uppercase tracking-[.16em] text-green-400" style={PS2}>
            AUDIO RELAY LIVE
          </div>
        </div>

        <BFFTngBoard gs={gameState} />

        {gameState.round_stage === 'match_complete' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-10 z-40 flex justify-center">
            <div className="rounded-2xl border border-[#FFD700]/45 bg-black/90 px-8 py-4 text-center shadow-[0_0_40px_rgba(255,215,0,.18)]">
              <div className="text-[7px] uppercase tracking-[.2em] text-[#FFD700]/60" style={PS2}>
                REGULAR GAME WINNER
              </div>
              <div className="mt-2 font-heading text-3xl text-[#FFD700]">
                {Number(gameState.winning_team) === 2 ? gameState.family2 : gameState.family1}
              </div>
              <div className="mt-1 text-white/35">Family Dysfunction is next.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function formatWordSearchDisplayTime(ms) {
  const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function WordSearchDisplay({ room }) {
  const state = room?.state || {};
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const phase = state.phase || 'setup';
  const mode = state.mode || 'race';
  const paused = state.paused === true;
  const players = Array.isArray(state.players) ? state.players : [];
  const words = Array.isArray(state.words) ? state.words : [];
  const grid = Array.isArray(state.grid) ? state.grid : [];
  const scores = state.scores || {};
  const activeSeat = Number(state.activeSeat || 0);
  const foundCount = words.filter((word) => word.found).length;
  const timeRemaining = state.timeEnd
    ? Math.max(0, Number(state.timeEnd) - clock)
    : 0;
  const activePlayer = players.find(
    (player) => Number(player.seatNumber) === activeSeat,
  );

  const statusLabel =
    phase === 'setup'
      ? 'WAITING FOR HOST'
      : phase === 'finished'
        ? 'GAME OVER'
        : paused
          ? 'PAUSED'
          : mode === 'race'
            ? 'RACE LIVE'
            : activePlayer
              ? `${activePlayer.name || `SEAT ${activeSeat}`} TURN`
              : `SEAT ${activeSeat} TURN`;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden px-4 pb-4 pt-3 sm:px-6">
      <div className="mb-3 grid shrink-0 grid-cols-4 gap-2">
        <div className="rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/[.06] px-3 py-3 text-center">
          <div className="text-[5px] uppercase tracking-[.18em] text-white/25" style={PS2}>
            STATUS
          </div>
          <div className="mt-2 text-[7px] uppercase tracking-[.12em] text-[#BC13FE]" style={PS2}>
            {statusLabel}
          </div>
        </div>

        <div className="rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/[.05] px-3 py-3 text-center">
          <div className="text-[5px] uppercase tracking-[.18em] text-white/25" style={PS2}>
            TIME
          </div>
          <div className="mt-2 text-xl text-[#FFD700]" style={PS2}>
            {phase === 'playing' && !paused
              ? formatWordSearchDisplayTime(timeRemaining)
              : paused
                ? 'PAUSE'
                : '--'}
          </div>
        </div>

        <div className="rounded-xl border border-green-400/25 bg-green-400/[.05] px-3 py-3 text-center">
          <div className="text-[5px] uppercase tracking-[.18em] text-white/25" style={PS2}>
            FOUND
          </div>
          <div className="mt-2 text-xl text-green-400" style={PS2}>
            {foundCount}/{words.length || 0}
          </div>
        </div>

        <div className="rounded-xl border border-[#22D3EE]/25 bg-[#22D3EE]/[.05] px-3 py-3 text-center">
          <div className="text-[5px] uppercase tracking-[.18em] text-white/25" style={PS2}>
            MODE
          </div>
          <div className="mt-2 text-[7px] uppercase tracking-[.12em] text-[#8DEEFF]" style={PS2}>
            {mode === 'turn' ? 'TURN' : 'RACE'}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <section className="flex min-h-0 items-center justify-center overflow-auto rounded-2xl border border-[#BC13FE]/20 bg-black/45 p-3">
          {grid.length ? (
            <NeonWordSearchBoard
              grid={grid}
              words={words}
              players={players}
              mySeat={null}
              myColor="#BC13FE"
              canInteract={false}
              maxBoardPx={820}
            />
          ) : (
            <div className="text-center">
              <div className="text-6xl">🔍</div>
              <div className="mt-5 text-2xl text-[#BC13FE]">
                Word Search Ready
              </div>
              <div className="mt-2 text-sm text-white/35">
                Waiting for the Host to start the board.
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-3">
          <section className="shrink-0 rounded-2xl border border-white/10 bg-black/50 p-3">
            <div className="mb-2 text-[6px] uppercase tracking-[.18em] text-white/25" style={PS2}>
              PLAYERS
            </div>

            <div className="grid grid-cols-2 gap-2">
              {players.length ? players.map((player) => {
                const seat = Number(player.seatNumber || 0);
                const active = mode === 'race'
                  ? phase === 'playing'
                  : activeSeat === seat;
                const color = player.color || '#FFFFFF';

                return (
                  <div
                    key={player.playerId || player.accountId || seat}
                    className="rounded-lg border px-3 py-2"
                    style={{
                      borderColor: active ? color : 'rgba(255,255,255,.10)',
                      background: active ? `${color}0d` : 'rgba(255,255,255,.015)',
                      boxShadow: active ? `0 0 16px ${color}22` : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/75">
                          {player.name || player.handle || `Seat ${seat}`}
                        </div>
                        <div className="mt-1 text-[5px] uppercase text-white/25" style={PS2}>
                          SEAT {seat}
                        </div>
                      </div>
                      <div className="text-xl" style={{ ...PS2, color }}>
                        {Number(scores[String(seat)] || player.score || 0)}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-2 py-4 text-center text-sm text-white/30">
                  Waiting for players…
                </div>
              )}
            </div>
          </section>

          <section className="min-h-0 flex-1 rounded-2xl border border-[#BC13FE]/20 bg-black/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[6px] uppercase tracking-[.18em] text-[#BC13FE]" style={PS2}>
                WORDS
              </div>
              <div className="text-[6px] text-[#FFD700]" style={PS2}>
                {foundCount}/{words.length}
              </div>
            </div>

            <div className="grid max-h-full grid-cols-2 gap-2 overflow-y-auto pr-1">
              {words.map((word) => {
                const finder = players.find(
                  (player) => String(player.seatNumber) === String(word.foundBy),
                );
                const color = word.revealed
                  ? '#777777'
                  : finder?.color || '#BC13FE';

                return (
                  <div
                    key={word.word}
                    className="rounded-lg border px-2 py-2 text-center"
                    style={{
                      borderColor: word.found ? `${color}70` : 'rgba(255,255,255,.08)',
                      background: word.found ? `${color}10` : 'rgba(255,255,255,.02)',
                      color: word.found ? color : 'rgba(255,255,255,.48)',
                      textDecoration: word.found ? 'line-through' : 'none',
                    }}
                  >
                    <div className="text-[7px]" style={PS2}>
                      {word.word}
                    </div>
                    {word.found && word.points != null && (
                      <div className="mt-1 text-[5px] opacity-70" style={PS2}>
                        {word.revealed ? 'REVEAL' : `+${word.points}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {phase === 'finished' && (
            <section className="shrink-0 rounded-2xl border border-green-400/30 bg-green-400/[.06] p-4 text-center">
              <div className="text-[7px] uppercase tracking-[.18em] text-green-400" style={PS2}>
                GAME OVER
              </div>
              <div className="mt-2 text-sm text-white/55">
                {state.winnerSeat
                  ? `Seat ${state.winnerSeat} wins with ${Number(scores[String(state.winnerSeat)] || 0)} points.`
                  : state.message || 'Word Search complete.'}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function GameDisplay() {
  const initial = useMemo(savedDisplay, []);
  const [code, setCode] = useState('');
  const [display, setDisplay] = useState(initial);
  const [room, setRoom] = useState(null);
  const [notifications, setNotifications] = useState([]);
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
        if (Array.isArray(payload.notifications) && payload.notifications.length > 0) {
          setNotifications((current) => {
            const seen = new Set(current.map((item) => item.id));
            const merged = [...current, ...payload.notifications.filter((item) => !seen.has(item.id))];
            return merged.slice(-3);
          });

          payload.notifications.forEach((item) => {
            window.setTimeout(() => {
              setNotifications((current) => current.filter((row) => row.id !== item.id));
            }, 7500);
          });
        }
        setError('');
      } catch (stateError) {
        if (cancelled) return;

        setError(stateError.message || 'The Game Display connection was lost.');

        if (stateError.status === 401) {
          localStorage.removeItem('tng_display_device_id');
          localStorage.removeItem('tng_display_token');
          setDisplay(null);
          setRoom(null);
          setNotifications([]);
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

  const squareBizMode = room?.gameId === 'square-biz';

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#030207] text-white">
      {!squareBizMode && <AmbientBackdrop />}
      {!squareBizMode && <DisplayHud room={room} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />}

      {error && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg border border-red-500/40 bg-black/90 px-4 py-2 text-sm text-red-400 shadow-xl">
          {error}
        </div>
      )}

      <DisplayNotificationStack notifications={notifications} />

      <div className={`relative z-10 overflow-hidden ${squareBizMode ? 'h-[100dvh]' : 'h-[calc(100dvh-4rem)]'}`}>
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
        {room?.gameId === 'square-biz' && <SquareBizDisplay room={room} />}
        {room?.gameId === 'word-search' && <WordSearchDisplay room={room} />}
        {room?.gameId === 'bff' && (
          <BFFDisplay room={room} displayId={display?.deviceId} />
        )}

        {room && !['hangman', 'spades', 'square-biz', 'word-search', 'bff'].includes(room.gameId) && (
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
