import React from 'react';
import { getCardImage } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SEAT_POSITIONS = {
  1: { bottom: '0%', left: '50%', transform: 'translateX(-50%)' },
  2: { left: '0%',  top: '50%',  transform: 'translateY(-50%)' },
  3: { top: '0%',   left: '50%', transform: 'translateX(-50%)' },
  4: { right: '0%', top: '50%',  transform: 'translateY(-50%)' },
};

// Relative position mapping based on viewer's seat
const ROTATION = {
  1: { 1: 'bottom', 2: 'left',   3: 'top',    4: 'right'  },
  2: { 2: 'bottom', 3: 'left',   4: 'top',    1: 'right'  },
  3: { 3: 'bottom', 4: 'left',   1: 'top',    2: 'right'  },
  4: { 4: 'bottom', 1: 'left',   2: 'top',    3: 'right'  },
};

const POSITION_STYLES = {
  bottom: { bottom: 20, left: '50%', transform: 'translateX(-50%)' },
  top:    { top: 20,    left: '50%', transform: 'translateX(-50%)' },
  left:   { left: '30%', top: '50%',  transform: 'translateY(-50%)' },
  right:  { right: '30%', top: '50%',  transform: 'translateY(-50%)' },
};

export default function SpadesCardArea({ trick = [], players = [], mySeatNumber }) {
  if (!trick || trick.length === 0) return null;

  return (
    <>
      {trick.map((play, i) => {
        if (!play?.card) return null;
        const { seatNumber, card } = play;
        const position = mySeatNumber
          ? ROTATION[mySeatNumber]?.[seatNumber] || 'bottom'
          : ({ 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' }[seatNumber] || 'bottom');

        const posStyle = POSITION_STYLES[position];

        return (
          <div
            key={`${seatNumber}-${card.suit}-${card.value}`}
            className="absolute z-30 pointer-events-none"
            style={posStyle}
          >
            <div className="relative" style={{ width: 52, height: 72 }}>
              <img
                src={getCardImage(card)}
                alt={`${card.suit} ${card.value}`}
                className="w-full h-full rounded-md shadow-xl"
                style={{ objectFit: 'contain', border: '2px solid rgba(255,215,0,0.4)' }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}