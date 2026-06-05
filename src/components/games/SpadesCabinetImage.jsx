import React from 'react';

const CARD_BACK = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/711c24400_BackDesign.png';
const KING_SPADES = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/442e05070_King-spades.png';
const FOUR_HEARTS = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/86f65cd37_hearts-4.png';

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
    <div className="w-full h-full flex items-center justify-center"
      style={{ minHeight: 130, position: 'relative', background: '#0a1a0a', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)', border: '3px solid #3d2817' }}>
      
      {/* Felt texture overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(20,50,20,0.3) 0%, rgba(0,0,0,0.4) 100%)' }} />

      {/* Curved text along top edge */}
      <svg viewBox="0 0 300 55" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 55, pointerEvents: 'none', zIndex: 30 }}>
        <defs>
          <path id="curve" d="M 5,45 Q 150,8 295,45" />
        </defs>
        <text fill="#FFD700" fontSize="14" fontFamily="'Rye', serif" letterSpacing="2" textAnchor="middle">
          <textPath href="#curve" startOffset="50%">TexasNomad Spades</textPath>
        </text>
      </svg>

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

        {/* 4 of Hearts — left foreground */}
        <img
          src={FOUR_HEARTS}
          alt="4 of Hearts"
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

        {/* King of Spades — right foreground */}
        <img
          src={KING_SPADES}
          alt="King of Spades"
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