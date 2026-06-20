import React from 'react';

// Pip dot positions in a 3x3 grid (col%, row%)
const PIP_POS = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
};

const FRONT = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/348f82880_domino_front.png';
const BACK  = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/967ce20c4_domino_back.png';
const PIP_IMG = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/9f8b50e18_crowned_b.png';

function Half({ value, size }) {
  const pips = PIP_POS[value] ?? [];
  const pipSize = Math.max(5, size * 0.26);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {pips.map(([x, y], i) => (
        <img key={i} src={PIP_IMG} alt=""
          style={{
            position: 'absolute', width: pipSize, height: pipSize,
            left: `${x}%`, top: `${y}%`,
            transform: 'translate(-50%,-50%)',
            objectFit: 'contain', pointerEvents: 'none', userSelect: 'none',
          }} />
      ))}
    </div>
  );
}

/**
 * DominoTile
 * unit     — px, the "narrow" dimension of one half (default 40)
 * a, b     — pip values 0-6
 * vertical — boolean (default false = horizontal)
 * faceDown — boolean
 * selected — glows gold, lifts
 * playable — glows green
 * onClick
 */
export default function DominoTile({
  a = 0, b = 0, unit = 40,
  vertical = false,
  faceDown = false,
  selected = false,
  playable = false,
  onClick,
  style = {},
}) {
  const w = vertical ? unit       : unit * 2;
  const h = vertical ? unit * 2   : unit;

  const glow = selected
    ? 'drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 3px #FFD700)'
    : playable
    ? 'drop-shadow(0 0 7px #10b981)'
    : 'none';

  const wrapStyle = {
    width: w, height: h, position: 'relative', flexShrink: 0,
    filter: glow,
    transform: selected ? 'translateY(-10px) scale(1.07)' : 'none',
    transition: 'transform 0.12s, filter 0.12s',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  if (faceDown) {
    return (
      <div style={wrapStyle} onClick={onClick}>
        <img src={BACK} alt="domino" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
      </div>
    );
  }

  return (
    <div style={wrapStyle} onClick={onClick}>
      <img src={FRONT} alt="domino" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
      {vertical ? (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%' }}>
            <Half value={a} size={unit} />
          </div>
          <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '50%' }}>
            <Half value={b} size={unit} />
          </div>
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}>
            <Half value={a} size={unit} />
          </div>
          <div style={{ position: 'absolute', top: 0, left: '50%', width: '50%', height: '100%' }}>
            <Half value={b} size={unit} />
          </div>
        </>
      )}
    </div>
  );
}