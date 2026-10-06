import React, { useEffect, useRef } from 'react';
import { drawPortrait } from './draw';

/** Animated idle portrait of a fighter (code-drawn). */
export default function RRPortrait({ ch, size = 180, animate = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) drawPortrait(ref.current, ch, 0);
    if (!animate) return undefined;
    let f = 0; const t = setInterval(() => { if (ref.current) drawPortrait(ref.current, ch, f += 3); }, 60);
    return () => clearInterval(t);
  }, [ch, animate]);
  return <canvas ref={ref} width={size} height={size} />;
}