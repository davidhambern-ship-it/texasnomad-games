// Tiny WebAudio sound effects for See That?!
let ctx = null, muted = false;
try { muted = localStorage.getItem('st_muted') === '1'; } catch { /* ignore */ }
const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; };
function tone(f, d, type = 'sine', vol = 0.18, when = 0, slide = 0) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
}
export const sfx = {
  unlock() { ac(); },
  get muted() { return muted; },
  setMuted(m) { muted = !!m; try { localStorage.setItem('st_muted', m ? '1' : '0'); } catch { /* ignore */ } },
  found(combo = 0) { const b = 660 * Math.pow(1.06, Math.min(combo, 6)); tone(b, 0.12, 'triangle', 0.22); tone(b * 1.5, 0.18, 'triangle', 0.2, 0.08); tone(b * 2, 0.25, 'sine', 0.12, 0.16); },
  other() { tone(520, 0.1, 'triangle', 0.12); tone(780, 0.14, 'triangle', 0.1, 0.07); },
  miss() { tone(180, 0.22, 'sawtooth', 0.12, 0, -60); },
  lock() { tone(140, 0.4, 'square', 0.1, 0, -40); },
  hint() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'sine', 0.1, i * 0.07)); },
  tick() { tone(1000, 0.05, 'square', 0.06); },
  go() { tone(523, 0.12, 'triangle', 0.2); tone(784, 0.3, 'triangle', 0.2, 0.12); },
  end() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, i * 0.12)); },
};
