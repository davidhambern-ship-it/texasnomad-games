// ─────────────────────────────────────────────────────────────────────────────
// Rodeo Rumble — platform-fighter engine (pure, no DOM). Runs at a fixed 60 steps
// per second. The TV (or a solo device) owns the match; controllers only send
// input snapshots { x, y, jump, light, heavy, dodge }, so phones can drive it later.
//
// Damage % builds up; the higher it is, the further hits launch you. Fly past the
// blast zone and you lose a stock. Last fighter with stocks wins.
//
// Stages are built from SOLIDS (blocks you can't pass through; their outer edges
// have grabbable ledges) and soft PLATS (jump up through, press down to drop;
// they may move).
// ─────────────────────────────────────────────────────────────────────────────
import { fighterById, moveFor, PROJECTILES } from './fighters.js';

export const STAGES = {
  mesa: {
    id: 'mesa', name: 'Big Mesa', theme: 'mesa', blurb: 'The classic. One big mesa, three wooden platforms.',
    solids: [{ x1: -390, x2: 390, y: 0, bottom: 80 }],
    plats: [{ x1: -255, x2: -105, y: -128 }, { x1: 105, x2: 255, y: -128 }, { x1: -75, x2: 75, y: -250 }],
    blast: { x1: -940, x2: 940, y1: -800, y2: 640 },
    spawns: [-250, 250, -95, 95],
    xl: [{ x1: -330, x2: -220, y: -232 }, { x1: 220, x2: 330, y: -232 }],
  },
  saloon: {
    id: 'saloon', name: 'Saloon Rooftops', theme: 'saloon', blurb: 'Two rooftops at night with a gap between them. Mind the drop.',
    solids: [{ x1: -500, x2: -95, y: 0, bottom: 900 }, { x1: 95, x2: 500, y: -36, bottom: 900 }],
    plats: [{ x1: -62, x2: 62, y: -118 }, { x1: -420, x2: -290, y: -150 }, { x1: 290, x2: 420, y: -186 }],
    blast: { x1: -1000, x2: 1000, y1: -820, y2: 560 },
    spawns: [-320, 320, -180, 190], gap: 95,
    xl: [{ x1: -260, x2: -150, y: -262 }, { x1: 150, x2: 260, y: -292 }],
  },
  canyon: {
    id: 'canyon', name: 'Canyon Express', theme: 'canyon', blurb: 'Two cliffs and a runaway minecart rolling between them.',
    solids: [{ x1: -580, x2: -210, y: 0, bottom: 900 }, { x1: 210, x2: 580, y: 0, bottom: 900 }],
    plats: [{ x1: -64, x2: 64, y: -26, move: { ax: 250, period: 460 }, cart: true }, { x1: -470, x2: -330, y: -165 }, { x1: 330, x2: 470, y: -165 }],
    blast: { x1: -1060, x2: 1060, y1: -820, y2: 560 },
    spawns: [-400, 400, -280, 280], gap: 210,
    xl: [{ x1: -160, x2: -50, y: -236 }, { x1: 50, x2: 160, y: -236 }],
  },
  lounge: {
    id: 'lounge', name: 'Bunnie Lounge', theme: 'lounge', blurb: 'The crew’s hangout. Neon, bar stools and a big couch up top.',
    solids: [{ x1: -440, x2: 440, y: 0, bottom: 90 }],
    plats: [{ x1: -310, x2: -225, y: -105 }, { x1: 225, x2: 310, y: -105 }, { x1: -45, x2: 45, y: -150 }, { x1: -170, x2: 170, y: -268 }],
    blast: { x1: -950, x2: 950, y1: -800, y2: 640 },
    spawns: [-270, 270, -110, 110],
    xl: [{ x1: -405, x2: -335, y: -190 }, { x1: 335, x2: 405, y: -190 }],
  },
};
export const STAGE_LIST = Object.values(STAGES);
export const EMPTY_INPUT = { x: 0, y: 0, jump: false, light: false, heavy: false, dodge: false };
const DZ = 0.28; // stick deadzone

