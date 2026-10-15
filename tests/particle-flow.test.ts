import {describe,expect,it} from 'vitest';
import {fresh} from '../src/storage';
import {balance} from '../src/physics';
import {particleProgress,particleSegments} from '../src/particle-flow';
import type {BenchState} from '../src/workbench';

const state=(id:number):BenchState=>({id,...fresh().labs[id],playing:true});
const same=(a:number[],b:number[])=>a.every((n,i)=>n===b[i]);
function velocity(s:BenchState,a:[number,number],b:[number,number]){
 const segment=particleSegments(s).find(segment=>same(segment.a,a)&&same(segment.b,b));
 if(!segment)throw new Error('Missing wire segment');
 return [(b[0]-a[0])*segment.direction||0,(b[1]-a[1])*segment.direction||0];
}

describe('Conventional current in DC circuits',()=>{
 for(const id of [1,2])it(`leaves the positive terminal and enters the return terminal in lab ${id}`,()=>{
  const s=state(id);
  expect(velocity(s,[62,387],[62,315])[1]).toBeLessThan(0);
  expect(velocity(s,[170,387],[170,373])[1]).toBeGreaterThan(0);
  expect(velocity(s,[110,315],[690,315])[0]).toBeGreaterThan(0);
 });
 it('reverses the full diode circuit with source polarity and stops at zero volts',()=>{
  const s=state(4);
  for(const sign of [1,-1,0]){
   s.params.u=.5*sign;
   expect(Math.sign(velocity(s,[62,387],[62,240])[1])).toBe(-sign||0);
   expect(Math.sign(velocity(s,[170,365],[170,387])[1])).toBe(sign);
   expect(Math.sign(velocity(s,[536,325],[708,325])[0])).toBe(sign);
   // An ideal voltmeter draws no current, for either polarity.
   expect(velocity(s,[543,222],[543,276])).toEqual([0,0]);
   expect(velocity(s,[708,325],[708,222])).toEqual([0,0]);
  }
 });
 it('keeps external current direction when only the diode is flipped',()=>{
  const s=state(4);
  for(const u of [.65,-.8]){
   s.params.u=u;s.apparatus.selected=0;
   const before=velocity(s,[62,387],[62,240]);
   s.apparatus.selected=1;
   expect(velocity(s,[62,387],[62,240])).toEqual(before);
  }
 });
 it('reverses bridge diagonal current across balance and follows the moving contact',()=>{
  const s=state(1),equilibrium=balance(1,s.params);
  for(const offset of [-10,0,10]){
   s.params.l=equilibrium+offset;
   const v=velocity(s,[445,215],[445,263]);
   expect(Math.sign(v[1])||0).toBe(-Math.sign(offset)||0);
   const x=110+580*s.params.l/100;
   expect(velocity(s,[x,263],[x,291])[1]).toBe(v[1]/48*28);
  }
 });
 it('uses the selected cell voltage to reverse compensation current',()=>{
  const s=state(2);
  for(const selected of [0,1]){
   s.apparatus.selected=selected;
   const equilibrium=(selected===0?s.params.en:s.params.ex)*s.params.ln/s.params.en;
   for(const offset of [-5,0,5]){
    s.params.lx=equilibrium+offset;
    expect(Math.sign(velocity(s,[530,205],[530,286])[1])||0).toBe(Math.sign(offset));
   }
  }
 });
 it('returns sample current to the ohmmeter through its negative lead',()=>{
  const s=state(3);
  expect(velocity(s,[595,321],[595,345])[1]).toBeGreaterThan(0);
  expect(velocity(s,[737,321],[737,345])[1]).toBeLessThan(0);
 });
 it('keeps reverse progress within the wire and preserves AC oscillation',()=>{
  const segment={a:[0,0] as [number,number],b:[1,0] as [number,number],phase:.5,direction:-1,kind:0};
  expect(particleProgress(.2,1,segment,false)).toBeCloseTo(.3);
  expect(particleProgress(.6,1,segment,false)).toBeCloseTo(.9);
  expect(particleProgress(.2,1,segment,true)).toBe(particleProgress(.2,1,{...segment,direction:1},true));
 });
});
