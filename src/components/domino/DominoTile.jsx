import React from 'react';

// Pip dot positions in a 3x3 grid (col%, row%) — designed for vertical layout
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
 * DominoTile — always rendered vertically, rotated 90° for horizontal placement.
 * unit     — px, the narrow dimension of one half (default 40)
 * a, b     — pip values 0-6
 * vertical — boolean (default true)
 * faceDown — boolean
 * selected — glows gold, lifts
 * playable — glows green
 * onClick
 */
export default function DominoTile({
  a = 0, b = 0, unit = 40,
  vertical = true,
  faceDown = false,
  selected = false,
  playable = false,
  onClick,
  style = {},
}) {
  // Always render as a vertical domino (unit wide, unit*2 tall)
  // For horizontal placement, we rotate the whole thing 90deg
  const tileW = unit;
  const tileH = unit * 2;

  const glow = selected
    ? 'drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 3px #FFD700)'
    : playable
    ? 'drop-shadow(0 0 7px #10b981)'
    : 'none';

  // When horizontal: rotate 90deg; the rendered box becomes tileH wide × tileW tall
  const outerW = vertical ? tileW  : tileH;
  const outerH = vertical ? tileH  : tileW;

  const liftTransform = selected ? (vertical ? 'translateY(-10px) scale(1.07)' : 'translateX(-10px) scale(1.07)') : 'none';

  const outerStyle = {
    width: outerW, height: outerH,
    position: 'relative', flexShrink: 0,
    filter: glow,
    transform: liftTransform,
    transition: 'transform 0.12s, filter 0.12s',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  // Inner tile: always vertical layout, rotated if horizontal
  const innerRotate = vertical ? 'none' : 'rotate(90deg)';
  const innerStyle = {
    position: 'absolute',
    width: tileW, height: tileH,
    top: vertical ? 0 : (outerH - tileH) / 2,
    left: vertical ? 0 : (outerW - tileW) / 2,
    transform: innerRotate,
    transformOrigin: 'center center',
  };

  if (faceDown) {
    return (
      <div style={outerStyle} onClick={onClick}>
        <div style={innerStyle}>
          <img src={BACK} alt="domino" style={{ width: tileW, height: tileH, objectFit: 'fill', display: 'block' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={outerStyle} onClick={onClick}>
      <div style={innerStyle}>
        <img src={FRONT} alt="domino" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
        {/* Top half = a */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%' }}>
          <Half value={a} size={unit} />
        </div>
        {/* Bottom half = b */}
        <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '50%' }}>
          <Half value={b} size={unit} />
        </div>
      </div>
    </div>
  );
}