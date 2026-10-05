import React, { useCallback, useEffect, useRef, useState } from 'react';
import BSPhone from './BSPhone';
import * as G from '@/lib/battleSudoku/game';

const CREW = [['Tank', 3, '#3ef08a'], ['Carlos', 5, '#ff9f1c'], ['Lemonade', 6, '#ffd23f'], ['Violet', 7, '#c77dff'], ['Dexter', 8, '#3ec5ff'], ['Berna', 9, '#f15bb5']];

/** Solo: you vs CPU captains, all on this device (same rules as the party game). */
export default function BSSolo({ name = 'You', rivals = 2, level = 'normal', difficulty = 'normal', onExit }) {
  const make = () => {
    const pool = level === 'easy' ? CREW.slice(0, 3) : level === 'hard' ? CREW.slice(3) : CREW.slice(1, 5);
    const cpus = Array.from({ length: rivals }, (_, i) => pool[i % pool.length]);
    return G.createGame({ seed: `${Date.now()}-${Math.random()}`, settings: { difficulty, setupSec: 25 },
      players: [{ id: 'me', name, color: '#ff5f6d' }, ...cpus.map(([n, l, c], i) => ({ id: `cpu${i}`, name: n, cpu: l, color: c }))] });
  };
  const game = useRef(null);
  if (!game.current) game.current = make();
  const [, force] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => { const n = Date.now(); G.tick(game.current, n); setNow(n); }, 200); return () => clearInterval(t); }, []);
  const act = useCallback(async (type, payload = {}) => { const r = G.act(game.current, 'me', { ...payload, type }, Date.now()); G.tick(game.current, Date.now()); force(x => x + 1); return r; }, []);
  const v = G.view(game.current, 'me', now);
  return (
    <>
      <BSPhone v={v} act={act} now={now} onExit={onExit} />
      {v.phase === 'final' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 16, zIndex: 80, display: 'flex', justifyContent: 'center' }}>
          <button type="button" className="bs-btn primary" onClick={() => { game.current = make(); force(x => x + 1); }}>Battle again</button>
        </div>
      )}
    </>
  );
}
