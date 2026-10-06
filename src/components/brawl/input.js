// Rodeo Rumble — input sources: keyboard, gamepads, and the on-screen touch pad.
// Every source produces the same snapshot { x, y, jump, light, heavy, dodge }.

// Laptop layout: arrow keys move (right hand), W (or E) jumps and A / S / D fight (left hand).
const KEYS = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  jump: ['KeyW', 'KeyE', 'Space'], light: ['KeyA'], heavy: ['KeyS'], dodge: ['KeyD'],
};

export function createKeyboard() {
  const down = new Set();
  const kd = (e) => { if (Object.values(KEYS).some(l => l.includes(e.code))) { down.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); } };
  const ku = (e) => down.delete(e.code);
  const blur = () => down.clear();
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
  const on = (k) => KEYS[k].some(c => down.has(c));
  return {
    read() { return { x: (on('right') ? 1 : 0) - (on('left') ? 1 : 0), y: (on('down') ? 1 : 0) - (on('up') ? 1 : 0), jump: on('jump'), light: on('light'), heavy: on('heavy'), dodge: on('dodge') }; },
    used() { return down.size > 0; },
    dispose() { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); },
  };
}

/** Standard-mapping gamepad: stick/d-pad move · A/Y jump · X light · B heavy · bumpers/triggers dodge */
export function readGamepad(index) {
  const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
  const p = pads[index];
  if (!p || !p.connected) return null;
  const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
  let x = p.axes[0] || 0, y = p.axes[1] || 0;
  if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
  return { x: Math.abs(x) < 0.2 ? 0 : x, y: Math.abs(y) < 0.2 ? 0 : y, jump: b(0) || b(3), light: b(2), heavy: b(1), dodge: b(4) || b(5) || b(6) || b(7) };
}
export function connectedPads() {
  const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
  return Array.from(pads).filter(p => p && p.connected).map(p => p.index);
}

/** Merge several snapshots (keyboard + touch + pad all driving player 1). */
export function merge(...srcs) {
  const o = { x: 0, y: 0, jump: false, light: false, heavy: false, dodge: false };
  for (const s of srcs) {
    if (!s) continue;
    if (Math.abs(s.x) > Math.abs(o.x)) o.x = s.x;
    if (Math.abs(s.y) > Math.abs(o.y)) o.y = s.y;
    o.jump = o.jump || s.jump; o.light = o.light || s.light; o.heavy = o.heavy || s.heavy; o.dodge = o.dodge || s.dodge;
  }
  return o;
}

export const touchState = () => ({ x: 0, y: 0, jump: false, light: false, heavy: false, dodge: false });