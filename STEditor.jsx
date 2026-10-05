import React, { useEffect, useMemo, useRef, useState } from 'react';
import STPractice from './STPractice';
import { loadScene, loadSceneList } from '@/api/seeThatApi';
import { loadLibrary } from './stCompose';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'my-scene';
const idFor = (name, taken) => { let b = slug(name) || 'object', id = b, i = 2; while (taken.has(id)) id = `${b}-${i++}`; return id; };
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const r4 = (n) => Math.round(n * 10000) / 10000;

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/**
 * STEditor — mark the hidden objects on a scene picture (e.g. one made with GPT),
 * then download the optimized .jpg + .json to drop into public/see-that/scenes/.
 */
export default function STEditor({ onExit }) {
  const [img, setImg] = useState(null);         // { url, w, h, fileName }
  const [title, setTitle] = useState('');
  const [objs, setObjs] = useState([]);         // { id, name, shape, x, y, w, h }
  const [sel, setSel] = useState(null);
  const [shape, setShape] = useState('rect');
  const [zoom, setZoom] = useState(1);
  const [drawing, setDrawing] = useState(null);
  const [over, setOver] = useState(false);
  const [testing, setTesting] = useState(false);
  const [installed, setInstalled] = useState([]);
  const [msg, setMsg] = useState('');
  const [jsonFile, setJsonFile] = useState(null);
  const box = useRef(null);
  const drag = useRef(null);
  const nameRefs = useRef({});
  const [mode, setMode] = useState('spots');    // 'spots' = the game places objects · 'painted' = objects are in the picture
  const [lib, setLib] = useState([]);
  const [peek, setPeek] = useState(0);

  useEffect(() => { loadSceneList().then(setInstalled).catch(() => {}); loadLibrary().then(setLib).catch(() => {}); }, []);
  useEffect(() => { if (sel && mode === 'painted' && nameRefs.current[sel]) nameRefs.current[sel].focus(); }, [sel, mode]);
  const exportH = img ? Math.round(img.h * Math.min(1, 2000 / img.w)) : 1000;
  const loadItems = (s) => { if (s.mode === 'dynamic') { setMode('spots'); setObjs(s.zones || []); } else { setMode('painted'); setObjs(s.objects || []); } };

  const openFile = (file) => {
    if (!file) return;
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      file.text().then(t => { try { const s = JSON.parse(t); setJsonFile(s); setTitle(s.title || ''); loadItems(s); setMsg(img ? 'Loaded the boxes from the .json.' : 'Loaded the boxes — now drop the matching picture.'); } catch { setMsg('That .json file couldn’t be read.'); } });
      return;
    }
    if (!file.type.startsWith('image/')) { setMsg('Drop a picture (JPG, PNG or WebP).'); return; }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { setImg({ url, w: im.naturalWidth, h: im.naturalHeight, fileName: file.name }); if (!title && !jsonFile) setTitle(file.name.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ')); setMsg(''); };
    im.src = url;
  };
  const openInstalled = async (id) => {
    try {
      const s = await loadScene(id);
      const url = `/see-that/scenes/${s.image}`;
      const im = new Image();
      im.onload = () => { setImg({ url, w: im.naturalWidth, h: im.naturalHeight, fileName: s.image }); setTitle(s.title || s.id); loadItems(s); setJsonFile(s); setMsg(`Editing “${s.title}”.`); };
      im.src = url;
    } catch { setMsg('Couldn’t open that scene.'); }
  };

  const pos = (e) => { const r = box.current.getBoundingClientRect(); return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }; };
  const down = (e) => {
    if (!img) return;
    const p = pos(e);
    const t = e.target;
    try { box.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (t.dataset.handle) { const o = objs.find(q => q.id === t.dataset.handle); drag.current = { mode: 'resize', id: o.id, o: { ...o }, p }; setSel(o.id); return; }
    if (t.dataset.obj) { const o = objs.find(q => q.id === t.dataset.obj); drag.current = { mode: 'move', id: o.id, o: { ...o }, p }; setSel(o.id); return; }
    drag.current = { mode: 'draw', p }; setDrawing({ x: p.x, y: p.y, w: 0, h: 0 }); setSel(null);
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const p = pos(e);
    if (d.mode === 'draw') setDrawing({ x: Math.min(d.p.x, p.x), y: Math.min(d.p.y, p.y), w: Math.abs(p.x - d.p.x), h: Math.abs(p.y - d.p.y) });
    else if (d.mode === 'move') setObjs(os => os.map(o => (o.id === d.id ? { ...o, x: r4(clamp01(d.o.x + p.x - d.p.x)), y: r4(clamp01(d.o.y + p.y - d.p.y)) } : o)));
    else if (d.mode === 'resize') setObjs(os => os.map(o => (o.id === d.id ? { ...o, w: r4(Math.max(0.005, d.o.w + p.x - d.p.x)), h: r4(Math.max(0.005, d.o.h + p.y - d.p.y)) } : o)));
  };
  const up = () => {
    const d = drag.current; drag.current = null;
    if (d?.mode === 'draw' && drawing) {
      if (drawing.w > 0.006 && drawing.h > 0.006) {
        const taken = new Set(objs.map(o => o.id));
        const id = idFor(`${mode === 'spots' ? 'spot' : 'object'}-${objs.length + 1}`, taken);
        const item = mode === 'spots'
          ? { id, kind: 'spot', x: r4(drawing.x), y: r4(drawing.y), w: r4(drawing.w), h: r4(drawing.h), size: Math.round(exportH * (0.012 + 0.022 * (drawing.y + drawing.h))) }
          : { id, name: '', shape, x: r4(drawing.x), y: r4(drawing.y), w: r4(drawing.w), h: r4(drawing.h) };
        setObjs(os => [...os, item]);
        setSel(id);
      }
      setDrawing(null);
    }
  };
  useEffect(() => {
    const k = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel && document.activeElement?.tagName !== 'INPUT') { setObjs(os => os.filter(o => o.id !== sel)); setSel(null); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [sel]);

  const rename = (id, name) => setObjs(os => os.map(o => (o.id === id ? { ...o, name } : o)));
  const problems = useMemo(() => {
    const p = [];
    if (!img) p.push('Add a picture.');
    if (mode === 'spots') { if (objs.length < 8) p.push(`Mark at least 8 spots (20+ is better) — you have ${objs.length}.`); return p; }
    if (objs.length < 6) p.push(`Mark at least 6 objects (15+ makes every round different) — you have ${objs.length}.`);
    const empty = objs.filter(o => !o.name.trim()).length; if (empty) p.push(`${empty} box${empty > 1 ? 'es need' : ' needs'} a name.`);
    const names = objs.map(o => o.name.trim().toLowerCase()).filter(Boolean); const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) p.push(`Two boxes share the name “${dup[0]}” — names must be different.`);
    return p;
  }, [img, objs, mode]);

  const sceneId = slug(title);
  const buildScene = () => {
    if (mode === 'spots') {
      const W = Math.min(2000, img.w), H = Math.round(img.h * (W / img.w));
      return { v: 2, mode: 'dynamic', id: sceneId, title: title.trim() || sceneId, image: `${sceneId}.jpg`, width: W, height: H, library: 'objects',
        zones: objs.map(z => ({ id: z.id, kind: z.kind || 'spot', x: r4(z.x), y: r4(z.y), w: r4(z.w), h: r4(z.h), size: Math.round(z.size || 20) })) };
    }
    const taken = new Set();
    const objects = objs.map(o => { const id = idFor(o.name, taken); taken.add(id); return { id, name: o.name.trim(), shape: o.shape, x: r4(o.x), y: r4(o.y), w: r4(o.w), h: r4(o.h) }; });
    const W = Math.min(2000, img.w), H = Math.round(img.h * (W / img.w));
    return { v: 1, id: sceneId, title: title.trim() || sceneId, image: `${sceneId}.jpg`, width: W, height: H, objects };
  };
  const exportFiles = async () => {
    const scene = buildScene();
    const im = new Image(); im.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = img.url; });
    const c = document.createElement('canvas'); c.width = scene.width; c.height = scene.height;
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const jpg = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.86));
    download(`${scene.id}.jpg`, jpg);
    setTimeout(() => download(`${scene.id}.json`, new Blob([JSON.stringify(scene, null, 1)], { type: 'application/json' })), 400);
    setMsg(`Downloaded ${scene.id}.jpg and ${scene.id}.json — upload both to public/see-that/scenes/ in GitHub.`);
  };

  if (testing && img) {
    const scene = buildScene();
    return <STPractice scene={scene} imageUrl={img.url} library={scene.mode === 'dynamic' ? lib : null} count={scene.mode === 'dynamic' ? 10 : Math.min(10, scene.objects.length)} seconds={120} name="Tester" onExit={() => setTesting(false)} />;
  }

  return (
    <div className="st-ed">
      <div>
        {!img ? (
          <div className={`st-drop${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); [...e.dataTransfer.files].forEach(openFile); }}>
            <h2 className="st-h" style={{ fontSize: 40, color: 'var(--st-gold)' }}>Scene editor</h2>
            <p>Drop your scene picture here (from GPT or anywhere), or</p>
            <label className="st-btn primary" style={{ display: 'inline-block' }}>Choose a picture<input type="file" accept="image/*,.json" multiple hidden onChange={e => [...e.target.files].forEach(openFile)} /></label>
            {installed.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div className="st-label-sm" style={{ marginBottom: 6 }}>…or edit an installed scene</div>
                <div className="st-row" style={{ justifyContent: 'center' }}>{installed.map(s => <button key={s.id} type="button" className="st-btn small" onClick={() => openInstalled(s.id)}>{s.title}</button>)}</div>
              </div>
            )}
            {msg && <p className="st-err">{msg}</p>}
          </div>
        ) : (
          <>
            <div className="st-row" style={{ marginBottom: 8 }}>
              {mode === 'painted' && <div className="st-seg"><button type="button" aria-pressed={shape === 'rect'} onClick={() => setShape('rect')}>▭ Box</button><button type="button" aria-pressed={shape === 'ellipse'} onClick={() => setShape('ellipse')}>◯ Oval</button></div>}
              <span className="st-label-sm">Zoom</span>
              <input type="range" min="1" max="4" step="0.25" value={zoom} onChange={e => setZoom(Number(e.target.value))} aria-label="Zoom" />
              <span className="st-sub" style={{ margin: 0 }}>{mode === 'spots' ? 'Drag on the picture to mark a spot where objects can sit. Drag a spot to move it; drag its green corner to resize.' : 'Drag on the picture to box an object. Drag a box to move it; drag its green corner to resize.'}</span>
            </div>
            <div className="st-edcanvas">
              <div className="st-edimg" ref={box} style={{ width: `${zoom * 100}%` }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                <img className="base" src={img.url} alt="" draggable={false} />
                <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                  {objs.map(o => (o.shape === 'ellipse'
                    ? <ellipse key={o.id} data-obj={o.id} className={`st-edbox${sel === o.id ? ' sel' : ''}${mode === 'spots' ? ' spot' : ''}`} cx={o.x + o.w / 2} cy={o.y + o.h / 2} rx={o.w / 2} ry={o.h / 2} />
                    : <rect key={o.id} data-obj={o.id} className={`st-edbox${sel === o.id ? ' sel' : ''}${mode === 'spots' ? ' spot' : ''}`} x={o.x} y={o.y} width={o.w} height={o.h} />))}
                  {objs.filter(o => o.id === sel).map(o => <rect key="h" data-handle={o.id} className="st-edhandle" x={o.x + o.w - 0.007} y={o.y + o.h - 0.007 * (img.w / img.h)} width={0.014} height={0.014 * (img.w / img.h)} />)}
                  {drawing && (shape === 'ellipse' ? <ellipse className="st-edbox drawing" cx={drawing.x + drawing.w / 2} cy={drawing.y + drawing.h / 2} rx={drawing.w / 2} ry={drawing.h / 2} /> : <rect className="st-edbox drawing" x={drawing.x} y={drawing.y} width={drawing.w} height={drawing.h} />)}
                </svg>
                {mode === 'painted' && objs.map(o => <span key={`t-${o.id}`} className={`st-edtag${sel === o.id ? ' sel' : ''}`} style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }}>{o.name || '(name me)'}</span>)}
                {mode === 'spots' && lib.length > 0 && objs.map((z, i) => { const o = lib[(i + peek) % lib.length]; return <img key={`pv-${z.id}`} className="st-edpreview" src={o.src} alt="" style={{ left: `${(z.x + z.w / 2) * 100}%`, top: `${(z.y + z.h) * 100}%`, height: `${(z.size * (o.rel || 1)) / exportH * 100}%` }} />; })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="st-grid" style={{ alignContent: 'start' }}>
        <div className="st-card st-grid">
          <div>
            <div className="st-label-sm" style={{ marginBottom: 6 }}>Scene title</div>
            <input className="st-input" value={title} maxLength={40} placeholder="e.g. Ranch Barn" onChange={e => setTitle(e.target.value)} />
            <div className="st-sub" style={{ fontSize: 12 }}>File name: <code className="st-code">{sceneId}.jpg</code> + <code className="st-code">{sceneId}.json</code></div>
          </div>
          <div>
            <div className="st-label-sm" style={{ marginBottom: 6 }}>How are the objects hidden?</div>
            <div className="st-seg" style={{ marginBottom: 12 }}>
              <button type="button" aria-pressed={mode === 'spots'} onClick={() => { if (mode !== 'spots' && (!objs.length || window.confirm('Switch to spots? Your boxes will be cleared.'))) { setMode('spots'); setObjs([]); setSel(null); } }}>Game places them</button>
              <button type="button" aria-pressed={mode === 'painted'} onClick={() => { if (mode !== 'painted' && (!objs.length || window.confirm('Switch to painted objects? Your spots will be cleared.'))) { setMode('painted'); setObjs([]); setSel(null); } }}>Painted in the picture</button>
            </div>
            {mode === 'spots' && <p className="st-sub" style={{ marginTop: -4, fontSize: 13 }}>The game drops objects from the TNG object library onto these spots — a new layout every game. Use the size slider so the preview object looks right at that spot. {lib.length > 0 && <button type="button" className="st-btn small ghost" onClick={() => setPeek(p => p + 1)}>Try other objects</button>}</p>}
            <div className="st-label-sm" style={{ marginBottom: 6 }}>{mode === 'spots' ? `Spots (${objs.length})` : `Hidden objects (${objs.length})`}</div>
            <div className="st-edlist">
              {mode === 'spots' && objs.map((z, i) => (
                <div key={z.id} className={`st-editem${sel === z.id ? ' sel' : ''}`} style={{ gridTemplateColumns: '22px 1fr auto' }} onClick={() => setSel(z.id)}>
                  <span className="st-label-sm">{i + 1}</span>
                  <label className="st-sub" style={{ margin: 0, fontSize: 12 }}>Object size {z.size}px
                    <input type="range" min="8" max="90" value={z.size} style={{ width: '100%' }} onChange={e => { const v = Number(e.target.value); setObjs(os => os.map(q => (q.id === z.id ? { ...q, size: v } : q))); }} /></label>
                  <button type="button" className="st-btn small ghost" title="Delete" onClick={(e) => { e.stopPropagation(); setObjs(os => os.filter(q => q.id !== z.id)); if (sel === z.id) setSel(null); }}>✕</button>
                </div>
              ))}
              {mode === 'painted' && objs.map((o, i) => (
                <div key={o.id} className={`st-editem${sel === o.id ? ' sel' : ''}`} onClick={() => setSel(o.id)}>
                  <span className="st-label-sm">{i + 1}</span>
                  <input ref={el => { nameRefs.current[o.id] = el; }} value={o.name} placeholder="Name it (e.g. Horseshoe)" maxLength={24} onChange={e => rename(o.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                  <button type="button" className="st-btn small ghost" title="Box / oval" onClick={(e) => { e.stopPropagation(); setObjs(os => os.map(q => (q.id === o.id ? { ...q, shape: q.shape === 'rect' ? 'ellipse' : 'rect' } : q))); }}>{o.shape === 'rect' ? '▭' : '◯'}</button>
                  <button type="button" className="st-btn small ghost" title="Delete" onClick={(e) => { e.stopPropagation(); setObjs(os => os.filter(q => q.id !== o.id)); if (sel === o.id) setSel(null); }}>✕</button>
                </div>
              ))}
              {!objs.length && <span className="st-sub">{mode === 'spots' ? 'Draw a box over each surface where an object could sit — tabletops, shelves, benches, open floor. Objects sit with their bottom inside the box.' : 'Draw a box around each thing players should find.'}</span>}
            </div>
          </div>
          {problems.length > 0 && <ul className="st-steps" style={{ color: '#ffd0a0' }}>{problems.map(p => <li key={p}>{p}</li>)}</ul>}
          <div className="st-row">
            <button type="button" className="st-btn primary" disabled={problems.length > 0} onClick={exportFiles}>Download scene files</button>
            <button type="button" className="st-btn" disabled={!img || (mode === 'spots' ? objs.length < 4 || !lib.length : objs.length < 3 || objs.some(o => !o.name.trim()))} onClick={() => setTesting(true)}>Test play</button>
          </div>
          {img && <div className="st-row"><label className="st-btn small ghost">Load .json<input type="file" accept=".json,application/json" hidden onChange={e => openFile(e.target.files[0])} /></label><button type="button" className="st-btn small ghost" onClick={() => { if (window.confirm('Start over with a new picture?')) { setImg(null); setObjs([]); setTitle(''); setJsonFile(null); setSel(null); } }}>New scene</button></div>}
          {msg && <p className="st-sub" style={{ color: 'var(--st-green)' }}>{msg}</p>}
        </div>
        <div className="st-card">
          <div className="st-label-sm">Adding it to the game</div>
          <ol className="st-steps">
            <li>{mode === 'spots' ? <>Mark the spots, set each spot’s object size, then <b>Test play</b> a few times — every game lays the objects out differently.</> : <>Box every object, give each a short clear name, then <b>Test play</b> to make sure the taps land.</>}</li>
            <li><b>Download scene files</b> — you get a .jpg and a .json with the same name.</li>
            <li>In GitHub: open <code className="st-code">public/see-that/scenes</code> → <b>Add file → Upload files</b> → drop both → commit.</li>
            <li>After the site redeploys, the scene shows up in the host’s scene picker. No list to edit.</li>
          </ol>
        </div>
        <button type="button" className="st-btn ghost small" onClick={onExit}>← Back</button>
      </div>
    </div>
  );
}
