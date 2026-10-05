// ─────────────────────────────────────────────────────────────────────────────
// See That?! — shared round rules (browser + server)
//
// A scene is one picture plus a list of hidden objects, each marked with a box
// or oval in normalized coordinates (0–1 of the image width/height):
//   { v:1, id, title, image:'saloon.jpg', width, height,
//     objects:[{ id, name, shape:'rect'|'ellipse', x, y, w, h }] }
// Scene files live in public/see-that/scenes/<id>.json next to the image.
//
// A round picks some of the scene's objects to hunt. Players tap; the first tap
// inside an object's box claims it. Wild tapping is punished with a short
// lockout, and each player gets a couple of hints.
// ─────────────────────────────────────────────────────────────────────────────

export const FIND_POINTS = 100;
export const COMBO_STEP = 25;      // bonus per chained find
export const COMBO_MAX = 100;
export const COMBO_WINDOW_MS = 8000;
export const MISS_PENALTY = 10;
export const MISS_LOCK_MS = 1500;
export const SPAM_LOCK_MS = 5000;  // 3 misses inside 6s
export const HINTS_PER_ROUND = 2;
export const HINT_COST = 25;
export const TAP_PAD = 0.008;      // forgiveness around each box (fraction of image)

export function rng(seed) {
  let s = typeof seed === 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const inUnit = (n) => typeof n === 'number' && n >= -0.01 && n <= 1.01;
export function validScene(s) {
  if (!s || !s.id || !s.image) return false;
  if (s.mode === 'dynamic') return Array.isArray(s.zones) && s.zones.length > 0 && s.zones.every(z => [z.x, z.y, z.w, z.h].every(inUnit) && z.size > 0);
  return Array.isArray(s.objects) && s.objects.length > 0 && s.objects.every(o => o.id && o.name && [o.x, o.y, o.w, o.h].every(inUnit));
}

// ── dynamic scenes: the game places objects from a sprite library onto "spots" ──
// scene.zones = [{ id, kind, x, y, w, h, size }]  x/y/w/h = where an object's base can rest
//   (normalized), size = how tall a normal object looks there (scene pixels).
// library = [{ id, name, file, w, h, rel, difficulty, family }]  rel = relative real-world size.
export const DIFFICULTY = {
  easy: { scale: 1.15, decoys: 4, pref: { easy: 3, medium: 1, hard: 0.3 } },
  normal: { scale: 1, decoys: 8, pref: { easy: 1, medium: 1.5, hard: 1 } },
  hard: { scale: 0.85, decoys: 12, pref: { easy: 0.3, medium: 1, hard: 2.5 } },
};
const AVOID_DIST = 0.05; // don't reuse a spot within ~5% of the picture width of last game's objects

export function placeObjects(scene, library, { count = 10, difficulty = 'normal', seed = Date.now(), avoid = [] } = {}) {
  const R = rng(seed);
  const D = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const W = scene.width, H = scene.height;
  // pick targets (weighted by difficulty) then decoys; one object per look-alike family
  const pool = library.slice();
  const usedFam = new Set();
  const take = (n, weightFn) => {
    const out = [];
    while (out.length < n) {
      const cands = pool.filter(o => !usedFam.has(o.family || o.id));
      if (!cands.length) break;
      const ws = cands.map(weightFn); let t = R() * ws.reduce((a, b) => a + b, 0), k = 0;
      while (k < cands.length - 1 && (t -= ws[k]) > 0) k++;
      const o = cands[k]; out.push(o); usedFam.add(o.family || o.id); pool.splice(pool.indexOf(o), 1);
    }
    return out;
  };
  const targets = take(count, o => D.pref[o.difficulty] ?? 1);
  const decoys = take(D.decoys, () => 1);
  const boxes = [], used = {}, placements = [];
  const overlaps = (b) => boxes.some(q => b.x < q.x + q.w + 4 && b.x + b.w + 4 > q.x && b.y < q.y + q.h + 4 && b.y + b.h + 4 > q.y);
  const near = (bx, by) => avoid.some(a => Math.hypot(a.x - bx / W, (a.y - by / H) * (H / W)) < AVOID_DIST);
  [...targets.map(o => [o, true]), ...decoys.map(o => [o, false])].forEach(([o, isTarget], i) => {
    for (let tries = 0; tries < 80; tries++) {
      const ws = scene.zones.map(z => 1 / (1 + (used[z.id] || 0) * 2.5));
      let t = R() * ws.reduce((a, b) => a + b, 0), zi = 0;
      while (zi < ws.length - 1 && (t -= ws[zi]) > 0) zi++;
      const z = scene.zones[zi];
      const bx = (z.x + R() * z.w) * W, by = (z.y + R() * z.h) * H;
      if (tries < 40 && near(bx, by)) continue;
      const ph = Math.max(12, z.size * (o.rel || 1) * D.scale * (0.92 + R() * 0.16));
      const pw = ph * (o.w / o.h);
      const rot = (R() - 0.5) * 20;
      const rr = Math.abs(rot) * Math.PI / 180, bw = pw * Math.cos(rr) + ph * Math.sin(rr), bh = ph * Math.cos(rr) + pw * Math.sin(rr);
      const box = { x: bx - bw / 2 - 2, y: by - bh - 2, w: bw + 4, h: bh + 4 };
      if (box.x < 2 || box.y < 2 || box.x + box.w > W - 2 || box.y + box.h > H - 2) continue;
      if (overlaps(box)) continue;
      boxes.push(box); used[z.id] = (used[z.id] || 0) + 1;
      placements.push({ key: `p${i}`, sprite: o.id, name: o.name, target: isTarget, zone: z.id, bx: +(bx / W).toFixed(5), by: +(by / H).toFixed(5), pw: +pw.toFixed(1), ph: +ph.toFixed(1), rot: +rot.toFixed(1),
        x: +(box.x / W).toFixed(5), y: +(box.y / H).toFixed(5), w: +(box.w / W).toFixed(5), h: +(box.h / H).toFixed(5) });
      return;
    }
  });
  return placements;
}
const objList = (round, scene) => round.objects || scene.objects;

export function pickObjects(scene, count, rand = Math.random) {
  const ids = scene.objects.map(o => o.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, Math.max(1, Math.min(count, ids.length)));
}

// Is (x,y) inside this object (normalized coords)? aspect = width/height of the image.
export function hitObject(o, x, y, aspect = 1.6, pad = TAP_PAD) {
  const px = pad, py = pad * aspect;
  if (o.shape === 'ellipse') {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, rx = o.w / 2 + px, ry = o.h / 2 + py;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  }
  return x >= o.x - px && x <= o.x + o.w + px && y >= o.y - py && y <= o.y + o.h + py;
}

export function createRound(scene, { count = 10, seconds = 120, seed = Date.now(), startsAt = Date.now(), library = null, difficulty = 'normal', avoid = [] } = {}) {
  const base = { sceneId: scene.id, startsAt, endsAt: startsAt + seconds * 1000, seconds, found: {}, p: {}, log: [] };
  if (scene.mode === 'dynamic') {
    const placements = placeObjects(scene, library || [], { count, difficulty, seed, avoid });
    const objects = placements.filter(p => p.target).map(p => ({ id: p.key, name: p.name, shape: 'rect', x: p.x, y: p.y, w: p.w, h: p.h }));
    return { ...base, placements, objects, ids: objects.map(o => o.id) };
  }
  return { ...base, ids: pickObjects(scene, count, rng(seed)) };
}

const pstate = (round, pid) => (round.p[pid] || (round.p[pid] = { score: 0, finds: 0, misses: [], lockUntil: 0, hintsLeft: HINTS_PER_ROUND, hints: [], comboAt: 0, combo: 0 }));

export const roundOver = (round, now = Date.now()) => now >= round.endsAt || round.ids.every(id => round.found[id]);

// One tap. Mutates `round`. Returns what happened.
export function applyTap(round, scene, pid, x, y, now = Date.now()) {
  if (now < round.startsAt) return { kind: 'wait' };
  if (roundOver(round, now)) return { kind: 'closed' };
  const ps = pstate(round, pid);
  if (now < ps.lockUntil) return { kind: 'locked', until: ps.lockUntil };
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return { kind: 'ignored' };
  const aspect = (scene.width && scene.height) ? scene.width / scene.height : 1.6;
  const byId = Object.fromEntries(objList(round, scene).map(o => [o.id, o]));
  // remaining targets first; smallest box wins if boxes overlap
  const hits = round.ids.filter(id => !round.found[id] && byId[id] && hitObject(byId[id], x, y, aspect))
    .sort((a, b) => byId[a].w * byId[a].h - byId[b].w * byId[b].h);
  if (hits.length) {
    const id = hits[0];
    ps.combo = now - ps.comboAt <= COMBO_WINDOW_MS ? ps.combo + 1 : 0;
    ps.comboAt = now;
    const bonus = Math.min(COMBO_MAX, ps.combo * COMBO_STEP);
    const points = FIND_POINTS + bonus;
    round.found[id] = { by: pid, at: now, points };
    ps.score += points; ps.finds++;
    ps.hints = ps.hints.filter(h => h.id !== id);
    round.log.push({ t: now, pid, id, points });
    return { kind: 'found', id, name: byId[id].name, points, combo: ps.combo };
  }
  // tapped something already found (or a non-target object) → no penalty
  const already = round.ids.some(id => round.found[id] && hitObject(byId[id], x, y, aspect, 0));
  if (already) return { kind: 'already' };
  ps.misses = ps.misses.filter(t => now - t < 6000);
  ps.misses.push(now);
  ps.combo = 0;
  const spam = ps.misses.length >= 3;
  const lock = spam ? SPAM_LOCK_MS : MISS_LOCK_MS;
  ps.lockUntil = now + lock;
  ps.score -= MISS_PENALTY;
  if (spam) ps.misses = [];
  return { kind: 'miss', lockMs: lock, penalty: MISS_PENALTY, spam };
}

// A hint: a ring somewhere around one of the remaining objects (not dead-centre).
export function applyHint(round, scene, pid, now = Date.now(), rand = Math.random) {
  if (now < round.startsAt || roundOver(round, now)) return { kind: 'closed' };
  const ps = pstate(round, pid);
  if (ps.hintsLeft <= 0) return { kind: 'none' };
  const byId = Object.fromEntries(objList(round, scene).map(o => [o.id, o]));
  const left = round.ids.filter(id => !round.found[id] && !ps.hints.some(h => h.id === id));
  if (!left.length) return { kind: 'none' };
  const id = left[Math.floor(rand() * left.length)];
  const o = byId[id];
  const aspect = (scene.width && scene.height) ? scene.width / scene.height : 1.6;
  const r = Math.max(0.055, Math.max(o.w, o.h * (1 / aspect)) * 1.6);
  const ang = rand() * Math.PI * 2, off = r * 0.45 * rand();
  const hint = { id, cx: o.x + o.w / 2 + Math.cos(ang) * off, cy: o.y + o.h / 2 + Math.sin(ang) * off * aspect, r };
  ps.hints.push(hint); ps.hintsLeft--; ps.score -= HINT_COST;
  return { kind: 'hint', hint, name: o.name };
}

export function standings(round) {
  return Object.entries(round.p).map(([pid, s]) => ({ pid, score: s.score, finds: s.finds })).sort((a, b) => b.score - a.score);
}
