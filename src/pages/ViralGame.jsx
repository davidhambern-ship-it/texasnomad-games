import React, { useEffect } from 'react';

export default function ViralGame() {
  useEffect(() => {
    window.location.replace('/viral/index.html');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050208] text-white">
      <div className="text-center">
        <div className="text-4xl mb-4">🚀</div>
        <div className="font-heading tracking-widest uppercase text-[#FFD700]">
          Launching VIRAL!
        </div>
      </div>
    </div>
  );
}
