import React from 'react';
import { Link } from 'react-router-dom';

// Cabinet themes per game
const CABINET_THEMES = {
  bff: {
    marqueeBorder: '#FFD700',
    marqueeShadow: '0 0 20px #FFD700, 0 0 40px rgba(255,215,0,0.4)',
    cabinetBg: '#1a0a2e',
    cabinetAccent: '#BC13FE',
    cabinetShadow: '0 0 40px rgba(188,19,254,0.5)',
    cabinetSide: 'linear-gradient(180deg, #2d1060, #1a0a2e)',
    screenBorder: '#FFD700',
    screenGlow: 'rgba(255,215,0,0.3)',
    deckColor: '#120820',
    deckBorder: '#BC13FE',
    joystickBall: '#FFD700',
    joystickBase: '#2a1040',
    buttonColors: ['#BC13FE', '#FF5F1F', '#FFD700', '#4ade80'],
  },
  spades: {
    marqueeBorder: '#10b981',
    marqueeShadow: '0 0 20px #10b981, 0 0 40px rgba(16,185,129,0.4)',
    cabinetBg: '#051a10',
    cabinetAccent: '#10b981',
    cabinetShadow: '0 0 40px rgba(16,185,129,0.4)',
    cabinetSide: 'linear-gradient(180deg, #063a20, #051a10)',
    screenBorder: '#10b981',
    screenGlow: 'rgba(16,185,129,0.25)',
    deckColor: '#031008',
    deckBorder: '#10b981',
    joystickBall: '#10b981',
    joystickBase: '#062010',
    buttonColors: ['#10b981', '#FFD700', '#BC13FE', '#22d3ee'],
  },
  hangman: {
    marqueeBorder: '#FF5F1F',
    marqueeShadow: '0 0 20px #FF5F1F, 0 0 40px rgba(255,95,31,0.4)',
    cabinetBg: '#1a0800',
    cabinetAccent: '#FF5F1F',
    cabinetShadow: '0 0 40px rgba(255,95,31,0.4)',
    cabinetSide: 'linear-gradient(180deg, #3a1500, #1a0800)',
    screenBorder: '#FF5F1F',
    screenGlow: 'rgba(255,95,31,0.25)',
    deckColor: '#100500',
    deckBorder: '#FF5F1F',
    joystickBall: '#FF5F1F',
    joystickBase: '#200a00',
    buttonColors: ['#FF5F1F', '#FFD700', '#4ade80', '#BC13FE'],
  },
  'square-biz': {
    marqueeBorder: '#22d3ee',
    marqueeShadow: '0 0 20px #22d3ee, 0 0 40px rgba(34,211,238,0.4)',
    cabinetBg: '#020e1a',
    cabinetAccent: '#22d3ee',
    cabinetShadow: '0 0 40px rgba(34,211,238,0.4)',
    cabinetSide: 'linear-gradient(180deg, #041c30, #020e1a)',
    screenBorder: '#22d3ee',
    screenGlow: 'rgba(34,211,238,0.25)',
    deckColor: '#010810',
    deckBorder: '#22d3ee',
    joystickBall: '#22d3ee',
    joystickBase: '#021020',
    buttonColors: ['#22d3ee', '#BC13FE', '#FFD700', '#4ade80'],
  },
  'word-search': {
    marqueeBorder: '#8b5cf6',
    marqueeShadow: '0 0 20px #8b5cf6, 0 0 40px rgba(139,92,246,0.4)',
    cabinetBg: '#0d0520',
    cabinetAccent: '#8b5cf6',
    cabinetShadow: '0 0 40px rgba(139,92,246,0.4)',
    cabinetSide: 'linear-gradient(180deg, #1a0840, #0d0520)',
    screenBorder: '#8b5cf6',
    screenGlow: 'rgba(139,92,246,0.25)',
    deckColor: '#080310',
    deckBorder: '#8b5cf6',
    joystickBall: '#8b5cf6',
    joystickBase: '#100528',
    buttonColors: ['#8b5cf6', '#FF5F1F', '#FFD700', '#10b981'],
  },
  'see-that': {
    marqueeBorder: '#f43f5e',
    marqueeShadow: '0 0 20px #f43f5e, 0 0 40px rgba(244,63,94,0.4)',
    cabinetBg: '#1a0008',
    cabinetAccent: '#f43f5e',
    cabinetShadow: '0 0 40px rgba(244,63,94,0.4)',
    cabinetSide: 'linear-gradient(180deg, #380010, #1a0008)',
    screenBorder: '#f43f5e',
    screenGlow: 'rgba(244,63,94,0.25)',
    deckColor: '#100005',
    deckBorder: '#f43f5e',
    joystickBall: '#f43f5e',
    joystickBase: '#200008',
    buttonColors: ['#f43f5e', '#FFD700', '#22d3ee', '#4ade80'],
  },
  txd: {
    marqueeBorder: '#FFD700',
    marqueeShadow: '0 0 20px #FFD700, 0 0 40px rgba(255,215,0,0.5)',
    cabinetBg: '#1a1000',
    cabinetAccent: '#FFD700',
    cabinetShadow: '0 0 40px rgba(255,215,0,0.4)',
    cabinetSide: 'linear-gradient(180deg, #3a2800, #1a1000)',
    screenBorder: '#FFD700',
    screenGlow: 'rgba(255,215,0,0.3)',
    deckColor: '#100c00',
    deckBorder: '#FFD700',
    joystickBall: '#FFD700',
    joystickBase: '#201800',
    buttonColors: ['#FFD700', '#FF5F1F', '#BC13FE', '#10b981'],
  },
  default: {
    marqueeBorder: '#BC13FE',
    marqueeShadow: '0 0 20px #BC13FE, 0 0 40px rgba(188,19,254,0.4)',
    cabinetBg: '#0a0318',
    cabinetAccent: '#BC13FE',
    cabinetShadow: '0 0 40px rgba(188,19,254,0.4)',
    cabinetSide: 'linear-gradient(180deg, #1a0530, #0a0318)',
    screenBorder: '#BC13FE',
    screenGlow: 'rgba(188,19,254,0.25)',
    deckColor: '#060110',
    deckBorder: '#BC13FE',
    joystickBall: '#BC13FE',
    joystickBase: '#100228',
    buttonColors: ['#BC13FE', '#FFD700', '#FF5F1F', '#10b981'],
  },
};

