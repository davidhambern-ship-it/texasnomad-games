// node scripts/out-sim.mjs — CPU-only OUT! games on a fake clock; checks every rule invariant.
import * as G from '../src/lib/nomadCards/game.js';
let errors = 0; const stats = { games: 0, rounds: 0, turns: 0, catches: 0, swaps: 0, rotates: 0, stacks: 0 }; const lens = [];
const configs = [{}, { stacking: true }, { sevenZero: true }, { stacking: true, sevenZero: true }];
for (let n = 0; n < 120; n++) {
  const size = 2 + (n % 9);
  const settings = { ...configs[n % 4], target: n % 3 === 0 ? 0 : 250 };
  let now = 1_000_000;
  const players = Array.from({ length: size }, (_, i) => ({ id: `c${i}`, name: `CPU${i}`, cpu: 2 + ((n + i) % 8) }));
  const g = G.createGame({ seed: `sim${n}`, settings, players, now });
  let lastSeq = 0, steps = 0;
  for (; steps < 40000 && g.phase !== 'final'; steps++) {
    now += 400; G.tick(g, now);
    const total = g.deck.length + g.discard.length + g.order.reduce((a, id) => a + g.players[id].hand.length, 0);
    if (total !== 108) { errors++; console.log('card count', total, n); break; }
    const ids = new Set([...g.deck, ...g.discard, ...g.order.flatMap(id => g.players[id].hand)].map(c => c.id));
    if (ids.size !== 108) { errors++; console.log('duplicate cards', n); break; }
    if (g.phase === 'play' && !G.COLORS.includes(g.color)) { errors++; console.log('bad colour', g.color); break; }
    if (g.drawStack && !settings.stacking) { errors++; console.log('stack without rule'); break; }
    for (const e of g.log) if (e.seq > lastSeq) {
      if (e.kind === 'catch') stats.catches++; if (e.kind === 'swap') stats.swaps++; if (e.kind === 'rotate') stats.rotates++; if (e.kind === 'stack') stats.stacks++; if (e.kind === 'play') stats.turns++;
      if (e.kind === 'play' && e.card && !settings.sevenZero && e.card.v === '7' && /swapped/.test(e.text)) { errors++; }
    }
    lastSeq = g.seq;
    // a view must never leak someone else's hand
    const v = G.view(g, 'c0', now);
    if (v.players.some(p => p.hand)) { errors++; console.log('hand leaked'); break; }
  }
  if (g.phase !== 'final') { errors++; console.log('game did not finish', n, size, JSON.stringify(settings)); }
  const w = g.players[g.winner]; if (w && settings.target && w.score < settings.target) { errors++; console.log('winner below target'); }
  stats.games++; stats.rounds += g.round; lens.push(steps * 0.4 / 60);
}
console.log({ errors, ...stats, avgRounds: (stats.rounds / stats.games).toFixed(1), avgMinutes: (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1) });
process.exit(errors ? 1 : 0);
