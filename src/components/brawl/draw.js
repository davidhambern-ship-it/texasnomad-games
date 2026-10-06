// Rodeo Rumble — canvas renderer. Everything is drawn in code: sunset desert,
// the mesa stage, the four fighters (procedural rigs), effects and the HUD.

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export const pctColor = (p) => (p < 40 ? '#ffffff' : p < 80 ? '#ffe27a' : p < 120 ? '#ffaa4a' : p < 170 ? '#ff6a3d' : '#ff2d4d');

// ── poses ───────────────────────────────────────────────────────────────────
const BASE = { lean: 0, crouch: 0, legF: 0.12, legB: -0.12, kneeF: -0.1, kneeB: -0.1, armF: 0.3, armB: -0.25, spin: 0 };
const MOVE_POSE = {
  jab: [{ armF: 0.6, lean: -0.05 }, { armF: 1.6, lean: 0.15 }],
  ftilt: [{ legF: -0.4, lean: -0.1 }, { legF: 1.55, kneeF: 0, lean: -0.3, armF: -0.4, armB: 0.7 }],
  utilt: [{ armF: 0.3, crouch: 0.15 }, { armF: 3.05, lean: -0.12 }],
  dtilt: [{ crouch: 0.3 }, { crouch: 0.5, legF: 1.5, kneeF: 0, lean: -0.35, armF: 0.9 }],
  nair: [{ legF: 0.6, kneeF: -1, legB: -0.6 }, { legF: 1.3, legB: -1.3, kneeF: 0, kneeB: 0, armF: 1.6, armB: -1.6, spin: 1 }],
  fair: [{ armF: 2.7, lean: -0.15 }, { armF: 1.0, lean: 0.35, legB: -0.5 }],
  bair: [{ legB: -0.3, kneeB: -1 }, { legB: -1.65, kneeB: 0, lean: 0.45, armF: 0.9 }],
  uair: [{ legF: 0.6, kneeF: -1.2 }, { legF: 2.9, kneeF: 0, lean: -0.55, armB: -1.1 }],
  dair: [{ legF: 0.9, kneeF: -1.5, legB: 0.6, kneeB: -1.3, armF: 1.2 }, { legF: 0.08, kneeF: 0, legB: -0.08, kneeB: 0, armF: 2.6, armB: 2.6 }],
  fsmash: [{ armF: -1.3, lean: -0.32, legF: 0.4 }, { armF: 1.6, lean: 0.38, legB: -0.7, kneeB: 0 }],
  usmash: [{ crouch: 0.45, armF: 0.3, armB: 0.3 }, { armF: 3.1, armB: 3.0, legF: 0.3, legB: -0.3 }],
  dsmash: [{ crouch: 0.35, armF: 0.4, armB: -0.4 }, { crouch: 0.55, legF: 1.45, legB: -1.45, kneeF: 0, kneeB: 0, armF: 1.1, armB: -1.1 }],
  recover: [{ crouch: 0.3 }, { armF: 3.0, armB: 2.8, legF: -0.2, legB: 0.25, kneeF: -0.4, spin: 0.35 }],
  pound: [{ legF: 0.8, kneeF: -1.6, legB: 0.6, kneeB: -1.4, armF: 2.2, armB: 2.2 }, { legF: 0.12, legB: -0.12, kneeF: 0, kneeB: 0, armF: 2.9, armB: 2.9 }],
  dash: [{ lean: 0.4, armF: -0.6 }, { lean: 1.15, armF: 1.6, legB: -1.0, kneeB: 0, legF: 0.4 }],
};
const SIG_POSE = {
  sixshooter: [{ armF: 1.0 }, { armF: 1.6, lean: -0.08 }],
  stampede: [{ lean: 0.5, crouch: 0.3 }, { lean: 1.0, armF: 0.6, armB: -0.6, run: true }],
  tumbleweed: [{ armF: -0.8, lean: -0.15 }, { armF: 1.4, lean: 0.2 }],
  zapball: [{ armF: 1.4, armB: 1.3, lean: -0.05 }, { armF: 1.6, armB: 1.5, lean: 0.12 }],
  boardtoss: [{ armF: -1.0, lean: -0.2 }, { armF: 1.5, lean: 0.25, legB: -0.5 }],
  shakedown: [{ armF: 1.9, armB: 1.6, crouch: 0.15, lean: -0.08 }, { armF: 1.6, lean: 0.35, legB: -0.6 }],
  heartkiss: [{ armF: 2.2, lean: -0.05 }, { armF: 1.5, lean: 0.12 }],
  nononsense: [{ armF: 1.4, armB: 1.2, lean: 0.2 }, { armF: 2.8, armB: 2.6, lean: -0.35 }],
  hotbox: [{ armF: 0.8, lean: -0.1, crouch: 0.1 }, { armF: 1.4, armB: 1.0, lean: 0.15 }],
};
function mix(a, b, t) { const o = { ...a }; for (const k of Object.keys(b)) if (typeof b[k] === 'number') o[k] = lerp(a[k] ?? 0, b[k], t); else o[k] = b[k]; return o; }

function poseFor(F, frame) {
  let p = { ...BASE };
  const run = Math.abs(F.vx) > 0.8 && F.ground;
  const breath = Math.sin(frame * 0.08) * 0.06;
  p.armF += breath; p.armB -= breath;
  if (F.state === 'stand' && run) {
    const s = Math.sin(frame * 0.32 * clamp(Math.abs(F.vx) / 5, 0.6, 1.4));
    p = { ...p, legF: s * 0.95, legB: -s * 0.95, kneeF: -Math.max(0, s) * 1.1 - 0.15, kneeB: -Math.max(0, -s) * 1.1 - 0.15, armF: -s * 0.85 + 0.2, armB: s * 0.85 - 0.2, lean: 0.22 };
  } else if (['air', 'helpless', 'airdodge', 'respawn'].includes(F.state) || (!F.ground && F.state === 'move')) {
    if (F.vy < 0) p = { ...p, legF: 0.7, kneeF: -1.4, legB: -0.15, kneeB: -0.7, armF: 2.5, armB: 2.1 };
    else p = { ...p, legF: 0.25, kneeF: -0.5, legB: -0.2, kneeB: -0.4, armF: 1.7, armB: 1.4 };
    if (F.state === 'respawn') p = { ...BASE, armF: 0.4 + breath, armB: -0.4 };
  } else if (F.state === 'shield') p = { ...p, crouch: 0.18, armF: 1.2, armB: 1.0, lean: -0.05 };
  else if (F.state === 'land') p = { ...p, crouch: 0.35 };
  else if (F.state === 'ledge') p = { ...p, armF: 3.0, armB: 2.9, legF: 0.15, legB: -0.1, kneeF: -0.2 };
  else if (F.state === 'hitstun') p = { ...p, lean: -0.5, armF: 2.4, armB: -2.0, legF: 0.8, kneeF: -0.8, legB: -0.5 };
  else if (F.state === 'stunned') p = { ...p, lean: -0.2 + Math.sin(frame * 0.2) * 0.25, armF: 0.1, armB: -0.1, crouch: 0.2 };
  else if (F.state === 'roll') p = { ...p, crouch: 0.6, spin: 1 };
  if (F.state === 'move' && F.move) {
    const m = F.move, d = m.def;
    const P = m.key === 'signature' ? SIG_POSE[F.ch.signature] : MOVE_POSE[m.key];
    if (P) {
      const f0 = d.counter ? (m.countered ? m.t - 1 : 999) : d.hits && d.hits[0] ? d.hits[0].f[0] : d.proj ? d.proj.f : d.dash ? d.dash.f[0] : 6;
      const f1 = d.hits && d.hits[0] ? d.hits[0].f[1] : f0 + 6;
      let q;
      if (m.charging) q = mix(p, P[0], 1);
      else if (m.t < f0) q = mix(p, P[0], clamp(m.t / Math.max(1, f0), 0, 1));
      else if (m.t <= f1) q = mix(mix(p, P[0], 1), P[1], clamp((m.t - f0 + 1) / 3, 0, 1));
      else q = mix(mix(p, P[0], 1), P[1], 1 - clamp((m.t - f1) / Math.max(4, d.dur - f1), 0, 1) * 0.9);
      if (q.run) { const s = Math.sin(frame * 0.5); q.legF = s; q.legB = -s; q.kneeF = -Math.max(0, s) - 0.2; q.kneeB = -Math.max(0, -s) - 0.2; }
      p = q;
    }
  }
  return p;
}

// ── fighter rig ─────────────────────────────────────────────────────────────
const dir = (a) => [Math.sin(a), Math.cos(a)]; // 0 = straight down, +PI/2 = forward

