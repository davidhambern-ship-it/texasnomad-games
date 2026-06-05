import React from 'react';

const CARD_BACK = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/711c24400_BackDesign.png';
const BIG_JOKER = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/857028cf9_BigJoker.png';
const LITTLE_JOKER = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/f18ea1d80_LittleJoker.png';

// Back cards fanned behind
const BACK_CARDS = [
  { rotate: -30, x: -52, y: 10, z: 1 },
  { rotate: -20, x: -32, y: 4, z: 2 },
  { rotate: -10, x: -14, y: 0, z: 3 },
  { rotate:   0, x:   0, y: -2, z: 4 },
  { rotate:  10, x:  14, y: 0, z: 5 },
  { rotate:  20, x:  32, y: 4, z: 6 },
  { rotate:  30, x:  52, y: 10, z: 7 },
];

export default function SpadesCabinetImage() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#020106]"
      style={{ minHeight: 130, position: 'relative' }}>
      
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 80%, rgba(74,74,138,0.4) 0%, transparent 70%)' }} />

      <div className="relative flex items-end justify-center" style={{ width: 200, height: 110 }}>
        
        {/* Back-of-deck cards fanned */}
        {BACK_CARDS.map((c, i) => (
          <img
            key={i}
            src={CARD_BACK}
            alt=""
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              width: 44,
              height: 62,
              borderRadius: 4,
              objectFit: 'cover',
              transform: `translateX(-50%) translateX(${c.x}px) translateY(${c.y}px) rotate(${c.rotate}deg)`,
              zIndex: c.z,
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          />
        ))}

        {/* Little Joker — left foreground */}
        <img
          src={LITTLE_JOKER}
          alt="Little Joker"
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            width: 54,
            height: 76,
            borderRadius: 5,
            objectFit: 'cover',
            transform: 'translateX(-50%) translateX(-28px) rotate(-8deg)',
            zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.8), 0 0 12px rgba(74,74,138,0.6)',
          }}
        />

        {/* Big Joker — right foreground */}
        <img
          src={BIG_JOKER}
          alt="Big Joker"
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            width: 54,
            height: 76,
            borderRadius: 5,
            objectFit: 'cover',
            transform: 'translateX(-50%) translateX(28px) rotate(8deg)',
            zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.8), 0 0 12px rgba(74,74,138,0.6)',
          }}
        />
      </div>
    </div>
  );
}