function mulberry(seed) {
  let a = 0; for (const c of String(seed)) a = (Math.imul(a ^ c.charCodeAt(0), 2654435761) + 1) | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/**
 * Stages grow with the crowd: up to 4 fighters use the base layout; each extra
 * fighter widens everything by 12.5% (8 fighters = 1.5x wide), central gaps keep
 * their size, and from 6 fighters on two extra platforms drop in.
 */
export const stageScale = (n) => 1 + Math.max(0, Math.min(8, n) - 4) * 0.125;
function buildStage(def, n = 2) {
  const S = JSON.parse(JSON.stringify(def));
  const k = stageScale(n), gap = def.gap || 0;
  const fx = (x) => (Math.abs(x) <= gap ? x : Math.sign(x) * (gap + (Math.abs(x) - gap) * k));
  if (n >= 6 && def.xl) S.plats.push(...JSON.parse(JSON.stringify(def.xl)));
  if (k !== 1) {
    S.solids.forEach(m => { m.x1 = fx(m.x1); m.x2 = fx(m.x2); });
    S.plats.forEach(p => {
      if (p.move) return; // the minecart keeps its track
      const c = fx((p.x1 + p.x2) / 2), w = (p.x2 - p.x1) * (1 + (k - 1) * 0.5);
      p.x1 = c - w / 2; p.x2 = c + w / 2;
    });
    // blast zones move out with the stage edge, but the run-off distance only grows a little
    const dx1 = Math.min(...def.solids.map(m => m.x1)), dx2 = Math.max(...def.solids.map(m => m.x2));
    const grow = 1 + (k - 1) * 0.3;
    S.blast = { ...S.blast, x1: fx(dx1) - (dx1 - def.blast.x1) * grow, x2: fx(dx2) + (def.blast.x2 - dx2) * grow };
  }
  S.scale = k;
  S.spawns = n <= 4 ? S.spawns.map(fx) : spreadSpawns(S, n);
  S.plats.forEach(p => { p.soft = true; p.bx1 = p.x1; p.bx2 = p.x2; p.by = p.y; p.dx = 0; p.dy = 0; });
  S.solids.forEach((s, i) => { s.i = i; });
  S.x1 = Math.min(...S.solids.map(s => s.x1)); S.x2 = Math.max(...S.solids.map(s => s.x2));
  return S;
}
// n evenly spaced starting spots across the solid ground, handed out left/right alternately
function spreadSpawns(S, n) {
  const segs = S.solids.map(m => [m.x1 + 50, m.x2 - 50]);
  const total = segs.reduce((a, [x1, x2]) => a + (x2 - x1), 0);
  const xs = [];
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * total;
    for (const [x1, x2] of segs) { if (d <= x2 - x1) { xs.push(Math.round(x1 + d)); break; } d -= x2 - x1; }
  }
  const out = []; let lo = 0, hi = xs.length - 1;
  while (lo <= hi) { out.push(xs[lo++]); if (lo <= hi) out.push(xs[hi--]); }
  return out;
}
/** top of whatever you'd land on at x (solids and platforms) */
export function surfaceAt(S, x, below = -Infinity) {
  let best = null;
  for (const p of [...S.solids, ...S.plats]) if (x >= p.x1 && x <= p.x2 && p.y >= below && (!best || p.y < best.y)) best = p;
  return best;
}
const solidUnder = (S, x) => S.solids.find(s => x >= s.x1 - 2 && x <= s.x2 + 2) || null;

export function createMatch({ players = [], stocks = 3, stage = 'mesa', seed = Date.now() } = {}) {
  const S = buildStage(STAGES[stage] || STAGES.mesa, players.length);
  const g = {
    frame: 0, stage: S, stocks, rand: mulberry(seed), hitstop: 0, shake: 0, fighters: [], projectiles: [], events: [],
    over: false, winner: null, overAt: 0, nextProj: 1,
  };
  players.forEach((p, i) => {
    const ch = fighterById(p.fighter);
    const sx = S.spawns[i % S.spawns.length];
    const ground = solidUnder(S, sx) || S.solids[0];
    g.fighters.push({
      id: p.id, slot: i, name: p.name || ch.name, ch, color: p.color || ch.color, cpu: p.cpu || 0,
      x: sx, y: ground.y, vx: 0, vy: 0, face: sx < 0 ? 1 : -1,
      ground, jumps: ch.airJumps, dmg: 0, stocks, state: 'stand', t: 0, move: null, stun: 0, inv: 90, shield: 60,
      lag: 0, once: {}, airdodged: false, fastfall: false, prevIn: { ...EMPTY_INPUT }, ledge: null, ledgeCD: 0, dropT: 0, dropPlat: null,
      respawnT: 0, lastHit: null, flash: 0, ai: null, rollDir: 0,
      stats: { kos: 0, falls: 0, dealt: 0, taken: 0 },
    });
  });
  return g;
}

const alive = (g) => g.fighters.filter(F => F.stocks > 0);
function stickDir(inp, face) {
  const ax = Math.abs(inp.x), ay = Math.abs(inp.y);
  if (ax < DZ && ay < DZ) return 'n';
  if (ay > ax * 1.05) return inp.y < 0 ? 'u' : 'd';
  return sign(inp.x) === face ? 'f' : 'b';
}

function startMove(g, F, key, opts = {}) {
  const def = moveFor(F.ch, key);
  if (def.once) { if (F.once[def.once]) return false; F.once[def.once] = true; }
  F.move = { key, def, t: 0, hitIds: new Set(), charging: !!def.charge, chargeT: 0, countered: false };
  F.state = 'move'; F.t = 0;
  if (opts.face) F.face = opts.face;
  g.events.push({ type: 'swing', id: F.id, key });
  return true;
}

function jump(g, F, air) {
  F.vy = -(air ? F.ch.djump : F.ch.jump); F.ground = null; F.state = 'air'; F.fastfall = false; F.t = 0;
  if (air) F.jumps--;
  g.events.push({ type: 'jump', id: F.id, x: F.x, y: F.y, air });
}

