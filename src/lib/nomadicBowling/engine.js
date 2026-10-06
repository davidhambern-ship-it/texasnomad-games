export const STAGES = [
  { id: 'neon-saloon', name: 'Neon Spur Saloon', accent: '#32e6ff', warm: '#ffbb5c', wall: '#160e25', lane: '#704131', sign: 'NEON SPUR', detail: 'CYBER SALOON · SECTOR 07' },
  { id: 'western-room', name: 'Copper Cactus Game Room', accent: '#ffab52', warm: '#75f6b3', wall: '#24140f', lane: '#85502f', sign: 'COPPER CACTUS', detail: 'WESTERN GAME ROOM · HIGH STAKES' },
  { id: 'midnight-saloon', name: 'Midnight Mirage', accent: '#f373ff', warm: '#3cf1d3', wall: '#15102a', lane: '#53314e', sign: 'MIDNIGHT MIRAGE', detail: 'CYBER SALOON · AFTER DARK' },
];
export const DEFAULTS = { mode: 'brawl', teams: false, stage: 'neon-saloon' };
export const PIN_POSITIONS = Array.from({ length: 4 }, (_, row) => Array.from({ length: row + 1 }, (_, col) => ({ id: row * (row + 1) / 2 + col, x: (col - row / 2) * .084, z: .82 + row * .056 }))).flat();
export const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
const pins = () => PIN_POSITIONS.map(p => p.id);
function rand(g) { let x = g.randomState | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; g.randomState = x >>> 0; return g.randomState / 4294967296; }
export function scoreFrames(frames) {
  const flat = frames.flat(), cumulative = []; let offset = 0, total = 0, blocked = false;
  for (let f = 0; f < 10; f++) {
    const a = frames[f] || []; let value = null;
    if (f === 9) {
      const done = a.length >= 3 || (a.length === 2 && a[0] + a[1] < 10);
      if (done) value = a.reduce((s, v) => s + v, 0);
    } else if (a[0] === 10) {
      if (flat.length >= offset + 3) value = 10 + flat[offset + 1] + flat[offset + 2];
    } else if (a.length === 2) {
      if (a[0] + a[1] === 10) { if (flat.length > offset + 2) value = 10 + flat[offset + 2]; }
      else value = a[0] + a[1];
    }
    offset += a.length;
    if (value == null) blocked = true;
    if (!blocked) { total += value; cumulative.push(total); } else cumulative.push(null);
  }
  return { total, cumulative };
}
export function marks(a = [], frame = 0) {
  return a.map((v, i) => {
    if (v === 10) return 'X';
    if (i > 0 && a[i - 1] !== 10 && a[i - 1] + v === 10 && (frame < 9 || i === 1 || a[0] === 10)) return '/';
    return v === 0 ? '–' : String(v);
  });
}
export function ballPosition(shot, progress) {
  const p = clamp(progress, 0, 1.1);
  const curl = shot.spin * .20 * p * p * (.8 + (1 - shot.power) * .5);
  const bend = shot.hit ? shot.push * .38 * Math.max(0, p - shot.hitProgress) : 0;
  return { x: shot.start * (1 - p) + shot.aim * p + curl + bend, z: p };
}
export function resolvePins(standing, shot) {
  const fallen = new Set(), struck = new Set();
  for (let p = 0; p <= .82; p += .01) if (Math.abs(ballPosition(shot, p).x) > .46) return [];
  const bodies = PIN_POSITIONS.filter(p => standing.includes(p.id)).map(p => ({ ...p, ox: p.x, oz: p.z, vx: 0, vz: 0 }));
  const dt = 1 / 120, speed = .42 + shot.power * .55;
  let z = .70, ball = ballPosition(shot, z), bx = ball.x, bvx = (shot.aim - shot.start + shot.spin * .30 + (shot.hit ? shot.push * .38 : 0)) * speed;
  for (let step = 0; step < 260; step++) {
    bx += bvx * dt; z += speed * dt;
    for (const pin of bodies) {
      if (!struck.has(pin.id) && z < 1.13 && Math.abs(bx) < .48 && Math.hypot(pin.x - bx, pin.z - z) < .060) {
        const dx = pin.x - bx, dz = pin.z - z, d = Math.hypot(dx, dz) || .01;
        pin.vx += (dx / d * .28 + bvx * .35) * shot.power;
        pin.vz += Math.max(.13, dz / d * .42 + speed * .24) * shot.power;
        fallen.add(pin.id); struck.add(pin.id);
      }
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > .050 || d < .001) continue;
      const nx = dx / d, nz = dz / d, approach = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (approach > .015) {
        const impulse = approach * .72; a.vx -= nx * impulse; a.vz -= nz * impulse; b.vx += nx * impulse; b.vz += nz * impulse;
        if (Math.hypot(b.vx, b.vz) > .045) fallen.add(b.id);
        if (Math.hypot(a.vx, a.vz) > .045) fallen.add(a.id);
      }
      const separate = (.050 - d) / 2; a.x -= nx * separate; a.z -= nz * separate; b.x += nx * separate; b.z += nz * separate;
    }
    for (const pin of bodies) { pin.x += pin.vx * dt; pin.z += pin.vz * dt; pin.vx *= .986; pin.vz *= .986; if (Math.hypot(pin.x - pin.ox, pin.z - pin.oz) > .025) fallen.add(pin.id); }
  }
  return [...fallen];
}
function note(g, text) { g.seq++; g.log.push({ seq: g.seq, text }); g.log = g.log.slice(-8); }
function enemy(g, id) { const p = g.players.find(x => x.id === id), at = g.players.indexOf(p); for (let n = 1; n < g.players.length; n++) { const q = g.players[(at + n) % g.players.length]; if (!g.settings.teams || p.team !== q.team) return q; } return null; }
export function createGame({ players, settings = {}, seed = 107, now = Date.now() }) {
  if (!players || players.length < 2 || players.length > 8) throw Error('Bowling needs 2–8 seats.');
  const s = { ...DEFAULTS, ...settings }; s.mode = s.mode === 'classic' ? 'classic' : 'brawl'; s.stage = STAGES.some(x => x.id === s.stage) ? s.stage : DEFAULTS.stage; s.teams = Boolean(s.teams);
  if (s.teams && players.length % 2) throw Error('Teams need an even number of seats.');
  const g = { settings: s, players: players.map((p, i) => ({ id: p.id, name: p.name, color: p.color || '#32e6ff', cpu: Boolean(p.cpu), team: i % 2, frames: Array.from({ length: 10 }, () => []), charges: s.mode === 'brawl' ? 3 : 0 })), frame: 0, turn: 0, phase: 'aim', phaseAt: now, deadline: now + 45000, standing: pins(), delivery: null, seq: 0, log: [], randomState: Number(seed) >>> 0 || 107, winnerIds: [] };
  note(g, 'Welcome to Nomadic Bowling. Ten frames. No mercy.'); return g;
}
function finishFrame(g, now) {
  g.turn++;
  if (g.turn >= g.players.length) { g.turn = 0; g.frame++; }
  if (g.frame >= 10) {
    g.phase = 'final';
    const scores = g.players.map(p => ({ id: p.id, team: p.team, score: scoreFrames(p.frames).total }));
    if (g.settings.teams) { const totals = [0, 0]; scores.forEach(p => { totals[p.team] += p.score; }); const best = Math.max(...totals); g.winnerIds = scores.filter(p => totals[p.team] === best).map(p => p.id); }
    else { const best = Math.max(...scores.map(p => p.score)); g.winnerIds = scores.filter(p => p.score === best).map(p => p.id); }
    note(g, 'FINAL · ' + g.players.filter(p => g.winnerIds.includes(p.id)).map(p => p.name).join(' & ') + ' wins.'); return;
  }
  g.standing = pins(); g.phase = 'aim'; g.phaseAt = now; g.deadline = now + 45000; g.delivery = null;
}
function commitDelivery(g, now) {
  const p = g.players[g.turn], a = p.frames[g.frame], count = g.delivery.knocked.length;
  a.push(count); note(g, `${p.name}: ${count === 10 ? 'STRIKE!' : count + ' pins'}${g.delivery.hit ? ' · sabotage + revenge' : ''}`);
  const left = g.standing.filter(id => !g.delivery.knocked.includes(id));
  let complete = false, reset = false;
  if (g.frame < 9) complete = a[0] === 10 || a.length === 2;
  else {
    complete = a.length === 3 || (a.length === 2 && a[0] + a[1] < 10);
    reset = !complete && (count === 10 || (a.length === 2 && a[0] !== 10 && a[0] + a[1] === 10));
  }
  if (complete) finishFrame(g, now);
  else { g.standing = reset ? pins() : left; g.phase = 'aim'; g.phaseAt = now; g.deadline = now + 45000; g.delivery = null; }
}
function settle(g, now) { g.phase = 'settling'; g.phaseAt = now; g.deadline = now + 1600; }
export function act(g, id, action, now = Date.now()) {
  tick(g, now);
  const me = g.players.find(p => p.id === id), bowler = g.players[g.turn];
  const fail = error => ({ ok: false, error });
  if (!me || g.phase === 'final') return fail('This game is not accepting moves.');
  if (action.type === 'bowl') {
    if (g.phase !== 'aim' || id !== bowler.id) return fail('Wait for your turn to bowl.');
    for (const key of ['aim', 'start', 'spin', 'power']) if (!Number.isFinite(Number(action[key]))) return fail('Set aim, position, spin and power first.');
    const power = clamp(action.power, .3, 1);
    const release = Math.sin((now - g.phaseAt) / 530) * .11;
    g.delivery = { start: clamp(action.start, -.28, .28), aim: clamp(action.aim, -.34, .34) + release, release, spin: clamp(action.spin, -1, 1), power, launchedAt: now, duration: 4200 + (1 - power) * 1200, hit: false, push: 0, hitProgress: 0, attack: null, knocked: [], revengeShot: null };
    g.phase = 'rolling'; g.phaseAt = now; g.deadline = now + g.delivery.duration; note(g, `${bowler.name} sends it!`); return { ok: true };
  }
  if (action.type === 'sabotage') {
    if (g.settings.mode !== 'brawl' || g.phase !== 'rolling' || enemy(g, bowler.id)?.id !== id) return fail('Only the nominated rival can sabotage this roll.');
    if (!me.charges || g.delivery.attack) return fail('No sabotage charge available for this roll.');
    if (!Number.isFinite(Number(action.x))) return fail('Aim your sabotage shot.');
    me.charges--; g.delivery.attack = { by: id, x: clamp(action.x, -.45, .45), push: action.push === -1 ? -1 : 1, firedAt: now, impactAt: now + 200, resolved: false, hit: false }; return { ok: true };
  }
  if (action.type === 'revenge') {
    if (g.phase !== 'revenge' || id !== bowler.id || g.delivery.revengeShot) return fail('No revenge shot available.');
    if (!Number.isFinite(Number(action.x)) || !Number.isFinite(Number(action.z))) return fail('Aim at a standing pin.');
    const x = clamp(action.x, -.45, .45) + Math.sin((now - g.phaseAt) / 130) * .016;
    const z = clamp(action.z, .72, 1.08) + Math.cos((now - g.phaseAt) / 180) * .010;
    const targets = PIN_POSITIONS.filter(p => g.standing.includes(p.id) && !g.delivery.knocked.includes(p.id)).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const hit = targets[0] && Math.hypot(targets[0].x - x, targets[0].z - z) < .052;
    const extra = hit ? targets.filter(p => Math.hypot(p.x - targets[0].x, p.z - targets[0].z) < .103).slice(0, 2).map(p => p.id) : [];
    g.delivery.knocked.push(...extra); g.delivery.revengeShot = { x, z, hit: Boolean(hit), pins: extra, at: now }; note(g, extra.length ? `PINSHOT! +${extra.length} pins on this delivery.` : 'Revenge shot missed.'); settle(g, now); return { ok: true };
  }
  return fail('Unknown move.');
}
export function tick(g, now = Date.now()) {
  if (g.phase === 'final') return;
  const bowler = g.players[g.turn];
  if (g.phase === 'aim') {
    if (bowler.cpu && now > g.phaseAt + 1400) {
      // Clear the CPU flag temporarily to prevent tick -> act -> tick recursion.
      const cpu = bowler.cpu; bowler.cpu = false;
      const target = PIN_POSITIONS.find(p => g.standing.includes(p.id)) || PIN_POSITIONS[0];
      act(g, bowler.id, { type: 'bowl', start: (rand(g) - .5) * .25, aim: target.x + (rand(g) - .5) * .18, power: .72 + rand(g) * .26, spin: (rand(g) - .5) * .5 }, now); bowler.cpu = cpu;
    } else if (now >= g.deadline) { g.delivery = { knocked: [], hit: false }; note(g, 'Shot clock expired · zero pins.'); commitDelivery(g, now); }
    return;
  }
  if (g.phase === 'rolling') {
    const d = g.delivery, progress = (now - d.launchedAt) / d.duration, rival = enemy(g, bowler.id);
    if (g.settings.mode === 'brawl' && rival?.cpu && rival.charges && !d.attack && progress > .50 && progress < .53 && rand(g) < .55) { rival.charges--; d.attack = { by: rival.id, x: ballPosition(d, .55).x + (rand(g) - .5) * .06, push: rand(g) < .5 ? -1 : 1, firedAt: now, impactAt: now + 200, resolved: false, hit: false }; }
    if (d.attack && !d.attack.resolved && now >= d.attack.impactAt) {
      const a = d.attack, p = (a.impactAt - d.launchedAt) / d.duration, ball = ballPosition(d, p);
      a.resolved = true; a.hit = p >= .525 && p <= .580 && Math.abs(ball.x - a.x) < .052 && Math.abs(ball.x) < .46;
      if (a.hit) { d.hit = true; d.push = a.push; d.hitProgress = p; note(g, 'SABOTAGE LANDED! Bowler earns a revenge shot.'); } else note(g, 'Sabotage missed. Charge spent.');
    }
    if (now >= g.deadline) { d.knocked = resolvePins(g.standing, d); if (d.hit && d.knocked.length < g.standing.length) { g.phase = 'revenge'; g.phaseAt = now; g.deadline = now + 7000; note(g, 'REVENGE · aim and shoot one standing pin.'); } else settle(g, now); }
    return;
  }
  if (g.phase === 'revenge') {
    if (bowler.cpu && now > g.phaseAt + 1500) { const target = PIN_POSITIONS.find(p => g.standing.includes(p.id) && !g.delivery.knocked.includes(p.id)); if (target) { const cpu = bowler.cpu; bowler.cpu = false; act(g, bowler.id, { type: 'revenge', x: target.x, z: target.z }, now); bowler.cpu = cpu; } }
    else if (now >= g.deadline) { note(g, 'Revenge window closed.'); settle(g, now); }
    return;
  }
  if (g.phase === 'settling' && now >= g.deadline) commitDelivery(g, now);
}
export function view(g, now = Date.now()) {
  const scores = g.players.map(p => ({ ...p, ...scoreFrames(p.frames) }));
  const teamTotals = [0, 0]; scores.forEach(p => { teamTotals[p.team] += p.total; });
  return { settings: g.settings, players: scores, teamTotals, frame: g.frame, turn: g.players[g.turn]?.id, phase: g.phase, phaseAt: g.phaseAt, deadline: g.deadline, standing: g.standing, delivery: g.delivery, attacker: g.settings.mode === 'brawl' && g.phase !== 'final' ? enemy(g, g.players[g.turn].id)?.id : null, seq: g.seq, log: g.log, winnerIds: g.winnerIds, now };
}
