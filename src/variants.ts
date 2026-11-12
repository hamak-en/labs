import data from './variants.json';
import type { Params } from './physics';

export const variantCount = 10;
export const variantLabIds = Object.keys(data).map(Number);
export const hasVariants = (id:number) => variantLabIds.includes(id);
export const variantNumbers = Array.from({length:variantCount},(_,i)=>i+1);
export const validVariant = (v:unknown):v is number => typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=variantCount;
export const variantLabel = (v:number|undefined) => validVariant(v)?`Варіант ${v}`:'Попередня установка';
export function variantValues(id:number,variant:number):Params {
 if(!validVariant(variant)||!hasVariants(id))throw new Error('Невідомий варіант лабораторної.');
 return {...(data as Record<string,Params[]>)[id][variant-1]};
}
// Only specimen properties change. User settings, wiring, power and temperature
// remain independent of the selected variant.
export function applyVariant(id:number,variant:number,p:Params,a:{selected:number;core:boolean}) {
 const values=variantValues(id,variant);
 if(id===6)p.l=a.core?values.lCore:values.l;
 else if(id===7)p.phase=a.selected===0?values.lampPhase:values.coilPhase;
 else if(id===8)p.cx=a.selected===0?values.cx1:values.cx2;
 else Object.assign(p,values);
}