function drawFighter(ctx, F, frame, tag) {
  const ch = F.ch, h = ch.h, s = ch.size;
  const pose = poseFor(F, frame);
  const legL = h * 0.38, torso = h * 0.3, headR = h * (ch.style === 'bull' ? 0.2 : 0.185), armL = h * 0.32;
  const B = ch.style === 'bunny' ? ch.pal : null;
  const alt = F.color !== ch.color; // duplicate fighter: tint the outfit
  const body = B ? (alt ? F.color : B.shirt) : F.color, dark = shade(body, -0.45), mid = shade(body, -0.2), outline = 'rgba(8,6,20,.9)';
  const fur = B ? B.fur : null;
  const pantsF = B ? (alt && B.pants !== B.fur ? shade(F.color, -0.25) : B.pants) : mid, pantsB = B ? shade(pantsF, -0.3) : dark;
  const armF = B ? (B.sleeve || fur) : body, armB = B ? shade(B.sleeve || fur, -0.3) : dark;
  const thick = Math.max(7, h * 0.165);
  ctx.save();
  ctx.translate(F.x, F.y);
  if (F.state === 'respawn') {
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 2, 40, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  const crouchDrop = pose.crouch * legL * 0.55;
  // whole-body spin for rolls, nair, tumbles
  let rot = 0;
  if (pose.spin) rot = (frame * 0.45 * pose.spin) % TAU;
  if (F.state === 'hitstun' && Math.hypot(F.vx, F.vy) > 9) rot = frame * 0.35;
  if (F.state === 'helpless') rot = Math.sin(frame * 0.15) * 0.3;
  const cy = -h * 0.5;
  if (rot) { ctx.translate(0, cy); ctx.rotate(rot * F.face); ctx.translate(0, -cy); }
  ctx.scale(F.face, 1);
  const flicker = F.inv > 0 && F.state !== 'respawn' && Math.floor(frame / 3) % 2 === 0;
  ctx.globalAlpha = F.state === 'helpless' ? 0.75 : flicker ? 0.55 : 1;

  const hip = [0, -legL + crouchDrop];
  // torso leans around the hip
  const tl = pose.lean;
  const sh = [hip[0] + Math.sin(tl) * torso, hip[1] - Math.cos(tl) * torso];
  const neck = [sh[0] + Math.sin(tl) * headR * 0.3, sh[1] - Math.cos(tl) * headR * 0.3];
  const head = [neck[0] + Math.sin(tl) * headR, neck[1] - Math.cos(tl) * headR];

  const seg = (a, b, w, col) => { ctx.strokeStyle = outline; ctx.lineWidth = w + 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  const leg = (a, k, col) => {
    const d1 = dir(a); const knee = [hip[0] + d1[0] * legL * 0.5, hip[1] + d1[1] * legL * 0.5];
    const d2 = dir(a + k); const foot = [knee[0] + d2[0] * legL * 0.52, knee[1] + d2[1] * legL * 0.52];
    seg(hip, knee, thick, col); seg(knee, foot, thick * 0.92, col);
    ctx.fillStyle = outline; ctx.beginPath(); ctx.ellipse(foot[0] + 3, foot[1], thick * 0.75, thick * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = B ? B.shoe : ch.style === 'robot' ? '#9fb4c8' : '#3a2416'; ctx.beginPath(); ctx.ellipse(foot[0] + 3, foot[1], thick * 0.6, thick * 0.36, 0, 0, TAU); ctx.fill();
    if (ch.id === 'katarina') { ctx.fillStyle = '#f2ece0'; ctx.beginPath(); ctx.ellipse(foot[0] + 1, foot[1] - 1, thick * 0.3, thick * 0.22, 0, 0, TAU); ctx.fill(); }
    return foot;
  };
  const arm = (a, col) => {
    const d = dir(a); const hand = [sh[0] + d[0] * armL, sh[1] + d[1] * armL];
    seg(sh, hand, thick * 0.82, col);
    ctx.fillStyle = outline; ctx.beginPath(); ctx.arc(hand[0], hand[1], thick * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = B ? shade(fur, 0.12) : ch.style === 'robot' ? '#cfe9ff' : ch.style === 'bull' ? '#5b3a1e' : '#f1c6a0'; ctx.beginPath(); ctx.arc(hand[0], hand[1], thick * 0.48, 0, TAU); ctx.fill();
    return hand;
  };
  // back limbs first (darker)
  if (ch.style === 'scarf') drawScarf(ctx, neck, frame, F, ch.accent, h);
  if (B) bunnyBack(ctx, ch, hip, sh, head, headR, thick, frame, outline);
  leg(pose.legB, pose.kneeB, pantsB);
  const backHand = arm(pose.armB, armB);
  // torso
  ctx.strokeStyle = outline; ctx.lineWidth = thick * 2.3 * (ch.style === 'bull' ? 1.25 : 1) + 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(sh[0], sh[1]); ctx.stroke();
  ctx.strokeStyle = body; ctx.lineWidth = thick * 2.2 * (ch.style === 'bull' ? 1.25 : 1);
  // shoulders a touch wider than the hips
  ctx.lineWidth = thick * 2.3 * (ch.style === 'bull' ? 1.25 : 1);
  ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(sh[0], sh[1]); ctx.stroke();
  // belt / chest detail
  const bx = lerp(hip[0], sh[0], 0.18), by = lerp(hip[1], sh[1], 0.18);
  if (B) bunnyTorso(ctx, ch, hip, sh, thick, frame, outline);
  else { ctx.strokeStyle = mid; ctx.lineWidth = thick * 0.5; ctx.beginPath(); ctx.moveTo(bx - thick, by); ctx.lineTo(bx + thick, by); ctx.stroke(); }
  if (ch.style === 'cowboy') { ctx.fillStyle = ch.accent; ctx.beginPath(); ctx.arc(bx, by, thick * 0.35, 0, TAU); ctx.fill(); }
  if (ch.style === 'robot') { ctx.fillStyle = '#7df9ff'; ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(frame * 0.2); ctx.beginPath(); ctx.arc(lerp(hip[0], sh[0], 0.6), lerp(hip[1], sh[1], 0.6), thick * 0.4, 0, TAU); ctx.fill(); ctx.globalAlpha = F.state === 'helpless' ? 0.75 : flicker ? 0.55 : 1; }
  if (B) bunnyHair(ctx, ch, head, headR, frame, outline);
  leg(pose.legF, pose.kneeF, pantsF);
  if (ch.id === 'robert') sarong(ctx, hip, thick, frame);
  if (B) drawBunnyHead(ctx, head, headR, F, frame, outline, tl); else drawHead(ctx, head, headR, F, frame, outline, tl);
  const hand = arm(pose.armF, armF);
  if (ch.id === 'richard') { ctx.fillStyle = '#c9c9c9'; ctx.strokeStyle = outline; ctx.lineWidth = 2; const wx = lerp(sh[0], hand[0], 0.82), wy = lerp(sh[1], hand[1], 0.82); ctx.beginPath(); ctx.arc(wx, wy, thick * 0.32, 0, TAU); ctx.fill(); ctx.stroke(); }
  // props
  if (F.state === 'move' && F.move && F.move.key === 'signature' && ch.signature === 'sixshooter') {
    ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-(pose.armF - Math.PI / 2)); ctx.fillStyle = '#333'; ctx.fillRect(0, -4, 20, 7); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-2, -2, 7, 12); ctx.restore();
  }
  if (F.state === 'move' && F.move && F.move.key === 'signature' && ch.signature === 'zapball' && (F.move.charging || F.move.t < 8)) {
    const r = 8 + (F.move.chargeT / 70) * 14;
    const gx = (hand[0] + backHand[0]) / 2 + 10, gy = (hand[1] + backHand[1]) / 2;
    const grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, r * 1.8); grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, '#7df9ff'); grad.addColorStop(1, 'rgba(125,249,255,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(gx, gy, r * 1.8, 0, TAU); ctx.fill();
  }
  // smash charge glow
  if (F.move && F.move.charging && F.move.key !== 'signature') {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(frame * 0.6);
    ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(hand[0], hand[1], thick * (1.2 + F.move.chargeT / 40), 0, TAU); ctx.fill();
  }
  ctx.restore();
  // hit flash overlay
  if (F.flash > 0) { ctx.save(); ctx.globalAlpha = F.flash / 10; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(F.x, F.y - h * 0.5, ch.w * 0.9, h * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  // shield bubble
  if (F.state === 'shield') {
    const r = (h * 0.42 + 6) * (0.45 + 0.55 * (F.shield / 60));
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = tag.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(F.x, F.y - h * 0.5, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.8; ctx.stroke(); ctx.restore();
  }
  if (F.state === 'move' && F.move && F.move.def.counter && !F.move.countered && F.move.t >= F.move.def.counter[0] && F.move.t <= F.move.def.counter[1]) {
    ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(frame * 0.8); ctx.strokeStyle = '#e0b64a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(F.x, F.y - h * 0.5, ch.w * 1.1, h * 0.62, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (F.dazed > 0 && F.state === 'hitstun') { ctx.save(); ctx.fillStyle = '#ff6fb5'; ctx.font = 'bold 16px system-ui'; for (let i = 0; i < 3; i++) { const a = frame * 0.14 + i * 2.1; ctx.fillText('♥', F.x + Math.cos(a) * 24 - 6, F.y - h - 8 + Math.sin(a) * 6); } ctx.restore(); }
  if (F.state === 'stunned') { ctx.save(); ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 18px system-ui'; for (let i = 0; i < 3; i++) { const a = frame * 0.12 + i * 2.1; ctx.fillText('★', F.x + Math.cos(a) * 24 - 6, F.y - h - 10 + Math.sin(a) * 6); } ctx.restore(); }
  void s;
}

function drawHead(ctx, c, r, F, frame, outline, lean) {
  const ch = F.ch;
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(lean * 0.6);
  const skin = ch.style === 'robot' ? '#d7ecff' : ch.style === 'bull' ? '#8a5a2e' : '#f1c6a0';
  if (ch.style === 'robot') {
    ctx.fillStyle = outline; roundRect(ctx, -r - 3, -r - 3, r * 2 + 6, r * 2 + 4, r * 0.5); ctx.fill();
    ctx.fillStyle = skin; roundRect(ctx, -r, -r, r * 2, r * 2 - 2, r * 0.45); ctx.fill();
    ctx.fillStyle = '#062c3a'; roundRect(ctx, -r * 0.3, -r * 0.45, r * 1.25, r * 0.6, r * 0.25); ctx.fill();
    ctx.fillStyle = '#7df9ff'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(frame * 0.15); roundRect(ctx, -r * 0.15, -r * 0.33, r * 0.95, r * 0.36, r * 0.15); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = outline; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r); ctx.lineTo(-r * 0.35, -r * 1.7); ctx.stroke();
    ctx.fillStyle = Math.floor(frame / 20) % 2 ? '#ff5f6d' : '#ffe27a'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 1.75, 4, 0, TAU); ctx.fill();
    ctx.restore(); return;
  }
  ctx.fillStyle = outline; ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, TAU); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // eye (facing right)
  const hurt = F.state === 'hitstun' || F.state === 'stunned';
  ctx.fillStyle = '#140c1e';
  if (hurt) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#140c1e'; ctx.beginPath(); ctx.moveTo(r * 0.25, -r * 0.3); ctx.lineTo(r * 0.6, 0); ctx.moveTo(r * 0.6, -r * 0.3); ctx.lineTo(r * 0.25, 0); ctx.stroke(); }
  else { ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.12, r * 0.13, r * 0.2, 0, 0, TAU); ctx.fill(); }
  if (ch.style === 'cowboy') {
    // bandana + hat
    ctx.fillStyle = ch.accent; ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.45); ctx.lineTo(r * 0.85, r * 0.35); ctx.lineTo(r * 0.2, r * 1.0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = outline; roundRect(ctx, -r * 1.55, -r * 0.82, r * 3.1, r * 0.42, r * 0.2); ctx.fill();
    ctx.fillStyle = '#6b3f1f'; roundRect(ctx, -r * 1.45, -r * 0.78, r * 2.9, r * 0.3, r * 0.15); ctx.fill();
    ctx.fillStyle = outline; roundRect(ctx, -r * 0.82, -r * 1.75, r * 1.64, r * 1.05, r * 0.35); ctx.fill();
    ctx.fillStyle = '#7d4a24'; roundRect(ctx, -r * 0.72, -r * 1.65, r * 1.44, r * 0.95, r * 0.3); ctx.fill();
    ctx.fillStyle = ch.accent; ctx.fillRect(-r * 0.72, -r * 0.98, r * 1.44, r * 0.18);
  } else if (ch.style === 'bull') {
    // horns + nose ring
    ctx.strokeStyle = outline; ctx.lineWidth = r * 0.42; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.7); ctx.quadraticCurveTo(-r * 1.4, -r * 1.0, -r * 1.2, -r * 1.75); ctx.moveTo(r * 0.4, -r * 0.75); ctx.quadraticCurveTo(r * 1.3, -r * 1.05, r * 1.15, -r * 1.8); ctx.stroke();
    ctx.strokeStyle = ch.accent; ctx.lineWidth = r * 0.26;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.7); ctx.quadraticCurveTo(-r * 1.4, -r * 1.0, -r * 1.2, -r * 1.75); ctx.moveTo(r * 0.4, -r * 0.75); ctx.quadraticCurveTo(r * 1.3, -r * 1.05, r * 1.15, -r * 1.8); ctx.stroke();
    ctx.fillStyle = '#5b3a1e'; ctx.beginPath(); ctx.ellipse(r * 0.65, r * 0.35, r * 0.45, r * 0.32, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r * 0.85, r * 0.62, r * 0.2, 0, TAU); ctx.stroke();
  } else if (ch.style === 'scarf') {
    // goggles + spiky hair
    ctx.fillStyle = '#2a1640';
    ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.2); ctx.lineTo(-r * 1.25, -r * 1.05); ctx.lineTo(-r * 0.5, -r * 0.8); ctx.lineTo(-r * 0.3, -r * 1.45); ctx.lineTo(r * 0.2, -r * 0.85); ctx.lineTo(r * 0.75, -r * 1.2); ctx.lineTo(r * 0.85, -r * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = outline; roundRect(ctx, -r * 0.2, -r * 0.62, r * 1.15, r * 0.48, r * 0.22); ctx.fill();
    ctx.fillStyle = ch.accent; ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.38, r * 0.17, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawScarf(ctx, neck, frame, F, col, h) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = h * 0.08; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(neck[0], neck[1] + 4);
  const sp = Math.min(1, Math.abs(F.vx) / 6 + 0.3);
  for (let i = 1; i <= 6; i++) ctx.lineTo(neck[0] - i * 7 * sp - 4, neck[1] + 4 + Math.sin(frame * 0.3 + i) * 4 * i * 0.4 + i * (1 - sp) * 3);
  ctx.stroke(); ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ── scenery ─────────────────────────────────────────────────────────────────
function drawSky(ctx, W, H, cam, frame) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d1240'); g.addColorStop(0.38, '#6b2a6b'); g.addColorStop(0.62, '#e8603c'); g.addColorStop(0.8, '#ffb35c'); g.addColorStop(1, '#ffd98a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 40; i++) { const x = (i * 197.3) % W, y = (i * 71.7) % (H * 0.35); const tw = 0.5 + 0.5 * Math.sin(frame * 0.03 + i); ctx.globalAlpha = tw * 0.8; ctx.fillRect(x, y, 2, 2); }
  ctx.globalAlpha = 1;
  // sun
  const sx = W * 0.72 - cam.x * 0.03, sy = H * 0.66 - cam.y * 0.03;
  const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, H * 0.35); sg.addColorStop(0, 'rgba(255,240,180,1)'); sg.addColorStop(0.18, 'rgba(255,200,110,.9)'); sg.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, H * 0.35, 0, TAU); ctx.fill();
  // far mesas (parallax)
  const layer = (par, col, base, seed, hgt) => {
    ctx.fillStyle = col; ctx.beginPath(); const off = -cam.x * par; ctx.moveTo(0, H);
    for (let x = -200; x <= W + 200; x += 40) {
      const k = Math.floor((x - off) / 160 + seed * 7);
      const n = Math.abs(Math.sin(k * 12.9898 + seed) * 43758.5453) % 1;
      const top = base - (n > 0.55 ? hgt * (0.6 + n * 0.5) : hgt * 0.15 * n);
      ctx.lineTo(x + (off % 40), top - cam.y * par * 0.5);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  };
  layer(0.05, '#a8475a', H * 0.78, 1, H * 0.16);
  layer(0.12, '#6d2d4f', H * 0.88, 2, H * 0.14);
}

