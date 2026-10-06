import React, { useEffect, useRef } from 'react';
import { createRenderer } from './draw';

/** Render authoritative host frames without starting a second match simulation. */
export default function RRPlayerArena({ frameRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const renderer = createRenderer();
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const frame = frameRef.current;
      if (!frame?.game) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      const dpr = canvas.width / Math.max(1, canvas.clientWidth);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.scale(dpr, dpr);
      renderer.render(ctx, frame.game, canvas.clientWidth, canvas.clientHeight, {
        tags: frame.tags || {}, hudH: 0,
      });
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [frameRef]);

  return <canvas ref={canvasRef} className="rr-player-arena" aria-label="Live Rodeo Rumble arena showing all fighters" />;
}
