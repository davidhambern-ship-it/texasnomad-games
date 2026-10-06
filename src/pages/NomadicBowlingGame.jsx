import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';
import { bowlingApi } from '@/api/nomadicBowlingApi';
import { mountBowling } from '@/lib/nomadicBowling/app';
import { claimStandaloneDisplay, releaseStandaloneDisplay } from '@/api/standaloneDisplay';
import '@/components/nomadicBowling/bowling.css';
export default function NomadicBowlingGame(){
  const ref=useRef(null),identity=useTngGameIdentity(),navigate=useNavigate(),[params]=useSearchParams();
  const code=String(params.get('room')||params.get('display')||'').toUpperCase(),display=Boolean(params.get('display')),host=params.get('host')==='1',name=identity.publicName;
  useEffect(()=>{if(!ref.current||(!display&&identity.loading))return undefined;return mountBowling(ref.current,{api:bowlingApi,identityName:name||'You',initialCode:code,display,host,onExit:()=>navigate('/games')});},[code,display,host,name,identity.loading,navigate]);
  useEffect(()=>{if(!host||display)return undefined;const sync=()=>{try{const s=JSON.parse(localStorage.getItem('nb_seat_v1')||'null');if(s?.isHost&&s.code)claimStandaloneDisplay('nomadic-bowling',s.code).catch(()=>{});}catch{/* storage optional */}};const timer=setInterval(sync,15000);return()=>{clearInterval(timer);releaseStandaloneDisplay().catch(()=>{});};},[host,display]);
  return <div ref={ref} className="nb-root" />;
}
