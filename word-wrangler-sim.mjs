// node scripts/word-wrangler-sim.mjs — plays CPU games and checks the engine:
// every move legal, board always full, ids unique, and replaying the moves from the seed
// gives the identical state (what the online race server relies on).
import { readFileSync } from 'node:fs';
import * as E from '../src/lib/wordWranglerEngine.js';
const read = (f) => readFileSync(new URL(`../public/word-wrangler/${f}`, import.meta.url), 'utf8').split('\n').filter(Boolean);
const words = read('words.txt'); const dict = new Set(words); const common = new Set(read('cpu.txt')); const trie = E.buildTrie(words);
let errors = 0, moves = 0;
for (let g = 0; g < 100; g++) {
  const mode = g % 2 ? 'timed' : 'race';
  let st = E.createGame({ seed: `sim-${g}`, mode }); const log = [];
  for (let m = 0; m < 40; m++) {
    const pick = E.cpuPickWord(st, trie, 1 + (g % 10), { common });
    if (!pick) { st = E.shuffleBoard(st); log.push(null); continue; }
    const r = E.applyWord(st, pick.path, dict);
    if (!r.ok) { errors++; console.log('illegal', pick.word, r.reason); break; }
    st = r.state; log.push(pick.path); moves++;
    const ids = new Set(st.board.flat().map(t => t && t.id));
    if (ids.size !== st.size * st.size || ids.has(null)) { errors++; console.log('board broken'); }
  }
  let replay = E.createGame({ seed: `sim-${g}`, mode });
  for (const p of log) replay = p ? E.applyWord(replay, p, dict).state : E.shuffleBoard(replay);
  if (JSON.stringify(replay) !== JSON.stringify(st)) { errors++; console.log('replay mismatch', g); }
}
console.log(`${moves} moves checked, ${errors} errors`);
process.exit(errors ? 1 : 0);
