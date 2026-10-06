import { getNeonAuthToken } from '@/lib/neonAuth';
import { tngServiceUrl } from '@/lib/tngServiceOrigin';
async function call(path,{token,body,refresh=false}={}){
  const auth=await getNeonAuthToken({forceRefresh:refresh}).catch(()=>''),headers={Accept:'application/json',...(token?{'X-NB-Token':token}:{}),...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})};
  let response;try{response=await fetch(tngServiceUrl('/nb-api')+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});}catch{throw Error('Cannot reach the lanes. Check your connection.');}
  if(response.status===401&&auth&&!refresh)return call(path,{token,body,refresh:true});
  const d=await response.json().catch(()=>({}));if(!response.ok){const e=new Error(d.error?.message||'The lanes could not process that move.');e.status=response.status;throw e;}return d;
}
export const bowlingApi={createRoom:settings=>call('/rooms',{body:settings}),getRoom:(code,token)=>call('/rooms/'+encodeURIComponent(code),{token}),action:(code,token,action,payload={})=>call('/rooms/'+encodeURIComponent(code)+'/action',{token,body:{action,...payload}})};
