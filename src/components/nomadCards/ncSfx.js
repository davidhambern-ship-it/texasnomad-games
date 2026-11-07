// WebAudio sound effects for OUT!
let ctx = null, muted = false;
try { muted = localStorage.getItem('nc_muted') === '1'; } catch { /* ignore */ }
const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; };
function tone(f, d, type = 'sine', vol = 0.16, when = 0, slide = 0) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.03);
}
function noise(d, vol = 0.25, when = 0, lp = 900) {
  const c = ac(); if (!c || muted) return;
  const len = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol; src.buffer = buf;
  src.connect(f).connect(g).connect(c.destination); src.start(c.currentTime + when);
}
export const ncSfx = {
  unlock() { ac(); },
  get muted() { return muted; },
  setMuted(m) { muted = !!m; try { localStorage.setItem('nc_muted', m ? '1' : '0'); } catch { /* ignore */ } },
  card() { noise(0.07, 0.22, 0, 3200); tone(420, 0.05, 'triangle', 0.05); },
  draw() { noise(0.12, 0.12, 0, 1800); },
  skip() { tone(300, 0.12, 'square', 0.07); tone(200, 0.16, 'square', 0.06, 0.1); },
  reverse() { tone(500, 0.1, 'triangle', 0.1, 0, 300); tone(800, 0.1, 'triangle', 0.1, 0.1, -300); },
  plus() { [600, 750, 900].forEach((f, i) => tone(f, 0.08, 'square', 0.07, i * 0.07)); },
  wild() { [523, 659, 784, 988].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, i * 0.05)); },
  nomad() { tone(392, 0.15, 'sawtooth', 0.1); tone(523, 0.25, 'sawtooth', 0.1, 0.12); tone(659, 0.35, 'sawtooth', 0.1, 0.26); },
  caught() { noise(0.3, 0.3, 0, 900); tone(140, 0.4, 'sawtooth', 0.12, 0, -60); },
  turn() { tone(880, 0.08, 'sine', 0.12); tone(1320, 0.1, 'sine', 0.08, 0.08); },
  bad() { tone(160, 0.2, 'sawtooth', 0.08, 0, -40); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, 'triangle', 0.15, i * 0.13)); },
  tick() { tone(1000, 0.04, 'square', 0.05); },
};
