// ─────────────────────────────────────────────────────────────────────────────
// Rodeo Rumble — the cast and their moves.
//
// Controls are built for phones: a thumbstick plus four buttons.
//   LIGHT  ground: jab / side / up / down tilt     air: neutral / forward / back / up / down air
//   HEAVY  ground: side / up / down smash (hold to charge), neutral = signature special
//          air:    up = recovery, down = ground pound, side = dash strike, neutral = signature
//   JUMP   (double jump in the air)         DODGE  shield on the ground, roll with a direction, air dodge
//
// Move data: frames are at 60 fps. Hitbox x is "forward" (flipped by facing), y is
// up from the feet (negative = above). ang is degrees in the attacker's frame
// (0 = straight forward, 90 = straight up, 180 = backward, negative = downward).
// ─────────────────────────────────────────────────────────────────────────────

const H = (f, x, y, r, dmg, base, grow, ang) => ({ f, x, y, r, dmg, base, grow, ang });

export const BASE_MOVES = {
  jab: { dur: 16, hits: [H([3, 6], 28, -34, 18, 3, 3.2, 0.25, 38)] },
  ftilt: { dur: 26, hits: [H([6, 10], 40, -30, 22, 8, 5, 0.75, 34)] },
  utilt: { dur: 26, hits: [H([5, 11], 8, -74, 26, 7, 5.5, 0.72, 88)] },
  dtilt: { dur: 20, hits: [H([4, 8], 36, -8, 20, 6, 4.5, 0.6, 22)] },
  nair: { dur: 30, air: true, landLag: 7, hits: [H([4, 14], 0, -32, 36, 7, 4.5, 0.65, 45)] },
  fair: { dur: 32, air: true, landLag: 10, hits: [H([8, 12], 38, -32, 25, 11, 5, 0.95, 40)] },
  bair: { dur: 30, air: true, landLag: 10, hits: [H([7, 11], -40, -32, 25, 12, 5.5, 1.0, 145)] },
  uair: { dur: 28, air: true, landLag: 8, hits: [H([6, 11], 0, -74, 27, 9, 5, 0.85, 86)] },
  dair: { dur: 36, air: true, landLag: 14, hits: [H([10, 16], 0, 10, 26, 12, 4, 0.9, -78)] },
  fsmash: { dur: 46, charge: true, hits: [H([13, 17], 48, -32, 31, 16, 7, 1.22, 36)] },
  usmash: { dur: 44, charge: true, hits: [H([11, 17], 2, -82, 35, 15, 7, 1.18, 88)] },
  dsmash: { dur: 42, charge: true, hits: [H([9, 13], 42, -8, 25, 13, 6, 1.12, 24), H([9, 13], -42, -8, 25, 13, 6, 1.12, 156)] },
  // air heavies (shared by everyone, tuned per fighter below)
  recover: { dur: 34, air: true, once: 'recover', helpless: true, impulse: [{ f: 3, vx: 0, vy: -16, steer: 4 }], hits: [H([3, 14], 0, -40, 34, 6, 5, 0.55, 80)] },
  pound: { dur: 60, air: true, landLag: 16, endOnLand: true, impulse: [{ f: 7, vx: 0, vy: 19 }], hover: [0, 6], hits: [H([7, 60], 0, 4, 28, 10, 5, 0.85, -70)] },
  dash: { dur: 28, air: true, once: 'dash', landLag: 10, hover: [4, 16], dash: { f: [5, 15], vx: 13 }, hits: [H([5, 15], 30, -34, 28, 9, 6, 0.8, 32)] },
};

// signature specials (neutral heavy)
export const SIGNATURES = {
  sixshooter: { name: 'Six-Shooter', dur: 24, proj: { f: 8, kind: 'bullet' } },
  stampede: { name: 'Stampede', dur: 42, hover: [0, 34], dash: { f: [8, 30], vx: 11.5 }, hits: [H([8, 30], 34, -36, 32, 12, 7, 1.0, 36)] },
  tumbleweed: { name: 'Tumbleweed', dur: 26, proj: { f: 9, kind: 'tumbleweed' } },
  zapball: { name: 'Zap Ball', dur: 26, charge: true, maxCharge: 70, proj: { f: 6, kind: 'zap' } },
  // the Bunnie Crew
  boardtoss: { name: 'Board Toss', dur: 28, proj: { f: 9, kind: 'board' } },
  shakedown: { name: 'Shakedown', dur: 42, counter: [4, 24] },
  heartkiss: { name: 'Heart Kiss', dur: 26, proj: { f: 10, kind: 'heart' } },
  nononsense: { name: 'No Nonsense', dur: 40, hits: [{ ...H([8, 12], 30, -38, 28, 10, 8.5, 0.95, 50), unblockable: true }] },
  hotbox: { name: 'Hotbox', dur: 34, proj: { f: 12, kind: 'smoke' } },
};