function land(g, F, prevVy) {
  F.jumps = F.ch.airJumps; F.once = {}; F.airdodged = false; F.fastfall = false;
  if (F.state === 'hitstun') {
    if (prevVy > 8) { F.vy = -prevVy * 0.42; F.ground = null; g.events.push({ type: 'bounce', x: F.x, y: F.y }); return; }
    F.state = 'land'; F.lag = 10; F.stun = 0; F.vy = 0; return;
  }
  F.vy = 0;
  if (F.state === 'move' && F.move) {
    if (F.move.def.air || F.move.def.endOnLand) { F.lag = F.move.def.landLag || 6; F.move = null; F.state = 'land'; }
  } else if (F.state === 'helpless') { F.state = 'land'; F.lag = 12; }
  else if (F.state === 'airdodge') { F.state = 'land'; F.lag = 6; }
  else if (F.state === 'air' || F.state === 'respawn') { F.state = 'stand'; }
  if (prevVy > 6) g.events.push({ type: 'land', x: F.x, y: F.y, heavy: prevVy > 11 });
}

// ── per-fighter control ─────────────────────────────────────────────────────
function control(g, F, inp) {
  const ch = F.ch, P = F.prevIn;
  const pr = { jump: inp.jump && !P.jump, light: inp.light && !P.light, heavy: inp.heavy && !P.heavy, dodge: inp.dodge && !P.dodge };
  const flickDown = inp.y > 0.7 && P.y <= 0.7;
  const flickSide = Math.abs(inp.x) > 0.7 && Math.abs(P.x) <= 0.7;
  const sx = Math.abs(inp.x) > DZ ? inp.x : 0;
  F.t++;
  if (F.inv > 0) F.inv--;
  if (F.ledgeCD > 0) F.ledgeCD--;
  if (F.dropT > 0) F.dropT--;
  if (F.state !== 'shield' && F.shield < 60) F.shield = Math.min(60, F.shield + 0.12);

  switch (F.state) {
    case 'stand': {
      if (pr.jump) { jump(g, F, false); break; }
      if (inp.dodge) {
        if (flickSide || (pr.dodge && Math.abs(inp.x) > 0.5)) { F.state = 'roll'; F.t = 0; F.rollDir = sign(inp.x); F.inv = 16; break; }
        F.state = 'shield'; F.t = 0; break;
      }
      if (pr.light) {
        const d = stickDir(inp, F.face);
        if (d === 'f' || d === 'b') startMove(g, F, 'ftilt', { face: sign(inp.x) });
        else startMove(g, F, d === 'u' ? 'utilt' : d === 'd' ? 'dtilt' : 'jab');
        break;
      }
      if (pr.heavy) {
        const d = stickDir(inp, F.face);
        if (d === 'f' || d === 'b') startMove(g, F, 'fsmash', { face: sign(inp.x) });
        else startMove(g, F, d === 'u' ? 'usmash' : d === 'd' ? 'dsmash' : 'signature');
        break;
      }
      if (flickDown && F.ground && F.ground.soft) { F.dropT = 14; F.dropPlat = F.ground; F.ground = null; F.state = 'air'; F.vy = 1; break; }
      const target = sx * ch.speed;
      F.vx += (target - F.vx) * (sx ? 0.32 : 0.28);
      if (sx) F.face = sign(sx);
      break;
    }
    case 'air': {
      F.vx += clamp(sx * ch.air - F.vx, -0.5, 0.5);
      if (F.vy > 0 && flickDown) F.fastfall = true;
      if (pr.jump && F.jumps > 0) { if (Math.abs(inp.x) > 0.3) F.face = sign(inp.x); jump(g, F, true); F.vx = sx * ch.air; break; }
      if (pr.dodge && !F.airdodged) { F.state = 'airdodge'; F.t = 0; F.inv = 20; F.airdodged = true; F.vx *= 0.5; F.vy = Math.min(F.vy, 2); break; }
      if (pr.light) {
        const d = stickDir(inp, F.face);
        startMove(g, F, d === 'u' ? 'uair' : d === 'd' ? 'dair' : d === 'f' ? 'fair' : d === 'b' ? 'bair' : 'nair');
        break;
      }
      if (pr.heavy) {
        const d = stickDir(inp, F.face);
        if (d === 'u') startMove(g, F, 'recover');
        else if (d === 'd') startMove(g, F, 'pound');
        else if (d === 'f' || d === 'b') startMove(g, F, 'dash', { face: sign(inp.x) });
        else startMove(g, F, 'signature');
      }
      break;
    }
    case 'helpless':
      F.vx += clamp(sx * ch.air * 0.6 - F.vx, -0.25, 0.25);
      break;
    case 'shield':
      F.vx *= 0.7; F.shield -= 0.3;
      if (F.shield <= 0) { breakShield(g, F); break; }
      if (pr.jump) { jump(g, F, false); break; }
      if (flickSide) { F.state = 'roll'; F.t = 0; F.rollDir = sign(inp.x); F.inv = 16; break; }
      if (!inp.dodge) { F.state = 'stand'; F.t = 0; }
      break;
    case 'roll':
      F.vx = F.t >= 3 && F.t <= 18 ? F.rollDir * 6.4 : F.vx * 0.6;
      if (F.t >= 24) { F.state = 'stand'; F.face = -F.rollDir; }
      break;
    case 'airdodge':
      F.vx *= 0.96;
      if (F.t >= 26) F.state = 'air';
      break;
    case 'land':
      F.vx *= 0.75;
      if (--F.lag <= 0) F.state = 'stand';
      break;
    case 'stunned':
      F.vx *= 0.8;
      if (F.t >= F.lag) F.state = F.ground ? 'stand' : 'air';
      break;
    case 'hitstun':
      if (--F.stun <= 0) { F.state = F.ground ? 'stand' : 'air'; }
      break;
    case 'ledge': {
      const L = F.ledge, s = L.side, toward = -s;
      F.vx = 0; F.vy = 0;
      if (pr.jump) { F.state = 'air'; F.y = L.solid.y - 6; F.x -= s * 6; F.vy = -F.ch.jump * 0.95; F.vx = toward * 1.5; F.ledge = null; g.events.push({ type: 'jump', id: F.id, x: F.x, y: F.y }); break; }
      if (F.t > 6 && ((inp.x * toward > 0.6) || inp.y < -0.6 || pr.light || pr.heavy)) { climb(F); break; }
      if (F.t > 6 && (inp.y > 0.6 || inp.x * s > 0.6)) { F.state = 'air'; F.ledgeCD = 30; F.vy = 1; F.ledge = null; break; }
      if (F.t > 300) { F.state = 'air'; F.ledgeCD = 60; F.ledge = null; }
      break;
    }
    case 'respawn':
      F.vx = 0; F.vy = 0;
      if (F.t > 20 && (sx || inp.y > 0.5 || pr.jump || pr.light || pr.heavy || pr.dodge || F.t > 160)) { F.state = 'air'; F.jumps = ch.airJumps; }
      break;
    case 'move': runMove(g, F, inp, sx); break;
    default: break;
  }
  F.prevIn = { ...inp };
}

