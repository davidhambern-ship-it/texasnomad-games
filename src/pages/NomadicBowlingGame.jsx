import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';
import { bowlingApi } from '@/api/nomadicBowlingApi';
import { mountBowling } from '@/lib/nomadicBowling/app';
import { claimStandaloneDisplay, releaseStandaloneDisplay } from '@/api/standaloneDisplay';
import '@/components/nomadicBowling/bowling.css';
export default function NomadicBowlingGame(){
  const ref=useRef(null),identity=useTngGameIdentity(),navigate=useNavigate(),[params]=useSearchParams(),[hostCode,setHostCode]=useState('');
  const code=String(params.get('room')||params.get('display')||'').toUpperCase(),display=Boolean(params.get('display')),host=params.get('host')==='1',name=identity.publicName;
  useEffect(()=>{if(!ref.current||(!display&&identity.loading))return undefined;return mountBowling(ref.current,{api:bowlingApi,identityName:name||'You',initialCode:code,display,host,onHostRoom:setHostCode,onExit:()=>navigate('/games')});},[code,display,host,name,identity.loading,navigate]);
  useEffect(()=>{if(!hostCode||display)return undefined;const sync=()=>claimStandaloneDisplay('nomadic-bowling',hostCode).catch(()=>{});sync();const timer=setInterval(sync,15000);return()=>{clearInterval(timer);releaseStandaloneDisplay().catch(()=>{});};},[hostCode,display]);
  return <div ref={ref} className="nb-root" />;
}
