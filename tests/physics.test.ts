import { describe, expect, it } from 'vitest';
import { labs } from '../src/config';
import { balance, calculateRow, simulate, thermalFit, rlc, diode } from '../src/physics';
const defaults=(id:number)=>Object.fromEntries(labs[id-1].fields.map(f=>[f.key,f.value]));
describe('Bridge equilibrium and dimensional calculations',()=>{
 for(const id of [1,2,8])it(`balanced lab ${id} returns the actual unknown`,()=>{
  const p=defaults(id);p[id===2?'lx':'l']=balance(id,p);const sim=simulate(id,p,'default');expect(sim.reading).toBeCloseTo(0,10);
  const result=calculateRow(id,sim.measurement);const key=id===1?'rx':id===2?'ex':'cx';expect(result[key]).toBeCloseTo(p[key],10);expect(result.error).toBeGreaterThan(0);
 });
 it('does not accept zero lengths or incomplete measurements',()=>{expect(()=>calculateRow(1,{r:1000,l1:0,l2:100})).toThrow();expect(()=>calculateRow(8,{c0:2,l1:null,l2:50})).toThrow();});
});
describe('Thermal regression',()=>{
 it('recovers independent model parameters from six temperature readings',()=>{const p=defaults(3);const rows=[30,40,50,60,70,80].map(t=>simulate(3,{...p,t},'default').measurement);const f=thermalFit(rows);expect(f.alpha).toBeCloseTo(p.alpha,9);expect(f.gap).toBeCloseTo(p.gap,9);expect(f.r0).toBeCloseTo(p.r0,9);});
 it('rejects repeated temperatures and absolute zero',()=>{expect(()=>thermalFit([{t:30,metal:25,semi:1000},{t:30,metal:25,semi:1000}])).toThrow('різні');expect(()=>calculateRow(3,{t:-273.15,metal:25,semi:1000})).toThrow();});
});
describe('Diode, oscilloscope, AC and power',()=>{
 it('uses mA correctly and preserves reversed polarity',()=>{expect(calculateRow(4,{u:0.4,i:2}).r).toBe(200);expect(diode(-0.5)).toBeLessThan(0);expect(()=>calculateRow(4,{u:0.4,i:0})).toThrow();expect(()=>calculateRow(4,{u:0.4,i:-2})).toThrow();});
 it('calibrates full excursion against RMS voltage',()=>{expect(calculateRow(5,{u:10,length:20*Math.SQRT2}).alpha).toBeCloseTo(1);});
 it('recovers coil inductance in RL mode, but never from RLC magnitude alone',()=>{const p=defaults(6),sim=simulate(6,p,'rl');expect(calculateRow(6,sim.measurement,'rl').l).toBeCloseTo(p.l);expect(calculateRow(6,sim.measurement,'rlc').l).toBeNaN();expect(()=>calculateRow(6,{u:1,i:1,r:10,f:50},'rl')).toThrow('Z ≥ R');});
 it('has zero phase and Z = R at resonance',()=>{const f=50,l=.1,c=1/((2*Math.PI*f)**2*l);const v=rlc(20,l,c,f);expect(v.z).toBeCloseTo(20);expect(v.phase).toBeCloseTo(0);});
 it('enforces real passive power and resolves active resistance',()=>{const v=calculateRow(7,{u:100,i:2,p:100});expect(v.pf).toBe(.5);expect(v.phase).toBeCloseTo(60);expect(v.z).toBe(50);expect(v.r).toBe(25);expect(v.x).toBeCloseTo(25*Math.sqrt(3));expect(()=>calculateRow(7,{u:10,i:1,p:11})).toThrow('P ≤ UI');});
});
