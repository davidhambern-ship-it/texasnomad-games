import React from 'react';
import TXDDomino from './TXDDomino';
import { computeBoardLayout, computeOpenEnds } from '@/lib/txdDominoEngine';

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
  if (board.length === 0) {
    const canPlay = !!onDropOnEnd;
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div
          onDragOver={(e) => { if (canPlay) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd('first', id); }}
          onClick={() => { if (selectedDomino && onDropOnEnd) onDropOnEnd('first', selectedDomino.id); }}
          style={{
            width: 120, height: 64, borderRadius: 14,
            border: canPlay ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.1)',
            background: canPlay ? 'rgba(0,255,120,0.08)' : 'rgba(255,255,255,0.02)',
            boxShadow: canPlay ? '0 0 18px rgba(0,255,120,0.5)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canPlay ? 'pointer' : 'default',
          }}
        >
          <span style={{ fontSize: 10, color: canPlay ? '#00ff78' : 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>
            {canPlay ? 'PLAY HERE' : '— empty —'}
          </span>
        </div>
      </div>
    );
  }

  const laidOut = computeBoardLayout(board);
  const openEnds = computeOpenEnds(board, leftEnd, rightEnd, spinnerActive);

  const handleEndClick = (endId) => {
    if (selectedDomino && playableEndIds.has(endId) && onDropOnEnd) {
      onDropOnEnd(endId, selectedDomino.id);
    }
  };

  return (
    <div className="relative w-full h-full">
      {laidOut.map((piece, i) => {
        const isDouble = piece.top === piece.bottom;
        const orientation = piece.placedOrientation || (isDouble ? 'vertical' : 'horizontal');
        return (
          <div
            key={piece.id || i}
            style={{
              position: 'absolute',
              left: `${piece.x}%`,
              top: `${piece.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 5 + i,
              filter: piece.isSpinner
                ? 'drop-shadow(0 0 10px rgba(0,255,120,0.9)) drop-shadow(0 0 16px rgba(255,95,31,0.7))'
                : 'none',
            }}
          >
            <TXDDomino
              top={piece.top}
              bottom={piece.bottom}
              width={piece.isSpinner ? 40 : 34}
              orientation={orientation}
            />
          </div>
        );
      })}

      {openEnds && onDropOnEnd && Object.entries(openEnds).map(([endId, end]) => {
        if (!end || !end.active) return null;
        const isPlayable = playableEndIds.has(endId);
        return (
          <div
            key={endId}
            onDragOver={(e) => { if (isPlayable || draggingDominoId) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id) onDropOnEnd(endId, id); }}
            onClick={() => handleEndClick(endId)}
            style={{
              position: 'absolute',
              left: `${end.x}%`,
              top: `${end.y}%`,
              width: 72, height: 42,
              transform: 'translate(-50%, -50%)',
              borderRadius: 10,
              border: isPlayable ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.15)',
              background: isPlayable ? 'rgba(0,255,120,0.15)' : 'rgba(255,255,255,0.02)',
              boxShadow: isPlayable ? '0 0 18px rgba(0,255,120,0.7)' : 'none',
              cursor: isPlayable ? 'pointer' : 'default',
              pointerEvents: isPlayable || draggingDominoId ? 'auto' : 'none',
              zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={`End: ${end.value}`}
          >
            <span style={{ fontSize: 12, color: isPlayable ? '#00ff78' : 'rgba(255,255,255,0.2)', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {end.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}