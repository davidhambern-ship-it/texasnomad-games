// Rodeo Rumble — tiny synth sound effects (no audio files).
let ctx = null; let muted = false;
try { muted = localStorage.getItem('rr_muted') === '1'; } catch { /* ignore */ }
const ac = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } return ctx; };
function tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  const c = ac(); if (!c || muted) return;
  const o = c.createOscillator(), g = c.createGain(); const t = c.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, hp = 400) {
  const c = ac(); if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur); const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(c.destination); s.start();
}
export const rrSfx = {
  unlock() { const c = ac(); if (c && c.state === 'suspended') c.resume(); },
  get muted() { return muted; },
  setMuted(m) { muted = m; try { localStorage.setItem('rr_muted', m ? '1' : '0'); } catch { /* ignore */ } },
  hit(kb) { noise(0.08 + Math.min(0.2, kb / 80), Math.min(0.4, 0.12 + kb / 60), kb > 15 ? 120 : 600); tone(kb > 15 ? 90 : 160, 0.12, 'sine', 0.25, 0.5); },
  block() { tone(900, 0.06, 'triangle', 0.08, 0.8); },
  swing() { noise(0.06, 0.05, 2500); },
  jump() { tone(420, 0.08, 'square', 0.04, 1.6); },
  shoot() { noise(0.05, 0.12, 1500); tone(700, 0.05, 'square', 0.05, 0.5); },
  ko() { noise(0.6, 0.35, 60); tone(70, 0.6, 'sawtooth', 0.2, 0.4); },
  shieldbreak() { tone(600, 0.3, 'square', 0.12, 0.3); },
  go() { tone(523, 0.12, 'square', 0.1); setTimeout(() => tone(784, 0.25, 'square', 0.1), 120); },
  count() { tone(392, 0.1, 'square', 0.08); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.09), i * 120)); },
};