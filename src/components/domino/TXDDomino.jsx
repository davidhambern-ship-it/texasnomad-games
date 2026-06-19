import React from 'react';

const DOMINO_FRONT = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/348f82880_domino_front.png';
const DOMINO_BACK  = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/967ce20c4_domino_back.png';
const CROWNED_B    = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/9f8b50e18_crowned_b.png';

// Pip grid positions as [col, row] in a 3×3 grid (0-indexed)
// Each cell is ~33% of the half width/height
const PIP_LAYOUTS = {
  0: [],
  1: [[1,1]],
  2: [[0,0],[2,2]],
  3: [[0,0],[1,1],[2,2]],
  4: [[0,0],[2,0],[0,2],[2,2]],
  5: [[0,0],[2,0],[1,1],[0,2],[2,2]],
  6: [[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]],
};

function PipDot({ col, row, halfW, halfH }) {
  // Place pip in a 3×3 grid inside the half
  const padding = 0.15; // 15% padding from edge
  const cellW = (1 - padding * 2) / 2; // each cell step
  const cellH = (1 - padding * 2) / 2;
  const x = (padding + col * cellW) * 100;
  const y = (padding + row * cellH) * 100;
  // Pip size relative to the smaller dimension
  const minDim = Math.min(halfW, halfH);
  const pipSize = Math.max(3, minDim * 0.18);

  return (
    <img
      src={CROWNED_B}
      alt=""
      style={{
        position: 'absolute',
        width: pipSize,
        height: pipSize,
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        objectFit: 'contain',
        pointerEvents: 'none',
      }}
    />
  );
}

function DominoHalf({ value, halfW, halfH }) {
  const pips = PIP_LAYOUTS[value] ?? [];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {pips.map(([col, row], i) => (
        <PipDot key={i} col={col} row={row} halfW={halfW} halfH={halfH} />
      ))}
    </div>
  );
}

/**
 * TXDDomino
 * Props:
 *   top, bottom   {number} 0-6
 *   width         {number} px — narrow dimension (default 100)
 *   orientation   {"vertical"|"horizontal"} default "vertical"
 *   faceDown      {boolean}
 *   playable      {boolean} — glows green
 *   selected      {boolean} — glows gold, lifts
 *   onClick       {function}
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
  const h = isHoriz ? width     : width * 2;

  // half dimensions
  const halfW = isHoriz ? width     : width;
  const halfH = isHoriz ? width     : width;

  const glowFilter = selected
    ? 'drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 4px #FFD700)'
    : playable
    ? 'drop-shadow(0 0 8px #10b981)'
    : 'none';

  const transform = selected ? 'translateY(-8px)' : 'none';
  const cursor = onClick ? 'pointer' : 'default';

  const wrapStyle = {
    width: w, height: h, position: 'relative',
    filter: glowFilter, transform, cursor,
    transition: 'transform 0.15s, filter 0.15s',
    flexShrink: 0,
    ...style,
  };

  if (faceDown) {
    return (
      <div className={className} style={wrapStyle} onClick={onClick}>
        <img src={DOMINO_BACK} alt="domino back" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
      </div>
    );
  }

  if (isHoriz) {
    return (
      <div className={className} style={wrapStyle} onClick={onClick}>
        <img src={DOMINO_FRONT} alt="domino" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
        {/* Left half = top value */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}>
          <DominoHalf value={top} halfW={halfW} halfH={halfH} />
        </div>
        {/* Right half = bottom value */}
        <div style={{ position: 'absolute', top: 0, left: '50%', width: '50%', height: '100%' }}>
          <DominoHalf value={bottom} halfW={halfW} halfH={halfH} />
        </div>
      </div>
    );
  }

  // Vertical
  return (
    <div className={className} style={wrapStyle} onClick={onClick}>
      <img src={DOMINO_FRONT} alt="domino" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
      {/* Top half */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%' }}>
        <DominoHalf value={top} halfW={halfW} halfH={halfH} />
      </div>
      {/* Bottom half */}
      <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '50%' }}>
        <DominoHalf value={bottom} halfW={halfW} halfH={halfH} />
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