function climb(F) {
  const L = F.ledge, m = L.solid;
  F.state = 'stand'; F.ground = m; F.y = m.y; F.x = L.side < 0 ? m.x1 + F.ch.w : m.x2 - F.ch.w; F.vx = 0; F.vy = 0; F.inv = Math.max(F.inv, 10); F.t = 0; F.ledge = null;
}

function breakShield(g, F) {
  F.state = 'stunned'; F.t = 0; F.lag = 150; F.shield = 30; F.vy = -9; F.ground = null;
  g.events.push({ type: 'shieldbreak', id: F.id, x: F.x, y: F.y - F.ch.h });
}

function runMove(g, F, inp, sx) {
  const m = F.move, d = m.def;
  if (m.charging) {
    const max = d.maxCharge || 60;
    if (inp.heavy && m.chargeT < max) { m.chargeT++; F.vx *= 0.8; return; }
    m.charging = false;
  }
  m.t++;
  const t = m.t;
  if (F.ground) { if (!d.dash) F.vx *= 0.82; }
  else if (!d.dash || t < d.dash.f[0] || t > d.dash.f[1]) F.vx += clamp(sx * F.ch.air - F.vx, -0.3, 0.3);
  for (const imp of d.impulse || []) if (imp.f === t) {
    F.vy = imp.vy; F.ground = null;
    F.vx = imp.steer ? sx * imp.steer : imp.vx * F.face;
    if (imp.vy < 0) g.events.push({ type: 'jump', id: F.id, x: F.x, y: F.y, air: true });
  }
  if (d.dash && t >= d.dash.f[0] && t <= d.dash.f[1]) F.vx = d.dash.vx * F.face;
  if (d.proj && d.proj.f === t) spawnProjectile(g, F, d.proj.kind, m.chargeT / (d.maxCharge || 60));
  if (t >= d.dur) {
    F.move = null;
    F.state = d.helpless ? 'helpless' : F.ground ? 'stand' : 'air';
    F.t = 0;
  }
}

function spawnProjectile(g, F, kind, charge = 0) {
  const P = PROJECTILES[kind];
  if (P.one && g.projectiles.some(p => p.owner === F.id && p.kind === kind)) { g.events.push({ type: 'fizzle', id: F.id }); return; }
  const big = kind === 'zap' ? 1 + charge * 1.4 : 1;
  g.projectiles.push({
    id: g.nextProj++, owner: F.id, kind, x: F.x + F.face * (F.ch.w * 0.6 + P.r * (kind === 'smoke' ? 0.4 : 1)), y: F.y - F.ch.h * (kind === 'smoke' ? 0.5 : 0.55),
    vx: P.speed * F.face, vy: P.vy || 0, r: P.r * big, dmg: P.dmg * big * F.ch.dmg, base: P.base * (kind === 'zap' ? 1 + charge : 1), grow: P.grow * (kind === 'zap' ? 1 + charge * 0.8 : 1),
    ang: P.ang, life: P.life, max: P.life, grav: P.grav, bounce: P.bounce || 0, color: P.color, face: F.face, t: 0,
    boomerang: !!P.boomerang, wave: !!P.wave, stunBonus: P.stunBonus || 0, multi: P.multi || 0, drag: P.drag || 1, cool: {}, baseY: 0,
  });
  g.projectiles[g.projectiles.length - 1].baseY = g.projectiles[g.projectiles.length - 1].y;
  g.events.push({ type: 'shoot', id: F.id, kind });
}

