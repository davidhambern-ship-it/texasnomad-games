// WebAudio sound effects for BattleSudoku
let ctx = null, muted = false;
try { muted = localStorage.getItem('bs_muted') === '1'; } catch { /* ignore */ }
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
export const sfx = {
  unlock() { ac(); },
  get muted() { return muted; },
  setMuted(m) { muted = !!m; try { localStorage.setItem('bs_muted', m ? '1' : '0'); } catch { /* ignore */ } },
  correct(streak = 0) { tone(700 + Math.min(streak, 8) * 40, 0.09, 'triangle', 0.14); tone(1050, 0.12, 'sine', 0.08, 0.06); },
  wrong() { tone(160, 0.25, 'sawtooth', 0.1, 0, -50); },
  sonar() { tone(1400, 0.5, 'sine', 0.12); tone(1400, 0.6, 'sine', 0.05, 0.35); },
  horn() { tone(196, 0.7, 'sawtooth', 0.09); tone(247, 0.7, 'sawtooth', 0.07, 0.05); },
  order() { tone(520, 0.06, 'square', 0.06); },
  fire() { noise(0.25, 0.3, 0, 600); tone(90, 0.25, 'sine', 0.2, 0, -40); },
  splash() { noise(0.35, 0.18, 0, 2500); },
  hit() { noise(0.5, 0.45, 0, 1200); tone(70, 0.4, 'sine', 0.25, 0, -30); },
  sink() { noise(1.1, 0.5, 0, 700); [220, 185, 147].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, 0.3 + i * 0.22)); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, 'triangle', 0.15, i * 0.13)); },
  tick() { tone(1000, 0.04, 'square', 0.05); },
};
