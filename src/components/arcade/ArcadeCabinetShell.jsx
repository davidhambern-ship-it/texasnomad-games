import React from 'react';

// Cabinet themes per game
const CABINET_THEMES = {
  bff: {
    marqueeColor: 'from-purple-900 via-yellow-600 to-purple-900',
    marqueeBorder: '#FFD700',
    marqueeShadow: '0 0 20px #FFD700, 0 0 40px rgba(255,215,0,0.4)',
    cabinetBg: 'from-purple-950 via-purple-900 to-indigo-950',
    cabinetAccent: '#BC13FE',
    cabinetShadow: '0 0 30px rgba(188,19,254,0.5)',
    screenBorder: '#FFD700',
    screenGlow: 'rgba(255,215,0,0.3)',
    deckBg: 'from-purple-900 to-purple-950',
    deckBorder: '#BC13FE',
    joystickColor: '#FFD700',
    buttonColor: '#BC13FE',
    buttonGlow: 'rgba(188,19,254,0.6)',
    sideDecor: '🎯',
  },
  spades: {
    marqueeColor: 'from-emerald-950 via-emerald-800 to-emerald-950',
    marqueeBorder: '#10b981',
    marqueeShadow: '0 0 20px #10b981, 0 0 40px rgba(16,185,129,0.4)',
    cabinetBg: 'from-emerald-950 via-slate-900 to-emerald-950',
    cabinetAccent: '#10b981',
    cabinetShadow: '0 0 30px rgba(16,185,129,0.4)',
    screenBorder: '#10b981',
    screenGlow: 'rgba(16,185,129,0.25)',
    deckBg: 'from-emerald-900 to-slate-900',
    deckBorder: '#10b981',
    joystickColor: '#10b981',
    buttonColor: '#10b981',
    buttonGlow: 'rgba(16,185,129,0.6)',
    sideDecor: '♠',
  },
  hangman: {
    marqueeColor: 'from-orange-950 via-orange-800 to-orange-950',
    marqueeBorder: '#FF5F1F',
    marqueeShadow: '0 0 20px #FF5F1F, 0 0 40px rgba(255,95,31,0.4)',
    cabinetBg: 'from-orange-950 via-amber-950 to-orange-950',
    cabinetAccent: '#FF5F1F',
    cabinetShadow: '0 0 30px rgba(255,95,31,0.4)',
    screenBorder: '#FF5F1F',
    screenGlow: 'rgba(255,95,31,0.25)',
    deckBg: 'from-orange-900 to-amber-950',
    deckBorder: '#FF5F1F',
    joystickColor: '#FF5F1F',
    buttonColor: '#FF5F1F',
    buttonGlow: 'rgba(255,95,31,0.6)',
    sideDecor: '🤠',
  },
  'square-biz': {
    marqueeColor: 'from-cyan-950 via-cyan-800 to-cyan-950',
    marqueeBorder: '#22d3ee',
    marqueeShadow: '0 0 20px #22d3ee, 0 0 40px rgba(34,211,238,0.4)',
    cabinetBg: 'from-cyan-950 via-slate-900 to-cyan-950',
    cabinetAccent: '#22d3ee',
    cabinetShadow: '0 0 30px rgba(34,211,238,0.4)',
    screenBorder: '#22d3ee',
    screenGlow: 'rgba(34,211,238,0.25)',
    deckBg: 'from-cyan-900 to-slate-900',
    deckBorder: '#22d3ee',
    joystickColor: '#22d3ee',
    buttonColor: '#22d3ee',
    buttonGlow: 'rgba(34,211,238,0.6)',
    sideDecor: '❓',
  },
  'word-search': {
    marqueeColor: 'from-violet-950 via-violet-800 to-violet-950',
    marqueeBorder: '#8b5cf6',
    marqueeShadow: '0 0 20px #8b5cf6, 0 0 40px rgba(139,92,246,0.4)',
    cabinetBg: 'from-violet-950 via-purple-950 to-violet-950',
    cabinetAccent: '#8b5cf6',
    cabinetShadow: '0 0 30px rgba(139,92,246,0.4)',
    screenBorder: '#8b5cf6',
    screenGlow: 'rgba(139,92,246,0.25)',
    deckBg: 'from-violet-900 to-purple-950',
    deckBorder: '#8b5cf6',
    joystickColor: '#8b5cf6',
    buttonColor: '#8b5cf6',
    buttonGlow: 'rgba(139,92,246,0.6)',
    sideDecor: '🔤',
  },
  'see-that': {
    marqueeColor: 'from-rose-950 via-rose-800 to-rose-950',
    marqueeBorder: '#f43f5e',
    marqueeShadow: '0 0 20px #f43f5e, 0 0 40px rgba(244,63,94,0.4)',
    cabinetBg: 'from-rose-950 via-slate-900 to-rose-950',
    cabinetAccent: '#f43f5e',
    cabinetShadow: '0 0 30px rgba(244,63,94,0.4)',
    screenBorder: '#f43f5e',
    screenGlow: 'rgba(244,63,94,0.25)',
    deckBg: 'from-rose-900 to-slate-900',
    deckBorder: '#f43f5e',
    joystickColor: '#f43f5e',
    buttonColor: '#f43f5e',
    buttonGlow: 'rgba(244,63,94,0.6)',
    sideDecor: '🔍',
  },
  txd: {
    marqueeColor: 'from-amber-950 via-amber-700 to-amber-950',
    marqueeBorder: '#FFD700',
    marqueeShadow: '0 0 20px #FFD700, 0 0 40px rgba(255,215,0,0.5)',
    cabinetBg: 'from-amber-950 via-stone-900 to-amber-950',
    cabinetAccent: '#FFD700',
    cabinetShadow: '0 0 30px rgba(255,215,0,0.4)',
    screenBorder: '#FFD700',
    screenGlow: 'rgba(255,215,0,0.3)',
    deckBg: 'from-amber-900 to-stone-900',
    deckBorder: '#FFD700',
    joystickColor: '#FFD700',
    buttonColor: '#FFD700',
    buttonGlow: 'rgba(255,215,0,0.6)',
    sideDecor: '🀱',
  },
  default: {
    marqueeColor: 'from-purple-950 via-purple-800 to-purple-950',
    marqueeBorder: '#BC13FE',
    marqueeShadow: '0 0 20px #BC13FE, 0 0 40px rgba(188,19,254,0.4)',
    cabinetBg: 'from-purple-950 via-slate-900 to-purple-950',
    cabinetAccent: '#BC13FE',
    cabinetShadow: '0 0 30px rgba(188,19,254,0.4)',
    screenBorder: '#BC13FE',
    screenGlow: 'rgba(188,19,254,0.25)',
    deckBg: 'from-purple-900 to-slate-900',
    deckBorder: '#BC13FE',
    joystickColor: '#BC13FE',
    buttonColor: '#BC13FE',
    buttonGlow: 'rgba(188,19,254,0.6)',
    sideDecor: '🕹',
  },
};

