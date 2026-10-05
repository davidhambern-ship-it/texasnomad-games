// Loads the Word Wrangler dictionary (public/word-wrangler/*.txt) once per page.
// words.txt = every playable word (3–12 letters, built from the en_US Hunspell list,
// abbreviations and slurs removed). cpu.txt = everyday words the CPU rivals use.
import { buildTrie } from '@/lib/wordWranglerEngine';

let loading = null;
let trie = null;

const parse = (txt) => txt.split('\n').map(s => s.trim()).filter(Boolean);

export function loadWordDict() {
  if (!loading) {
    loading = Promise.all([
      fetch('/word-wrangler/words.txt').then(r => { if (!r.ok) throw new Error('dict'); return r.text(); }),
      fetch('/word-wrangler/cpu.txt').then(r => (r.ok ? r.text() : '')).catch(() => ''),
    ]).then(([all, cpu]) => {
      const words = parse(all);
      const dict = new Set(words);
      const common = new Set(parse(cpu));
      return {
        dict, common, words,
        trie() { if (!trie) trie = buildTrie(words); return trie; },
      };
    }).catch((e) => { loading = null; throw e; });
  }
  return loading;
}
