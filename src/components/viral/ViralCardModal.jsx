import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const CARD_COLORS = {
  equipment: '#00c875',
  challenge: '#BC13FE',
  viral: '#FF5F1F',
  event: '#f472b6',
  sponsor: '#a78bfa',
  pay: '#FFD700',
  play: '#22d3ee',
};

export default function ViralCardModal({ card, type, onClose, onConfirm }) {
  if (!card) return null;

  const color = CARD_COLORS[type] || '#666';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-md p-6 rounded-2xl border-2"
        style={{
          background: `linear-gradient(135deg, ${color}20, ${color}10)`,
          borderColor: color,
          boxShadow: `0 0 40px ${color}60`,
        }}
      >
        {/* Card Header */}
        <div className="text-center mb-4">
          <div className="text-[8px] text-white/40 uppercase mb-1" style={PS2}>
            {type} Card
          </div>
          <div
            className="text-2xl font-bold uppercase text-glow"
            style={{ 
              color, 
              fontFamily: "'Teko', sans-serif",
              textShadow: `0 0 20px ${color}`,
            }}
          >
            {card.name}
          </div>
        </div>

        {/* Card Effect */}
        <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
          <div className="text-sm text-white/80 text-center leading-relaxed">
            {card.description || card.effect?.description || 'Card effect description'}
          </div>
          
          {/* Effect details */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {card.effect?.followers && (
              <div className="px-2 py-1 rounded text-[7px] uppercase" style={{ background: '#FFD70020', border: '1px solid #FFD700', color: '#FFD700' }}>
                +{card.effect.followers} followers
              </div>
            )}
            {card.effect?.money && (
              <div className="px-2 py-1 rounded text-[7px] uppercase" style={{ background: '#00c87520', border: '1px solid #00c875', color: '#00c875' }}>
                ${card.effect.money}
              </div>
            )}
            {card.effect?.ssp && (
              <div className="px-2 py-1 rounded text-[7px] uppercase" style={{ background: '#BC13FE20', border: '1px solid #BC13FE', color: '#BC13FE' }}>
                +{card.effect.ssp} SSP
              </div>
            )}
            {card.sspReward && (
              <div className="px-2 py-1 rounded text-[7px] uppercase" style={{ background: '#BC13FE20', border: '1px solid #BC13FE', color: '#BC13FE' }}>
                +{card.sspReward} SSP on success
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg font-heading text-xs tracking-widest uppercase transition-all"
            style={{
              background: 'transparent',
              border: '1px solid white/30',
              color: 'white/60',
            }}
          >
            Close
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-lg font-heading text-xs tracking-widest uppercase transition-all hover:scale-105"
              style={{
                background: `${color}30`,
                border: `2px solid ${color}`,
                color,
                boxShadow: `0 0 15px ${color}40`,
              }}
            >
              Apply Effect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}