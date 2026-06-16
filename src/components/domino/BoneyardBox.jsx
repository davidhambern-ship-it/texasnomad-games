import React from 'react';
import TXDDomino from './TXDDomino';

/**
 * BoneyardBox
 * Props:
 *   boneyard       {array}    — current boneyard array
 *   canDraw        {boolean}  — true when it's this player's turn and no playable tiles
 *   onDraw         {function}
 *   compact        {boolean}  — smaller sizing for host panel
 */
export default function BoneyardBox({ boneyard = [], canDraw = false, onDraw, compact = false }) {
  const count = boneyard.length;
  // Show up to this many face-down tiles visually
  const maxVisible = compact ? 12 : 18;
  const visibleCount = Math.min(count, maxVisible);

  return (
    <aside
      className="flex flex-col items-center rounded-3xl"
      style={{
        minHeight: compact ? 320 : 480,
        width: compact ? 140 : 160,
        flexShrink: 0,
        padding: compact ? '12px 10px' : '16px 12px',
        background: 'rgba(12, 6, 30, 0.96)',
        border: '2px solid rgba(0, 255, 120, 0.75)',
        boxShadow: '0 0 18px rgba(0,255,120,0.22), inset 0 0 18px rgba(188,19,254,0.18)',
      }}
    >
      {/* Title */}
      <div className="font-heading text-white tracking-widest text-center mb-3 uppercase"
        style={{ fontSize: compact ? 13 : 15, textShadow: '0 0 10px rgba(0,255,120,0.5)' }}>
        BONEYARD
      </div>

      {/* Domino stack */}
      <div className="flex flex-wrap gap-1.5 justify-center content-start flex-1 w-full">
        {Array.from({ length: visibleCount }).map((_, i) => (
          <TXDDomino
            key={i}
            top={0} bottom={0}
            width={compact ? 22 : 26}
            faceDown
            style={{ filter: 'drop-shadow(0 0 5px rgba(188,19,254,0.45))' }}
          />
        ))}
        {count === 0 && (
          <div className="text-white/20 text-xs font-body text-center w-full mt-4 italic">Empty</div>
        )}
      </div>

      {/* Count */}
      <div className="mt-3 text-center font-heading tracking-wider"
        style={{ color: '#00ff78', fontSize: compact ? 13 : 15, textShadow: '0 0 8px rgba(0,255,120,0.6)' }}>
        {count} left
      </div>

      {/* Draw button — only shown when it's valid to draw */}
      {canDraw && (
        <button
          onClick={onDraw}
          disabled={count === 0}
          className="mt-3 w-full py-2 rounded-xl font-heading text-xs tracking-widest uppercase text-white transition-all disabled:opacity-40"
          style={{
            background: count > 0
              ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
              : 'rgba(255,255,255,0.05)',
            boxShadow: count > 0 ? '0 0 10px rgba(124,58,237,0.5)' : 'none',
          }}
        >
          {count > 0 ? 'DRAW' : 'PASS'}
        </button>
      )}
    </aside>
  );
}