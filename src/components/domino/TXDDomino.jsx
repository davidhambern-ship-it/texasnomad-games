import React from 'react';

const CROWNED_B = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/9f8b50e18_crowned_b.png';
const TEXAS_ZERO = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/34e8d668a_texas_zero.png';
const DOMINO_FRONT = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/348f82880_domino_front.png';
const DOMINO_BACK = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/967ce20c4_domino_back.png';

const POSITIONS = {
  TL: { x: 25, y: 20 }, TC: { x: 50, y: 20 }, TR: { x: 75, y: 20 },
  ML: { x: 25, y: 50 }, C:  { x: 50, y: 50 }, MR: { x: 75, y: 50 },
  BL: { x: 25, y: 80 }, BC: { x: 50, y: 80 }, BR: { x: 75, y: 80 },
};

const TXD_PIP_MAP = {
  0: ['C'], 1: ['C'], 2: ['TL', 'BR'], 3: ['TL', 'C', 'BR'],
  4: ['TL', 'TR', 'BL', 'BR'], 5: ['TL', 'TR', 'C', 'BL', 'BR'],
  6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'],
};

const SYMBOL_SIZE = { 0: 220, 1: 160, 2: 145, 3: 138, 4: 128, 5: 120, 6: 108 };

function DominoHalf({ value, halfSize }) {
  const positions = TXD_PIP_MAP[value] || [];
  const symbol = value === 0 ? TEXAS_ZERO : CROWNED_B;
  const size = (SYMBOL_SIZE[value] ?? 90) * (halfSize / 500);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {positions.map((posKey) => {
        const pos = POSITIONS[posKey];
        if (!pos) return null;
        return (
          <img key={posKey} src={symbol} alt="" style={{
            position: 'absolute', width: size, height: size,
            left: `${pos.x}%`, top: `${pos.y}%`,
            transform: 'translate(-50%, -50%)', objectFit: 'contain', pointerEvents: 'none',
          }} />
        );
      })}
    </div>
  );
}

/**
 * TXDDomino
 * Props:
 *   top, bottom  {number} 0-6
 *   width        {number} px — narrow dimension (default 100)
 *   orientation  {"vertical"|"horizontal"} default "vertical"
 *   faceDown     {boolean}
 *   playable     {boolean} — glows green
 *   selected     {boolean} — glows gold, lifts
 *   onClick      {function}
 *   style, className
 */
export default function TXDDomino({
  top = 0, bottom = 0, width = 100,
  orientation = 'vertical',
  faceDown = false, playable = false, selected = false,
  onClick, style = {}, className = '',
}) {
  const isHoriz = orientation === 'horizontal';
  const w = isHoriz ? width * 2 : width;
  const h = isHoriz ? width : width * 2;

  const glowFilter = selected
    ? 'drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 4px #FFD700)'
    : playable
    ? 'drop-shadow(0 0 8px #10b981)'
    : 'none';

  const transform = selected ? 'translateY(-8px)' : 'none';
  const cursor = onClick ? 'pointer' : 'default';

  const wrapStyle = { width: w, height: h, position: 'relative', filter: glowFilter, transform, cursor, transition: 'transform 0.15s, filter 0.15s', ...style };

  if (faceDown) {
    return (
      <div className={className} style={wrapStyle} onClick={onClick}>
        <img src={DOMINO_BACK} alt="domino back" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
      </div>
    );
  }

  if (isHoriz) {
    // Horizontal: left half = top value, right half = bottom value
    return (
      <div className={className} style={wrapStyle} onClick={onClick}>
        <img src={DOMINO_FRONT} alt="domino" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}>
          <DominoHalf value={top} halfSize={width} />
        </div>
        <div style={{ position: 'absolute', top: 0, left: '50%', width: '50%', height: '100%' }}>
          <DominoHalf value={bottom} halfSize={width} />
        </div>
      </div>
    );
  }

  // Vertical (default)
  return (
    <div className={className} style={wrapStyle} onClick={onClick}>
      <img src={DOMINO_FRONT} alt="domino" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%' }}>
        <DominoHalf value={top} halfSize={width} />
      </div>
      <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '50%' }}>
        <DominoHalf value={bottom} halfSize={width} />
      </div>
    </div>
  );
}

export const DOMINO_SET = [];
for (let i = 0; i <= 6; i++) {
  for (let j = i; j <= 6; j++) {
    DOMINO_SET.push({ top: i, bottom: j, id: `${i}-${j}` });
  }
}