function drawMesa(ctx, S, frame) {
  const m = S.solids[0];
  // mesa body tapering down
  const g = ctx.createLinearGradient(0, m.y, 0, m.bottom + 260);
  g.addColorStop(0, '#c9643a'); g.addColorStop(0.45, '#9b3f2a'); g.addColorStop(1, '#4a1d22');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(m.x1, m.y); ctx.lineTo(m.x2, m.y); ctx.lineTo(m.x2 - 10, m.bottom); ctx.lineTo(m.x2 - 80, m.bottom + 140); ctx.lineTo(m.x2 - 170, m.bottom + 280); ctx.lineTo(m.x1 + 170, m.bottom + 280); ctx.lineTo(m.x1 + 80, m.bottom + 140); ctx.lineTo(m.x1 + 10, m.bottom); ctx.closePath(); ctx.fill();
  // strata
  ctx.strokeStyle = 'rgba(255,200,150,.18)'; ctx.lineWidth = 3;
  for (let i = 1; i < 6; i++) { const y = m.y + i * 26; const inset = i * 6; ctx.beginPath(); ctx.moveTo(m.x1 + inset, y); ctx.lineTo(m.x2 - inset, y + (i % 2 ? 4 : -3)); ctx.stroke(); }
  // top surface
  ctx.fillStyle = '#e9b26b'; ctx.fillRect(m.x1 - 4, m.y - 4, m.x2 - m.x1 + 8, 14);
  ctx.fillStyle = '#7fae4b'; ctx.fillRect(m.x1 - 4, m.y - 6, m.x2 - m.x1 + 8, 5);
  ctx.strokeStyle = 'rgba(30,10,10,.6)'; ctx.lineWidth = 3; ctx.strokeRect(m.x1 - 4, m.y - 6, m.x2 - m.x1 + 8, 16);
  // cactus + sign props
  cactus(ctx, m.x1 + 40, m.y - 6, 0.8); cactus(ctx, m.x2 - 60, m.y - 6, 1);
  // wooden platforms
  for (const p of S.plats) {
    ctx.fillStyle = '#5a3418'; ctx.fillRect(p.x1 + 10, p.y + 8, 8, 26); ctx.fillRect(p.x2 - 18, p.y + 8, 8, 26);
    ctx.fillStyle = '#a8692f'; roundRect(ctx, p.x1, p.y - 3, p.x2 - p.x1, 14, 4); ctx.fill();
    ctx.strokeStyle = '#3a200e'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(58,32,14,.6)'; ctx.lineWidth = 1.5;
    for (let x = p.x1 + 24; x < p.x2 - 10; x += 26) { ctx.beginPath(); ctx.moveTo(x, p.y - 2); ctx.lineTo(x, p.y + 10); ctx.stroke(); }
  }
  void frame;
}
function cactus(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#3f7d3a'; ctx.strokeStyle = '#1e3d1c'; ctx.lineWidth = 2.5;
  roundRect(ctx, -7, -54, 14, 54, 7); ctx.fill(); ctx.stroke();
  roundRect(ctx, -22, -40, 10, 22, 5); ctx.fill(); ctx.stroke(); roundRect(ctx, -22, -24, 18, 8, 4); ctx.fill();
  roundRect(ctx, 12, -46, 10, 24, 5); ctx.fill(); ctx.stroke(); roundRect(ctx, 4, -28, 18, 8, 4); ctx.fill();
  ctx.restore();
}