// ── stage motion ────────────────────────────────────────────────────────────
function moveStage(g) {
  for (const p of g.stage.plats) {
    if (!p.move) { p.dx = 0; p.dy = 0; continue; }
    const ph = (g.frame / p.move.period) * Math.PI * 2;
    const ox = Math.sin(ph) * (p.move.ax || 0), oy = Math.sin(ph) * (p.move.ay || 0);
    const nx1 = p.bx1 + ox, ny = p.by + oy;
    p.dx = nx1 - p.x1; p.dy = ny - p.y;
    p.x1 = nx1; p.x2 = p.bx2 + ox; p.y = ny;
  }
  for (const F of g.fighters) if (F.ground && F.ground.soft && (F.ground.dx || F.ground.dy)) { F.x += F.ground.dx; F.y = F.ground.y; }
}

// ── physics & collisions ────────────────────────────────────────────────────
function physics(g, F) {
  if (F.state === 'out' || F.state === 'ledge' || F.state === 'respawn') return;
  const ch = F.ch, S = g.stage;
  const hovering = F.state === 'move' && F.move.def.hover && F.move.t >= F.move.def.hover[0] && F.move.t <= F.move.def.hover[1];
  if (!F.ground) {
    if (hovering) F.vy = 0;
    else {
      F.vy += ch.grav * (F.state === 'airdodge' ? 0.55 : 1);
      if (F.state === 'hitstun') { F.vx *= 0.955; if (F.vy < 0) F.vy *= 0.975; }
      else F.vy = Math.min(F.vy, F.fastfall ? ch.fall * 1.45 : ch.fall);
    }
  }
  const prevY = F.y, prevVy = F.vy;
  F.x += F.vx; F.y += F.vy;

  if (F.ground) {
    if (F.x < F.ground.x1 || F.x > F.ground.x2) {
      F.ground = null;
      if (F.state === 'stand' || F.state === 'shield' || F.state === 'roll' || F.state === 'land') { F.state = 'air'; F.t = 0; }
    } else F.y = F.ground.y;
    if (F.state === 'hitstun' && F.vy < -0.5) F.ground = null;
  }
  if (!F.ground && F.vy >= 0) {
    for (const p of [...S.solids, ...S.plats]) {
      if (p.soft && (F.dropT > 0 && F.dropPlat === p)) continue;
      if (p.soft && F.state === 'hitstun' && F.vy > 10) continue;
      const top = p.y, prevTop = p.y - (p.dy || 0);
      if (prevY <= prevTop + 0.5 && F.y >= top && F.x >= p.x1 && F.x <= p.x2) { F.y = top; F.ground = p; land(g, F, prevVy); break; }
    }
  }
  // solids are solid: walls and undersides
  const hw = ch.w / 2;
  for (const m of S.solids) {
    if (F.ground === m) continue;
    if (F.y > m.y + 1 && F.y - ch.h < m.bottom && F.x + hw > m.x1 && F.x - hw < m.x2) {
      const prevHead = prevY - ch.h;
      if (prevHead >= m.bottom - 1 && F.vy < 0) { F.y = m.bottom + ch.h; F.vy = Math.max(0, -F.vy * 0.3); }
      else if (F.x < (m.x1 + m.x2) / 2) { F.x = m.x1 - hw; if (F.state === 'hitstun') F.vx = -Math.abs(F.vx) * 0.5; else F.vx = Math.min(F.vx, 0); }
      else { F.x = m.x2 + hw; if (F.state === 'hitstun') F.vx = Math.abs(F.vx) * 0.5; else F.vx = Math.max(F.vx, 0); }
    }
  }
  // ledge grab
  if (!F.ground && F.ledgeCD === 0 && F.vy > -3 && (F.state === 'air' || F.state === 'helpless' || F.state === 'airdodge' || (F.state === 'move' && F.move.key === 'recover'))) {
    for (const m of S.solids) {
      for (const s of [-1, 1]) {
        const edge = s < 0 ? m.x1 : m.x2;
        const hangX = edge + s * (hw + 2);
        if (Math.abs(F.x - hangX) < 28 && F.y >= m.y - 12 && F.y <= m.y + ch.h + 40 && F.x * s >= edge * s - 6) {
          if (g.fighters.some(o => o !== F && o.state === 'ledge' && o.ledge && o.ledge.solid === m && o.ledge.side === s)) continue;
          F.state = 'ledge'; F.ledge = { solid: m, side: s }; F.x = hangX; F.y = m.y + ch.h * 0.78; F.vx = 0; F.vy = 0; F.face = -s; F.t = 0; F.move = null;
          F.inv = Math.max(F.inv, F.once.ledged ? 0 : 40); F.once = { ledged: true }; F.jumps = F.ch.airJumps; F.airdodged = false;
          g.events.push({ type: 'ledge', id: F.id });
          return;
        }
      }
    }
  }
}

// ── hits ────────────────────────────────────────────────────────────────────
function boxOf(F) { const hw = F.ch.w / 2; return { x1: F.x - hw, x2: F.x + hw, y1: F.y - F.ch.h, y2: F.y }; }
function circleHits(cx, cy, r, b) { const nx = clamp(cx, b.x1, b.x2), ny = clamp(cy, b.y1, b.y2); return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r; }
const hittable = (T) => T.state !== 'out' && T.state !== 'respawn' && T.inv <= 0;

