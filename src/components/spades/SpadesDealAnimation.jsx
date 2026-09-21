import React, { useEffect, useRef, useState } from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const CARD_WIDTH = 54;
const CARD_HEIGHT = 76;
const CARD_FLIGHT_MS = 285;
const DEAL_INTERVAL_MS = 102;
const INITIAL_DELAY_MS = 220;
const FINISH_DELAY_MS = 180;

let sharedAudioContext = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSeatPosition(seatNumber, viewerSeat) {
  if (!viewerSeat) {
    return { 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' }[seatNumber] || 'bottom';
  }

  const rotation = {
    1: { 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' },
    2: { 2: 'bottom', 3: 'left', 4: 'top', 1: 'right' },
    3: { 3: 'bottom', 4: 'left', 1: 'top', 2: 'right' },
    4: { 4: 'bottom', 1: 'left', 2: 'top', 3: 'right' },
  };

  return rotation[viewerSeat]?.[seatNumber] || 'bottom';
}

function createFlightGeometry(position, bounds, dealRound, index) {
  const width = bounds.width || 224;
  const height = bounds.height || 224;
  const horizontal = clamp(width * 0.94, 150, 280);
  const vertical = clamp(height * 1.03, 150, 260);

  const lane = (dealRound - 6) * 1.15;
  const wobble = index % 2 === 0 ? -1 : 1;

  let x = 0;
  let y = 0;
  let rotation = 0;

  if (position === 'top') {
    x = lane;
    y = -vertical;
    rotation = wobble * 3.5;
  } else if (position === 'bottom') {
    x = lane;
    y = vertical;
    rotation = wobble * -3.5;
  } else if (position === 'left') {
    x = -horizontal;
    y = lane;
    rotation = -8 + wobble * 2;
  } else {
    x = horizontal;
    y = lane;
    rotation = 8 + wobble * 2;
  }

  const distance = Math.hypot(x, y) || 1;
  const perpendicularX = -y / distance;
  const perpendicularY = x / distance;
  const curve = 28 * wobble;

  const peelX = x * 0.08 + perpendicularX * 7 * wobble;
  const peelY = y * 0.06 - 13;
  const midX = x * 0.56 + perpendicularX * curve;
  const midY = y * 0.54 + perpendicularY * curve - 22;
  const overshootX = x * 1.018;
  const overshootY = y * 1.018;

  return {
    x,
    y,
    rotation,
    peelX,
    peelY,
    peelRotation: rotation * 0.18,
    midX,
    midY,
    midRotation: rotation * 0.62,
    overshootX,
    overshootY,
  };
}

function getAudioContext() {
  try {
    if (!sharedAudioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      sharedAudioContext = new AudioContextClass();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function playDealFlick(index) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  try {
    const duration = 0.026;
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      const envelope = 1 - (i / frameCount);
      data[i] = (Math.random() * 2 - 1) * envelope * envelope;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.value = 1650 + ((index % 5) * 85);
    filter.Q.value = 0.8;

    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration);
  } catch {
    // Audio is presentation-only. Ignore browser/audio-policy failures.
  }
}

export default function SpadesDealAnimation({
  dealSequence,
  seatedPlayers,
  dealStartSeat,
  mySeatNumber,
  onCardDealt,
  onComplete,
}) {
  const rootRef = useRef(null);
  const boundsRef = useRef({ width: 224, height: 224 });
  const timersRef = useRef(new Set());
  const onCardDealtRef = useRef(onCardDealt);
  const onCompleteRef = useRef(onComplete);

  const [activeFlights, setActiveFlights] = useState([]);
  const [deckCount, setDeckCount] = useState(dealSequence?.length || 0);
  const [dealtCount, setDealtCount] = useState(0);

  useEffect(() => {
    onCardDealtRef.current = onCardDealt;
  }, [onCardDealt]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const measure = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width && rect.height) {
        boundsRef.current = {
          width: rect.width,
          height: rect.height,
        };
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const seatedSorted = [...(seatedPlayers || [])]
      .filter((player) => player.seatNumber != null)
      .sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));

    if (!dealSequence?.length || seatedSorted.length === 0) {
      onCompleteRef.current?.();
      return undefined;
    }

    const startIndex = dealStartSeat != null
      ? Math.max(
          0,
          seatedSorted.findIndex(
            (player) => Number(player.seatNumber) === Number(dealStartSeat),
          ),
        )
      : 0;

    const orderedSeats = startIndex > 0
      ? [...seatedSorted.slice(startIndex), ...seatedSorted.slice(0, startIndex)]
      : seatedSorted;

    let cancelled = false;
    let nextIndex = 0;

    setActiveFlights([]);
    setDeckCount(dealSequence.length);
    setDealtCount(0);

    const schedule = (callback, delay) => {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        if (!cancelled) callback();
      }, delay);
      timersRef.current.add(timer);
      return timer;
    };

    const launchNext = () => {
      if (cancelled || nextIndex >= dealSequence.length) return;

      const index = nextIndex;
      nextIndex += 1;

      const player = orderedSeats[index % orderedSeats.length];
      const seatNumber = Number(player.seatNumber);
      const card = dealSequence[index];
      const position = getSeatPosition(seatNumber, mySeatNumber);
      const dealRound = Math.floor(index / orderedSeats.length);
      const geometry = createFlightGeometry(
        position,
        boundsRef.current,
        dealRound,
        index,
      );

      const flight = {
        id: `deal-${index}-${seatNumber}`,
        index,
        card,
        seatNumber,
        position,
        geometry,
      };

      playDealFlick(index);
      setDeckCount(Math.max(0, dealSequence.length - index - 1));
      setActiveFlights((current) => [...current, flight]);

      schedule(() => {
        setActiveFlights((current) => current.filter((item) => item.id !== flight.id));
        setDealtCount(index + 1);
        onCardDealtRef.current?.(seatNumber, card, index);

        if (index === dealSequence.length - 1) {
          schedule(() => onCompleteRef.current?.(), FINISH_DELAY_MS);
        }
      }, CARD_FLIGHT_MS);

      if (nextIndex < dealSequence.length) {
        schedule(launchNext, DEAL_INTERVAL_MS);
      }
    };

    schedule(launchNext, INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []); // Run once per mounted deal; polling rerenders must not restart the animation.

  const stackLayers = deckCount <= 0
    ? 0
    : Math.max(1, Math.min(7, Math.ceil(deckCount / 8)));

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
      style={{ zIndex: 40 }}
    >
      <div
        className="absolute rounded-full tng-deal-glow"
        style={{
          width: 118,
          height: 104,
          background:
            'radial-gradient(ellipse, rgba(188,19,254,.22) 0%, rgba(255,95,31,.10) 42%, transparent 72%)',
          filter: 'blur(8px)',
        }}
      />

      <div
        className="relative tng-deal-deck"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          opacity: stackLayers > 0 ? 1 : 0,
          transition: 'opacity 180ms ease, transform 180ms ease',
        }}
      >
        {Array.from({ length: stackLayers }, (_, offset) => {
          const normalized = stackLayers <= 1 ? 0 : offset / (stackLayers - 1);
          return (
            <div
              key={offset}
              className="absolute overflow-hidden rounded-[6px]"
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                left: offset * 1.15,
                top: offset * -1.05,
                opacity: 0.56 + normalized * 0.44,
                zIndex: offset + 1,
                boxShadow:
                  offset === stackLayers - 1
                    ? '0 12px 26px rgba(0,0,0,.48), 0 0 24px rgba(188,19,254,.10)'
                    : '0 3px 9px rgba(0,0,0,.26)',
              }}
            >
              <img
                src={getCardBack()}
                alt=""
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
          );
        })}
      </div>

      {activeFlights.map((flight) => {
        const g = flight.geometry;

        return (
          <div
            key={flight.id}
            className="absolute left-1/2 top-1/2 tng-deal-flight overflow-hidden rounded-[6px]"
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              marginLeft: -CARD_WIDTH / 2,
              marginTop: -CARD_HEIGHT / 2,
              zIndex: 60 + flight.index,
              '--deal-peel-x': `${g.peelX}px`,
              '--deal-peel-y': `${g.peelY}px`,
              '--deal-peel-r': `${g.peelRotation}deg`,
              '--deal-mid-x': `${g.midX}px`,
              '--deal-mid-y': `${g.midY}px`,
              '--deal-mid-r': `${g.midRotation}deg`,
              '--deal-x': `${g.x}px`,
              '--deal-y': `${g.y}px`,
              '--deal-r': `${g.rotation}deg`,
              '--deal-over-x': `${g.overshootX}px`,
              '--deal-over-y': `${g.overshootY}px`,
              animationDuration: `${CARD_FLIGHT_MS}ms`,
            }}
          >
            <img
              src={getCardBack()}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
        );
      })}

      <div
        className="absolute left-1/2 whitespace-nowrap"
        style={{
          bottom: -44,
          transform: 'translateX(-50%)',
        }}
      >
        <div
          className="text-[6px] uppercase tracking-[0.18em] text-[#FFD700]/55"
          style={PS2}
        >
          DEALING · {Math.min(dealtCount, dealSequence?.length || 0)}/{dealSequence?.length || 0}
        </div>
      </div>

      <style>{`
        .tng-deal-flight,
        .tng-deal-deck,
        .tng-deal-glow {
          will-change: transform, opacity;
          backface-visibility: hidden;
          transform-style: preserve-3d;
        }

        .tng-deal-flight {
          animation-name: tng-deal-flight;
          animation-timing-function: cubic-bezier(.18,.72,.22,1);
          animation-fill-mode: both;
          filter: drop-shadow(0 12px 15px rgba(0,0,0,.46));
        }

        .tng-deal-deck {
          animation: tng-deal-deck-breathe 420ms ease-in-out infinite alternate;
        }

        .tng-deal-glow {
          animation: tng-deal-glow 900ms ease-in-out infinite alternate;
        }

        @keyframes tng-deal-flight {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg) scale(.94);
            filter: drop-shadow(0 5px 7px rgba(0,0,0,.30)) brightness(.96);
          }
          8% {
            opacity: 1;
          }
          18% {
            opacity: 1;
            transform:
              translate3d(var(--deal-peel-x), var(--deal-peel-y), 0)
              rotate(var(--deal-peel-r))
              scale(1.055);
            filter: drop-shadow(0 16px 18px rgba(0,0,0,.46)) brightness(1.06);
          }
          62% {
            opacity: 1;
            transform:
              translate3d(var(--deal-mid-x), var(--deal-mid-y), 0)
              rotate(var(--deal-mid-r))
              scale(1.035);
            filter: drop-shadow(0 20px 20px rgba(0,0,0,.48)) brightness(1.08);
          }
          88% {
            opacity: 1;
            transform:
              translate3d(var(--deal-over-x), var(--deal-over-y), 0)
              rotate(var(--deal-r))
              scale(1.01);
            filter: drop-shadow(0 9px 11px rgba(0,0,0,.38)) brightness(1.02);
          }
          96% {
            opacity: 1;
            transform:
              translate3d(var(--deal-x), var(--deal-y), 0)
              rotate(var(--deal-r))
              scale(.975);
            filter: drop-shadow(0 3px 5px rgba(0,0,0,.30)) brightness(1);
          }
          100% {
            opacity: 0;
            transform:
              translate3d(var(--deal-x), var(--deal-y), 0)
              rotate(var(--deal-r))
              scale(.96);
            filter: drop-shadow(0 2px 3px rgba(0,0,0,.22)) brightness(1);
          }
        }

        @keyframes tng-deal-deck-breathe {
          from {
            transform: translate3d(-1px, 0, 0) rotate(-.35deg);
          }
          to {
            transform: translate3d(1px, -1px, 0) rotate(.35deg);
          }
        }

        @keyframes tng-deal-glow {
          from {
            opacity: .26;
            transform: scale(.90);
          }
          to {
            opacity: .62;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tng-deal-flight {
            animation-timing-function: linear;
          }

          .tng-deal-deck,
          .tng-deal-glow {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
