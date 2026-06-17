import React from 'react';
import TXDDomino from './TXDDomino';

/**
 * TXDBoard — absolute-positioned board with drag-drop open-end zones.
 *
 * Props:
 *   board        — array of placed pieces: { top, bottom, id, side, isSpinner, x, y, rotation }
 *   openEnds     — object: { left, right, top, bottom } each with { x, y, rotation, value, active }
 *   selectedDomino — currently selected domino from hand (for drop zone highlighting)
 *   playableEndIds — set of endIds the selected domino can play on
 *   onDropOnEnd  — (endId) => void — called when player drops on a valid zone
 *   draggingDominoId — id of domino being dragged (for cursor feedback)
 */
export default function TXDBoard({
  board = [],
  openEnds = null,
  selectedDomino = null,
  playableEndIds = new Set(),
  onDropOnEnd,
  draggingDominoId = null,
}) {
  if (board.length === 0) {
    // Show a center drop zone for the first play
    const isFirstPlayable = !!onDropOnEnd;
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div
          onDragOver={(e) => { if (isFirstPlayable) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd('first', id); }}
          onClick={() => { if (selectedDomino && onDropOnEnd) onDropOnEnd('first', selectedDomino.id); }}
          style={{
            width: 120, height: 64, borderRadius: 14,
            border: isFirstPlayable ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.1)',
            background: isFirstPlayable ? 'rgba(0,255,120,0.08)' : 'rgba(255,255,255,0.02)',
            boxShadow: isFirstPlayable ? '0 0 18px rgba(0,255,120,0.5)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isFirstPlayable ? 'pointer' : 'default',
            transition: 'box-shadow 0.15s, background 0.15s',
          }}
        >
          <span style={{ fontSize: 10, color: isFirstPlayable ? '#00ff78' : 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>
            {isFirstPlayable ? 'PLAY HERE' : '— empty —'}
          </span>
        </div>
      </div>
    );
  }

  const handleDragOver = (e, endId) => {
    if (playableEndIds.has(endId)) e.preventDefault();
  };

  const handleDrop = (e, endId) => {
    e.preventDefault();
    const dominoId = e.dataTransfer.getData('dominoId');
    if (dominoId && onDropOnEnd) onDropOnEnd(endId, dominoId);
  };

  // Click-to-play: if a domino is selected and this end is playable, trigger play
  const handleEndClick = (endId) => {
    if (selectedDomino && playableEndIds.has(endId) && onDropOnEnd) {
      onDropOnEnd(endId, selectedDomino.id);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Placed tiles */}
      {board.map((piece, i) => {
        const isDouble = piece.top === piece.bottom;
        // Use stored orientation if available, otherwise derive from isDouble
        const orientation = piece.placedOrientation || (isDouble ? 'vertical' : 'horizontal');
        const x = piece.x ?? 50;
        const y = piece.y ?? 50;

        return (
          <div
            key={piece.id || i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
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

      {/* Open-end drop zones */}
      {openEnds && Object.entries(openEnds).map(([endId, end]) => {
        if (!end || !end.active) return null;
        const isPlayable = playableEndIds.has(endId);
        return (
          <div
            key={endId}
            onDragOver={(e) => handleDragOver(e, endId)}
            onDrop={(e) => handleDrop(e, endId)}
            onClick={() => handleEndClick(endId)}
            style={{
              position: 'absolute',
              left: `${end.x}%`,
              top: `${end.y}%`,
              width: 68,
              height: 36,
              transform: `translate(-50%, -50%) rotate(${end.rotation}deg)`,
              borderRadius: 10,
              border: isPlayable ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.1)',
              background: isPlayable ? 'rgba(0, 255, 120, 0.12)' : 'rgba(255,255,255,0.02)',
              boxShadow: isPlayable ? '0 0 14px rgba(0,255,120,0.65)' : 'none',
              cursor: isPlayable ? 'pointer' : 'default',
              pointerEvents: isPlayable || draggingDominoId ? 'auto' : 'none',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'box-shadow 0.15s, background 0.15s',
            }}
            title={isPlayable ? `Play on ${end.value}` : `End: ${end.value}`}
          >
            {isPlayable && (
              <span style={{ fontSize: 11, color: '#00ff78', fontWeight: 'bold', fontFamily: 'monospace', opacity: 0.9 }}>
                {end.value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}