// Metal screw
function Screw() {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 35% 30%, #e0e0e0, #666)',
      border: '1px solid #333',
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.1)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '48%', left: '10%', right: '10%', height: 1, background: 'rgba(0,0,0,0.6)', transform: 'rotate(45deg)' }} />
      <div style={{ position: 'absolute', top: '10%', bottom: '10%', left: '48%', width: 1, background: 'rgba(0,0,0,0.6)', transform: 'rotate(45deg)' }} />
    </div>
  );
}

// 3D Arcade Joystick
function Joystick({ ballColor, baseColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, userSelect: 'none', flexShrink: 0 }}>
      {/* Ball top */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', zIndex: 3, position: 'relative',
        background: `radial-gradient(circle at 35% 30%, ${ballColor}ff, ${ballColor}88 50%, #000 100%)`,
        boxShadow: `0 0 12px ${ballColor}cc, 0 4px 8px rgba(0,0,0,0.8), inset 0 -3px 6px rgba(0,0,0,0.4)`,
        border: `1px solid ${ballColor}60`,
      }}>
        {/* Gloss highlight */}
        <div style={{ position: 'absolute', top: 3, left: 5, width: 8, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
      </div>
      {/* Shaft */}
      <div style={{
        width: 8, height: 22, zIndex: 2,
        background: 'linear-gradient(90deg, #555, #999, #666, #333)',
        boxShadow: '2px 0 4px rgba(0,0,0,0.6)',
        borderRadius: '0 0 2px 2px',
      }} />
      {/* Base plate */}
      <div style={{
        width: 60, height: 14, borderRadius: '4px 4px 8px 8px',
        background: `linear-gradient(180deg, ${baseColor}, #111)`,
        border: `2px solid ${ballColor}30`,
        boxShadow: `0 4px 8px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 10px ${ballColor}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* D-pad cross marks */}
        <div style={{ width: 24, height: 3, background: `${ballColor}30`, borderRadius: 2 }} />
      </div>
      {/* Base shadow */}
      <div style={{ width: 50, height: 4, borderRadius: '0 0 8px 8px', background: 'rgba(0,0,0,0.6)', filter: 'blur(4px)', marginTop: -2 }} />
    </div>
  );
}

// Physical dome arcade button
function ArcadeButton({ label, action, color, disabled = false, size = 'md' }) {
  const d = size === 'lg' ? 52 : size === 'sm' ? 36 : 44;
  const fs = size === 'lg' ? 7 : size === 'sm' ? 5 : 6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' }}>
      {/* Button mount ring */}
      <div style={{
        width: d + 8, height: d + 8, borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 50%, #222, #111)',
        border: '2px solid #333',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {/* Dome button */}
        <button
          onClick={action}
          disabled={disabled}
          style={{
            width: d, height: d, borderRadius: '50%',
            background: disabled
              ? `radial-gradient(circle at 40% 35%, ${color}44, #111 80%)`
              : `radial-gradient(circle at 38% 32%, ${color}ff 0%, ${color}cc 40%, ${color}66 70%, #000 100%)`,
            border: `2px solid ${color}88`,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            boxShadow: disabled
              ? 'none'
              : `0 6px 0 ${color}44, 0 8px 16px rgba(0,0,0,0.8), 0 0 20px ${color}66, inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4)`,
            transform: 'translateY(0)',
            transition: 'transform 0.08s, box-shadow 0.08s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'visible',
          }}
          onMouseDown={e => {
            if (disabled) return;
            e.currentTarget.style.transform = 'translateY(4px)';
            e.currentTarget.style.boxShadow = `0 2px 0 ${color}44, 0 4px 8px rgba(0,0,0,0.8), 0 0 12px ${color}66, inset 0 2px 4px rgba(255,255,255,0.1)`;
          }}
          onMouseUp={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 6px 0 ${color}44, 0 8px 16px rgba(0,0,0,0.8), 0 0 20px ${color}66, inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4)`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 6px 0 ${color}44, 0 8px 16px rgba(0,0,0,0.8), 0 0 20px ${color}66, inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4)`;
          }}
        >
          {/* Gloss highlight */}
          <div style={{ position: 'absolute', top: '14%', left: '18%', width: '40%', height: '28%', borderRadius: '50%', background: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        </button>
      </div>
      {/* Label below */}
      <span style={{
        fontSize: fs, fontFamily: "'Press Start 2P', monospace",
        color: disabled ? `${color}40` : `${color}cc`,
        letterSpacing: 0.5, textAlign: 'center',
        textShadow: disabled ? 'none' : `0 0 8px ${color}80`,
        maxWidth: d + 16, lineHeight: 1.3,
        wordBreak: 'break-word',
      }}>{label}</span>
    </div>
  );
}

/**
 * ArcadeCabinetShell
 *
 * Props:
 *   gameId        — key into CABINET_THEMES
 *   gameTitle     — marquee display title
 *   controls      — array of { label, action, disabled?, size? }
 *   centerInfo    — optional JSX for center deck area (room code, turn, etc.)
 *   header        — optional JSX for the sticky status bar (room code, seat, LIVE)
 *   children      — the game board UI
 */
export default function ArcadeCabinetShell({
  gameId = 'default',
  gameTitle = 'TEXAS NOMAD',
  controls = [],
  centerInfo = null,
  header = null,
  children,
}) {
  const theme = CABINET_THEMES[gameId] || CABINET_THEMES.default;
  const btnColors = theme.buttonColors;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #0a0318, #030008)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '8px 8px 16px' }}>

      {/* ── Sticky Header Bar (room code, seat, LIVE) ── */}
      {header && (
        <div style={{
          width: '100%', maxWidth: 900,
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(5,3,11,0.95)', backdropFilter: 'blur(12px)',
          borderBottom: `2px solid ${theme.cabinetAccent}40`,
          borderRadius: '12px 12px 0 0',
          marginBottom: 0,
        }}>
          {header}
        </div>
      )}

      {/* ── Cabinet Body ── */}
      <div style={{
        width: '100%', maxWidth: 900, position: 'relative',
        display: 'flex', flexDirection: 'column',
        borderRadius: header ? '0 0 24px 24px' : '24px',
        border: `3px solid ${theme.cabinetAccent}50`,
        boxShadow: `${theme.cabinetShadow}, 0 40px 100px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)`,
        overflow: 'hidden',
        background: theme.cabinetBg,
      }}>

        {/* Cabinet side texture strips */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: theme.cabinetSide, zIndex: 1, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, background: theme.cabinetSide, zIndex: 1, pointerEvents: 'none' }} />

        {/* Corner screws */}
        <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 5 }}><Screw /></div>
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 5 }}><Screw /></div>

        {/* ── MARQUEE ── */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 24px',
          background: `linear-gradient(90deg, rgba(0,0,0,0.8), ${theme.cabinetAccent}18, rgba(0,0,0,0.8))`,
          borderBottom: `2px solid ${theme.marqueeBorder}50`,
        }}>
          {/* Bulb row */}
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%', margin: '0 3px', flexShrink: 0,
              background: i % 2 === 0 ? theme.marqueeBorder : `${theme.marqueeBorder}30`,
              boxShadow: i % 2 === 0 ? `0 0 8px ${theme.marqueeBorder}, 0 0 4px ${theme.marqueeBorder}` : 'none',
            }} />
          ))}
          <h1 style={{
            fontFamily: "'Teko', sans-serif",
            fontSize: 'clamp(20px, 4vw, 36px)',
            color: theme.marqueeBorder,
            textShadow: theme.marqueeShadow,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            margin: '0 16px', flexShrink: 0, whiteSpace: 'nowrap',
          }}>{gameTitle}</h1>
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%', margin: '0 3px', flexShrink: 0,
              background: i % 2 !== 0 ? theme.marqueeBorder : `${theme.marqueeBorder}30`,
              boxShadow: i % 2 !== 0 ? `0 0 8px ${theme.marqueeBorder}, 0 0 4px ${theme.marqueeBorder}` : 'none',
            }} />
          ))}
        </div>

        {/* ── SCREEN BEZEL ── */}
        <div style={{ position: 'relative', zIndex: 2, margin: '12px 20px', flex: 1 }}>

          {/* Thick bezel frame */}
          <div style={{
            background: 'linear-gradient(145deg, #1c1428, #0a0810)',
            borderRadius: 16,
            padding: '10px',
            border: `4px solid ${theme.screenBorder}70`,
            boxShadow: `0 0 40px ${theme.screenGlow}, inset 0 0 30px rgba(0,0,0,0.9), 0 12px 30px rgba(0,0,0,0.7)`,
            position: 'relative',
          }}>
            <Screw style={{ position: 'absolute', top: 4, left: 4 }} />
            <Screw style={{ position: 'absolute', top: 4, right: 4 }} />
            <Screw style={{ position: 'absolute', bottom: 4, left: 4 }} />
            <Screw style={{ position: 'absolute', bottom: 4, right: 4 }} />

            {/* Screen glass */}
            <div style={{
              position: 'relative',
              borderRadius: 10,
              overflow: 'hidden',
              minHeight: 280,
              background: '#040308',
            }}>
              {/* Game content */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                {children}
              </div>

              {/* Scanlines */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)',
              }} />
              {/* Vignette */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.75) 100%)',
              }} />
              {/* Top gloss reflection */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '25%', zIndex: 5, pointerEvents: 'none',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
                borderRadius: '10px 10px 0 0',
              }} />
              {/* Inner screen glow */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
                borderRadius: 10,
                boxShadow: `inset 0 0 40px ${theme.screenGlow}`,
              }} />
            </div>
          </div>
        </div>

        {/* ── CONTROLLER DECK ── */}
        <div style={{
          position: 'relative', zIndex: 2,
          background: `linear-gradient(180deg, ${theme.deckColor}, #050308)`,
          borderTop: `3px solid ${theme.deckBorder}60`,
          padding: '16px 24px 20px',
          boxShadow: `inset 0 6px 20px rgba(0,0,0,0.8)`,
        }}>

          {/* Deck top accent stripe */}
          <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${theme.deckBorder}80, transparent)`, marginBottom: 14, borderRadius: 2 }} />

          {/* Textured deck surface */}
          <div style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%)',
            position: 'absolute', inset: 0, pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>

            {/* LEFT — Joystick */}
            <div style={{ flexShrink: 0, paddingBottom: 8 }}>
              <Joystick ballColor={theme.joystickBall} baseColor={theme.joystickBase} />
            </div>

            {/* CENTER — Status / info panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {centerInfo ? (
                <div style={{ width: '100%' }}>{centerInfo}</div>
              ) : (
                <div style={{
                  background: 'rgba(0,0,0,0.7)',
                  border: `1px solid ${theme.deckBorder}30`,
                  borderRadius: 8, padding: '6px 14px', textAlign: 'center',
                }}>
                  <span style={{ fontSize: 7, color: `${theme.deckBorder}70`, fontFamily: "'Press Start 2P', monospace" }}>
                    TEXAS NOMAD GAMES
                  </span>
                </div>
              )}

              {/* Status lights + coin slot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {['#ff3333','#ffaa00','#33ff66'].map((c, i) => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: `radial-gradient(circle at 40% 35%, ${c}ff, ${c}88)`,
                    boxShadow: `0 0 8px ${c}cc, inset 0 -1px 2px rgba(0,0,0,0.4)`,
                    border: `1px solid ${c}50`,
                  }} />
                ))}
                {/* Coin slot */}
                <div style={{
                  width: 36, height: 8, borderRadius: 4,
                  background: 'linear-gradient(180deg, #111, #222)',
                  border: '1px solid #444',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 4, color: '#555', fontFamily: 'monospace', letterSpacing: 0.5 }}>INSERT</span>
                </div>
              </div>
            </div>

            {/* RIGHT — Game-specific arcade buttons */}
            <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', maxWidth: 240, paddingBottom: 8 }}>
              {controls.map((ctrl, i) => (
                <ArcadeButton
                  key={i}
                  label={ctrl.label}
                  action={ctrl.action}
                  color={btnColors[i % btnColors.length]}
                  disabled={ctrl.disabled}
                  size={ctrl.size || 'md'}
                />
              ))}
            </div>
          </div>

          {/* Bottom screws row */}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Screw />
            <div style={{ flex: 1, height: 1, margin: '0 8px', background: `linear-gradient(90deg, transparent, ${theme.deckBorder}20, transparent)` }} />
            <Screw />
          </div>
        </div>

      </div>
    </div>
  );
}