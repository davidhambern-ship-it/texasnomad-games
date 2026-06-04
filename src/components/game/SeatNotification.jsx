import React, { useEffect, useState } from 'react';

export default function SeatNotification({ notification }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!!notification);
  }, [notification]);

  if (!notification) return null;

  const isCorrect = notification.result === 'correct';
  const isWrong = notification.result === 'wrong';

  return (
    <div
      className="fixed top-20 left-1/2 z-[9999] pointer-events-none"
      style={{ transform: 'translateX(-50%)', opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
    >
      <div
        className="px-8 py-5 rounded-2xl border-2 text-center"
        style={{
          background: isCorrect ? 'linear-gradient(135deg,#0d2b0d,#0a1a1a)' : isWrong ? 'linear-gradient(135deg,#2b0d0d,#1a0a1a)' : 'linear-gradient(135deg,#1a0a2b,#0a0a1a)',
          borderColor: isCorrect ? '#4ade80' : isWrong ? '#ef4444' : '#BC13FE',
          boxShadow: isCorrect ? '0 0 30px rgba(74,222,128,0.4),0 0 60px rgba(74,222,128,0.2)' : isWrong ? '0 0 30px rgba(239,68,68,0.4),0 0 60px rgba(239,68,68,0.2)' : '0 0 30px rgba(188,19,254,0.4)',
          animation: 'slideInNotif 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
          minWidth: '320px',
        }}
      >
        <div className="text-white/60 text-[9px] tracking-[0.3em] uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          Seat {notification.seatNumber}
        </div>
        <div className="text-5xl font-bold tracking-widest my-1"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            color: isCorrect ? '#4ade80' : isWrong ? '#ef4444' : '#BC13FE',
            textShadow: isCorrect ? '0 0 20px rgba(74,222,128,0.8)' : isWrong ? '0 0 20px rgba(239,68,68,0.8)' : '0 0 20px rgba(188,19,254,0.8)',
          }}>
          {notification.letter}
        </div>
        {notification.result && (
          <div className="text-[11px] tracking-[0.2em] uppercase mt-1"
            style={{ fontFamily: "'Press Start 2P', monospace", color: isCorrect ? '#4ade80' : '#ef4444' }}>
            {isCorrect ? '✓ CORRECT!' : '✗ WRONG!'}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideInNotif {
          from { transform: translateY(-30px) scale(0.85); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}