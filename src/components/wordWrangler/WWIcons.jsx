import React from 'react';

// Precious-stone colours: base, deep, light
export const GEMS = {
  emerald: ['#18c964', '#075a2b', '#9bffc9'],
  ruby: ['#e3173d', '#6e0416', '#ff9db0'],
  diamond: ['#d9f6ff', '#7fbfd6', '#ffffff'],
  sapphire: ['#2563ff', '#0a1f73', '#9dbbff'],
  amethyst: ['#a052ff', '#3f0f85', '#e2c6ff'],
  topaz: ['#ff9b18', '#8a4300', '#ffe2a6'],
  opal: ['#efe9ff', '#9b8fd1', '#ffffff'],
};

// Small brilliant-cut gem for legends and menus
function GemIcon({ kind, size }) {
  const [base, deep, light] = GEMS[kind];
  const id = `gi-${kind}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {kind === 'opal'
            ? (<><stop offset="0" stopColor="#ffd6f3" /><stop offset=".35" stopColor="#c9f3ff" /><stop offset=".65" stopColor="#fff3b8" /><stop offset="1" stopColor="#d8c8ff" /></>)
            : (<><stop offset="0" stopColor={light} /><stop offset=".45" stopColor={base} /><stop offset="1" stopColor={deep} /></>)}
        </linearGradient>
      </defs>
      <path d="M3.5 9 L7.5 4 H16.5 L20.5 9 L12 21 Z" fill={`url(#${id})`} stroke={deep} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M3.5 9 H20.5 M7.5 4 L9.5 9 L12 4 L14.5 9 L16.5 4 M9.5 9 L12 21 L14.5 9" fill="none" stroke={deep} strokeWidth=".8" strokeOpacity=".7" />
      <path d="M8.2 5.2 L9.4 8.2 L6 8.2 Z" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}

// Faceted "emerald-cut" stone that fills a special tile (viewBox 100×100)
export function GemFace({ kind }) {
  const [base, deep, light] = GEMS[kind] || GEMS.diamond;
  const id = `gf-${kind}`;
  const W = (o) => `rgba(255,255,255,${o})`, B = (o) => `rgba(0,0,0,${o})`;
  return (
    <svg className="gem" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {kind === 'opal'
            ? (<><stop offset="0" stopColor="#ffd1f0" /><stop offset=".3" stopColor="#bff0ff" /><stop offset=".55" stopColor="#fff1b0" /><stop offset=".8" stopColor="#d9c6ff" /><stop offset="1" stopColor="#9fe8ff" /></>)
            : (<><stop offset="0" stopColor={light} /><stop offset=".5" stopColor={base} /><stop offset="1" stopColor={deep} /></>)}
        </linearGradient>
      </defs>
      <polygon points="14,0 86,0 100,14 100,86 86,100 14,100 0,86 0,14" fill={`url(#${id})`} />
      <polygon points="14,0 86,0 72,24 28,24" fill={W(0.38)} />
      <polygon points="86,0 100,14 76,28 72,24" fill={W(0.22)} />
      <polygon points="100,14 100,86 76,72 76,28" fill={B(0.16)} />
      <polygon points="100,86 86,100 72,76 76,72" fill={B(0.26)} />
      <polygon points="86,100 14,100 28,76 72,76" fill={B(0.32)} />
      <polygon points="14,100 0,86 24,72 28,76" fill={B(0.18)} />
      <polygon points="0,86 0,14 24,28 24,72" fill={W(0.14)} />
      <polygon points="0,14 14,0 28,24 24,28" fill={W(0.3)} />
      <polygon points="28,24 72,24 76,28 76,72 72,76 28,76 24,72 24,28" fill={W(0.08)} stroke={W(0.45)} strokeWidth="1.2" />
      <polygon points="30,28 52,28 34,50 30,46" fill={W(0.28)} />
      <polygon points="14,0 86,0 100,14 100,86 86,100 14,100 0,86 0,14" fill="none" stroke={deep} strokeWidth="3" />
    </svg>
  );
}

function Outlaw({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9.5c3-1.6 15-1.6 18 0l-1.2 5.5c-4 1.3-11.6 1.3-15.6 0z" fill="#1b1b1b" stroke="#000" strokeWidth="1.2" />
      <ellipse cx="8.6" cy="11.8" rx="2" ry="1.3" fill="#fff" /><ellipse cx="15.4" cy="11.8" rx="2" ry="1.3" fill="#fff" />
      <path d="M5.5 15.5l-2 4.5M18.5 15.5l2 4.5" stroke="#1b1b1b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function WWIcon({ kind, size = 16 }) {
  if (kind === 'outlaw') return <Outlaw size={size} />;
  if (GEMS[kind]) return <GemIcon kind={kind} size={size} />;
  return null;
}
