import React, { useEffect } from 'react';

export default function ViralGame() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = String(params.get('join') || '').trim().toUpperCase();
    const launch = new URLSearchParams();

    if (/^[A-Z]{4}$/.test(joinCode)) {
      launch.set('join', joinCode);
    } else if (params.get('host') === '1') {
      launch.set('host', '1');
    }

    const suffix = launch.toString() ? `?${launch.toString()}` : '';
    window.location.replace(`/viral/index.html${suffix}`);
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
