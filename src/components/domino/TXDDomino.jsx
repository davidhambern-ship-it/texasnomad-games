import React from 'react';

const CROWNED_B = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/9f8b50e18_crowned_b.png';
const TEXAS_ZERO = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/34e8d668a_texas_zero.png';
const DOMINO_FRONT = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/348f82880_domino_front.png';
const DOMINO_BACK = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/967ce20c4_domino_back.png';

const POSITIONS = {
  TL: { x: 25, y: 20 },
  TC: { x: 50, y: 20 },
  TR: { x: 75, y: 20 },
  ML: { x: 25, y: 50 },
  C:  { x: 50, y: 50 },
  MR: { x: 75, y: 50 },
  BL: { x: 25, y: 80 },
  BC: { x: 50, y: 80 },
  BR: { x: 75, y: 80 },
};

const TXD_PIP_MAP = {
  0: ['C'],
  1: ['C'],
  2: ['TL', 'BR'],
  3: ['TL', 'C', 'BR'],
  4: ['TL', 'TR', 'BL', 'BR'],
  5: ['TL', 'TR', 'C', 'BL', 'BR'],
  6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'],
};

const SYMBOL_SIZE = {
  0: 220,
  1: 160,
  2: 145,
  3: 138,
  4: 128,
  5: 120,
  6: 108,
};

// Renders one half of a domino (top or bottom)
function DominoHalf({ value, halfSize }) {
  const positions = TXD_PIP_MAP[value] || [];
  const symbol = value === 0 ? TEXAS_ZERO : CROWNED_B;
  // symbolSize is defined relative to a 500px half-width reference
  const rawSize = SYMBOL_SIZE[value] ?? 90;
  // Scale it to the actual rendered half size
  const scale = halfSize / 500;
  const size = rawSize * scale;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {positions.map((posKey) => {
        const pos = POSITIONS[posKey];
        if (!pos) return null;
        return (
          <img
            key={posKey}
            src={symbol}
            alt=""
            style={{
              position: 'absolute',
              width: size,
              height: size,
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * TXDDomino
 * Props:
 *   top      {number} 0-6
 *   bottom   {number} 0-6
 *   width    {number} px (default 100)
 *   faceDown {boolean}
 *   style    {object} extra styles on wrapper
 *   className {string}
 */
export default function TXDDomino({ top = 0, bottom = 0, width = 100, faceDown = false, style = {}, className = '' }) {
  const height = width * 2;
  const halfSize = width; // each half is square

  if (faceDown) {
    return (
      <div className={className} style={{ width, height, position: 'relative', ...style }}>
        <img src={DOMINO_BACK} alt="domino back" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
      </div>
    );
  }

  return (
    <div className={className} style={{ width, height, position: 'relative', ...style }}>
      {/* Domino front background */}
      <img
        src={DOMINO_FRONT}
        alt="domino"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
      />
      {/* Top half */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%' }}>
        <DominoHalf value={top} halfSize={halfSize} />
      </div>
      {/* Bottom half */}
      <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '50%' }}>
        <DominoHalf value={bottom} halfSize={halfSize} />
      </div>
    </div>
  );
}

export const DOMINO_SET = [
  [0,0],
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
  [1,1],[1,2],[1,3],[1,4],[1,5],[1,6],
  [2,2],[2,3],[2,4],[2,5],[2,6],
  [3,3],[3,4],[3,5],[3,6],
  [4,4],[4,5],[4,6],
  [5,5],[5,6],
  [6,6],
];