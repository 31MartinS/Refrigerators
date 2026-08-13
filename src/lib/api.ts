import { createClient } from '@supabase/supabase-js';
import { demoPrizes } from './config';
import type { DrawResult, ParticipantInput } from '../types';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const supabase=url&&key?createClient(url,key):null;
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function throwFunctionError(functionName:string,error:unknown):Promise<never>{
 let details:unknown;
 if(error&&typeof error==='object'&&'context' in error){
  const response=(error as {context?:Response}).context;
  if(response instanceof Response){
   try{details=await response.clone().json()}catch{try{details=await response.clone().text()}catch{details=undefined}}
  }
 }
 console.error(`[Supabase:${functionName}]`,{error,details});
 const message=details&&typeof details==='object'&&'error' in details?String((details as {error:unknown}).error):`La función ${functionName} devolvió un error.`;
 throw new Error(message,{cause:error});
}

export async function registerParticipant(input:ParticipantInput):Promise<{participantId:string}> {
 if(supabase){const {data,error}=await supabase.functions.invoke('register-participant',{body:input});if(error)return throwFunctionError('register-participant',error);return data as {participantId:string};}
 await wait(650); return {participantId:crypto.randomUUID()};
}
export async function drawPrize(participantId:string,refrigeratorId:string):Promise<DrawResult>{
 if(supabase){const {data,error}=await supabase.functions.invoke('draw-prize',{body:{participantId,refrigeratorId}});if(error)return throwFunctionError('draw-prize',error);return data as DrawResult;}
 await wait(900); const prize=demoPrizes[1]; const alternatives=demoPrizes.filter(p=>p.id!==prize.id); return {participationId:crypto.randomUUID(),refrigeratorId,prize,decorativePrizes:Array.from({length:4},(_,index)=>alternatives[index%alternatives.length]),awardedAt:new Date().toISOString()};
}