// Decorative Screw
function Screw({ style }) {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 35%, #ccc, #555)',
      border: '1px solid #333',
      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
      ...style,
    }}>
      <div style={{ width: '100%', height: 1, background: 'rgba(0,0,0,0.5)', marginTop: 4, transform: 'rotate(45deg)' }} />
    </div>
  );
}

// Decorative Joystick
function Joystick({ color }) {
  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ userSelect: 'none' }}>
      {/* base plate */}
      <div style={{
        width: 52, height: 52, borderRadius: 10,
        background: 'linear-gradient(145deg, #1a1a2e, #0d0d1a)',
        border: `2px solid ${color}40`,
        boxShadow: `inset 0 2px 6px rgba(0,0,0,0.8), 0 0 8px ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* directional cross */}
        <div style={{ position: 'absolute', width: 36, height: 12, background: `${color}20`, borderRadius: 3, border: `1px solid ${color}30` }} />
        <div style={{ position: 'absolute', width: 12, height: 36, background: `${color}20`, borderRadius: 3, border: `1px solid ${color}30` }} />
        {/* stick */}
        <div style={{
          width: 14, height: 14, borderRadius: '50%', zIndex: 2,
          background: `radial-gradient(circle at 40% 35%, ${color}, ${color}88)`,
          boxShadow: `0 0 8px ${color}80, 0 2px 4px rgba(0,0,0,0.6)`,
          border: '1px solid rgba(255,255,255,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 8, color: `${color}80`, fontFamily: "'Press Start 2P', monospace", letterSpacing: 1 }}>MOVE</span>
    </div>
  );
}

// Individual control button
function ArcadeButton({ label, action, color, buttonGlow, disabled = false, variant = 'primary' }) {
  const isSecondary = variant === 'secondary';
  return (
    <button
      onClick={action}
      disabled={disabled}
      style={{
        background: isSecondary
          ? `linear-gradient(145deg, #1a1a2e, #0d0d1a)`
          : `linear-gradient(145deg, ${color}dd, ${color}88)`,
        border: `2px solid ${color}`,
        borderRadius: 10,
        color: isSecondary ? color : '#fff',
        padding: '6px 10px',
        fontSize: 9,
        fontFamily: "'Press Start 2P', monospace",
        letterSpacing: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        boxShadow: `0 4px 0 ${color}44, 0 0 10px ${buttonGlow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
        transform: 'translateY(0)',
        transition: 'all 0.08s',
        minWidth: 52,
        textAlign: 'center',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        textShadow: isSecondary ? 'none' : '0 1px 2px rgba(0,0,0,0.6)',
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${color}44, 0 0 6px ${buttonGlow}`; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 0 ${color}44, 0 0 10px ${buttonGlow}, inset 0 1px 0 rgba(255,255,255,0.15)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 0 ${color}44, 0 0 10px ${buttonGlow}, inset 0 1px 0 rgba(255,255,255,0.15)`; }}
    >
      {label}
    </button>
  );
}

/**
 * ArcadeCabinetShell
 *
 * Props:
 *   gameId        — key into CABINET_THEMES (e.g. 'bff', 'spades', 'txd')
 *   gameTitle     — marquee display title
 *   controls      — array of { label, action, disabled?, variant? }
 *   centerInfo    — optional center deck content (room code, turn indicator, etc.)
 *   children      — the actual game board UI
 */
export default function ArcadeCabinetShell({
  gameId = 'default',
  gameTitle = 'TEXAS NOMAD',
  controls = [],
  centerInfo = null,
  children,
}) {
  const theme = CABINET_THEMES[gameId] || CABINET_THEMES.default;

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a0318, #050505)' }}>

      {/* ── Cabinet Outer Shell ── */}
      <div className="relative flex flex-col w-full max-w-4xl"
        style={{
          background: `linear-gradient(180deg, ${theme.cabinetBg.replace('from-', '').replace('via-', '').replace('to-', '')})`,
          borderRadius: '28px 28px 20px 20px',
          border: `3px solid ${theme.cabinetAccent}40`,
          boxShadow: `${theme.cabinetShadow}, 0 30px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)`,
          overflow: 'hidden',
        }}>

        {/* Cabinet background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-b ${theme.cabinetBg} opacity-90 pointer-events-none`} />

        {/* Side screws top */}
        <div className="absolute top-3 left-3 z-10"><Screw /></div>
        <div className="absolute top-3 right-3 z-10"><Screw /></div>

        {/* ── MARQUEE ── */}
        <div className="relative z-10 flex items-center justify-center py-3 px-6"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.cabinetAccent}15, transparent)`,
            borderBottom: `2px solid ${theme.marqueeBorder}40`,
          }}>

          {/* Marquee bulbs left */}
          <div className="flex gap-1 mr-3">
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: theme.marqueeBorder, boxShadow: `0 0 6px ${theme.marqueeBorder}`, opacity: i % 2 === 0 ? 1 : 0.4 }} />
            ))}
          </div>

          <h1 className="font-heading tracking-[0.3em] uppercase text-center"
            style={{
              fontSize: 'clamp(18px, 4vw, 32px)',
              color: theme.marqueeBorder,
              textShadow: theme.marqueeShadow,
              letterSpacing: '0.3em',
            }}>
            {gameTitle}
          </h1>

          {/* Marquee bulbs right */}
          <div className="flex gap-1 ml-3">
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: theme.marqueeBorder, boxShadow: `0 0 6px ${theme.marqueeBorder}`, opacity: i % 2 !== 0 ? 1 : 0.4 }} />
            ))}
          </div>
        </div>

        {/* ── SCREEN BEZEL ── */}
        <div className="relative z-10 mx-4 sm:mx-6 my-3">

          {/* Outer bezel */}
          <div style={{
            background: 'linear-gradient(145deg, #1a1520, #0d0a14)',
            borderRadius: 18,
            padding: '10px 12px',
            border: `3px solid ${theme.screenBorder}60`,
            boxShadow: `0 0 30px ${theme.screenGlow}, inset 0 0 20px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.6)`,
          }}>

            {/* Bezel screws */}
            <div className="absolute top-2 left-2"><Screw /></div>
            <div className="absolute top-2 right-2"><Screw /></div>
            <div className="absolute bottom-2 left-2"><Screw /></div>
            <div className="absolute bottom-2 right-2"><Screw /></div>

            {/* Screen glass */}
            <div style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              minHeight: 320,
              background: '#050508',
            }}>
              {/* Game content */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                {children}
              </div>

              {/* CRT scanlines overlay */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
              }} />

              {/* Screen vignette */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.7) 100%)',
              }} />

              {/* Screen reflection (top gloss) */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '30%', zIndex: 5, pointerEvents: 'none',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
                borderRadius: '12px 12px 0 0',
              }} />

              {/* Inner screen glow border */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
                borderRadius: 12,
                boxShadow: `inset 0 0 30px ${theme.screenGlow}`,
              }} />
            </div>
          </div>
        </div>

        {/* ── CONTROLLER DECK ── */}
        <div className="relative z-10 mx-2 sm:mx-4 mb-4"
          style={{
            background: `linear-gradient(180deg, #1a1520, #0d0a14)`,
            borderRadius: '0 0 18px 18px',
            border: `2px solid ${theme.deckBorder}40`,
            borderTop: `3px solid ${theme.deckBorder}60`,
            padding: '12px 16px',
            boxShadow: `inset 0 4px 12px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.5)`,
          }}>

          {/* Deck accent line */}
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${theme.deckBorder}60, transparent)`, marginBottom: 12 }} />

          <div className="flex items-center gap-3">

            {/* LEFT — Joystick */}
            <div className="flex-shrink-0">
              <Joystick color={theme.joystickColor} />
            </div>

            {/* CENTER — Status info */}
            <div className="flex-1 flex flex-col items-center gap-1.5 px-2">
              {centerInfo ? (
                <div className="w-full">{centerInfo}</div>
              ) : (
                <div style={{
                  background: 'rgba(0,0,0,0.6)',
                  border: `1px solid ${theme.deckBorder}30`,
                  borderRadius: 8,
                  padding: '6px 12px',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: 8, color: `${theme.deckBorder}80`, fontFamily: "'Press Start 2P', monospace" }}>
                    TEXAS NOMAD GAMES
                  </span>
                </div>
              )}

              {/* Status lights row */}
              <div className="flex gap-2 items-center">
                {['#ff4444','#ffaa00','#44ff44'].map((c, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}`, opacity: 0.7 }} />
                ))}
                <div style={{
                  height: 16, width: 40, borderRadius: 4,
                  background: 'rgba(0,0,0,0.8)',
                  border: `1px solid ${theme.deckBorder}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 6, color: `${theme.deckBorder}60`, fontFamily: 'monospace' }}>CREDIT 1</span>
                </div>
              </div>
            </div>

            {/* RIGHT — Game-specific buttons */}
            <div className="flex-shrink-0 flex flex-wrap gap-2 justify-end" style={{ maxWidth: 220 }}>
              {controls.map((ctrl, i) => (
                <ArcadeButton
                  key={i}
                  label={ctrl.label}
                  action={ctrl.action}
                  color={theme.buttonColor}
                  buttonGlow={theme.buttonGlow}
                  disabled={ctrl.disabled}
                  variant={ctrl.variant}
                />
              ))}
            </div>
          </div>

          {/* Bottom deck screws */}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <Screw />
            <div style={{ height: 8, flex: 1, margin: '1px 8px', background: `linear-gradient(90deg, transparent, ${theme.deckBorder}20, transparent)`, borderRadius: 4 }} />
            <Screw />
          </div>
        </div>

      </div>
    </div>
  );
}