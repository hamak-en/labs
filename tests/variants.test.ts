import {describe,it,expect,vi,afterEach} from 'vitest';
import {labs} from '../src/config';
import {applyVariant,variantNumbers,variantValues,variantLabIds,hasVariants} from '../src/variants';
import {balance,calculateRow,simulate,thermalFit} from '../src/physics';
import {fresh,restore,save} from '../src/storage';
const params=(id:number)=>Object.fromEntries(labs[id-1].fields.map(f=>[f.key,f.value]));
afterEach(()=>vi.unstubAllGlobals());
describe('ten reproducible specimen sets in labs with variants',()=>{
 it('defines 70 distinct in-range sets while leaving every visible setting unchanged',()=>{
  for(const id of variantLabIds){
   expect(new Set(variantNumbers.map(v=>JSON.stringify(variantValues(id,v)))).size).toBe(10);
   for(const v of variantNumbers){const p=params(id),visible=labs[id-1].fields.filter(f=>!f.hidden);const before={...p};applyVariant(id,v,p,{selected:id===7?1:0,core:false});for(const f of visible)expect(p[f.key]).toBe(before[f.key]);for(const f of labs[id-1].fields)expect(p[f.key]).toBeGreaterThanOrEqual(f.min),expect(p[f.key]).toBeLessThanOrEqual(f.max);}
  }
 });
 it('recovers each bridge resistance, source EMF and both capacitances by null measurements',()=>{
  for(const v of variantNumbers)for(const id of [1,2,8])for(const selected of id===8?[0,1]:[0]){
   const p=params(id);applyVariant(id,v,p,{selected,core:false});p[id===2?'lx':'l']=balance(id,p,'r1');
   const sim=simulate(id,p,'r1'),key=id===1?'rx':id===2?'ex':'cx';expect(sim.reading).toBeCloseTo(0,12);expect(calculateRow(id,sim.measurement).hasOwnProperty(key)).toBe(true);expect(calculateRow(id,sim.measurement)[key]).toBeCloseTo(p[key],8);
   if(id===8){const rounded=Math.round(p.l*10)/10;expect(Math.abs(simulate(8,{...p,l:rounded},'default').reading!*12.6)).toBeLessThan(.005);}
  }
 });
 it('recovers all three thermal unknowns from a six-temperature series',()=>{
  for(const v of variantNumbers){const p=params(3);applyVariant(3,v,p,{selected:0,core:false});const fit=thermalFit([30,40,50,60,70,80].map(t=>simulate(3,{...p,t},'default').measurement));expect(fit.r0).toBeCloseTo(p.r0,9);expect(fit.alpha).toBeCloseTo(p.alpha,9);expect(fit.gap).toBeCloseTo(p.gap,9);expect(simulate(3,{...p,t:30},'default').measurement.semi).toBeCloseTo(p.rs30);}
 });
 it('changes diode curves without changing bias',()=>{
  const currents=new Set<number>();for(const v of variantNumbers){const p=params(4);applyVariant(4,v,p,{selected:0,core:false});const forward=simulate(4,p,'forward');currents.add(forward.measurement.i!);expect(forward.measurement.i).toBeGreaterThan(0);expect(simulate(4,{...p,u:-.4},'reverse').measurement.i).toBeLessThan(0);
  }expect(currents.size).toBe(10);
 });
 it('recovers the selected coil and load properties in both configurations',()=>{
  for(const v of variantNumbers)for(const core of [false,true]){const p={...params(6),u:10};applyVariant(6,v,p,{selected:0,core});expect(calculateRow(6,simulate(6,p,'rl').measurement,'rl').l).toBeCloseTo(variantValues(6,v)[core?'lCore':'l'],9);}
  for(const v of variantNumbers)for(const selected of [0,1]){const p=params(7);applyVariant(7,v,p,{selected,core:false});const result=calculateRow(7,simulate(7,p,'default').measurement);expect(result.phase).toBeCloseTo(variantValues(7,v)[selected===0?'lampPhase':'coilPhase'],9);}
 });
 it('keeps lab 5 fixed and preserves its historical variant measurements on restoration',()=>{
  expect(hasVariants(5)).toBe(false);expect(()=>variantValues(5,1)).toThrow();
  for(const sensitivity of [.6,1,1.2]){const measured=simulate(5,{...params(5),ux:10,sensitivity},'sensitivity').measurement;expect(calculateRow(5,measured).alpha).toBeCloseTo(1,10);}
  const s=fresh();s.labs[5].variant=10;s.labs[5].params.sensitivity=1.2;s.labs[5].rows=[{id:1,row:{u:10,length:24*Math.SQRT2},mode:'sensitivity',source:'demo',variant:10}];
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(s)});const restored=restore().labs[5];expect(restored.variant).toBeUndefined();expect(restored.params.sensitivity).toBeUndefined();expect(restored.rows[0].variant).toBe(10);expect(restored.rows[0].row.length).toBeCloseTo(24*Math.SQRT2);
 });
 it('restores variant, configuration and journal metadata while preserving old custom installations',()=>{
  let text='';vi.stubGlobal('localStorage',{getItem:()=>text,setItem:(_k:string,v:string)=>{text=v;}});
  const s=fresh();s.labs[8].variant=10;s.labs[8].apparatus.selected=1;applyVariant(8,10,s.labs[8].params,s.labs[8].apparatus);s.labs[8].rows=[{id:1,row:{c0:2,l1:40,l2:60},mode:'default',source:'manual',variant:2,specimen:'c1'}];save(s);expect(restore().labs[8]).toEqual(s.labs[8]);
  const old=fresh();delete old.labs[2].variant;old.labs[2].params.ex=.91;old.labs[2].rows=[{id:2,row:{en:1,ln:50,lx:45.5},mode:'default',source:'manual'}];save(old);const restored=restore().labs[2];expect(restored.variant).toBeUndefined();expect(restored.params.ex).toBe(.91);expect(restored.rows[0].variant).toBeUndefined();expect(restored.rows[0].row.lx).toBe(45.5);
 });
});
