import React, { useEffect } from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SHUFFLE_MS = 2700;
const CARD_WIDTH = 58;
const CARD_HEIGHT = 82;

function Packet({ side }) {
  const direction = side === 'left' ? -1 : 1;

  return (
    <div
      className={`absolute left-1/2 top-1/2 tng-shuffle-packet tng-shuffle-${side}`}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginLeft: -CARD_WIDTH / 2,
        marginTop: -CARD_HEIGHT / 2,
        '--packet-direction': direction,
      }}
    >
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          className="absolute overflow-hidden rounded-[6px]"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            left: index * 1.2,
            top: index * -1.15,
            zIndex: index,
            boxShadow:
              index === 6
                ? '0 10px 24px rgba(0,0,0,.44)'
                : '0 3px 8px rgba(0,0,0,.24)',
          }}
        >
          <img
            src={getCardBack()}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

function RiffleCard({ index }) {
  const side = index % 2 === 0 ? -1 : 1;
  const lane = Math.floor(index / 2);
  const spread = 38 + lane * 2.5;
  const rotation = side * (8 + lane * 0.7);

  return (
    <div
      className="absolute left-1/2 top-1/2 tng-riffle-card overflow-hidden rounded-[6px]"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginLeft: -CARD_WIDTH / 2,
        marginTop: -CARD_HEIGHT / 2,
        '--riffle-x': `${side * spread}px`,
        '--riffle-r': `${rotation}deg`,
        '--riffle-delay': `${lane * 18}ms`,
        zIndex: 20 + index,
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
}

export default function SpadesShuffleAnimation({ phase, onComplete }) {
  useEffect(() => {
    if (phase !== 'shuffling') return undefined;

    const timer = window.setTimeout(() => {
      onComplete?.();
    }, SHUFFLE_MS);

    return () => window.clearTimeout(timer);
  }, [phase, onComplete]);

  if (phase !== 'shuffling') return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      <div
        className="absolute rounded-full tng-shuffle-glow"
        style={{
          width: 190,
          height: 150,
          background:
            'radial-gradient(ellipse, rgba(188,19,254,.20) 0%, rgba(255,95,31,.10) 42%, transparent 72%)',
          filter: 'blur(10px)',
        }}
      />

      <div className="relative" style={{ width: 210, height: 150 }}>
        <Packet side="left" />
        <Packet side="right" />

        {Array.from({ length: 12 }, (_, index) => (
          <RiffleCard key={index} index={index} />
        ))}

        <div
          className="absolute left-1/2 top-1/2 tng-shuffle-settled"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            marginLeft: -CARD_WIDTH / 2,
            marginTop: -CARD_HEIGHT / 2,
          }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="absolute overflow-hidden rounded-[6px]"
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                left: index * 1.15,
                top: index * -1.1,
                boxShadow:
                  index === 4
                    ? '0 12px 28px rgba(0,0,0,.5), 0 0 28px rgba(255,215,0,.12)'
                    : '0 2px 7px rgba(0,0,0,.25)',
              }}
            >
              <img
                src={getCardBack()}
                alt=""
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div
          className="text-[8px] uppercase tracking-widest text-[#FFD700]/85"
          style={PS2}
        >
          SHUFFLING...
        </div>
      </div>

      <style>{`
        .tng-shuffle-packet,
        .tng-riffle-card,
        .tng-shuffle-settled,
        .tng-shuffle-glow {
          will-change: transform, opacity;
          backface-visibility: hidden;
          transform-style: preserve-3d;
        }

        .tng-shuffle-left {
          animation: tng-shuffle-left ${SHUFFLE_MS}ms cubic-bezier(.22,.72,.24,1) both;
        }

        .tng-shuffle-right {
          animation: tng-shuffle-right ${SHUFFLE_MS}ms cubic-bezier(.22,.72,.24,1) both;
        }

        .tng-riffle-card {
          opacity: 0;
          animation: tng-riffle-card ${SHUFFLE_MS}ms cubic-bezier(.2,.7,.25,1) both;
          animation-delay: var(--riffle-delay);
        }

        .tng-shuffle-settled {
          opacity: 0;
          animation: tng-shuffle-settle ${SHUFFLE_MS}ms cubic-bezier(.2,.75,.25,1) both;
        }

        .tng-shuffle-glow {
          animation: tng-shuffle-glow ${SHUFFLE_MS}ms ease-in-out both;
        }

        @keyframes tng-shuffle-left {
          0%, 10% {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          24% {
            transform: translate3d(-52px, -5px, 0) rotate(-7deg);
          }
          40% {
            transform: translate3d(-57px, 5px, 0) rotate(-11deg);
          }
          57% {
            transform: translate3d(-35px, 12px, 0) rotate(8deg);
          }
          69% {
            transform: translate3d(-13px, 17px, 0) rotate(4deg);
          }
          80% {
            opacity: 1;
            transform: translate3d(-3px, 3px, 0) rotate(-2deg);
          }
          88%, 100% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
        }

        @keyframes tng-shuffle-right {
          0%, 10% {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          24% {
            transform: translate3d(52px, -5px, 0) rotate(7deg);
          }
          40% {
            transform: translate3d(57px, 5px, 0) rotate(11deg);
          }
          57% {
            transform: translate3d(35px, 12px, 0) rotate(-8deg);
          }
          69% {
            transform: translate3d(13px, 17px, 0) rotate(-4deg);
          }
          80% {
            opacity: 1;
            transform: translate3d(3px, 3px, 0) rotate(2deg);
          }
          88%, 100% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
        }

        @keyframes tng-riffle-card {
          0%, 34% {
            opacity: 0;
            transform: translate3d(var(--riffle-x), -4px, 0)
              rotate(var(--riffle-r)) scale(.98);
          }
          38% {
            opacity: .98;
          }
          52% {
            opacity: 1;
            transform: translate3d(calc(var(--riffle-x) * .48), 8px, 0)
              rotate(calc(var(--riffle-r) * .45)) scale(1);
          }
          67% {
            opacity: 1;
            transform: translate3d(0, 17px, 0) rotate(0deg) scale(1);
          }
          78% {
            opacity: .95;
            transform: translate3d(0, 4px, 0) rotate(0deg) scale(1);
          }
          84%, 100% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
          }
        }

        @keyframes tng-shuffle-settle {
          0%, 76% {
            opacity: 0;
            transform: translate3d(0, 7px, 0) rotate(0deg) scale(.97);
          }
          84% {
            opacity: 1;
            transform: translate3d(0, -3px, 0) rotate(-1.2deg) scale(1.02);
          }
          92% {
            opacity: 1;
            transform: translate3d(0, 1px, 0) rotate(.5deg) scale(1);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
          }
        }

        @keyframes tng-shuffle-glow {
          0%, 12% {
            opacity: .18;
            transform: scale(.85);
          }
          36%, 68% {
            opacity: .72;
            transform: scale(1.08);
          }
          100% {
            opacity: .26;
            transform: scale(.92);
          }
        }
      `}</style>
    </div>
  );
}
