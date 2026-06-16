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
    return (
      <div className="flex items-center justify-center h-full w-full text-white/20 font-body text-xs tracking-widest italic">
        — no tiles played yet —
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
        const orientation = isDouble ? 'vertical' : 'horizontal';
        // x/y are % coordinates from center of piece
        const x = piece.x ?? 50;
        const y = piece.y ?? 50;
        const rot = piece.rotation ?? (isDouble ? 0 : 90);

        return (
          <div
            key={piece.id || i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
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