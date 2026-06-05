import React from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

export default function OpponentHand({ player, position }) {
  if (!player?.hand?.length) return null;

  const isHorizontal = position === 'top' || position === 'bottom';
  const cardCount = player.hand.length;

  if (isHorizontal) {
    return (
      <div className={`absolute z-5 flex justify-center ${position === 'top' ? 'top-20' : 'bottom-20'}`}
        style={{ left: '50%', transform: 'translateX(-50%)', width: Math.min(440, 50 + cardCount * 35), height: 100 }}>
        <div className="flex" style={{ transform: 'scale(1.1)' }}>
          {player.hand.map((card, i, arr) => (
            <div key={card.id || i} className="relative rounded-lg overflow-hidden shadow-lg"
              style={{
                width: 50, height: 70,
                marginLeft: i > 0 ? '-42px' : '0',
                transform: `rotate(${(i - (arr.length - 1) / 2) * 2.5}deg) translateY(${Math.abs(i - (arr.length - 1) / 2) * -1.5}px)`,
              }}>
              <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute z-5 flex items-center ${position === 'left' ? 'left-20' : 'right-20'}`}
      style={{ top: '50%', transform: 'translateY(-50%)', width: 100, height: Math.min(400, 50 + cardCount * 30) }}>
      <div className="flex flex-col" style={{ transform: `scale(1.1) rotate(${position === 'left' ? '90deg' : '-90deg'})` }}>
        {player.hand.map((card, i, arr) => (
          <div key={card.id || i} className="relative rounded-lg overflow-hidden shadow-lg"
            style={{
              width: 50, height: 70,
              marginTop: i > 0 ? '-48px' : '0',
              transform: `rotate(${(i - (arr.length - 1) / 2) * 2}deg)`,
            }}>
            <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}