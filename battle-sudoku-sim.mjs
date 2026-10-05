// node scripts/battle-sudoku-sim.mjs — runs CPU-only BattleSudoku games on a fake clock and checks the rules.
import * as G from '../src/lib/battleSudoku/game.js';
// Also runs Fleet vs Fleet (teams) games: `node scripts/battle-sudoku-sim.mjs` does both.
function run(mode, count) {
const reasons = {}; let errors = 0, volleys = 0, sinks = 0, games = 0; const teamWins = [0, 0];
for (let n = 0; n < count; n++) {
  const size = mode === 'teams' ? 2 + (n % 7) : 2 + (n % 7);
  let now = 1_000_000;
  const players = Array.from({ length: size }, (_, i) => ({ id: `c${i}`, name: `CPU${i}`, cpu: 2 + ((n + i) % 9), team: i % 2 }));
  const g = G.createGame({ seed: `sim${mode}${n}`, players, now, settings: { mode, difficulty: ['easy', 'normal', 'hard'][n % 3] } });
  for (let step = 0; step < 4000 && g.phase !== 'final'; step++) {
    now += 500; G.tick(g, now);
    for (const id of g.order) {
      const P = g.players[id];
      if (P.shells < 0 || P.shells > G.MAX_SHELLS) { errors++; console.log('shells out of range', P.shells); }
      P.board.forEach((v, i) => { if (v && v !== g.solution[i]) { errors++; console.log('wrong digit on board'); } if (g.puzzle[i] && v !== g.puzzle[i]) { errors++; console.log('given lost'); } });
      const cells = P.ships.flatMap(s => s.cells); if (new Set(cells).size !== 17) { errors++; console.log('fleet overlap'); }
      if (P.ghost !== P.ships.every(s => s.hits.length >= s.size)) { errors++; console.log('ghost mismatch'); }
    }
    if (mode === 'teams') for (const id of g.order) for (const o of g.players[id].orders) {
      if (o.target && g.players[o.target].team === g.players[id].team) { errors++; console.log('friendly fire order'); }
      if (o.owner && g.players[o.owner].team !== g.players[id].team) { errors++; console.log('defended an enemy'); }
    }
    const v = G.view(g, 'c0', now);
    if (mode === 'teams' && v.me.allies.some(a => g.players[a.id].team !== g.players.c0.team)) { errors++; console.log('enemy fleet leaked as ally'); }
    if (!g.players.c0.board.every(Boolean) && JSON.stringify(v).includes(JSON.stringify(g.solution))) { errors++; console.log('solution leaked'); }
  }
  if (g.phase !== 'final') { errors++; console.log('game did not end', n); }
  if (mode === 'teams') {
    if (g.winnerTeam !== 0 && g.winnerTeam !== 1) { errors++; console.log('no winning fleet'); } else teamWins[g.winnerTeam]++;
    if (g.winner && g.players[g.winner].team !== g.winnerTeam) { errors++; console.log('MVP not on winning fleet'); }
  }
  reasons[g.winReason] = (reasons[g.winReason] || 0) + 1; volleys += g.volley; games++;
  sinks += g.order.reduce((a, id) => a + g.players[id].stats.sinks, 0);
}
console.log(mode, { games, errors, avgVolleys: (volleys / games).toFixed(1), avgSinks: (sinks / games).toFixed(1), winReasons: reasons, ...(mode === 'teams' ? { redWins: teamWins[0], blueWins: teamWins[1] } : {}) });
return errors;
}
const errs = run('ffa', 60) + run('teams', 60);
process.exit(errs ? 1 : 0);
