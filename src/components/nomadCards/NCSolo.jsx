import React, { useCallback, useEffect, useRef, useState } from 'react';
import NCHand from './NCHand';
import * as G from '@/lib/nomadCards/game';

const CREW = [['Tank', 3, '#3ef08a'], ['Carlos', 5, '#ff9f1c'], ['Lemonade', 6, '#ffd23f'], ['Violet', 7, '#c77dff'], ['Dexter', 8, '#3ec5ff'], ['Berna', 9, '#f15bb5'], ['Rio', 4, '#7ae0d6'], ['Duke', 6, '#ffb4a2'], ['Mabel', 7, '#e5e7eb']];

/** Solo: you vs CPU players on this device, same rules as the party game. */
export default function NCSolo({ name = 'You', rivals = 3, level = 'normal', settings = {}, onExit }) {
  const make = () => {
    const pool = level === 'easy' ? CREW.filter(c => c[1] <= 5) : level === 'hard' ? CREW.filter(c => c[1] >= 6) : CREW;
    const cpus = Array.from({ length: rivals }, (_, i) => pool[i % pool.length]);
    return G.createGame({ seed: `${Date.now()}-${Math.random()}`, settings: { ...settings, turnSec: 60 },
      players: [{ id: 'me', name, color: '#ff5f6d' }, ...cpus.map(([n, l, c], i) => ({ id: `cpu${i}`, name: n, cpu: l, color: c }))] });
  };
  const game = useRef(null);
  if (!game.current) game.current = make();
  const [, force] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => { const n = Date.now(); G.tick(game.current, n); setNow(n); }, 250); return () => clearInterval(t); }, []);
  const act = useCallback(async (type, payload = {}) => { const r = G.act(game.current, 'me', { ...payload, type }, Date.now()); force(x => x + 1); return r; }, []);
  const v = G.view(game.current, 'me', now);
  return <NCHand v={v} act={act} now={now} onExit={onExit} solo onNewGame={() => { game.current = make(); force(x => x + 1); }} />;
}
