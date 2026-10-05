import React, { useEffect, useMemo, useState } from 'react';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

// CPU rivals — level ≈ how sharp they are (1–10)
export const RIVALS = [
  { id: 'tank', name: 'Tank', level: 3, title: 'Rookie', color: '#4ade80' },
  { id: 'carlos', name: 'Carlos', level: 5, title: 'Ranch hand', color: '#ff5f1f' },
  { id: 'lemonade', name: 'Lemonade', level: 6, title: 'Sharp shooter', color: '#ffd700' },
  { id: 'violet', name: 'Violet', level: 7, title: 'Wordsmith', color: '#8b5cf6' },
  { id: 'dexter', name: 'Dexter', level: 8, title: 'Trail boss', color: '#22d3ee' },
  { id: 'berna', name: 'Berna', level: 9, title: 'Legend', color: '#bc13fe' },
];
export const rivalById = (id) => RIVALS.find(r => r.id === id) || null;
const PLAYER_COLORS = ['#ffd700', '#ff5f1f', '#22d3ee', '#3ef08a', '#ff7ad9', '#8b5cf6', '#f97316', '#e5e7eb'];
export const colorFor = (i) => PLAYER_COLORS[i % PLAYER_COLORS.length];

export function Avatar({ name, charId, color = '#bc13fe', size = 40, className = '' }) {
  const ch = charId ? TEXASNOMAD_CHARACTERS.find(c => c.id === charId) : null;
  const [broken, setBroken] = useState(false);
  const initials = String(name || '?').trim().slice(0, 2).toUpperCase();
  return (
    <div className={`ww-ava ${className}`} style={{ width: size, height: size, background: `${color}55`, borderColor: color, fontSize: size * 0.36 }}>
      {ch?.avatar && !broken ? <img src={ch.avatar} alt="" onError={() => setBroken(true)} /> : initials}
    </div>
  );
}

export function Countdown({ endsAt, offset = 0, onDone }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 100); return () => clearInterval(t); }, []);
  const left = Math.ceil((endsAt - (Date.now() + offset)) / 1000);
  useEffect(() => { if (left <= 0 && onDone) onDone(); }, [left <= 0]);
  if (left <= 0) return null;
  return (
    <div className="ww-overlay" style={{ background: 'rgba(5,2,12,.55)' }}>
      <div key={left} className="ww-count">{left > 3 ? 'READY' : left}</div>
    </div>
  );
}

export function Confetti({ on }) {
  const bits = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.6,
    color: ['#ffd700', '#ff5f1f', '#bc13fe', '#3ef08a', '#22d3ee', '#ff7ad9'][i % 6], rot: Math.random() * 360,
  })), [on]);
  if (!on) return null;
  return (
    <div className="ww-confetti" aria-hidden="true">
      {bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, transform: `rotate(${b.rot}deg)` }} />)}
    </div>
  );
}

export const loadName = () => { try { return localStorage.getItem('ww_name') || ''; } catch { return ''; } };
export const saveName = (n) => { try { localStorage.setItem('ww_name', n); } catch { /* ignore */ } };
export const loadBest = () => { try { return JSON.parse(localStorage.getItem('ww_best') || '{}'); } catch { return {}; } };
export const saveBest = (b) => { try { localStorage.setItem('ww_best', JSON.stringify(b)); } catch { /* ignore */ } };
