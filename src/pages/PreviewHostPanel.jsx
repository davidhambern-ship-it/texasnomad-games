import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Monitor, ShieldCheck, Unplug } from 'lucide-react';
import { ALL_GAMES } from '@/components/host/HostGameSelect';
import { tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';

const PS2={fontFamily:"'Press Start 2P', monospace"};

export default function PreviewHostPanel(){
  const { user, logout } = useAuth();
  const [phase,setPhase]=useState('loading');
  const [controllerId,setControllerId]=useState(null);
  const [pairing,setPairing]=useState(null);
  const [activeRoom,setActiveRoom]=useState(null);
  const [selectedGame,setSelectedGame]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const roomGame=useMemo(()=>ALL_GAMES.find(g=>g.id===activeRoom?.gameId)||selectedGame,[activeRoom,selectedGame]);

  useEffect(()=>{ let cancelled=false; (async()=>{
    try{
      let deviceId=localStorage.getItem('tng_device_id');
      if(!deviceId || localStorage.getItem('tng_connection_role')!=='host_controller'){
        const {device}=await tngApi.devices.create({role:'host_controller',deviceLabel:'Host Controller'});
        deviceId=device.id;
        localStorage.setItem('tng_device_id',deviceId);
        localStorage.setItem('tng_connection_role','host_controller');
      }
      if(cancelled)return;
      setControllerId(deviceId);
      const s=await tngApi.host.startSession(deviceId);
      if(cancelled)return;
      setActiveRoom(s.activeRoom||null);
      if(s.activeRoom){setPhase('room');return;}
      if(s.hostSession?.displayDeviceId){setPhase('ready');return;}
      const p=await tngApi.host.createPairing(deviceId);
      if(cancelled)return;
      setPairing(p.pairing); setPhase('pairing');
    }catch(e){ if(!cancelled){setError(e.message);setPhase('error');} }
  })(); return()=>{cancelled=true};},[]);

  useEffect(()=>{ if(phase!=='pairing'||!controllerId)return;
    const id=setInterval(async()=>{try{
      const s=await tngApi.host.startSession(controllerId);
      if(s.activeRoom){setActiveRoom(s.activeRoom);setPhase('room');}
      else if(s.hostSession?.displayDeviceId){setPairing(null);setPhase('ready');}
    }catch{}},2500);
    return()=>clearInterval(id);
  },[phase,controllerId]);

  async function createRoom(game){setBusy(true);setError('');try{
    const {room}=await tngApi.host.createRoom(controllerId,game.id);
    setSelectedGame(game);setActiveRoom(room);setPhase('room');
  }catch(e){setError(e.message)}finally{setBusy(false)}}

  async function endRoom(){setBusy(true);try{await tngApi.host.endRoom(controllerId);setActiveRoom(null);setSelectedGame(null);setPhase('ready');}finally{setBusy(false)}}

  async function signOut(){try{if(controllerId)await tngApi.host.endSession(controllerId)}catch{} localStorage.removeItem('tng_device_id');localStorage.removeItem('tng_connection_role');logout(true)}

  return <div className="min-h-screen bg-[#050505] text-white flex flex-col">
    <header className="h-14 border-b border-[#BC13FE]/40 flex items-center justify-between px-4">
      <Link to="/" className="font-heading tracking-widest">TEXASNOMAD <span className="text-[#FF5F1F]">HOST</span></Link>
      <div className="flex items-center gap-3"><span className="text-xs text-white/50">{user?.full_name||user?.email}</span><button onClick={signOut} className="text-xs text-white/40">SIGN OUT</button></div>
    </header>
    <main className="flex-1 flex items-center justify-center p-6">
      {phase==='loading'&&<div className="text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#BC13FE]"/><div style={PS2}>STARTING HOST CONTROLLER</div></div>}
      {phase==='error'&&<div className="text-center text-red-400"><div style={PS2}>HOST CONTROLLER ERROR</div><p className="mt-4">{error}</p></div>}
      {phase==='pairing'&&<div className="text-center max-w-xl w-full"><Monitor className="w-14 h-14 mx-auto mb-4 text-[#FFD700]"/><h1 className="text-3xl mb-3">Connect Game Display</h1><p className="text-white/45 mb-6">Open the Game Display on a second screen and enter this code.</p><div className="border-2 border-[#FFD700]/50 rounded-2xl p-8 font-mono text-6xl tracking-[0.25em] text-[#FFD700]">{pairing?.code||'------'}</div><Link to="/display" target="_blank" className="inline-block mt-6 px-5 py-3 bg-[#FFD700] text-black rounded-lg" style={PS2}>OPEN DISPLAY</Link></div>}
      {phase==='ready'&&<div className="w-full max-w-2xl text-center"><ShieldCheck className="w-12 h-12 mx-auto mb-4 text-green-400"/><h1 className="text-3xl mb-6">Host System Ready</h1>{error&&<p className="text-red-400 mb-4">{error}</p>}<div className="grid sm:grid-cols-3 gap-4">{ALL_GAMES.map(game=><button key={game.id} disabled={busy} onClick={()=>createRoom(game)} className="border-2 rounded-xl p-6 bg-black/50" style={{borderColor:game.color+'55'}}><div className="text-5xl mb-3">{game.emoji}</div><div style={{...PS2,color:game.color,fontSize:10}}>{game.title}</div></button>)}</div></div>}
      {phase==='room'&&activeRoom&&<div className="text-center max-w-xl"><div className="text-6xl mb-4">{roomGame?.emoji||'🎮'}</div><h1 className="text-3xl mb-4">{roomGame?.title||activeRoom.gameId}</h1><div className="text-5xl font-mono tracking-[0.2em] text-[#BC13FE] mb-6">{activeRoom.roomCode}</div><p className="text-white/45">This Host Controller is locked to this active room. A second live room cannot be created until you disconnect.</p><button onClick={endRoom} disabled={busy} className="mt-6 px-5 py-3 border border-red-500/50 text-red-400 rounded-lg"><Unplug className="w-4 h-4 inline mr-2"/>DISCONNECT ROOM</button></div>}
    </main>
  </div>
}
