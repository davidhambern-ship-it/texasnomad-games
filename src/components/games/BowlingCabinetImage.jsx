import React, { useEffect, useRef } from 'react';
import { drawLane } from '@/lib/nomadicBowling/draw';
export default function BowlingCabinetImage(){const ref=useRef(null);useEffect(()=>{const canvas=ref.current;if(!canvas)return;drawLane(canvas.getContext('2d'),900,550,null,0,{},true);},[]);return <canvas ref={ref} width={900} height={550} role="img" aria-label="Nomadic Bowling neon western saloon lane" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>;}
