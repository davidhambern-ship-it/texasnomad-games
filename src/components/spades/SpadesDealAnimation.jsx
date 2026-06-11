import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCardBack, getCardImage } from '@/lib/spadesCardImages';

// Absolute pixel offsets from center of the table container (224px wide, 224px tall = w-56 h-56)
// These point toward each seat's hand area
const SEAT_TARGETS = {
  bottom: { x: 0,    y: 160  },
  top:    { x: 0,    y: -160 },
  left:   { x: -160, y: 0   },
  right:  { x: 160,  y: 0   },
};

// Map absolute seat number to position label based on viewer seat
function getSeatPosition(seatNumber, viewerSeat) {
  if (!viewerSeat) {
    const pos = { 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' };
    return pos[seatNumber] || 'bottom';
  }
  const rotation = {
    1: { 1: 'bottom', 2: 'left',   3: 'top',    4: 'right'  },
    2: { 2: 'bottom', 3: 'left',   4: 'top',    1: 'right'  },
    3: { 3: 'bottom', 4: 'left',   1: 'top',    2: 'right'  },
    4: { 4: 'bottom', 1: 'left',   2: 'top',    3: 'right'  },
  };
  return rotation[viewerSeat]?.[seatNumber] || 'bottom';
}

// Tiny click sound synthesized via Web Audio (no file dependency)
function playDealTick() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch (_) {}
}

const CARD_FLIGHT_MS = 110; // duration of each card's CSS transition
const DEAL_INTERVAL_MS = 130; // time between successive cards being launched

export default function SpadesDealAnimation({
  dealSequence,      // ordered array of cards to deal
  seatedPlayers,     // [{playerId, seatNumber, ...}]
  dealStartSeat,     // which seat gets dealt first
  mySeatNumber,      // viewer's seat (null = spectator)
  onCardDealt,       // (seatNumber, card, cardIndex) — called when card lands
  onComplete,        // () — called after last card lands
}) {
  // Single flying card state
  const [flyCard, setFlyCard] = useState(null); // { card, targetX, targetY, isMyCard, key }
  const [deckCount, setDeckCount] = useState(dealSequence?.length || 0);
  const indexRef = useRef(0);
  const timerRef = useRef(null);
  const landTimerRef = useRef(null);

  const seatedSorted = [...(seatedPlayers || [])]
    .filter(p => p.seatNumber != null)
    .sort((a, b) => a.seatNumber - b.seatNumber);

  const startIdx = dealStartSeat != null
    ? Math.max(0, seatedSorted.findIndex(p => p.seatNumber === dealStartSeat))
    : 0;

  const orderedSeated = startIdx > 0
    ? [...seatedSorted.slice(startIdx), ...seatedSorted.slice(0, startIdx)]
    : seatedSorted;

  const dealNext = useCallback(() => {
    const i = indexRef.current;
    if (!dealSequence || i >= dealSequence.length) return;

    const player = orderedSeated[i % orderedSeated.length];
    const card = dealSequence[i];
    const posLabel = getSeatPosition(player.seatNumber, mySeatNumber);
    const target = SEAT_TARGETS[posLabel] || SEAT_TARGETS.bottom;
    const isMyCard = player.seatNumber === mySeatNumber;

    playDealTick();
    setDeckCount(dealSequence.length - i - 1);
    setFlyCard({
      card,
      targetX: target.x,
      targetY: target.y,
      isMyCard,
      key: i,
      seatNumber: player.seatNumber,
    });

    // After card has flown, notify parent and schedule next card
    landTimerRef.current = setTimeout(() => {
      onCardDealt?.(player.seatNumber, card, i);
      indexRef.current = i + 1;

      if (i + 1 >= dealSequence.length) {
        setFlyCard(null);
        setTimeout(() => onComplete?.(), 300);
      } else {
        timerRef.current = setTimeout(dealNext, DEAL_INTERVAL_MS - CARD_FLIGHT_MS);
      }
    }, CARD_FLIGHT_MS + 20);
  }, [dealSequence, orderedSeated, mySeatNumber, onCardDealt, onComplete]);

  useEffect(() => {
    if (!dealSequence || dealSequence.length === 0 || orderedSeated.length === 0) {
      onComplete?.();
      return;
    }
    indexRef.current = 0;
    setDeckCount(dealSequence.length);
    // Small initial delay so the table renders first
    timerRef.current = setTimeout(dealNext, 300);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(landTimerRef.current);
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const stackLayers = Math.max(1, Math.min(5, Math.ceil(deckCount / 10) + 1));

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible" style={{ zIndex: 40 }}>

      {/* Depleting deck stack at center */}
      <div className="relative" style={{ width: 56, height: 80 }}>
        {Array.from({ length: stackLayers }).map((_, offset) => (
          <div
            key={offset}
            className="absolute rounded-lg overflow-hidden shadow-lg"
            style={{
              width: 56, height: 80,
              top: offset * -1.5,
              left: offset * 1.5,
              opacity: deckCount > 0 ? Math.max(0.3, 1 - (offset * 0.15)) : 0,
              transition: 'opacity 0.2s',
              zIndex: offset,
            }}
          >
            <img
              src={getCardBack()}
              alt="deck"
              className="w-full h-full"
              style={{ objectFit: 'contain', imageRendering: 'auto' }}
            />
          </div>
        ))}
        {/* Glow ring */}
        <div className="absolute rounded-full" style={{
          width: 90, height: 90, top: -5, left: -17,
          background: 'radial-gradient(circle, rgba(188,19,254,0.25) 0%, transparent 70%)',
          zIndex: 0,
        }} />
      </div>

      {/* Single flying card — transitions from center to target seat */}
      {flyCard && (
        <div
          key={flyCard.key}
          className="absolute rounded-lg overflow-hidden shadow-2xl"
          style={{
            width: 54,
            height: 76,
            top: '50%',
            left: '50%',
            marginTop: -38,
            marginLeft: -27,
            zIndex: 50,
            transform: `translate(${flyCard.targetX}px, ${flyCard.targetY}px) scale(1)`,
            transition: `transform ${CARD_FLIGHT_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${CARD_FLIGHT_MS}ms ease`,
            filter: 'brightness(1.1)',
          }}
        >
          <img
            src={flyCard.isMyCard ? getCardImage(flyCard.card) : getCardBack()}
            alt="card"
            className="w-full h-full"
            style={{ objectFit: 'contain', imageRendering: 'auto' }}
            onError={(e) => { e.target.src = getCardBack(); }}
          />
        </div>
      )}

      {/* Progress counter */}
      <div className="absolute whitespace-nowrap" style={{ bottom: -48, left: '50%', transform: 'translateX(-50%)' }}>
        <div className="text-[8px] tracking-widest text-[#FFD700] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          DEALING {Math.max(0, (dealSequence?.length || 0) - deckCount)}/{dealSequence?.length || 0}
        </div>
      </div>
    </div>
  );
}