import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WWBoard from './WWBoard';
import WWRope from './WWRope';
import WWIcon from './WWIcons';
import { applyWord, checkWord, findWords, pathText, shuffleBoard, SPECIALS, SHUFFLE_COST } from '@/lib/wordWranglerEngine';
import { soundManager } from '@/lib/wordWranglerSound';

const REASON = { short: 'Words need 3+ letters', notword: 'Not in the dictionary', used: 'Already played that one', path: 'Tiles must touch' };
const fmtTime = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, '0')}`;

/**
 * WWPlay — one player's board, word preview, HUD and word list.
 *  state       engine state (controlled by the parent)
 *  onMove      ({ kind:'word'|'shuffle', path, result, state }) => void   parent stores the new state
 *  dict        { dict:Set, trie() }
 *  timeLeft    seconds remaining (null = untimed)
 *  totalTime   seconds for the bar
 *  disabled    freeze input
 *  side        extra nodes for the side column (rival / leaderboard)
 *  hudRight    nodes for the top-right (buttons)
 *  muted
 */
export default function WWPlay({ state, onMove, dict, timeLeft = null, totalTime = 150, disabled = false, side = null, hudRight = null, muted = false, title = null }) {
  const [path, setPath] = useState([]);
  const [fx, setFx] = useState(null);         // floating score
  const [toast, setToast] = useState(null);
  const [shake, setShake] = useState(0);
  const [popped, setPopped] = useState([]);
  const [freshIds, setFreshIds] = useState(null);
  const [hint, setHint] = useState(null);
  const [newWord, setNewWord] = useState(null);
  const fxKey = useRef(0);

  useEffect(() => { soundManager.setMute(!!muted); }, [muted]);
  useEffect(() => { if (disabled) setPath([]); }, [disabled]);
  // board replaced from outside (resync / new game): drop any trace
  useEffect(() => { setPath(p => (p.length && p.every(([r, c]) => state.board[r]?.[c]) ? p : [])); }, [state.seed]);

  const check = useMemo(() => (path.length ? checkWord(state, path, dict.dict) : null), [path, state, dict]);
  const status = !path.length ? null : check?.ok ? 'valid' : 'bad';
  const text = path.length ? pathText(state, path) : '';

  const flashToast = (msg, bad = false) => { setToast({ msg, bad, k: Date.now() }); };
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!fx) return undefined; const t = setTimeout(() => setFx(null), 1300); return () => clearTimeout(t); }, [fx]);
  useEffect(() => { if (!popped.length) return undefined; const t = setTimeout(() => setPopped([]), 450); return () => clearTimeout(t); }, [popped]);
  useEffect(() => { if (!hint) return undefined; const t = setTimeout(() => setHint(null), 6000); return () => clearTimeout(t); }, [hint]);

  const submit = useCallback((p) => {
    if (disabled) return;
    try { soundManager.init(); } catch { /* no audio */ }
    const res = applyWord(state, p, dict.dict);
    if (!res.ok) {
      setShake(s => s + 1);
      fxKey.current++;
      setFx({ bad: true, msg: REASON[res.reason] || 'Nope', k: fxKey.current });
      soundManager.playWrong();
      setPath([]);
      return;
    }
    // used tiles pop where they stood
    setPopped(res.cleared.map(([r, c]) => { const t = state.board[r][c]; return { id: t.id, r, c, text: t.l === '*' ? '★' : t.l === 'qu' ? 'Qu' : t.l.toUpperCase(), s: t.s }; }));
    setFreshIds(new Set(res.fresh.map(([r, c]) => res.state.board[r][c]?.id)));
    setPath([]);
    fxKey.current++;
    setFx({ points: res.points, word: res.word, notes: res.notes, k: fxKey.current });
    setNewWord(res.word);
    // sounds & callouts
    soundManager.playWhiplash();
    if (res.mult >= 3) soundManager.playDiamondShine(); else if (res.mult >= 2) soundManager.playGoldSparkle(); else soundManager.playTilePop();
    if (res.word.length >= 7) soundManager.playCrowdCheer();
    setTimeout(() => soundManager.playTileDrop(), 220);
    for (const e of res.events) {
      if (e.type === 'caught') { soundManager.playGunshot(); flashToast(`Outlaw caught! +${e.points}`); }
      if (e.type === 'escape') { soundManager.playRattlesnake(); flashToast(`An outlaw got away with ${-e.points} points!`, true); }
      if (e.type === 'time') { soundManager.playSpurs(); flashToast('Sapphire! +10 seconds on the rope'); }
      if (e.type === 'gemPoints') { soundManager.playSpurs(); flashToast('Sapphire! +50'); }
      if (e.type === 'blast') { soundManager.playGunshot(); flashToast(`Topaz blast! Cleared ${e.cleared} tiles +${e.points}`); }
      if (e.type === 'spawn' && e.kind === 'outlaw') { setTimeout(() => flashToast('Outlaw rode in! Catch him before he hits the bottom', true), 900); }
      if (e.type === 'spawn' && e.kind === 'diamond') { setTimeout(() => flashToast('Huge word! A Diamond dropped in'), 900); }
      if (e.type === 'spawn' && e.kind === 'ruby') { setTimeout(() => flashToast('6 letters! A Ruby dropped in'), 900); }
      if (e.type === 'hint') {
        const best = findWords(res.state, dict.trie(), { limit: 1, exclude: new Set(res.state.words.map(w => w.w)) })[0];
        if (best) { setHint(best); setTimeout(() => flashToast(`Opal: try "${best.word.toUpperCase()}"`), 600); }
      }
    }
    onMove({ kind: 'word', path: p, result: res, state: res.state });
  }, [state, dict, disabled, onMove]);

  const doShuffle = () => {
    if (disabled) return;
    const next = shuffleBoard(state);
    setPath([]); setHint(null);
    setFreshIds(new Set(next.board.flat().map(t => t.id)));
    soundManager.playSaloonDoors();
    flashToast(state.mode === 'timed' ? `Shuffled (−${SHUFFLE_COST.timed.seconds}s)` : `Shuffled (−${SHUFFLE_COST.race.points})`, true);
    onMove({ kind: 'shuffle', state: next });
  };

  useEffect(() => { if (!newWord) return undefined; const t = setTimeout(() => setNewWord(null), 600); return () => clearTimeout(t); }, [newWord]);

  const low = timeLeft != null && timeLeft <= 15;
  const words = state.words.slice().reverse();

  return (
    <div className="ww-play">
      <div className="ww-main">
        <div className="ww-hud">
          <div>
            <div className="ww-label">{title || 'Score'}</div>
            <div className="ww-score" aria-live="polite">{state.score.toLocaleString()}</div>
          </div>
          <div className={`ww-clock${low ? ' low' : ''}`}>
            {timeLeft != null && <><div className="ww-label">Time</div><div className="t">{fmtTime(timeLeft)}</div></>}
          </div>
          <div className="ww-hudr">
            <div className="ww-icons">{hudRight}</div>
            <div className="ww-label" style={{ marginTop: 6 }}>{state.words.length} words</div>
          </div>
        </div>

        <div className="ww-preview">
          {text ? (
            <>
              <span className={`ww-word st-${check?.ok ? 'valid' : check?.reason === 'used' ? 'used' : 'bad'}`}>{text}</span>
              {check?.ok && <span className="ww-ptsprev">+{check.points}</span>}
              {check?.reason === 'used' && <span className="ww-hintline">played</span>}
            </>
          ) : (
            <span className="ww-hintline">{disabled ? ' ' : 'Drag through touching letters — let go to play'}</span>
          )}
        </div>

        <div className="ww-boardframe">
          {timeLeft != null && <WWRope frac={totalTime ? timeLeft / totalTime : 0} low={low} lit={!disabled || timeLeft <= 0} />}
          <WWBoard state={state} path={path} onPath={setPath} onSubmit={submit} status={status} freshIds={freshIds} popped={popped} hintPath={hint?.path} shakeKey={shake} disabled={disabled} />
          {fx && !fx.bad && (
            <div className="ww-float" key={fx.k}>
              <div className="p">+{fx.points.toLocaleString()}</div>
              <div className="w">{fx.word}</div>
              {fx.notes?.length > 0 && <div className="n">{fx.notes.join(' · ')}</div>}
            </div>
          )}
          {fx && fx.bad && <div className="ww-float bad" key={fx.k}><div className="p">{fx.msg}</div></div>}
          {toast && <div className={`ww-toast${toast.bad ? ' bad' : ''}`} key={toast.k}>{toast.msg}</div>}
        </div>

        <div className="ww-actions">
          <button type="button" className="ww-btn primary" disabled={disabled || !check?.ok} onClick={() => submit(path)}>Play word</button>
          <button type="button" className="ww-btn" disabled={disabled || !path.length} onClick={() => setPath([])}>Clear</button>
          <button type="button" className="ww-btn ghost" disabled={disabled} onClick={doShuffle} title={state.mode === 'timed' ? 'Costs 10 seconds' : 'Costs 50 points'}>
            Shuffle {state.mode === 'timed' ? '(−10s)' : '(−50)'}
          </button>
        </div>
      </div>

      <div className="ww-side">
        {side}
        <div className="ww-panel">
          <h4>Your words {state.best ? `· best ${state.best.w.toUpperCase()} ${state.best.p}` : ''}</h4>
          <div className="ww-words">
            {words.length ? words.map((w, i) => <span key={w.w} className={i === 0 && newWord === w.w ? 'new' : ''}>{w.w}<b>{w.p}</b></span>) : <em style={{ color: 'var(--ww-dim)', fontSize: 13 }}>Nothing yet — go wrangle!</em>}
          </div>
        </div>
        <div className="ww-panel">
          <h4>Special tiles</h4>
          <div className="ww-legend">
            {Object.entries(SPECIALS).map(([k, v]) => (
              <div key={k}><WWIcon kind={k} size={18} /><span><b>{v.name}</b> — {v.desc}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
