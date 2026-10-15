import { labs } from './config';
import {bridgeModes} from './physics';
import type { Params, Row } from './physics';
export interface Measurement {id:number;row:Row;mode:string;source:'demo'|'manual'}
export interface Apparatus {power:boolean;connected:boolean;heating:boolean;core:boolean;probe:'metal'|'semi';selected:number;temperature:number}
export const freshApparatus=(id:number):Apparatus=>({power:false,connected:true,heating:false,core:false,probe:'metal',selected:[2,7].includes(id)?1:0,temperature:30});
export interface LabState {params:Params;mode:string;rows:Measurement[];apparatus:Apparatus}
export interface State {version:1;labs:Record<string,LabState>}
const key='electricity-lab:v1';
export function fresh():State{return {version:1,labs:Object.fromEntries(labs.map(l=>[l.id,{params:Object.fromEntries(l.fields.map(f=>[f.key,f.value])),mode:l.id===1?'r1':l.id===6?'rlc':l.id===5?'scope':l.id===4?'forward':'default',rows:[],apparatus:freshApparatus(l.id)}]))};}
export function restore():State{const state=fresh();try{
 const data=JSON.parse(localStorage.getItem(key)??'null');if(data?.version!==1||!data.labs)return state;
 for(const lab of labs){const s=data.labs[lab.id];if(!s||typeof s!=='object')continue;
  const a=s.apparatus;if(a&&typeof a==='object'){for(const key of ['power','connected','heating','core'] as const)if(typeof a[key]==='boolean')state.labs[lab.id].apparatus[key]=a[key];if(['metal','semi'].includes(a.probe))state.labs[lab.id].apparatus.probe=a.probe;if(a.selected===0||a.selected===1)state.labs[lab.id].apparatus.selected=a.selected;if(typeof a.temperature==='number'&&Number.isFinite(a.temperature)&&a.temperature>=30&&a.temperature<=80)state.labs[lab.id].apparatus.temperature=a.temperature;}
  for(const f of lab.fields){const v=s.params?.[f.key];if(typeof v==='number'&&Number.isFinite(v)&&v>=f.min&&v<=f.max&&(!f.choices||f.choices.includes(v)))state.labs[lab.id].params[f.key]=f.discrete?f.min+Math.round((v-f.min)/f.step)*f.step:v;}
  const modes=lab.id===1?[...bridgeModes]:lab.id===3?['default','linear']:lab.id===4?['forward','reverse']:lab.id===5?['scope','xy','sensitivity']:lab.id===6?['rlc','rl']:['default'];
  if(modes.includes(s.mode))state.labs[lab.id].mode=s.mode;
  if(lab.id===1&&!bridgeModes.includes(s.mode)){
   const p=state.labs[1].params;
   if(state.labs[1].apparatus.selected===1){p.rx2=p.rx;p.rx=labs[0].fields.find(f=>f.key==='rx')!.value;state.labs[1].mode='r2';}
  }
  if(Array.isArray(s.rows))state.labs[lab.id].rows=s.rows.slice(0,200).filter((r:Measurement)=>r&&typeof r.id==='number'&&r.row!==null&&typeof r.row==='object'&&['demo','manual'].includes(r.source)&&typeof r.mode==='string').map((r:Measurement)=>({id:r.id,mode:r.mode,source:r.source,row:Object.fromEntries(lab.columns.map(c=>{const legacyDefault=lab.id===1&&!(c.key in r.row)?c.key==='dR'&&typeof r.row.r==='number'?.001*r.row.r:['dl1','dL'].includes(c.key)?.1:null:null;return [c.key,typeof r.row[c.key]==='number'&&Number.isFinite(r.row[c.key])?r.row[c.key]:r.row[c.key]===null?null:legacyDefault];}))}));
 }
 }catch{/* An unavailable or corrupt browser store must not prevent work. */}return state;}
export function save(state:State):boolean{try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}
export function downloadCSV(name:string,headers:string[],rows:(string|number)[][]){const quote=(x:string|number)=>'"'+String(x).replaceAll('"','""')+'"';const text='\uFEFF'+[headers,...rows].map(r=>r.map(quote).join(';')).join('\r\n');const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
