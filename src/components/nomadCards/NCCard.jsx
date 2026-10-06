import React from 'react';

// Original OUT! art: each card is a coloured panel with a sheriff-star
// emblem. Colours are Chili (red), Sunset (gold), Cactus (green) and Sky (blue).
export const CARD_COLORS = { r: '#d93a2b', y: '#f0a020', g: '#2c9a52', b: '#2a73d6', w: '#1b1424' };
export const CARD_DARK = { r: '#8e1f15', y: '#9a5d06', g: '#16592c', b: '#153f82', w: '#000' };

const star = (cx, cy, R, r, rot = -Math.PI / 2) => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5; const rr = i % 2 ? r : R; pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`); }
  return pts.join(' ');
};
const STAR = star(50, 76, 38, 17);

function Glyph({ v, color, size = 1, x = 50, y = 76 }) {
  const fill = color;
  if (v === 'skip') return (
    <g transform={`translate(${x} ${y}) scale(${size})`} fill="none" stroke={fill} strokeWidth="5.5" strokeLinecap="round"><circle r="13" /><line x1="-9" y1="9" x2="9" y2="-9" /></g>
  );
  if (v === 'rev') return (
    <g transform={`translate(${x} ${y}) scale(${size}) rotate(-35)`} fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-12 -4 A12 12 0 0 1 10 -7" /><path d="M5 -13 L10 -7 L3 -3" />
      <path d="M12 4 A12 12 0 0 1 -10 7" /><path d="M-5 13 L-10 7 L-3 3" />
    </g>
  );
  const text = v === 'd2' ? '+2' : v === 'w4' ? '+4' : v;
  return <text x={x} y={y + 11 * size} textAnchor="middle" fontFamily="Teko, Impact, sans-serif" fontWeight="700" fontSize={34 * size} fill={fill}>{text}</text>;
}

function WildStar({ cx = 50, cy = 76, R = 38, r = 17 }) {
  // the star split into four colour wedges
  const cols = ['#d93a2b', '#f0a020', '#2c9a52', '#2a73d6'];
  return (
    <g>
      <clipPath id="ncws"><polygon points={star(cx, cy, R, r)} /></clipPath>
      <g clipPath="url(#ncws)">
        <rect x={cx - R} y={cy - R} width={R} height={R} fill={cols[0]} />
        <rect x={cx} y={cy - R} width={R} height={R} fill={cols[1]} />
        <rect x={cx - R} y={cy} width={R} height={R} fill={cols[3]} />
        <rect x={cx} y={cy} width={R} height={R} fill={cols[2]} />
      </g>
      <polygon points={star(cx, cy, R, r)} fill="none" stroke="#fff" strokeWidth="3" />
    </g>
  );
}

/** A face-up card. `card` = { c: 'r'|'y'|'g'|'b'|'w', v }, `chosen` = colour picked for a wild on the pile */
export default function NCCard({ card, chosen, w = 70, playable, dim, onClick, selected, style, className = '' }) {
  if (!card) return null;
  const wild = card.c === 'w';
  const bg = CARD_COLORS[card.c], dark = CARD_DARK[card.c];
  const corner = card.v === 'skip' ? '⦸' : card.v === 'rev' ? '⇄' : card.v === 'd2' ? '+2' : card.v === 'w4' ? '+4' : card.v === 'wild' ? '★' : card.v;
  const ink = wild ? '#fff' : bg;
  return (
    <svg viewBox="0 0 100 150" width={w} height={w * 1.5} className={`nc-card${playable ? ' playable' : ''}${dim ? ' dim' : ''}${selected ? ' sel' : ''} ${className}`} style={style}
      onClick={onClick} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined} role={onClick ? 'button' : undefined} aria-label={`${card.c === 'w' ? '' : { r: 'Chili ', y: 'Sunset ', g: 'Cactus ', b: 'Sky ' }[card.c]}${card.v === 'd2' ? '+2' : card.v === 'w4' ? 'Wild +4' : card.v === 'wild' ? 'Wild' : card.v === 'rev' ? 'Reverse' : card.v === 'skip' ? 'Skip' : card.v}`}>
      <defs>
        <pattern id={`nct-${card.c}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke={dark} strokeWidth="2" opacity=".35" /></pattern>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="147" rx="11" fill="#fffaf0" stroke="#1a1020" strokeWidth="2" />
      <rect x="7" y="7" width="86" height="136" rx="8" fill={bg} />
      <rect x="7" y="7" width="86" height="136" rx="8" fill={`url(#nct-${card.c})`} />
      {chosen && wild && <rect x="7" y="7" width="86" height="136" rx="8" fill="none" stroke={CARD_COLORS[chosen]} strokeWidth="6" />}
      {wild ? <WildStar /> : <polygon points={STAR} fill="#fffaf0" stroke={dark} strokeWidth="2.5" transform="rotate(-8 50 76)" />}
      {wild ? (card.v === 'w4' && <Glyph v="w4" color="#fff" size={0.9} y={78} />) : <Glyph v={card.v} color={ink} size={card.v.length > 1 ? 0.8 : 1} />}
      <text x="17" y="31" textAnchor="middle" fontFamily="Teko, Impact, sans-serif" fontWeight="700" fontSize={corner.length > 1 ? 18 : 22} fill="#fffaf0" stroke={dark} strokeWidth=".8">{corner}</text>
      <text x="83" y="130" textAnchor="middle" fontFamily="Teko, Impact, sans-serif" fontWeight="700" fontSize={corner.length > 1 ? 18 : 22} fill="#fffaf0" stroke={dark} strokeWidth=".8" transform="rotate(180 85 123)">{corner}</text>
    </svg>
  );
}

/** Card back: tooled leather with a gold star. */
export function NCBack({ w = 70, style, className = '' }) {
  return (
    <svg viewBox="0 0 100 150" width={w} height={w * 1.5} className={`nc-card back ${className}`} style={style} aria-hidden="true">
      <rect x="1.5" y="1.5" width="97" height="147" rx="11" fill="#fffaf0" stroke="#1a1020" strokeWidth="2" />
      <rect x="7" y="7" width="86" height="136" rx="8" fill="#4a2414" />
      <rect x="12" y="12" width="76" height="126" rx="6" fill="none" stroke="#c99a4a" strokeWidth="1.5" strokeDasharray="4 3" />
      <polygon points={star(50, 70, 26, 11)} fill="#e0b64a" stroke="#7a4a10" strokeWidth="2" />
      <text x="50" y="114" textAnchor="middle" fontFamily="Teko, Impact, sans-serif" fontWeight="700" fontSize="17" fill="#e0b64a" letterSpacing="1.5">OUT!</text>
    </svg>
  );
}
