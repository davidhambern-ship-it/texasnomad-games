import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';
import { computeBoardLayout } from '@/lib/txdDominoEngine';

const PADDING = 60; // extra space around the chain for drop zones

export default function TXDBoard({
  board = [],
  leftEnd = null,
  rightEnd = null,
  spinnerActive = false,
  selectedDomino = null,
  playableEndIds = new Set(),
  onDropOnEnd,
  draggingDominoId = null,
}) {
  const scrollRef = useRef(null);

  // Auto-scroll to keep the board centered when it changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop  = (el.scrollHeight - el.clientHeight) / 2;
  }, [board.length]);

  // ── Empty board ────────────────────────────────────────────────────────────
  if (board.length === 0) {
    const canPlay = !!onDropOnEnd;
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div
          onDragOver={(e) => { if (canPlay) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd('first', id); }}
          onClick={() => { if (selectedDomino && onDropOnEnd) onDropOnEnd('first', selectedDomino.id); }}
          style={{
            width: 120, height: 60, borderRadius: 12,
            border: canPlay ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.12)',
            background: canPlay ? 'rgba(0,255,120,0.1)' : 'rgba(255,255,255,0.02)',
            boxShadow: canPlay ? '0 0 20px rgba(0,255,120,0.5)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canPlay ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 9, color: canPlay ? '#00ff78' : 'rgba(255,255,255,0.2)', fontFamily: "'Press Start 2P', monospace", letterSpacing: 1 }}>
            {canPlay ? 'PLAY HERE' : '— empty —'}
          </span>
        </div>
      </div>
    );
  }

  // ── Compute layout ─────────────────────────────────────────────────────────
  const { tiles, bounds, openEnds: oe } = computeBoardLayout(board);
  if (!bounds || !tiles.length) return null;

  // Offset so all coordinates are positive, with padding
  const offX = -bounds.minX + PADDING;
  const offY = -bounds.minY + PADDING;
  const canvasW = bounds.maxX - bounds.minX + PADDING * 2;
  const canvasH = bounds.maxY - bounds.minY + PADDING * 2;

  // Drop zone positions
  const dropZones = [];
  if (oe && onDropOnEnd) {
    // Left arm drop zone
    dropZones.push({
      id: 'left',
      x: oe.leftX + offX - 36,
      y: offY - 14 + (bounds.maxY - bounds.minY) / 2,
      value: leftEnd,
    });
    // Right arm drop zone
    dropZones.push({
      id: 'right',
      x: oe.rightX + offX,
      y: offY - 14 + (bounds.maxY - bounds.minY) / 2,
      value: rightEnd,
    });
    // Top arm (if spinner)
    if (oe.topY !== undefined && (spinnerActive || (board[0]?.top === board[0]?.bottom))) {
      dropZones.push({
        id: 'top',
        x: oe.spinnerX + offX - 14,
        y: oe.topY + offY - 30,
        value: board.find(p => p.side === 'top')?.exposedValue ?? board[0]?.top,
        vertical: true,
      });
    }
    // Bottom arm
    if (oe.bottomY !== undefined && (spinnerActive || (board[0]?.top === board[0]?.bottom))) {
      dropZones.push({
        id: 'bottom',
        x: oe.spinnerX + offX - 14,
        y: oe.bottomY + offY,
        value: board.find(p => p.side === 'bottom')?.exposedValue ?? board[0]?.top,
        vertical: true,
      });
    }
  }

  return (
    <div
      ref={scrollRef}
      style={{
        width: '100%', height: '100%',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        scrollbarWidth: 'none',
      }}
    >
      {/* Virtual canvas */}
      <div style={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}>

        {/* Tiles */}
        {tiles.map((piece, i) => {
          const isDouble = piece.top === piece.bottom;
          const orientation = isDouble ? 'vertical' : 'horizontal';
          return (
            <div
              key={piece.id || i}
              style={{
                position: 'absolute',
                left: piece.px + offX,
                top:  piece.py + offY,
                zIndex: 5 + i,
                filter: piece.isSpinner
                  ? 'drop-shadow(0 0 8px rgba(0,255,120,0.8)) drop-shadow(0 0 14px rgba(255,95,31,0.6))'
                  : undefined,
              }}
            >
              <TXDDomino
                top={piece.top}
                bottom={piece.bottom}
                width={isDouble ? piece.tw : piece.th}
                orientation={orientation}
              />
            </div>
          );
        })}

        {/* Drop zones */}
        {dropZones.map((dz) => {
          const isPlayable = playableEndIds.has(dz.id);
          const w = dz.vertical ? 32 : 64;
          const h = dz.vertical ? 64 : 32;
          return (
            <div
              key={dz.id}
              onDragOver={(e) => { if (isPlayable || draggingDominoId) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd(dz.id, id); }}
              onClick={() => { if (isPlayable && onDropOnEnd && selectedDomino) onDropOnEnd(dz.id, selectedDomino.id); }}
              style={{
                position: 'absolute',
                left: dz.x,
                top: dz.y,
                width: w,
                height: h,
                borderRadius: 8,
                border: isPlayable ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.15)',
                background: isPlayable ? 'rgba(0,255,120,0.15)' : 'rgba(255,255,255,0.03)',
                boxShadow: isPlayable ? '0 0 16px rgba(0,255,120,0.6)' : 'none',
                cursor: isPlayable ? 'pointer' : 'default',
                pointerEvents: (isPlayable || draggingDominoId) ? 'auto' : 'none',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              title={`${dz.id}: ${dz.value}`}
            >
              <span style={{
                fontSize: 12,
                color: isPlayable ? '#00ff78' : 'rgba(255,255,255,0.2)',
                fontWeight: 'bold',
                fontFamily: 'monospace',
              }}>
                {dz.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}