// ── renderer ────────────────────────────────────────────────────────────────
export function createRenderer() {
  const cam = { x: 0, y: -150, z: 0.8 };
  let parts = [];
  const pctShake = {};

  function events(g, evs) {
    for (const e of evs) {
      if (e.type === 'hit') {
        const n = Math.min(18, 6 + e.dmg);
        for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 2 + Math.random() * (3 + e.kb * 0.4); parts.push({ k: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 16 + Math.random() * 10, max: 26, c: e.kb > 15 ? '#fff3a0' : '#ffffff' }); }
        parts.push({ k: 'ring', x: e.x, y: e.y, r: 6, grow: 3 + e.kb * 0.35, life: 14, max: 14, c: e.kb > 15 ? '#ffcf4a' : '#ffffff' });
        if (e.kb > 15) parts.push({ k: 'flash', life: 5, max: 5 });
        pctShake[e.id] = 14;
      } else if (e.type === 'block') { parts.push({ k: 'ring', x: e.x, y: e.y, r: 8, grow: 2.5, life: 10, max: 10, c: '#7fd8ff' }); }
      else if (e.type === 'ko') {
        const F = g.fighters.find(f => f.id === e.id);
        parts.push({ k: 'ko', x: e.x, y: e.y, side: e.side, life: 50, max: 50, c: F ? F.color : '#fff' });
        for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, sp = 3 + Math.random() * 9; parts.push({ k: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30 + Math.random() * 20, max: 50, c: F ? F.color : '#fff' }); }
      } else if (e.type === 'jump' || e.type === 'land') {
        const n = e.type === 'land' && e.heavy ? 10 : 5;
        for (let i = 0; i < n; i++) parts.push({ k: 'dust', x: e.x + (Math.random() - 0.5) * 20, y: e.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.5, life: 20, max: 20, r: 5 + Math.random() * 5 });
      } else if (e.type === 'counter') {
        parts.push({ k: 'ring', x: e.x, y: e.y, r: 12, grow: 7, life: 18, max: 18, c: '#e0b64a' });
        parts.push({ k: 'word', x: e.x, y: e.y - 40, text: 'SHAKEDOWN!', life: 45, max: 45, c: '#e0b64a' });
      } else if (e.type === 'shieldbreak') { parts.push({ k: 'ring', x: e.x, y: e.y, r: 10, grow: 6, life: 22, max: 22, c: '#ff5f6d' }); }
    }
  }

  function render(ctx, g, W, H, opts = {}) {
    const S = g.stage, frame = g.frame;
    // camera: fit everyone on screen
    const live = g.fighters.filter(F => F.state !== 'out');
    let x1 = Math.max(S.x1 + 200, -260), x2 = Math.min(S.x2 - 200, 260), y1 = -230, y2 = 30;
    for (const F of live) { x1 = Math.min(x1, F.x - 80); x2 = Math.max(x2, F.x + 80); y1 = Math.min(y1, F.y - F.ch.h - 80); y2 = Math.max(y2, F.y + 60); }
    const b = S.blast; x1 = Math.max(x1, b.x1 + 60); x2 = Math.min(x2, b.x2 - 60); y1 = Math.max(y1, b.y1 + 60); y2 = Math.min(y2, b.y2 - 40);
    const hudH = opts.hudH || 0;
    const tz = clamp(Math.min(W / (x2 - x1 + 120), (H - hudH) / (y2 - y1 + 110)), 0.32, 1.6);
    const tx = (x1 + x2) / 2, ty = (y1 + y2) / 2 - hudH / 2 / tz; // HUD sits on top, so nudge the action down
    cam.z = lerp(cam.z, tz, 0.08); cam.x = lerp(cam.x, tx, 0.1); cam.y = lerp(cam.y, ty, 0.1);

    const theme = S.theme || 'mesa';
    if (theme === 'saloon') drawNight(ctx, W, H, cam, frame); else if (theme === 'canyon') drawDay(ctx, W, H, cam, frame); else if (theme === 'lounge') drawLoungeBack(ctx, W, H, cam, frame); else drawSky(ctx, W, H, cam, frame);
    ctx.save();
    const shx = g.shake > 0.5 ? (Math.random() - 0.5) * g.shake : 0, shy = g.shake > 0.5 ? (Math.random() - 0.5) * g.shake : 0;
    ctx.translate(W / 2 + shx, H / 2 + shy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (theme === 'saloon') drawSaloon(ctx, S, frame); else if (theme === 'canyon') drawCanyon(ctx, S, frame); else if (theme === 'lounge') drawLounge(ctx, S, frame); else drawMesa(ctx, S, frame);
    // projectiles
    for (const p of g.projectiles) {
      ctx.save();
      if (p.kind === 'board') {
        ctx.translate(p.x, p.y); ctx.rotate(p.t * 0.45);
        ctx.fillStyle = 'rgba(8,6,20,.9)'; roundRect(ctx, -26, -8, 52, 16, 8); ctx.fill(); ctx.fillStyle = '#2a2320'; roundRect(ctx, -24, -6, 48, 12, 6); ctx.fill();
        ctx.fillStyle = '#58a84a'; ctx.beginPath(); ctx.arc(-8, 0, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.arc(8, 0, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8dcc0'; for (const x of [-16, 16]) { ctx.beginPath(); ctx.arc(x, 9, 4, 0, TAU); ctx.fill(); }
      } else if (p.kind === 'heart') {
        const gr = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 2.2); gr.addColorStop(0, 'rgba(255,170,210,.8)'); gr.addColorStop(1, 'rgba(255,111,181,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, TAU); ctx.fill();
        const k = p.r * (1 + Math.sin(p.t * 0.3) * 0.08); ctx.translate(p.x, p.y); ctx.fillStyle = '#ff4f9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, k * 0.7); ctx.bezierCurveTo(-k * 1.4, -k * 0.2, -k * 0.6, -k * 1.2, 0, -k * 0.45); ctx.bezierCurveTo(k * 0.6, -k * 1.2, k * 1.4, -k * 0.2, 0, k * 0.7); ctx.fill(); ctx.stroke();
      } else if (p.kind === 'smoke') {
        const a = Math.min(1, p.life / 30) * Math.min(1, p.t / 8);
        for (let i = 0; i < 7; i++) {
          const ang = i * 0.9 + p.t * 0.02, rr = p.r * (0.45 + (i % 3) * 0.12);
          ctx.fillStyle = `rgba(${i % 2 ? '215,210,200' : '190,200,180'},${0.42 * a})`;
          ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * p.r * 0.45, p.y + Math.sin(ang) * p.r * 0.32, rr, 0, TAU); ctx.fill();
        }
      } else if (p.kind === 'tumbleweed') {
        ctx.translate(p.x, p.y); ctx.rotate(frame * 0.3 * Math.sign(p.vx)); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0, 0, p.r * (0.5 + (i % 3) * 0.25), i, i + 4); ctx.stroke(); }
      } else {
        const gr = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 2); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, p.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2, 0, TAU); ctx.fill();
        if (p.kind === 'bullet') { ctx.strokeStyle = 'rgba(255,230,150,.6)'; ctx.lineWidth = p.r; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y); ctx.stroke(); }
      }
      ctx.restore();
    }
    // fighters
    for (const F of g.fighters) {
      if (F.state === 'out') continue;
      const tag = opts.tags ? opts.tags[F.id] : { label: F.name, color: F.color };
      drawFighter(ctx, F, frame, tag);
      // name tag
      ctx.save(); ctx.font = `900 ${Math.round(14 / Math.max(0.6, cam.z))}px system-ui`; ctx.textAlign = 'center';
      const ty2 = F.y - F.ch.h - (F.ch.style === 'cowboy' || F.ch.style === 'bull' ? 34 : 24);
      ctx.fillStyle = tag.color; ctx.fillText(tag.label, F.x, ty2);
      ctx.beginPath(); ctx.moveTo(F.x - 6, ty2 + 4); ctx.lineTo(F.x + 6, ty2 + 4); ctx.lineTo(F.x, ty2 + 11); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // particles (world)
    parts = parts.filter(p => p.life-- > 0);
    for (const p of parts) {
      const a = p.life / p.max;
      if (p.k === 'spark') { p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy = p.vy * 0.9 + 0.15; ctx.strokeStyle = p.c; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); ctx.stroke(); }
      else if (p.k === 'ring') { p.r += p.grow; ctx.strokeStyle = p.c; ctx.globalAlpha = a; ctx.lineWidth = 4 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); }
      else if (p.k === 'dust') { p.x += p.vx; p.y += p.vy; p.r += 0.4; ctx.fillStyle = 'rgba(240,210,170,1)'; ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      else if (p.k === 'word') { p.y -= 0.8; ctx.globalAlpha = Math.min(1, a * 2); ctx.font = '900 28px Teko, Impact, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#1a0f2e'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.c; ctx.fillText(p.text, p.x, p.y); }
      else if (p.k === 'ko') {
        ctx.globalAlpha = a; const w = 140 * (1 - a) + 40;
        const grd = p.side === 'left' || p.side === 'right' ? ctx.createLinearGradient(p.x, 0, p.x + (p.side === 'left' ? 700 : -700), 0) : ctx.createLinearGradient(0, p.y, 0, p.y + (p.side === 'top' ? 700 : -700));
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, p.c); grd.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = grd;
        if (p.side === 'left') ctx.fillRect(p.x, p.y - w / 2, 700, w); else if (p.side === 'right') ctx.fillRect(p.x - 700, p.y - w / 2, 700, w);
        else if (p.side === 'top') ctx.fillRect(p.x - w / 2, p.y, w, 700); else ctx.fillRect(p.x - w / 2, p.y - 700, w, 700);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // full-screen flash
    for (const p of parts) if (p.k === 'flash') { ctx.fillStyle = `rgba(255,255,255,${(p.life / p.max) * 0.25})`; ctx.fillRect(0, 0, W, H); }
    // off-screen bubbles
    for (const F of live) {
      const sx = (F.x - cam.x) * cam.z + W / 2, sy = (F.y - F.ch.h / 2 - cam.y) * cam.z + H / 2;
      if (sx > -10 && sx < W + 10 && sy > hudH - 10 && sy < H + 10) continue;
      const bx = clamp(sx, 36, W - 36), by = clamp(sy, hudH + 36, H - 36);
      const tag = opts.tags ? opts.tags[F.id] : { color: F.color };
      ctx.fillStyle = 'rgba(10,8,25,.75)'; ctx.strokeStyle = tag.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 26, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pctColor(F.dmg); ctx.font = '900 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.floor(F.dmg)}%`, bx, by); ctx.textBaseline = 'alphabetic';
    }
    return { pctShake };
  }
  return { render, events, cam, pctShake };
}

