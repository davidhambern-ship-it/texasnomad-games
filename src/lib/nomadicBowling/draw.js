import { STAGES, PIN_POSITIONS, ballPosition, resolvePins } from './engine.js';
const predictionCache = new WeakMap();
export function project(x, z, w, h) { const depth = z / (1 + .65 * z); return { x: w / 2 + x * w * .76 / (1 + 2.1 * z), y: h * .92 - depth * h * .90, scale: 1 / (1 + 2.1 * z) }; }
export function unproject(px, py, w, h) { const depth = (h * .92 - py) / (h * .90), z = Math.max(0, Math.min(1.12, depth / (1 - .65 * depth))); return { x: (px - w / 2) * (1 + 2.1 * z) / (w * .76), z }; }
function polygon(ctx, pts, fill, stroke) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
function glowText(ctx, text, x, y, size, color, glow = 15) { ctx.save(); ctx.textAlign = 'center'; ctx.font = `900 ${size}px Impact, sans-serif`; ctx.fillStyle = color; ctx.shadowBlur = glow; ctx.shadowColor = color; ctx.fillText(text, x, y); ctx.restore(); }
function pin(ctx, x, y, size, down, accent) {
  ctx.save(); ctx.translate(x, y); if (down) { ctx.translate(size * .5 * down, 0); ctx.rotate(1.2 * down); }
  ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(0, 3, size * .33, size * .12, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-size * .3, 0, size * .3, 0); g.addColorStop(0, '#a3b9c6'); g.addColorStop(.4, '#fff8e9'); g.addColorStop(1, '#859bae');
  ctx.fillStyle = g; ctx.strokeStyle = '#17212b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-size * .25, 0); ctx.bezierCurveTo(-size * .42, -size * .28, -size * .11, -size * .48, -size * .11, -size * .66); ctx.bezierCurveTo(-size * .24, -size * .80, -size * .16, -size, 0, -size); ctx.bezierCurveTo(size * .16, -size, size * .24, -size * .80, size * .11, -size * .66); ctx.bezierCurveTo(size * .11, -size * .48, size * .42, -size * .28, size * .25, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = accent; ctx.lineWidth = size * .055; ctx.beginPath(); ctx.moveTo(-size * .14, -size * .64); ctx.lineTo(size * .14, -size * .64); ctx.moveTo(-size * .12, -size * .73); ctx.lineTo(size * .12, -size * .73); ctx.stroke(); ctx.restore();
}
export function drawLane(ctx, w, h, game, now = Date.now(), aim = {}, compact = false) {
  const stage = STAGES.find(s => s.id === game?.settings?.stage) || STAGES[0], A = stage.accent, W = stage.warm;
  ctx.clearRect(0, 0, w, h); const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, stage.wall); bg.addColorStop(1, '#090910'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // Timber walls, neon circuitry, recessed saloon bar and arcade booths.
  ctx.fillStyle = '#372124'; ctx.fillRect(0, h * .04, w, h * .36);
  for (let i = 0; i < 34; i++) { ctx.fillStyle = i % 2 ? '#1c121ed0' : '#542d2740'; ctx.fillRect(i * w / 34, h * .04, w / 34 - 2, h * .36); }
  ctx.fillStyle = '#110e18'; ctx.fillRect(0, h * .06, w, h * .018); ctx.fillRect(0, h * .26, w, h * .025);
  ctx.strokeStyle = A; ctx.lineWidth = 1.5; ctx.globalAlpha = .22;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(i * w / 6, 0); ctx.lineTo(i * w / 6, h * .10); ctx.lineTo(i * w / 6 + 30, h * .15); ctx.stroke(); } ctx.globalAlpha = 1;
  ctx.fillStyle = '#08080f'; ctx.strokeStyle = A; ctx.lineWidth = 2; ctx.shadowColor = A; ctx.shadowBlur = 18;
  ctx.fillRect(w * .28, h * .08, w * .44, h * .13); ctx.strokeRect(w * .28, h * .08, w * .44, h * .13); ctx.shadowBlur = 0;
  glowText(ctx, stage.sign, w / 2, h * .158, w * .029, A, 14);
  glowText(ctx, stage.detail, w / 2, h * .19, w * .0085, W, 0);
  for (const side of [0, 1]) {
    const x = side ? w * .78 : w * .035;
    ctx.fillStyle = '#080711'; ctx.fillRect(x, h * .16, w * .19, h * .22);
    ctx.strokeStyle = W; ctx.globalAlpha = .5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x, h * (.21 + i * .06)); ctx.lineTo(x + w * .19, h * (.21 + i * .06)); ctx.stroke(); } ctx.globalAlpha = 1;
    if (!side) for (let i = 0; i < 12; i++) { ctx.fillStyle = [A, W, '#a85fff'][i % 3]; ctx.globalAlpha = .4; ctx.fillRect(x + w * (.012 + (i % 6) * .026), h * (.178 + Math.floor(i / 6) * .07), w * .009, h * .035); ctx.globalAlpha = 1; }
    else for (let i = 0; i < 3; i++) { const cx = x + w * (.012 + i * .057); ctx.fillStyle = '#22192b'; ctx.fillRect(cx, h * .245, w * .049, h * .15); ctx.fillStyle = A; ctx.fillRect(cx + 3, h * .26, w * .04, h * .065); ctx.fillStyle = '#120c1e'; ctx.fillRect(cx + 6, h * .268, w * .032, h * .048); glowText(ctx, '★', cx + w * .024, h * .307, w * .015, W, 6); }
  }
  ctx.fillStyle = '#20161d'; ctx.fillRect(0, h * .39, w, h * .61);
  const vanish = { x: w / 2, y: h * .32 }; ctx.strokeStyle = '#7c514139';
  for (let i = -5; i <= 15; i++) { ctx.beginPath(); ctx.moveTo(vanish.x, vanish.y); ctx.lineTo(i * w / 10, h); ctx.stroke(); }
  for (let i = 0; i < 9; i++) { const y = h * (.42 + i * i * .008); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const edges = (x1, x2) => [project(x1, 0, w, h), project(x2, 0, w, h), project(x2, 1.08, w, h), project(x1, 1.08, w, h)];
  polygon(ctx, edges(-.56, -.46), '#05050e', A); polygon(ctx, edges(.46, .56), '#05050e', A);
  polygon(ctx, edges(-.46, .46), stage.lane, '#e5b98d');
  for (let i = 0; i < 20; i++) { ctx.strokeStyle = i % 2 ? '#f5b17427' : '#0c081530'; const x = -.46 + i * .046; ctx.beginPath(); const a = project(x, 0, w, h), b = project(x, 1.08, w, h); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  const foulA = project(-.46, .05, w, h), foulB = project(.46, .05, w, h); ctx.strokeStyle = '#fff1b3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(foulA.x, foulA.y); ctx.lineTo(foulB.x, foulB.y); ctx.stroke();
  for (let i = -3; i <= 3; i++) { const p = project(i * .08, .28, w, h); polygon(ctx, [{x:p.x,y:p.y-5},{x:p.x-4,y:p.y+3},{x:p.x+4,y:p.y+3}], '#271923'); }
  if (game?.settings?.mode === 'brawl' && !compact) { const a = project(-.46, .55, w, h), b = project(.46, .55, w, h); ctx.strokeStyle = '#fa68e5'; ctx.setLineDash([5, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); glowText(ctx, 'SABOTAGE GATE', w / 2, a.y + 17, 10, '#ffa2ed', 4); }
  // A faint projected trajectory during aiming (not an aim-assist outcome).
  if (game?.phase === 'aim' && !compact && aim.visible) {
    ctx.strokeStyle = A + '70'; ctx.setLineDash([3, 8]); ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const b = ballPosition({ start: aim.start || 0, aim: (aim.aim || 0) + Math.sin((now-game.phaseAt)/530)*.11, spin: aim.spin || 0, power: aim.power || .85 }, i / 40), p = project(b.x, b.z, w, h); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
  }
  const d = game?.delivery, rolling = game?.phase === 'rolling', progress = d ? Math.max(0, Math.min(1.03, (now - d.launchedAt) / d.duration)) : 0;
  const standing = game?.standing || PIN_POSITIONS.map(p => p.id);
  let knocked = d && !rolling ? d.knocked : [];
  if (d && rolling && progress > .80) { if (!predictionCache.has(d)) predictionCache.set(d, resolvePins(standing, d)); knocked = predictionCache.get(d); }
  for (const p of PIN_POSITIONS.slice().sort((a, b) => b.z - a.z)) {
    if (!standing.includes(p.id)) continue;
    const pos = project(p.x, p.z, w, h), fall = knocked.includes(p.id) ? rolling ? Math.max(0, Math.min(1, (progress - p.z + .015) * 16)) : 1 : 0;
    pin(ctx, pos.x, pos.y, Math.max(16, h * .115 * pos.scale), fall, A);
  }
  if (rolling || game?.phase === 'aim' || compact) {
    const b = rolling ? ballPosition(d, progress) : {x:aim.start || 0,z:.03}, p = project(Math.max(-.52, Math.min(.52, b.x)), b.z, w, h), r = h * .033 * p.scale;
    if (rolling) { for (let i = 6; i > 0; i--) { const q = ballPosition(d, Math.max(0, progress - i * .018)), t = project(q.x, q.z, w, h); ctx.fillStyle = A + '24'; ctx.beginPath(); ctx.arc(t.x, t.y, r * (1 - i * .1), 0, Math.PI * 2); ctx.fill(); } }
    ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * .75, r * 1.2, r * .35, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(p.x-r*.35,p.y-r*.35,1,p.x,p.y,r); g.addColorStop(0,'#d2ffff'); g.addColorStop(.25,A); g.addColorStop(1,'#08224c'); ctx.fillStyle=g; ctx.shadowColor=A; ctx.shadowBlur=12; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(now/210*(1+(d?.spin||0)));ctx.fillStyle='#061326';for(const [x,y]of [[-.23,-.18],[.22,-.18],[0,.21]]){ctx.beginPath();ctx.arc(x*r,y*r,r*.115,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
  if (d?.attack && now - d.attack.firedAt < 900) { const p = project(d.attack.x, .55, w, h); ctx.strokeStyle = d.attack.hit ? '#fff' : '#ff68dd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.attack.push < 0 ? w : 0, p.y - 35); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  if (game?.phase === 'revenge' && !compact) { const p = project((aim.revengeX || 0) + Math.sin((now-game.phaseAt)/130)*.016, (aim.revengeZ || .9) + Math.cos((now-game.phaseAt)/180)*.01, w, h); ctx.strokeStyle = '#ffda7b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.moveTo(p.x-20,p.y);ctx.lineTo(p.x+20,p.y);ctx.moveTo(p.x,p.y-20);ctx.lineTo(p.x,p.y+20);ctx.stroke(); }
  if (game?.phase === 'rolling' && aim.sabotageVisible && !compact) { const p=project(aim.sabotageX||0,.55,w,h);ctx.strokeStyle='#ff68dd';ctx.lineWidth=2;ctx.strokeRect(p.x-10,p.y-10,20,20); }
  // Film grain and ambient dust are deterministic and inexpensive.
  ctx.fillStyle='#ffe3af55';for(let i=0;i<18;i++){const x=(i*127.7+now*.002)%w,y=(i*61.3+now*.004)%(h*.5);ctx.fillRect(x,y,1,1);}
  if (compact) { glowText(ctx,'NOMADIC BOWLING',w/2,h*.76,w*.052,'#fff6cf',18);glowText(ctx,'ROLL STRAIGHT. PLAY DIRTY.',w/2,h*.84,w*.018,A,7); }
}
