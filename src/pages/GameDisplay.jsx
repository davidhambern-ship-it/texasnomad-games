import React,{useState}from'react';
import {Monitor,CheckCircle2} from 'lucide-react';
import {tngApi} from '@/api/tngApi';
export default function GameDisplay(){
 const[code,setCode]=useState('');const[display,setDisplay]=useState(null);const[error,setError]=useState('');
 async function submit(e){e.preventDefault();setError('');try{const r=await tngApi.display.pair(code);setDisplay(r.display)}catch(err){setError(err.message)}}
 if(display)return <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center text-center p-6"><div><CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4"/><h1 className="text-4xl">Game Display Ready</h1><p className="text-white/45 mt-4">Leave this screen open. The Host Controller is connected.</p></div></div>;
 return <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md text-center"><Monitor className="w-14 h-14 text-[#FFD700] mx-auto mb-4"/><h1 className="text-3xl mb-4">Pair This Screen</h1><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} className="w-full h-16 bg-black border-2 border-[#FFD700]/50 rounded-xl text-center text-4xl font-mono tracking-[0.25em]" placeholder="000000"/>{error&&<p className="text-red-400 mt-3">{error}</p>}<button disabled={code.length!==6} className="w-full mt-5 h-12 bg-[#FFD700] text-black rounded-lg disabled:opacity-40">CONNECT DISPLAY</button></form></div>
}