export const PROJECTILES = {
  bullet: { r: 7, speed: 15, life: 38, dmg: 4, base: 2.2, grow: 0.18, ang: 25, grav: 0, color: '#ffe08a' },
  tumbleweed: { r: 15, speed: 7.5, life: 110, dmg: 7, base: 4, grow: 0.5, ang: 55, grav: 0.45, bounce: 0.62, vy: -6, color: '#c9a36b' },
  zap: { r: 10, speed: 11, life: 70, dmg: 4, base: 3, grow: 0.45, ang: 35, grav: 0, color: '#7df9ff' },
  board: { r: 15, speed: 13, life: 80, dmg: 6, base: 4, grow: 0.5, ang: 40, grav: 0, boomerang: true, one: true, color: '#2a2320' },
  heart: { r: 13, speed: 5.5, life: 100, dmg: 5, base: 2, grow: 0.12, ang: 70, grav: 0, wave: true, stunBonus: 34, color: '#ff6fb5' },
  smoke: { r: 50, speed: 2.6, life: 145, dmg: 2, base: 2.6, grow: 0.1, ang: 85, grav: 0, multi: 32, drag: 0.96, one: true, color: '#d9d4cc' },
};

// Every fighter is original to TNG. Drawn in code (see components/brawl/draw.js).
export const ROSTER = [
  {
    id: 'tex', name: 'Tex', title: 'The Drifter', color: '#ff5f4a', accent: '#ffd25a', style: 'cowboy',
    blurb: 'All-rounder. Quick draw with a six-shooter.',
    w: 34, h: 66, speed: 5.7, air: 4.7, jump: 12.8, djump: 11.8, airJumps: 1, grav: 0.58, fall: 11.5, weight: 1.0,
    dmg: 1.1, kb: 1.05, size: 1.0, frames: 1.0, recover: 15.5, signature: 'sixshooter',
  },
  {
    id: 'bronco', name: 'Bronco', title: 'The Bull', color: '#c8862e', accent: '#f4e3c1', style: 'bull',
    blurb: 'Heavy hitter. Slow, hard to launch, hits like a freight train.',
    w: 44, h: 76, speed: 4.6, air: 3.9, jump: 12.0, djump: 11.2, airJumps: 1, grav: 0.62, fall: 12.5, weight: 1.32,
    dmg: 1.2, kb: 1.08, size: 1.15, frames: 1.12, recover: 14, signature: 'stampede',
  },
  {
    id: 'dusty', name: 'Dusty', title: 'The Dust Devil', color: '#b46cff', accent: '#ffe066', style: 'scarf',
    blurb: 'Light and lightning fast. Three jumps, rolling tumbleweeds.',
    w: 30, h: 58, speed: 7.1, air: 5.5, jump: 13.2, djump: 11.6, airJumps: 2, grav: 0.55, fall: 11, weight: 0.86,
    dmg: 0.94, kb: 0.95, size: 0.92, frames: 0.85, recover: 15.5, signature: 'tumbleweed',
  },
  {
    id: 'sparky', name: 'Sparky', title: 'The Live Wire', color: '#33d1ff', accent: '#e6fbff', style: 'robot',
    blurb: 'Floaty zoner. Charge a Zap Ball and keep them away.',
    w: 34, h: 64, speed: 5.2, air: 4.9, jump: 12.4, djump: 12.0, airJumps: 1, grav: 0.48, fall: 9.6, weight: 0.92,
    dmg: 0.92, kb: 0.95, size: 1.0, frames: 1.0, recover: 15.5, signature: 'zapball',
  },
  // ── the Bunnie Crew (from TNG reference art) ──
  {
    id: 'danni', name: 'Danni', full: 'Danni Bunnie', title: 'The Skater', color: '#c9772e', accent: '#3a7bd5', style: 'bunny',
    blurb: 'Laid-back skater. Tosses a boomerang skateboard that comes back around.',
    pal: { fur: '#c9772e', shirt: '#b5553a', shirt2: '#3a7bd5', pants: '#5d6a3a', shoe: '#5a3418' },
    w: 34, h: 66, speed: 6.0, air: 5.0, jump: 12.8, djump: 12.0, airJumps: 1, grav: 0.54, fall: 10.6, weight: 0.95,
    dmg: 0.98, kb: 1.0, size: 1.0, frames: 0.95, recover: 16, signature: 'boardtoss',
  },
  {
    id: 'katarina', name: 'Katarina', full: 'Katarina Bunnie', title: 'The Boss', color: '#7b3fb0', accent: '#e0b64a', style: 'bunny',
    blurb: 'Cool under pressure. Her Shakedown counters any hit and punishes it hard.',
    pal: { fur: '#7b3fb0', shirt: '#f2ece0', pants: '#a8916a', shoe: '#1a1a1a' },
    w: 33, h: 66, speed: 5.8, air: 4.8, jump: 12.6, djump: 11.8, airJumps: 1, grav: 0.57, fall: 11.2, weight: 1.0,
    dmg: 1.05, kb: 1.04, size: 1.0, frames: 0.95, recover: 15.5, signature: 'shakedown',
  },
  {
    id: 'brittani', name: 'Brittani', full: 'Brittani Bunnie', title: 'The Showstopper', color: '#ff7aa8', accent: '#ffd36b', style: 'bunny',
    blurb: 'Quick and floaty. A Heart Kiss leaves rivals dazed and wide open.',
    pal: { fur: '#ff7aa8', shirt: '#7e8f2a', pants: '#ff7aa8', shoe: '#ff7aa8' },
    w: 31, h: 62, speed: 6.4, air: 5.2, jump: 13.4, djump: 12.2, airJumps: 1, grav: 0.5, fall: 10, weight: 0.85,
    dmg: 0.9, kb: 0.95, size: 0.96, frames: 0.88, recover: 16, signature: 'heartkiss',
  },
  {
    id: 'richard', name: 'Richard', full: 'Richard Bunnie', title: 'The Enforcer', color: '#9a948c', accent: '#1b1b1f', style: 'bunny',
    blurb: 'Slow, heavy, no patience. His No Nonsense throw goes right through shields.',
    pal: { fur: '#9a948c', shirt: '#33384a', pants: '#20263a', shoe: '#3a2618' },
    w: 40, h: 72, speed: 4.9, air: 4.1, jump: 12.0, djump: 11.2, airJumps: 1, grav: 0.6, fall: 12, weight: 1.25,
    dmg: 1.15, kb: 1.08, size: 1.1, frames: 1.08, recover: 14.5, signature: 'nononsense',
  },
  {
    id: 'robert', name: 'Robert', full: 'Robert Bunnie', title: 'The Haze', color: '#5a3a24', accent: '#3d8a3a', style: 'bunny',
    blurb: 'Big and shaggy. His Hotbox smoke cloud lingers and chips away at anyone inside.',
    pal: { fur: '#5a3a24', shirt: '#5a3a24', pants: '#5a3a24', shoe: '#7a4a28' },
    w: 40, h: 70, speed: 5.0, air: 4.4, jump: 12.2, djump: 11.4, airJumps: 1, grav: 0.58, fall: 11.6, weight: 1.18,
    dmg: 1.08, kb: 1.04, size: 1.08, frames: 1.04, recover: 15, signature: 'hotbox',
  },
];
export const fighterById = (id) => ROSTER.find(f => f.id === id) || ROSTER[0];