/** Fighter portrait for menus: draws the rig standing in a small canvas. */
export function drawPortrait(canvas, ch, frame = 0, color) {
  const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const F = { ch, color: color || ch.color, x: 0, y: 0, vx: 0, vy: 0, face: 1, ground: true, state: 'stand', inv: 0, flash: 0, move: null, shield: 60 };
  const sc = (H * 0.84) / (ch.h * (ch.style === 'bunny' ? 1.8 : 1.4));
  ctx.save(); ctx.translate(W / 2, H * 0.92); ctx.scale(sc, sc); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawFighter(ctx, F, frame, { color: F.color });
  ctx.restore();
}

// ── the Bunnie Crew ─────────────────────────────────────────────────────────
function bunnyBack(ctx, ch, hip, sh, head, r, thick, frame, outline) {
  if (ch.id === 'danni') {
    // skateboard slung on the back
    ctx.save(); ctx.translate(lerp(hip[0], sh[0], 0.55) - thick * 1.4, lerp(hip[1], sh[1], 0.55)); ctx.rotate(-0.15);
    ctx.fillStyle = outline; roundRect(ctx, -thick * 0.62, -thick * 3.1, thick * 1.24, thick * 6.2, thick * 0.6); ctx.fill();
    ctx.fillStyle = '#2a2320'; roundRect(ctx, -thick * 0.5, -thick * 3.0, thick, thick * 6.0, thick * 0.5); ctx.fill();
    ctx.fillStyle = '#58a84a'; ctx.beginPath(); ctx.arc(0, -thick * 1.2, thick * 0.28, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.arc(0, thick * 0.8, thick * 0.24, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8dcc0'; for (const y of [-2.4, 2.4]) { ctx.beginPath(); ctx.arc(-thick * 0.62, y * thick, thick * 0.3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (ch.id === 'brittani') {
    // big pom tail
    ctx.fillStyle = shade(ch.pal.fur, 0.15); ctx.strokeStyle = outline; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(hip[0] - thick * 1.25, hip[1] - thick * 0.3, thick * 1.0, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

function bunnyHair(ctx, ch, head, r, frame, outline) {
  const hx = head[0], hy = head[1];
  if (ch.id === 'danni' || ch.id === 'robert') {
    const col = ch.id === 'danni' ? '#5a3a1e' : '#1c1410';
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const sx = hx - r * 1.0 + i * r * 0.16, len = r * (2.1 + (i % 3) * 0.4);
      const sway = Math.sin(frame * 0.08 + i) * 2 - r * 0.25;
      ctx.strokeStyle = outline; ctx.lineWidth = r * 0.34; ctx.beginPath(); ctx.moveTo(sx, hy - r * 0.3); ctx.quadraticCurveTo(sx - r * 0.4 + sway, hy + len * 0.5, sx - r * 0.5 + sway * 2, hy + len); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.moveTo(sx, hy - r * 0.3); ctx.quadraticCurveTo(sx - r * 0.4 + sway, hy + len * 0.5, sx - r * 0.5 + sway * 2, hy + len); ctx.stroke();
      if (ch.id === 'danni' && i % 2 === 0) { ctx.fillStyle = ['#e04a3a', '#f2c14e', '#3a7bd5'][i % 3]; ctx.beginPath(); ctx.arc(sx - r * 0.42 + sway * 1.6, hy + len * 0.75, r * 0.12, 0, TAU); ctx.fill(); }
    }
  }
  if (ch.id === 'katarina') {
    ctx.fillStyle = outline; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(hx - r * 0.7 + (i % 2) * r * 0.3, hy + i * r * 0.32, r * 0.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#3a1450'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(hx - r * 0.7 + (i % 2) * r * 0.3, hy + i * r * 0.32, r * 0.42, 0, TAU); ctx.fill(); }
  }
  if (ch.id === 'brittani') {
    ctx.fillStyle = outline; ctx.beginPath(); ctx.moveTo(hx - r * 1.1, hy - r * 0.5); ctx.quadraticCurveTo(hx - r * 1.7, hy + r * 1.5, hx - r * 1.0, hy + r * 2.7); ctx.lineTo(hx + r * 0.3, hy + r * 2.2); ctx.lineTo(hx + r * 0.6, hy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2c766'; ctx.beginPath(); ctx.moveTo(hx - r * 1.0, hy - r * 0.5); ctx.quadraticCurveTo(hx - r * 1.55 + Math.sin(frame * 0.07) * 2, hy + r * 1.5, hx - r * 0.9, hy + r * 2.55); ctx.lineTo(hx + r * 0.25, hy + r * 2.05); ctx.lineTo(hx + r * 0.5, hy); ctx.closePath(); ctx.fill();
  }
}

function bunnyTorso(ctx, ch, hip, sh, thick, frame, outline) {
  const at = (t) => [lerp(hip[0], sh[0], t), lerp(hip[1], sh[1], t)];
  const w = thick * 1.1;
  if (ch.id === 'danni') {
    // tie-dye blotches + peace sign
    const cols = ['#3a7bd5', '#e0a13a', '#7a3fb0', '#3d8a3a'];
    cols.forEach((c, i) => { const [x, y] = at(0.25 + i * 0.18); ctx.fillStyle = c; ctx.globalAlpha *= 0.55; ctx.beginPath(); ctx.arc(x + (i % 2 ? w * 0.4 : -w * 0.4), y, thick * 0.5, 0, TAU); ctx.fill(); ctx.globalAlpha /= 0.55; });
    const [px, py] = at(0.55); ctx.strokeStyle = '#efe2c4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, thick * 0.55, 0, TAU); ctx.moveTo(px, py - thick * 0.55); ctx.lineTo(px, py + thick * 0.55); ctx.moveTo(px, py); ctx.lineTo(px - thick * 0.38, py + thick * 0.4); ctx.moveTo(px, py); ctx.lineTo(px + thick * 0.38, py + thick * 0.4); ctx.stroke();
    // bead necklace
    const [nx, ny] = at(0.88); ctx.fillStyle = '#f2c14e'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(nx + i * thick * 0.25, ny + Math.abs(i) * -thick * 0.08 + thick * 0.2, 2, 0, TAU); ctx.fill(); }
  } else if (ch.id === 'katarina') {
    // suspenders + belt + gold chain
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = thick * 0.28;
    const [ax, ay] = at(0.12), [bx, by] = at(0.95);
    ctx.beginPath(); ctx.moveTo(ax - w * 0.5, ay); ctx.lineTo(bx - w * 0.45, by); ctx.moveTo(ax + w * 0.5, ay); ctx.lineTo(bx + w * 0.45, by); ctx.stroke();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = thick * 0.45; ctx.beginPath(); ctx.moveTo(ax - w, ay); ctx.lineTo(ax + w, ay); ctx.stroke();
    ctx.fillStyle = '#e0b64a'; ctx.fillRect(ax - 3, ay - 3, 6, 6);
    const [cx2, cy2] = at(0.82); ctx.strokeStyle = '#e0b64a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx2, cy2 - thick * 0.2, thick * 0.55, 0.3, Math.PI - 0.3); ctx.stroke();
  } else if (ch.id === 'brittani') {
    // fur torso with a green two-piece
    const [ax, ay] = at(0), [bx, by] = at(1);
    ctx.strokeStyle = ch.pal.fur; ctx.lineWidth = thick * 2.3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const top = at(0.72), bot = at(0.06);
    ctx.fillStyle = ch.pal.shirt; ctx.strokeStyle = outline; ctx.lineWidth = 1.5;
    roundRect(ctx, top[0] - w * 1.05, top[1] - thick * 0.42, w * 2.1, thick * 0.84, thick * 0.35); ctx.fill(); ctx.stroke();
    roundRect(ctx, bot[0] - w * 1.05, bot[1] - thick * 0.35, w * 2.1, thick * 0.7, thick * 0.3); ctx.fill(); ctx.stroke();
  } else if (ch.id === 'richard') {
    const [ax, ay] = at(0.1); ctx.strokeStyle = '#4a3020'; ctx.lineWidth = thick * 0.42; ctx.beginPath(); ctx.moveTo(ax - w, ay); ctx.lineTo(ax + w, ay); ctx.stroke();
    ctx.fillStyle = '#b8b8b8'; ctx.fillRect(ax - 3, ay - 3, 6, 6);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let t = 0.3; t < 0.95; t += 0.2) { const [x, y] = at(t); ctx.beginPath(); ctx.arc(x + w * 0.15, y, 1.6, 0, TAU); ctx.fill(); }
    const [cx2, cy2] = at(0.97); ctx.strokeStyle = shade(ch.pal.shirt, -0.4); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx2 - w * 0.6, cy2 - 2); ctx.lineTo(cx2, cy2 + thick * 0.4); ctx.lineTo(cx2 + w * 0.6, cy2 - 2); ctx.stroke();
  } else if (ch.id === 'robert') {
    // shaggy fur tufts + bead necklace
    ctx.strokeStyle = shade(ch.pal.fur, -0.35); ctx.lineWidth = 1.5;
    for (let t = 0.2; t < 1; t += 0.14) { const [x, y] = at(t); for (const o of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.moveTo(x + o * w, y); ctx.lineTo(x + o * w - 2, y + 4); ctx.stroke(); } }
    const [nx, ny] = at(0.86); ctx.fillStyle = '#3d8a3a'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(nx + i * thick * 0.25, ny + thick * 0.2 - Math.abs(i) * thick * 0.08, 2.2, 0, TAU); ctx.fill(); }
  }
}

function sarong(ctx, hip, thick, frame) {
  const sway = Math.sin(frame * 0.12) * 2;
  ctx.fillStyle = '#7a2a1e'; ctx.strokeStyle = 'rgba(8,6,20,.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hip[0] - thick * 1.3, hip[1] - thick * 0.5); ctx.lineTo(hip[0] + thick * 1.3, hip[1] - thick * 0.5); ctx.lineTo(hip[0] + thick * 0.4 + sway, hip[1] + thick * 1.9); ctx.lineTo(hip[0] - thick * 0.6 + sway, hip[1] + thick * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e0b64a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hip[0] - thick * 1.1, hip[1] - thick * 0.1); ctx.lineTo(hip[0] + thick * 1.1, hip[1] - thick * 0.1); ctx.stroke();
  ctx.strokeStyle = '#3d8a3a'; ctx.beginPath(); ctx.moveTo(hip[0] - thick * 0.8, hip[1] + thick * 0.5); ctx.lineTo(hip[0] + thick * 0.8 + sway, hip[1] + thick * 0.6); ctx.stroke();
}

function drawBunnyHead(ctx, c, r, F, frame, outline, lean) {
  const ch = F.ch, P = ch.pal, fur = P.fur, id = ch.id;
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(lean * 0.6);
  // ears
  const earIn = '#f0a3b4';
  const ear = (bx, by, ang, len, wid, flop = 0) => {
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    const tip = flop ? [Math.sin(flop) * len * 0.5, -len * 0.55 - Math.cos(flop) * len * 0.45] : [0, -len];
    const drawShape = (w2, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w2, 0); ctx.quadraticCurveTo(-w2 * 1.2, -len * 0.55, tip[0], tip[1]); ctx.quadraticCurveTo(w2 * 1.2, -len * 0.55, w2, 0); ctx.closePath(); ctx.fill(); };
    drawShape(wid + 2.5, outline); drawShape(wid, fur); drawShape(wid * 0.5, earIn);
    ctx.restore();
  };
  if (id === 'richard') {
    ear(r * 0.25, -r * 0.7, 2.55, r * 2.4, r * 0.42); // far ear, mostly hidden
  } else if (id === 'robert') {
    ear(-r * 0.45, -r * 0.75, -0.75, r * 1.7, r * 0.36); ear(r * 0.3, -r * 0.8, 0.55, r * 1.6, r * 0.36);
  } else {
    const wob = Math.sin(frame * 0.09) * 0.05;
    const flop = id === 'brittani' ? 0.9 : 0;
    ear(-r * 0.35, -r * 0.75, -0.32 + wob, r * 2.1, r * 0.38, flop); ear(r * 0.25, -r * 0.82, 0.05 - wob, r * 2.0, r * 0.38, flop ? flop * 1.2 : 0);
  }
  // head
  ctx.fillStyle = outline; ctx.beginPath(); ctx.ellipse(0, 0, r + 2.5, r * 0.95 + 2.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.95, 0, 0, TAU); ctx.fill();
  if (id === 'robert') { ctx.strokeStyle = shade(fur, -0.4); ctx.lineWidth = 1.5; for (let a = -2.6; a < 0.2; a += 0.35) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); ctx.stroke(); } }
  if (id === 'richard') ear(-r * 0.35, -r * 0.75, 3.75, r * 2.6, r * 0.46); // long floppy ear drooping down the back
  // muzzle, nose, whiskers
  const muz = id === 'robert' ? '#c49a6c' : shade(fur, 0.45);
  ctx.fillStyle = muz; ctx.beginPath(); ctx.ellipse(r * 0.48, r * 0.32, r * 0.48, r * 0.38, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e07a8a'; ctx.beginPath(); ctx.ellipse(r * 0.86, r * 0.12, r * 0.15, r * 0.11, 0, 0, TAU); ctx.fill();
  if (id === 'robert' || id === 'danni') { ctx.fillStyle = '#fff8e8'; ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.fillRect(r * 0.62, r * 0.48, r * 0.13, r * 0.2); ctx.fillRect(r * 0.76, r * 0.48, r * 0.13, r * 0.2); ctx.strokeRect(r * 0.62, r * 0.48, r * 0.27, r * 0.2); }
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
  for (const dy of [-0.05, 0.12, 0.28]) { ctx.beginPath(); ctx.moveTo(r * 0.7, r * (0.15 + dy * 0.5)); ctx.lineTo(r * 1.45, r * (0.02 + dy)); ctx.stroke(); }
  // eyes / eyewear
  const hurt = F.state === 'hitstun' || F.state === 'stunned';
  if (id === 'richard') {
    ctx.fillStyle = '#111'; roundRect(ctx, r * 0.05, -r * 0.42, r * 0.95, r * 0.42, r * 0.08); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.3); ctx.lineTo(-r * 0.6, -r * 0.35); ctx.stroke();
    ctx.strokeStyle = shade(fur, -0.45); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(r * 0.85, -r * 0.48); ctx.stroke(); // grumpy brow
  } else if (id === 'danni') {
    ctx.fillStyle = '#2f6fd6'; ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r * 0.52, -r * 0.18, r * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.26, r * 0.07, 0, TAU); ctx.fill();
  } else if (hurt) {
    ctx.strokeStyle = '#140c1e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.35); ctx.lineTo(r * 0.62, -r * 0.05); ctx.moveTo(r * 0.62, -r * 0.35); ctx.lineTo(r * 0.3, -r * 0.05); ctx.stroke();
  } else {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.2, r * 0.2, r * 0.24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = id === 'robert' ? '#b0401e' : '#7a4a10'; ctx.beginPath(); ctx.ellipse(r * 0.52, -r * 0.18, r * 0.12, r * 0.16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#140c1e'; ctx.beginPath(); ctx.ellipse(r * 0.54, -r * 0.18, r * 0.06, r * 0.1, 0, 0, TAU); ctx.fill();
    if (id === 'katarina') { ctx.fillStyle = 'rgba(150,60,200,.85)'; ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.33, r * 0.22, r * 0.1, 0, Math.PI, TAU); ctx.fill(); ctx.strokeStyle = '#140c1e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r * 0.22, -r * 0.3); ctx.lineTo(r * 0.7, -r * 0.4); ctx.stroke(); }
    if (id === 'brittani') { ctx.strokeStyle = '#140c1e'; ctx.lineWidth = 2; for (const k of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(r * (0.3 + k * 0.12), -r * 0.4); ctx.lineTo(r * (0.26 + k * 0.14), -r * 0.55); ctx.stroke(); } }
    if (id === 'robert') { ctx.strokeStyle = '#140c1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 0.22, -r * 0.42); ctx.lineTo(r * 0.72, -r * 0.34); ctx.stroke(); }
  }
  // headwear & hair in front
  if (id === 'danni') {
    // stars-and-stripes bandana
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r + 1, r * 0.95 + 1, 0, 0, TAU); ctx.clip();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#f2ece0' : '#c8342c'; ctx.fillRect(-r * 1.2, -r * 1.0 + i * r * 0.12, r * 2.4, r * 0.12); }
    ctx.fillStyle = '#1f3a7a'; ctx.fillRect(-r * 1.2, -r * 1.0, r * 0.9, r * 0.48);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-r * 1.0 + i * r * 0.2, -r * 0.8 + (i % 2) * r * 0.14, 1.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  } else if (id === 'katarina') {
    // fedora with a gold band and a feather
    ctx.fillStyle = outline; roundRect(ctx, -r * 1.5, -r * 0.85, r * 3.0, r * 0.4, r * 0.2); ctx.fill();
    ctx.fillStyle = '#3a1a52'; roundRect(ctx, -r * 1.42, -r * 0.82, r * 2.84, r * 0.3, r * 0.15); ctx.fill();
    ctx.fillStyle = outline; roundRect(ctx, -r * 0.85, -r * 1.55, r * 1.7, r * 0.85, r * 0.3); ctx.fill();
    ctx.fillStyle = '#4a2068'; roundRect(ctx, -r * 0.77, -r * 1.47, r * 1.54, r * 0.75, r * 0.26); ctx.fill();
    ctx.fillStyle = '#e0b64a'; ctx.fillRect(-r * 0.77, -r * 0.95, r * 1.54, r * 0.17);
    ctx.fillStyle = '#9b4fd0'; ctx.beginPath(); ctx.ellipse(r * 0.6, -r * 1.2, r * 0.12, r * 0.4, 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e0b64a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-r * 0.1, r * 0.55, r * 0.14, 0, TAU); ctx.stroke(); // hoop
  } else if (id === 'brittani') {
    ctx.fillStyle = '#f2c766'; ctx.strokeStyle = outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.2); ctx.quadraticCurveTo(-r * 0.6, -r * 1.25, r * 0.55, -r * 0.92); ctx.quadraticCurveTo(r * 0.1, -r * 0.7, r * 0.05, -r * 0.45); ctx.quadraticCurveTo(-r * 0.4, -r * 0.6, -r * 0.95, -r * 0.2); ctx.fill(); ctx.stroke();
  } else if (id === 'robert') {
    ctx.fillStyle = '#1c1410'; ctx.beginPath(); ctx.ellipse(-r * 0.1, -r * 0.95, r * 0.45, r * 0.25, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.85); ctx.lineTo(r * 0.25, -r * 0.85); ctx.stroke();
  }
  // something lit in the mouth (Danni, Richard, Robert)
  if (id === 'danni' || id === 'richard' || id === 'robert') {
    ctx.strokeStyle = '#efe6d6'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * 0.78, r * 0.42); ctx.lineTo(r * 1.32, r * 0.5); ctx.stroke();
    ctx.fillStyle = Math.floor(frame / 8) % 2 ? '#ff7a2f' : '#ffb04a'; ctx.beginPath(); ctx.arc(r * 1.34, r * 0.5, r * 0.08, 0, TAU); ctx.fill();
    for (let k = 0; k < 3; k++) { const t = ((frame * 0.6 + k * 20) % 60) / 60; ctx.fillStyle = `rgba(230,230,230,${0.35 * (1 - t)})`; ctx.beginPath(); ctx.arc(r * 1.36 + Math.sin(t * 6 + k) * 3, r * 0.45 - t * r * 1.6, r * (0.1 + t * 0.2), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ── extra stages ────────────────────────────────────────────────────────────
function hash(n) { return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1; }

function drawNight(ctx, W, H, cam, frame) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#060a1f'); g.addColorStop(0.6, '#1b2350'); g.addColorStop(1, '#3a2a5a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const x = (i * 137.7) % W, y = (i * 53.3) % (H * 0.6); ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.02 + i)); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2, 2); }
  ctx.globalAlpha = 1;
  const mx = W * 0.2 - cam.x * 0.02, my = H * 0.2;
  const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 120); mg.addColorStop(0, 'rgba(255,250,220,.45)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 120, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(mx, my, 36, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8dfc0'; ctx.beginPath(); ctx.arc(mx + 10, my - 8, 7, 0, TAU); ctx.arc(mx - 12, my + 10, 5, 0, TAU); ctx.fill();
  // distant town
  for (const [par, base, col, win] of [[0.05, 0.8, '#151a38', 'rgba(255,210,120,.55)'], [0.12, 0.9, '#0c1028', 'rgba(255,190,90,.7)']]) {
    const off = -cam.x * par;
    for (let i = -2; i < W / 70 + 3; i++) {
      const k = Math.floor(i - off / 70), x = i * 70 + (off % 70), hgt = 50 + hash(k + par * 100) * 90, y = H * base - hgt;
      ctx.fillStyle = col; ctx.fillRect(x, y, 62, H - y);
      if (hash(k * 3) > 0.4) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 31, y - 22); ctx.lineTo(x + 66, y); ctx.fill(); }
      ctx.fillStyle = win; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (hash(k * 7 + r * 3 + c) > 0.55) ctx.fillRect(x + 8 + c * 18, y + 12 + r * 22, 8, 10);
    }
  }
}
function drawSaloon(ctx, S, frame) {
  S.solids.forEach((m, i) => {
    const w = m.x2 - m.x1;
    const g = ctx.createLinearGradient(0, m.y, 0, m.y + 520); g.addColorStop(0, '#8a5530'); g.addColorStop(1, '#2c160c');
    ctx.fillStyle = g; ctx.fillRect(m.x1, m.y, w, 640);
    ctx.strokeStyle = 'rgba(30,14,6,.55)'; ctx.lineWidth = 2;
    for (let y = m.y + 16; y < m.y + 640; y += 16) { ctx.beginPath(); ctx.moveTo(m.x1, y); ctx.lineTo(m.x2, y); ctx.stroke(); }
    // windows
    for (let r = 0; r < 4; r++) for (let c = 0; c < Math.floor(w / 90); c++) {
      const wx = m.x1 + 30 + c * 90, wy = m.y + 60 + r * 110; const lit = hash(i * 31 + r * 7 + c) > 0.35;
      ctx.fillStyle = '#1a0d06'; ctx.fillRect(wx - 3, wy - 3, 46, 62);
      ctx.fillStyle = lit ? (Math.sin(frame * 0.05 + c + r) > 0.95 ? '#ffe9a8' : '#ffc860') : '#2a1a2e'; ctx.fillRect(wx, wy, 40, 56);
      ctx.strokeStyle = '#1a0d06'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx + 20, wy); ctx.lineTo(wx + 20, wy + 56); ctx.moveTo(wx, wy + 28); ctx.lineTo(wx + 40, wy + 28); ctx.stroke();
    }
    // roof trim
    ctx.fillStyle = '#c98a4a'; ctx.fillRect(m.x1 - 6, m.y - 6, w + 12, 12); ctx.strokeStyle = '#2c160c'; ctx.lineWidth = 3; ctx.strokeRect(m.x1 - 6, m.y - 6, w + 12, 12);
    // big sign on the facade
    ctx.save(); ctx.translate((m.x1 + m.x2) / 2, m.y + 30);
    ctx.fillStyle = '#3a1e0e'; roundRect(ctx, -110, -18, 220, 36, 6); ctx.fill(); ctx.strokeStyle = '#e0a84a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd36b'; ctx.font = '900 26px Teko, Impact, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i === 0 ? 'SALOON' : 'HOTEL', 0, 2); ctx.textBaseline = 'alphabetic';
    ctx.restore();
  });
  S.plats.forEach((p, i) => {
    if (i === 0) {
      // hanging sign over the gap
      const a = S.solids[0], b = S.solids[1];
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x2, a.y - 110); ctx.lineTo(p.x1 + 10, p.y); ctx.moveTo(b.x1, b.y - 110); ctx.lineTo(p.x2 - 10, p.y); ctx.stroke();
      ctx.fillStyle = '#6b3f1f'; roundRect(ctx, p.x1, p.y - 3, p.x2 - p.x1, 34, 4); ctx.fill(); ctx.strokeStyle = '#2c160c'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ffd36b'; ctx.font = '900 22px Teko, Impact, system-ui'; ctx.textAlign = 'center'; ctx.fillText('TNG', (p.x1 + p.x2) / 2, p.y + 24);
    } else {
      // water tower: the tank top is the platform
      const cx = (p.x1 + p.x2) / 2, w = p.x2 - p.x1, solid = S.solids.find(m => cx >= m.x1 && cx <= m.x2);
      ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x1 + 14, p.y + 70); ctx.lineTo(p.x1 + 4, solid.y); ctx.moveTo(p.x2 - 14, p.y + 70); ctx.lineTo(p.x2 - 4, solid.y); ctx.moveTo(p.x1 + 8, solid.y - 30); ctx.lineTo(p.x2 - 8, p.y + 74); ctx.stroke();
      ctx.fillStyle = '#7a4a28'; roundRect(ctx, p.x1, p.y, w, 74, 10); ctx.fill(); ctx.strokeStyle = '#2c160c'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 3; for (const y of [22, 50]) { ctx.beginPath(); ctx.moveTo(p.x1, p.y + y); ctx.lineTo(p.x2, p.y + y); ctx.stroke(); }
      ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.moveTo(p.x1 - 6, p.y + 2); ctx.lineTo(cx, p.y - 18); ctx.lineTo(p.x2 + 6, p.y + 2); ctx.closePath(); ctx.fill();
    }
  });
  void frame;
}