/** returns 'hit' | 'block' | 'counter' */
function applyHit(g, A, T, h, mul, dirFace, px, py, fromProj = false) {
  const dmg = h.dmg * mul;
  // Katarina's Shakedown: catch the hit and punish it
  const c = T.state === 'move' && T.move && T.move.def.counter;
  if (c && !T.move.countered && T.move.t >= c[0] && T.move.t <= c[1]) {
    T.move.countered = true; T.move.t = c[1] + 1; T.inv = Math.max(T.inv, 18);
    g.events.push({ type: 'counter', id: T.id, x: T.x, y: T.y - T.ch.h * 0.6 });
    g.hitstop = Math.max(g.hitstop, 8);
    if (A && !fromProj) {
      T.face = sign(A.x - T.x) || T.face;
      applyHit(g, T, A, { dmg: Math.max(9, dmg * 1.3) * T.ch.dmg, base: 8.5, grow: 1.05, ang: 38 }, 1, T.face, (A.x + T.x) / 2, A.y - A.ch.h / 2);
    }
    return 'counter';
  }
  if (T.state === 'shield' && !h.unblockable) {
    T.shield -= dmg * 1.5; T.vx = dirFace * Math.min(9, 2 + dmg * 0.35);
    g.hitstop = Math.max(g.hitstop, 3);
    g.events.push({ type: 'block', x: px, y: py, id: T.id });
    if (T.shield <= 0) breakShield(g, T);
    return 'block';
  }
  T.dmg = Math.min(999, T.dmg + dmg);
  const kb = (h.base * (0.85 + 0.15 * mul) + T.dmg * h.grow * 0.13 + dmg * 0.3 * h.grow) / T.ch.weight;
  const a = (h.ang * Math.PI) / 180;
  const speed = kb * 0.66;
  T.vx = Math.cos(a) * speed * dirFace; T.vy = -Math.sin(a) * speed;
  if (T.ground && T.vy > 0) T.vy = -T.vy * 0.45;
  if (T.vy < -0.5 || speed > 5) T.ground = null;
  if (T.state === 'ledge') T.ledge = null;
  T.state = 'hitstun'; T.stun = Math.round(6 + kb * 1.5 + (h.stunBonus || 0)); T.move = null; T.fastfall = false; T.once = {}; T.airdodged = false; T.flash = 8;
  if (h.stunBonus) T.dazed = T.stun;
  T.lastHit = { by: A ? A.id : null, frame: g.frame };
  T.stats.taken += dmg; if (A) A.stats.dealt += dmg;
  g.hitstop = Math.max(g.hitstop, Math.min(14, Math.round(3 + dmg / 2.4 + (kb > 16 ? 3 : 0))));
  if (kb > 15) g.shake = Math.max(g.shake, Math.min(18, kb * 0.6));
  g.events.push({ type: 'hit', x: px, y: py, dmg, kb, id: T.id, by: A ? A.id : null, ang: Math.atan2(T.vy, T.vx), heart: !!h.stunBonus, unblockable: !!h.unblockable });
  return 'hit';
}

function hits(g) {
  for (const A of g.fighters) {
    const m = A.move;
    if (!m || m.charging || A.state !== 'move') continue;
    const mul = m.def.charge && m.key !== 'signature' ? 1 + 0.45 * (m.chargeT / 60) : 1;
    for (const h of m.def.hits) {
      if (m.t < h.f[0] || m.t > h.f[1]) continue;
      const cx = A.x + h.x * A.face, cy = A.y + h.y;
      for (const T of g.fighters) {
        if (T === A || m.hitIds.has(T.id) || !hittable(T)) continue;
        if (circleHits(cx, cy, h.r, boxOf(T))) { m.hitIds.add(T.id); applyHit(g, A, T, h, mul, A.face, cx, cy); if (A.state !== 'move') break; }
      }
      if (A.state !== 'move' || !A.move) break;
    }
  }
  const S = g.stage;
  g.projectiles = g.projectiles.filter(p => {
    p.life--; p.t++;
    const owner = g.fighters.find(f => f.id === p.owner);
    if (p.boomerang) {
      // flies out, slows, then homes back to its thrower
      if (p.t > 20 && owner && owner.state !== 'out') {
        const tx = owner.x - p.x, ty = owner.y - owner.ch.h * 0.55 - p.y, d = Math.hypot(tx, ty) || 1;
        p.vx += (tx / d) * 1.1; p.vy += (ty / d) * 1.1;
        const sp = Math.hypot(p.vx, p.vy); if (sp > 13) { p.vx *= 13 / sp; p.vy *= 13 / sp; }
        if (d < 30 && p.t > 28) return false;
      }
    }
    if (p.drag !== 1) { p.vx *= p.drag; p.vy *= p.drag; }
    p.vy += p.grav; p.x += p.vx; p.y += p.vy;
    if (p.wave) p.y = p.baseY + Math.sin(p.t * 0.18) * 14;
    if (p.grav) {
      for (const pl of [...S.solids, ...S.plats]) if (p.vy > 0 && p.y + p.r >= pl.y && p.y + p.r - p.vy <= pl.y + 1 && p.x >= pl.x1 && p.x <= pl.x2) { p.y = pl.y - p.r; p.vy = -Math.max(4, p.vy * p.bounce); }
    } else if (!p.multi && !p.boomerang && S.solids.some(m => p.x > m.x1 && p.x < m.x2 && p.y > m.y && p.y < m.bottom)) return false;
    if (p.life <= 0 || p.y > S.blast.y2 || p.x < S.blast.x1 || p.x > S.blast.x2) return false;
    for (const T of g.fighters) {
      if (T.id === p.owner || !hittable(T)) continue;
      if (p.multi && (p.cool[T.id] || 0) > p.t) continue;
      if (circleHits(p.x, p.y, p.r, boxOf(T))) {
        const dir = p.multi ? (sign(T.x - p.x) || p.face) : (sign(p.vx) || p.face);
        const r = applyHit(g, owner, T, p, 1, dir, p.x, p.y, true);
        if (p.multi) { p.cool[T.id] = p.t + p.multi; continue; }
        if (r === 'counter' || r === 'block' || r === 'hit') return false;
      }
    }
    return true;
  });
}