/** A move as one fighter does it: sizes, damage and timing scaled to the fighter. */
export function moveFor(ch, key) {
  const src = key === 'signature' ? SIGNATURES[ch.signature] : BASE_MOVES[key];
  const fm = ch.frames, s = ch.size;
  const sf = (n) => Math.max(1, Math.round(n * fm));
  const m = {
    ...src, key, dur: sf(src.dur), landLag: src.landLag ? sf(src.landLag) : 0,
    hits: (src.hits || []).map(h => ({ ...h, f: [sf(h.f[0]), sf(h.f[1])], x: h.x * s, y: h.y * s, r: h.r * s, dmg: h.dmg * ch.dmg, base: h.base * ch.kb, grow: h.grow * ch.kb })),
  };
  if (src.dash) m.dash = { f: [sf(src.dash.f[0]), sf(src.dash.f[1])], vx: src.dash.vx };
  if (src.hover) m.hover = [sf(src.hover[0]), sf(src.hover[1])];
  if (src.proj) m.proj = { ...src.proj, f: sf(src.proj.f) };
  if (src.counter) m.counter = [sf(src.counter[0]), sf(src.counter[1])];
  if (key === 'recover') m.impulse = [{ f: 3, vx: 0, vy: -ch.recover, steer: 4 }];
  else if (src.impulse) m.impulse = src.impulse.map(i => ({ ...i, f: sf(i.f) }));
  return m;
}