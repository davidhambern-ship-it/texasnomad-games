import React from 'react';
import SpadesSeat from './SpadesSeat';

export default function SpadesSeatPosition({ seatNumber, player, isMe, isAvailable, isSpectator, onSit, currentTurnSeat, isPlaying, positionName }) {
  const positionStyles = {
    bottom: { bottom: 3, left: '50%', transform: 'translateX(-50%)' },
    top: { top: 3, left: '50%', transform: 'translateX(-50%)' },
    left: { left: 3, top: '50%', transform: 'translateY(-50%)' },
    right: { right: 3, top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <div className={`absolute z-10`} style={positionStyles[positionName]}>
      <SpadesSeat
        seatNumber={seatNumber}
        player={player}
        isMe={isMe}
        isAvailable={isAvailable}
        isSpectator={isSpectator}
        onSit={() => onSit(seatNumber)}
        currentTurnSeat={currentTurnSeat}
        isPlaying={isPlaying}
      />
    </div>
  );
}