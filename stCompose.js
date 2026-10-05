// Builds the picture for a "dynamic" scene: the background plus this round's objects,
// each sized for its spot, tinted to the local light and given a soft contact shadow.
// Every device builds the same picture from the same placement list.
import { useEffect, useState } from 'react';

let libPromise = null;
export function loadLibrary(base = '/see-that/objects/') {
  if (!libPromise) libPromise = fetch(`${base}objects.json`, { cache: 'no-store' }).then(r => r.json()).then(d => d.objects.map(o => ({ ...o, src: `${base}${o.file}` }))).catch((e) => { libPromise = null; throw e; });
  return libPromise;
}
export function setLibrary(list) { libPromise = Promise.resolve(list); }

const imgs = new Map();
function loadImg(src) {
  if (!imgs.has(src)) imgs.set(src, new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; }));
  return imgs.get(src);
}

export async function composeScene(bgSrc, width, height, placements, library) {
  const bg = await loadImg(bgSrc);
  const byId = Object.fromEntries(library.map(o => [o.id, o]));
  const sprites = await Promise.all(placements.map(p => (byId[p.sprite] ? loadImg(byId[p.sprite].src).catch(() => null) : null)));
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const g = c.getContext('2d');
  g.drawImage(bg, 0, 0, width, height);
  const clean = g.getImageData(0, 0, width, height).data;
  const avg = (x0, y0, x1, y1) => {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(width, x1 | 0); y1 = Math.min(height, y1 | 0);
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { const i = (y * width + x) * 4; r += clean[i]; gg += clean[i + 1]; b += clean[i + 2]; n++; }
    return n ? [r / n, gg / n, b / n] : [128, 110, 90];
  };
  placements.forEach((p, i) => {
    const im = sprites[i]; if (!im) return;
    const bx = p.bx * width, by = p.by * height, pw = p.pw, ph = p.ph;
    // soft contact shadow
    g.save(); g.translate(bx, by); g.scale(1, 0.28);
    const rad = pw * 0.62, gr = g.createRadialGradient(0, 0, 0, 0, 0, rad);
    gr.addColorStop(0, 'rgba(18,10,6,0.45)'); gr.addColorStop(1, 'rgba(18,10,6,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill(); g.restore();
    // sprite tinted toward the local colour, a touch darker at the bottom
    const s = 2, oc = document.createElement('canvas'); oc.width = Math.ceil(pw * s); oc.height = Math.ceil(ph * s);
    const o = oc.getContext('2d');
    o.drawImage(im, 0, 0, oc.width, oc.height);
    const [lr, lg, lb] = avg(bx - pw, by - ph * 1.6, bx + pw, by + ph * 0.6);
    o.globalCompositeOperation = 'source-atop';
    o.globalAlpha = 0.2; o.fillStyle = `rgb(${lr | 0},${lg | 0},${lb | 0})`; o.fillRect(0, 0, oc.width, oc.height);
    o.globalAlpha = 1;
    const vg = o.createLinearGradient(0, 0, 0, oc.height); vg.addColorStop(0, 'rgba(255,240,220,0.06)'); vg.addColorStop(1, 'rgba(0,0,0,0.16)');
    o.fillStyle = vg; o.fillRect(0, 0, oc.width, oc.height);
    g.save(); g.translate(bx, by); g.rotate((p.rot || 0) * Math.PI / 180);
    g.imageSmoothingQuality = 'high';
    g.drawImage(oc, -pw / 2, -ph, pw, ph);
    g.restore();
  });
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
  return URL.createObjectURL(blob);
}

// React hook: returns the picture URL to show (composed for dynamic rounds)
export function useSceneImage(scene, placements, library = null) {
  const [url, setUrl] = useState(null);
  const key = scene ? `${scene.image}|${placements ? placements.map(p => `${p.sprite}${p.bx}${p.by}`).join(',') : ''}` : '';
  useEffect(() => {
    if (!scene) { setUrl(null); return undefined; }
    if (!placements || !placements.length) { setUrl(scene.image); return undefined; }
    let alive = true, made = null;
    setUrl(null);
    (async () => {
      try {
        const lib = library || await loadLibrary();
        made = await composeScene(scene.image, scene.width, scene.height, placements, lib);
        if (alive) setUrl(made); else URL.revokeObjectURL(made);
      } catch { if (alive) setUrl(scene.image); }
    })();
    return () => { alive = false; if (made) setTimeout(() => URL.revokeObjectURL(made), 5000); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}
