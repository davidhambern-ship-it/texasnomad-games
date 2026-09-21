import React, { useEffect, useMemo, useRef, useState } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function WordSearchTurnEffects({
  mode,
  phase,
  paused,
  activeSeat,
  players = [],
  viewerSeat,
  timeRemaining,
}) {
  const [showTurnSplash, setShowTurnSplash] = useState(false);
  const timerRef = useRef(null);

  const activePlayer = useMemo(
    () => players.find((player) => Number(player.seatNumber) === Number(activeSeat)) || null,
    [activeSeat, players],
  );

  const activeColor = activePlayer?.color || '#FFD700';
  const isViewerTurn = Number(viewerSeat) === Number(activeSeat);
  const countdown = Math.max(0, Math.ceil(Number(timeRemaining || 0) / 1000));
  const showCountdown =
    mode === 'turn' &&
    phase === 'playing' &&
    !paused &&
    Number(activeSeat) > 0 &&
    countdown >= 1 &&
    countdown <= 5;

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (
      mode !== 'turn' ||
      phase !== 'playing' ||
      paused ||
      !Number(activeSeat)
    ) {
      setShowTurnSplash(false);
      return undefined;
    }

    setShowTurnSplash(true);
    timerRef.current = window.setTimeout(() => {
      setShowTurnSplash(false);
    }, 1450);

    return () => clearTimeout(timerRef.current);
  }, [activeSeat, mode, paused, phase]);

  if (mode !== 'turn' || phase !== 'playing') return null;

  const turnName = isViewerTurn
    ? 'YOUR TURN'
    : `${String(activePlayer?.name || `SEAT ${activeSeat}`).toUpperCase()}'S TURN`;

  return (
    <>
      <style>{`
        @keyframes ws-turn-enter {
          0% { opacity: 0; transform: translateY(-18px) scale(.88); }
          18% { opacity: 1; transform: translateY(0) scale(1.05); }
          72% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(.97); }
        }

        @keyframes ws-count-pop {
          0% { transform: scale(.72); opacity: .25; }
          35% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes ws-count-ring {
          0% { transform: scale(.78); opacity: .9; }
          100% { transform: scale(1.55); opacity: 0; }
        }

        @keyframes ws-count-warn {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.45); }
        }

        @keyframes ws-active-card-pulse {
          0%, 100% { box-shadow: 0 0 8px var(--ws-active-color, #FFD700)22; }
          50% { box-shadow: 0 0 20px var(--ws-active-color, #FFD700)66; }
        }

        .ws-active-turn-card {
          animation: ws-active-card-pulse 1.15s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .ws-turn-splash,
          .ws-count-number,
          .ws-count-ring,
          .ws-count-shell,
          .ws-active-turn-card {
            animation: none !important;
          }
        }
      `}</style>

      {showTurnSplash && (
        <div
          className="ws-turn-splash pointer-events-none fixed left-1/2 top-[72px] z-[90] -translate-x-1/2"
          style={{ animation: 'ws-turn-enter 1.45s ease-out forwards' }}
          aria-live="polite"
        >
          <div
            className="rounded-2xl border-2 bg-[#070311]/94 px-7 py-4 text-center backdrop-blur-md"
            style={{
              borderColor: activeColor,
              boxShadow: `0 0 34px ${activeColor}66, inset 0 0 22px ${activeColor}16`,
            }}
          >
            <div
              className="text-[7px] tracking-[0.28em] text-white/45 uppercase"
              style={PS2}
            >
              NEXT PLAYER
            </div>
            <div
              className="mt-2 whitespace-nowrap text-sm sm:text-lg tracking-widest"
              style={{
                ...PS2,
                color: activeColor,
                textShadow: `0 0 14px ${activeColor}`,
              }}
            >
              {turnName}
            </div>
            <div className="mt-2 text-[9px] text-white/45">
              Seat {activeSeat} · 60 seconds
            </div>
          </div>
        </div>
      )}

      {showCountdown && (
        <div
          className="pointer-events-none fixed bottom-5 right-5 z-[95] sm:bottom-7 sm:right-7"
          aria-live="assertive"
        >
          <div
            className="ws-count-shell relative flex h-[92px] w-[92px] items-center justify-center rounded-full border-2 bg-[#070311]/94 backdrop-blur-md sm:h-[108px] sm:w-[108px]"
            style={{
              borderColor: activeColor,
              boxShadow: `0 0 30px ${activeColor}77, inset 0 0 22px ${activeColor}24`,
              animation: 'ws-count-warn .72s ease-in-out infinite',
            }}
          >
            <div
              key={`ring-${countdown}`}
              className="ws-count-ring absolute inset-0 rounded-full border-2"
              style={{
                borderColor: activeColor,
                animation: 'ws-count-ring .95s ease-out forwards',
              }}
            />

            <div className="relative text-center">
              <div
                key={countdown}
                className="ws-count-number text-4xl sm:text-5xl"
                style={{
                  ...PS2,
                  color: activeColor,
                  textShadow: `0 0 18px ${activeColor}`,
                  animation: 'ws-count-pop .32s ease-out',
                }}
              >
                {countdown}
              </div>
              <div
                className="mt-1 text-[5px] sm:text-[6px] tracking-widest text-white/55 uppercase"
                style={PS2}
              >
                SECONDS
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