function drawDay(ctx, W, H, cam, frame) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3f8fd6'); g.addColorStop(0.55, '#8fc8ee'); g.addColorStop(1, '#f3d9a6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sx = W * 0.8 - cam.x * 0.02; ctx.fillStyle = 'rgba(255,250,220,.9)'; ctx.beginPath(); ctx.arc(sx, H * 0.18, 34, 0, TAU); ctx.fill();
  for (let i = 0; i < 5; i++) { const x = ((i * 260 - frame * 0.15 - cam.x * 0.04) % (W + 300) + W + 300) % (W + 300) - 150, y = H * (0.12 + (i % 3) * 0.07); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(x, y, 60, 16, 0, 0, TAU); ctx.ellipse(x + 30, y - 8, 36, 14, 0, 0, TAU); ctx.fill(); }
  for (const [par, base, col] of [[0.05, 0.72, '#c97a4a'], [0.1, 0.84, '#a3532e'], [0.16, 0.95, '#7a3420']]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); const off = -cam.x * par;
    for (let x = -60; x <= W + 60; x += 30) { const k = Math.floor((x - off) / 120); const n = hash(k + par * 50); ctx.lineTo(x + (off % 30), H * base - (n > 0.5 ? 80 * n : 20 * n) - cam.y * par * 0.4); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
}
function drawCanyon(ctx, S, frame) {
  const [a, b] = S.solids;
  // rail line across the gap
  const cart = S.plats.find(p => p.cart);
  ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a.x2, cart.by + 40); ctx.lineTo(b.x1, cart.by + 40); ctx.stroke();
  ctx.strokeStyle = '#6b5a4a'; ctx.lineWidth = 2; for (let x = a.x2 + 10; x < b.x1; x += 22) { ctx.beginPath(); ctx.moveTo(x, cart.by + 36); ctx.lineTo(x, cart.by + 46); ctx.stroke(); }
  for (const m of S.solids) {
    const g = ctx.createLinearGradient(0, m.y, 0, m.y + 600); g.addColorStop(0, '#c8643a'); g.addColorStop(0.5, '#9a3f2a'); g.addColorStop(1, '#3a1612');
    ctx.fillStyle = g; ctx.beginPath();
    const inner = m.x1 > 0 ? m.x1 : m.x2, outer = m.x1 > 0 ? m.x2 : m.x1, s = m.x1 > 0 ? 1 : -1;
    ctx.moveTo(m.x1, m.y); ctx.lineTo(m.x2, m.y); ctx.lineTo(outer + s * 60, m.y + 700); ctx.lineTo(inner + s * 30, m.y + 700); ctx.lineTo(inner + s * 6, m.y + 200); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,150,.18)'; ctx.lineWidth = 3; for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(m.x1 + 6, m.y + i * 30); ctx.lineTo(m.x2 - 6, m.y + i * 30 + (i % 2 ? 5 : -4)); ctx.stroke(); }
    ctx.fillStyle = '#e9b26b'; ctx.fillRect(m.x1 - 4, m.y - 4, m.x2 - m.x1 + 8, 12); ctx.fillStyle = '#9ab54b'; ctx.fillRect(m.x1 - 4, m.y - 6, m.x2 - m.x1 + 8, 5);
    ctx.strokeStyle = 'rgba(30,10,10,.6)'; ctx.lineWidth = 3; ctx.strokeRect(m.x1 - 4, m.y - 6, m.x2 - m.x1 + 8, 14);
    cactus(ctx, outer - s * 50, m.y - 6, 0.9);
  }
  for (const p of S.plats) {
    if (p.cart) {
      const cx = (p.x1 + p.x2) / 2;
      ctx.fillStyle = '#5a5f66'; ctx.strokeStyle = '#1e2024'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x1, p.y); ctx.lineTo(p.x2, p.y); ctx.lineTo(p.x2 - 12, p.y + 38); ctx.lineTo(p.x1 + 12, p.y + 38); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9a36b'; ctx.fillRect(p.x1 + 4, p.y - 6, p.x2 - p.x1 - 8, 8); // gold nuggets on top
      ctx.fillStyle = '#ffd36b'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(p.x1 + 14 + i * 18, p.y - 6 + (i % 2) * 2, 5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#1e2024'; for (const x of [p.x1 + 22, p.x2 - 22]) { ctx.save(); ctx.translate(x, p.y + 42); ctx.rotate(cx * 0.05); ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.restore(); }
    } else {
      const solid = S.solids.find(m => (p.x1 + p.x2) / 2 >= m.x1 && (p.x1 + p.x2) / 2 <= m.x2);
      ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x1 + 12, p.y + 6); ctx.lineTo(p.x1 + 20, solid ? solid.y : p.y + 60); ctx.moveTo(p.x2 - 12, p.y + 6); ctx.lineTo(p.x2 - 20, solid ? solid.y : p.y + 60); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x1 + 14, p.y + 20); ctx.lineTo(p.x2 - 18, (solid ? solid.y : p.y + 60) - 10); ctx.stroke();
      ctx.fillStyle = '#a8692f'; roundRect(ctx, p.x1, p.y - 3, p.x2 - p.x1, 14, 4); ctx.fill(); ctx.strokeStyle = '#3a200e'; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
  void frame;
}

