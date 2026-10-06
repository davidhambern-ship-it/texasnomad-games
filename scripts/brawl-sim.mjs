// node scripts/brawl-sim.mjs — CPU-only Rodeo Rumble matches; checks the engine and reports balance.
import { createMatch, step, STAGE_LIST } from '../src/lib/brawl/engine.js';
import { ROSTER } from '../src/lib/brawl/fighters.js';
const N = Number(process.argv[2] || 40);
const stageLen = {}, stageSelf = {}; let errors = 0; const wins = {}, koPct = [], lens = [], selfKO = { n: 0 }, states = {};
for (let n = 0; n < N; n++) {
  const size = Number(process.env.SIZE) || 2 + (n % 7);
  const players = Array.from({ length: size }, (_, i) => ({ id: `p${i}`, fighter: ROSTER[(n * 2 + i * 5) % ROSTER.length].id, cpu: 3 + ((n * 3 + i) % 7) }));
  const stage = STAGE_LIST[n % STAGE_LIST.length].id;
  const g = createMatch({ players, stocks: 3, seed: `s${n}`, stage });
  stageLen[stage] = stageLen[stage] || []; 
  const dmgAtKo = {};
  let f = 0;
  for (; f < 60 * 60 * 6 && !g.over; f++) {
    for (const F of g.fighters) dmgAtKo[F.id] = F.dmg;
    step(g);
    for (const e of g.events) if (e.type === 'ko') { koPct.push(Math.round(dmgAtKo[e.id])); if (!e.by) { selfKO.n++; stageSelf[stage] = (stageSelf[stage] || 0) + 1; } }
    for (const F of g.fighters) {
      if (![F.x, F.y, F.vx, F.vy, F.dmg].every(Number.isFinite)) { errors++; console.log('NaN', F.id, F.state); }
      states[F.state] = (states[F.state] || 0) + 1;
    }
  }
  if (!g.over) { console.log('match did not end', n, g.fighters.map(F => `${F.ch.id}:${F.stocks}:${F.state}:${Math.round(F.x)},${Math.round(F.y)}`).join(' ')); }
  else { const w = g.fighters.find(F => F.id === g.winner); wins[w.ch.id] = (wins[w.ch.id] || 0) + 1; }
  lens.push(f / 60); stageLen[stage].push(f / 60);
}
koPct.sort((a, b) => a - b);
const med = koPct[Math.floor(koPct.length / 2)];
console.log({ matches: N, errors, avgLenSec: (lens.reduce((a, b) => a + b, 0) / N).toFixed(0), kos: koPct.length, medianKoPct: med, p10: koPct[Math.floor(koPct.length * 0.1)], p90: koPct[Math.floor(koPct.length * 0.9)], selfDestructs: selfKO.n, wins });
const tot = Object.values(states).reduce((a, b) => a + b, 0);
console.log(Object.fromEntries(Object.entries(states).map(([k, v]) => [k, (v / tot * 100).toFixed(1) + '%'])));
console.log('stage avg sec', Object.fromEntries(Object.entries(stageLen).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)])), 'self-KOs by stage', stageSelf);
process.exit(errors ? 1 : 0);