// ── KOs ─────────────────────────────────────────────────────────────────────
function blast(g, F) {
  if (F.state === 'out') return;
  const b = g.stage.blast;
  const outTop = F.y < b.y1 && F.state === 'hitstun';
  if (!(F.x < b.x1 || F.x > b.x2 || F.y > b.y2 || outTop)) return;
  F.stocks--; F.stats.falls++;
  const by = F.lastHit && g.frame - F.lastHit.frame < 360 ? F.lastHit.by : null;
  const K = by && g.fighters.find(f => f.id === by); if (K) K.stats.kos++;
  g.events.push({ type: 'ko', id: F.id, by, x: clamp(F.x, b.x1, b.x2), y: clamp(F.y, b.y1, b.y2), side: F.x < b.x1 ? 'left' : F.x > b.x2 ? 'right' : F.y > b.y2 ? 'bottom' : 'top', stocksLeft: F.stocks });
  g.shake = Math.max(g.shake, 16);
  F.state = 'out'; F.move = null; F.vx = 0; F.vy = 0; F.ground = null; F.ledge = null; F.respawnT = F.stocks > 0 ? 80 : -1;
}

function respawnTick(g, F) {
  if (F.state !== 'out' || F.respawnT < 0) return;
  if (--F.respawnT > 0) return;
  const S = g.stage;
  const lanes = S.spawns;
  F.x = lanes[F.slot % lanes.length] * 0.6;
  const surf = surfaceAt(S, F.x) || S.solids[0];
  F.y = Math.min(surf.y, 0) - 300; F.vx = 0; F.vy = 0; F.dmg = 0; F.state = 'respawn'; F.t = 0; F.inv = 150; F.jumps = F.ch.airJumps; F.once = {}; F.face = F.x < 0 ? 1 : -1; F.shield = 60;
  g.events.push({ type: 'respawn', id: F.id });
}