function drawLoungeBack(ctx, W, H, cam, frame) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0c2a'); g.addColorStop(1, '#2e1238');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // brick-ish wall pattern with parallax
  const off = -cam.x * 0.1;
  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 2;
  for (let y = 0; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); for (let x = ((y / 26) % 2) * 30 + (off % 60); x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); } }
  // neon sign
  const nx = W / 2 - cam.x * 0.15, ny = H * 0.4 - cam.y * 0.05, fl = Math.sin(frame * 0.3) > 0.97 ? 0.4 : 1;
  const fs = Math.round(Math.min(W * 0.06, H * 0.09, 64));
  ctx.save(); ctx.globalAlpha = 0.6; ctx.textAlign = 'center'; ctx.font = `900 ${fs}px Teko, Impact, system-ui`;
  ctx.shadowColor = '#ff4fb0'; ctx.shadowBlur = 24; ctx.fillStyle = `rgba(255,120,200,${fl})`; ctx.fillText('BUNNIE LOUNGE', nx, ny);
  ctx.shadowColor = '#3ef0ff'; ctx.font = `900 ${Math.round(fs * 0.5)}px Teko, Impact, system-ui`; ctx.fillStyle = '#9ff8ff'; ctx.fillText('★ TEXAS NOMAD GAMES ★', nx, ny + fs * 0.7);
  ctx.restore();
  // posters + lava lamps
  for (let i = 0; i < 4; i++) {
    const px = W * (0.1 + i * 0.27) - cam.x * 0.12, py = H * 0.38;
    ctx.fillStyle = ['#3a7bd5', '#7b3fb0', '#ff7aa8', '#3d8a3a'][i]; ctx.globalAlpha = 0.35; ctx.fillRect(px, py, 70, 96); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.strokeRect(px, py, 70, 96);
  }
  // drifting haze
  for (let i = 0; i < 6; i++) { const x = ((i * 220 + frame * (0.2 + i * 0.05)) % (W + 400)) - 200, y = H * (0.3 + (i % 3) * 0.18); ctx.fillStyle = 'rgba(200,180,230,.06)'; ctx.beginPath(); ctx.ellipse(x, y, 180, 50, 0, 0, TAU); ctx.fill(); }
}
function drawLounge(ctx, S, frame) {
  const m = S.solids[0];
  // floor + stage front
  const g = ctx.createLinearGradient(0, m.y, 0, m.bottom + 200); g.addColorStop(0, '#4a2a3e'); g.addColorStop(1, '#140812');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(m.x1, m.y); ctx.lineTo(m.x2, m.y); ctx.lineTo(m.x2 - 40, m.bottom + 160); ctx.lineTo(m.x1 + 40, m.bottom + 160); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a5a36'; ctx.fillRect(m.x1 - 4, m.y - 4, m.x2 - m.x1 + 8, 14);
  ctx.strokeStyle = 'rgba(40,20,10,.6)'; ctx.lineWidth = 1.5; for (let x = m.x1 + 40; x < m.x2; x += 48) { ctx.beginPath(); ctx.moveTo(x, m.y - 4); ctx.lineTo(x, m.y + 10); ctx.stroke(); }
  // neon trim along the front edge
  ctx.save(); ctx.shadowColor = '#ff4fb0'; ctx.shadowBlur = 14; ctx.strokeStyle = '#ff6fc0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m.x1, m.y + 14); ctx.lineTo(m.x2, m.y + 14); ctx.stroke(); ctx.restore();
  // lava lamp + couch props on the floor
  const lx = m.x1 + 60; ctx.fillStyle = '#2a2a2a'; ctx.fillRect(lx - 10, m.y - 14, 20, 14); ctx.fillStyle = 'rgba(255,90,150,.55)'; ctx.beginPath(); ctx.ellipse(lx, m.y - 40, 10, 26, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.arc(lx, m.y - 50 + Math.sin(frame * 0.04) * 12, 5, 0, TAU); ctx.arc(lx + 2, m.y - 30 - Math.sin(frame * 0.05) * 8, 4, 0, TAU); ctx.fill();
  for (const p of S.plats) {
    const w = p.x2 - p.x1, cx = (p.x1 + p.x2) / 2;
    if (w > 200) {
      // loft balcony with a neon rail
      ctx.fillStyle = '#3a1e3a'; roundRect(ctx, p.x1, p.y - 3, w, 18, 5); ctx.fill(); ctx.strokeStyle = '#140812'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.shadowColor = '#3ef0ff'; ctx.shadowBlur = 12; ctx.strokeStyle = '#7ff6ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x1 + 6, p.y + 14); ctx.lineTo(p.x2 - 6, p.y + 14); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#2a1428'; ctx.lineWidth = 4; for (const x of [p.x1 + 20, p.x2 - 20]) { ctx.beginPath(); ctx.moveTo(x, p.y + 15); ctx.lineTo(x, p.y - 400); ctx.stroke(); }
    } else {
      // bar stool: seat is the platform
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - w * 0.3, p.y + 8); ctx.lineTo(cx - w * 0.42, m.y); ctx.moveTo(cx + w * 0.3, p.y + 8); ctx.lineTo(cx + w * 0.42, m.y); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - w * 0.36, (p.y + m.y) / 2 + 10); ctx.lineTo(cx + w * 0.36, (p.y + m.y) / 2 + 10); ctx.stroke();
      ctx.fillStyle = '#3b2418'; ctx.beginPath(); ctx.ellipse(cx, p.y + 4, w / 2, 10, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#140812'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#5a3a28'; ctx.beginPath(); ctx.ellipse(cx, p.y, w / 2 - 3, 6, 0, 0, TAU); ctx.fill();
    }
  }
}