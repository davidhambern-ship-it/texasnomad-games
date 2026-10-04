import React from 'react';
import frontImg from './assets/domino-front.png';
import backImg from './assets/domino-back.jpg';
import pipImg from './assets/crowned-b.png';

// Pip spots inside one half (fractions of the half's width/height), drawn for a
// half that is taller-than-wide in a vertical tile. Horizontal tiles transpose them.
const SPOTS = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.29, 0.24], [0.71, 0.24], [0.29, 0.5], [0.71, 0.5], [0.29, 0.76], [0.71, 0.76]],
};

function Half({ value, horizontal, unit, style }) {
  const size = Math.max(5, unit * (value >= 6 ? 0.29 : value >= 4 ? 0.32 : 0.38));
  return (
    <div className="tnd-half" style={style}>
      {(SPOTS[value] || []).map(([x, y], i) => {
        const px = horizontal ? y : x, py = horizontal ? x : y;
        return <img key={i} src={pipImg} alt="" draggable={false} className="tnd-pip" style={{ width: size, height: size, left: `${px * 100}%`, top: `${py * 100}%` }} />;
      })}
    </div>
  );
}

/**
 * DominoTile — one domino.
 *  a, b        pips: a = top half (vertical) or left half (horizontal)
 *  unit        px size of the short side (a tile is unit × 2·unit)
 *  horizontal  lay it sideways
 *  faceDown    show the TexasNomad back
 *  selected / playable / ghost / dim   visual states
 */
export default function DominoTile({ a = 0, b = 0, unit = 40, horizontal = false, faceDown = false, selected = false, playable = false, ghost = false, dim = false, onClick, className = '', style = {}, title }) {
  const w = horizontal ? unit * 2 : unit;
  const h = horizontal ? unit : unit * 2;
  const cls = ['tnd-tile', horizontal ? 'is-h' : 'is-v', selected && 'is-selected', playable && 'is-playable', ghost && 'is-ghost', dim && 'is-dim', onClick && 'is-clickable', className].filter(Boolean).join(' ');
  const art = faceDown ? backImg : frontImg;
  return (
    <div className={cls} style={{ width: w, height: h, ...style }} onClick={onClick} title={title}
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      aria-label={faceDown ? 'Face-down domino' : `Domino ${a}-${b}`}>
      <div className="tnd-art" style={horizontal ? { width: h, height: w, transform: 'translate(-50%,-50%) rotate(90deg)' } : { width: w, height: h, transform: 'translate(-50%,-50%)' }}>
        <img src={art} alt="" draggable={false} />
      </div>
      {!faceDown && (
        <>
          <Half value={a} horizontal={horizontal} unit={unit} style={horizontal ? { left: 0, top: 0, width: '50%', height: '100%' } : { left: 0, top: 0, width: '100%', height: '50%' }} />
          <Half value={b} horizontal={horizontal} unit={unit} style={horizontal ? { left: '50%', top: 0, width: '50%', height: '100%' } : { left: 0, top: '50%', width: '100%', height: '50%' }} />
        </>
      )}
    </div>
  );
}
