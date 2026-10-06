import React, { useEffect, useRef } from 'react';
import { ROSTER } from '@/lib/brawl/fighters';
import { drawPortrait } from '@/components/brawl/draw';

/** The actual game rigs, unchanged: no generated or reinterpreted characters. */
export default function RodeoCabinetImage() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = 1000, H = 560;
    canvas.width = W; canvas.height = H;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#25103e'); sky.addColorStop(.65, '#713d64'); sky.addColorStop(1, '#e17a43');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.arc(830, 100, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b304b';
    ctx.beginPath(); ctx.moveTo(0, 270); ctx.lineTo(0, 150); ctx.lineTo(115, 150); ctx.lineTo(150, 235); ctx.lineTo(310, 235); ctx.lineTo(350, 175); ctx.lineTo(450, 175); ctx.lineTo(480, 270); ctx.closePath(); ctx.fill();
    ROSTER.forEach((fighter, index) => {
      const portrait = document.createElement('canvas');
      portrait.width = 192; portrait.height = 220;
      drawPortrait(portrait, fighter, 0);
      const top = index < 5;
      const col = top ? index : index - 5;
      const x = top ? 15 + col * 196 : 113 + col * 196;
      const y = top ? 15 : 282;
      ctx.fillStyle = fighter.color;
      ctx.globalAlpha = .14;
      ctx.beginPath(); ctx.ellipse(x + 96, y + 115, 86, 110, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(portrait, x, y);
      ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = fighter.color; ctx.fillText(fighter.name.toUpperCase(), x + 96, y + 246);
    });
  }, []);
  return <canvas ref={canvasRef} className="w-full h-full object-cover" role="img" aria-label="Rodeo Rumble's nine original in-game fighters, including the Bunnie Crew" />;
}