// ── CPU fighters ────────────────────────────────────────────────────────────
function cpuInput(g, F) {
  const R = g.rand, L = clamp(F.cpu, 1, 9), S = g.stage;
  const ai = F.ai || (F.ai = { next: 0, move: 0, holdHeavy: 0, shieldUntil: 0 });
  const inp = { ...EMPTY_INPUT };
  inp.heavy = g.frame < ai.holdHeavy;
  inp.dodge = g.frame < ai.shieldUntil;
  if (F.state === 'out') return inp;
  if (F.state === 'respawn') { if (F.t > 30 + R() * 30) inp.x = -sign(F.x) * 0.5; return inp; }
  if (F.state === 'ledge') { if (F.t > 12 + R() * (40 - L * 3)) { if (R() < 0.5) inp.jump = !F.prevIn.jump; else inp.x = -F.ledge.side; } return inp; }
  // off-stage: head for the nearest solid ground
  const under = solidUnder(S, F.x);
  // only panic once we've dropped below the ground line (so CPUs can jump across gaps)
  const nearTop = Math.min(...S.solids.map(m => m.y + Math.max(0, Math.abs(F.x - clamp(F.x, m.x1, m.x2)) > 400 ? 999 : 0)));
  const off = !F.ground && (under ? F.y > under.y + 4 : F.y > nearTop - 20 || (F.vy > 2 && F.jumps === 0));
  if (off) {
    let home = null, best = Infinity;
    for (const m of S.solids) { const ex = clamp(F.x, m.x1 + 30, m.x2 - 30); const d = Math.abs(ex - F.x) + Math.max(0, F.y - m.y) * 0.3; if (d < best) { best = d; home = m; } }
    const hx = clamp(F.x, home.x1 + 30, home.x2 - 30);
    const dir = sign(hx - F.x) || -sign(F.x);
    inp.x = dir;
    const below = F.y > home.y - 30;
    if (F.vy > -1.5 && below) {
      if (F.jumps > 0 && !F.prevIn.jump) inp.jump = true;
      else if (!F.once.recover && F.state === 'air' && F.y > home.y + 10 && !F.prevIn.heavy) { inp.heavy = true; inp.y = -1; inp.x = dir * 0.4; }
      else if (!F.once.dash && F.state === 'air' && Math.abs(hx - F.x) > 160 && F.y < home.y + 30 && !F.prevIn.heavy) { inp.heavy = true; inp.x = dir; }
    }
    return inp;
  }
  const foes = g.fighters.filter(o => o !== F && o.stocks > 0 && o.state !== 'out');
  if (!foes.length) return inp;
  const T = foes.reduce((a, b) => (Math.hypot(b.x - F.x, b.y - F.y) < Math.hypot(a.x - F.x, a.y - F.y) ? b : a));
  const dx = T.x - F.x, dy = T.y - F.y, adx = Math.abs(dx);
  if (g.frame < ai.next) { inp.x = ai.move; return inp; }
  ai.next = g.frame + Math.round((24 - L * 2.2) * (0.6 + R() * 0.8));
  ai.move = 0;
  const sig = F.ch.signature;
  const dir = sign(dx) || F.face;
  // defend against a nearby attack (Katarina counters instead)
  if (T.move && !T.move.charging && adx < 120 && Math.abs(dy) < 90 && R() < 0.05 * L) {
    if (F.ground && F.state === 'stand' && sig === 'shakedown' && R() < 0.6) { inp.heavy = true; return inp; }
    if (F.ground) { ai.shieldUntil = g.frame + 14 + Math.round(R() * 12); inp.dodge = true; return inp; }
    if (!F.airdodged) { inp.dodge = true; return inp; }
  }
  const reach = 58 + F.ch.w * 0.6;
  if (adx < reach && Math.abs(dy) < 75 && T.state !== 'respawn') {
    if (F.ground && F.state === 'stand') {
      const killPct = 105 - L * 4;
      const roll = R();
      if (sig === 'nononsense' && (T.state === 'shield' || roll < 0.18) && F.face === dir) { inp.heavy = true; }
      else if (sig === 'hotbox' && roll < 0.12) { inp.heavy = true; }
      else if (T.dmg > killPct && roll < 0.55) { inp.heavy = true; inp.x = dy < -40 ? 0 : dir; inp.y = dy < -40 ? -1 : 0; ai.holdHeavy = g.frame + Math.round(R() * 20); }
      else if (dy < -45) { inp.light = true; inp.y = -1; }
      else if (roll < 0.15) { inp.heavy = true; inp.y = 1; }
      else if (roll < 0.6) { inp.light = true; inp.x = dir; }
      else { inp.light = true; if (F.face !== dir) inp.x = dir * 0.5; }
    } else if (F.state === 'air') {
      inp.light = true;
      if (dy > 35) inp.y = 1; else if (dy < -40) inp.y = -1; else inp.x = dir;
    }
    return inp;
  }
  // approach
  ai.move = dir; inp.x = dir;
  if (F.ground && F.state === 'stand') {
    if (dy < -90 && adx < 200) inp.jump = true;
    else if (dy > 60 && F.ground.soft) inp.y = 1;
    if (Math.abs(dy) < 70 && F.face === dir && R() < 0.22) {
      const ranged = ['sixshooter', 'zapball', 'tumbleweed', 'boardtoss', 'heartkiss'].includes(sig);
      if (ranged && adx > 180 && adx < 560) { inp.heavy = true; inp.x = 0; ai.holdHeavy = sig === 'zapball' ? g.frame + Math.round(R() * 50) : 0; ai.move = 0; }
      else if (sig === 'stampede' && adx > 140 && adx < 330) { inp.heavy = true; inp.x = 0; ai.move = 0; }
      else if (sig === 'hotbox' && adx > 90 && adx < 200) { inp.heavy = true; inp.x = 0; ai.move = 0; }
    }
    // don't run off the edge chasing someone who is off-stage
    const g0 = F.ground;
    const tUnder = solidUnder(S, T.x);
    const offT = !tUnder || T.y > tUnder.y + 4;
    if (offT && ((F.x < g0.x1 + 50 && dir < 0) || (F.x > g0.x2 - 50 && dir > 0))) { ai.move = 0; inp.x = 0; }
    // don't stroll into a pit between solids
    if (!g0.soft && ((F.x < g0.x1 + 30 && dir < 0) || (F.x > g0.x2 - 30 && dir > 0)) && Math.abs(dy) < 40) { inp.jump = !F.prevIn.jump && R() < 0.5; if (!inp.jump) { ai.move = 0; inp.x = 0; } }
  } else if (F.state === 'air' && ((dy < -70 && F.vy > 0 && R() < 0.4) || (!under && F.vy > 1)) && F.jumps > 0 && !F.prevIn.jump) inp.jump = true;
  return inp;
}

// ── step ────────────────────────────────────────────────────────────────────
export function step(g, inputs = {}) {
  g.events = [];
  if (g.shake > 0) g.shake *= 0.86;
  if (g.hitstop > 0) { g.hitstop--; return g; }
  g.frame++;
  moveStage(g);
  for (const F of g.fighters) {
    if (F.flash > 0) F.flash--;
    if (F.dazed > 0) F.dazed--;
    if (F.stocks <= 0 && F.state === 'out') continue;
    const inp = F.cpu ? cpuInput(g, F) : (inputs[F.id] || EMPTY_INPUT);
    if (F.state === 'out') { respawnTick(g, F); F.prevIn = { ...inp }; continue; }
    control(g, F, inp);
  }
  for (const F of g.fighters) physics(g, F);
  hits(g);
  for (const F of g.fighters) blast(g, F);
  if (!g.over && g.fighters.length > 1 && alive(g).length <= 1) {
    g.over = true; g.overAt = g.frame; g.winner = alive(g)[0]?.id || null;
    g.events.push({ type: 'gameover', winner: g.winner });
  }
  return g;
}