import {afterEach,describe,expect,it,vi} from 'vitest';
import {labs} from '../src/config';
import {fresh,restore,save} from '../src/storage';
import {applyVariant,variantNumbers,variantValues} from '../src/variants';
import {balance,simulate,calculateRow,capacitanceModes,bridgeCapacitance,combinedCapacitanceError} from '../src/physics';
afterEach(()=>vi.unstubAllGlobals());

describe('Sotti measures the same pair in four configurations',()=>{
 for(const [mode,expected,length] of [['c1',3,40],['c2',5,200/7],['series',1.875,1600/31],['parallel',8,20]] as const)it(`recovers the known ${mode} example`,()=>{
  const p={...fresh().labs[8].params,l:length};
  const model=simulate(8,p,mode);
  expect(model.reading).toBeCloseTo(0,12);
  expect(bridgeCapacitance(p,mode)).toBe(expected);
  expect(calculateRow(8,model.measurement).cx).toBeCloseTo(expected,12);
 });
 it('preserves specimens and controls, and allows null recording at the configured contact step in all variants',()=>{
  for(const variant of variantNumbers){
   const state=fresh().labs[8];state.params.limit=1;state.params.l=37.5;
   applyVariant(8,variant,state.params,state.apparatus);
   const values=variantValues(8,variant),before={...state.params};
   expect(state.params.cx).toBe(values.cx1);expect(state.params.cx2).toBe(values.cx2);
   for(const mode of capacitanceModes){
    const l=balance(8,state.params,mode),step=labs[7].fields.find(f=>f.key==='l')!.step,p={...state.params,l:Math.round(l/step)*step};
    expect(l).toBeGreaterThanOrEqual(1);expect(l).toBeLessThanOrEqual(99);
    expect(Math.abs(simulate(8,p,mode).reading!*12.6)).toBeLessThanOrEqual(.005);
   }
   expect(state.params).toEqual(before);
  }
 });
 it('propagates absolute errors by the correct capacitor derivatives',()=>{
  expect(combinedCapacitanceError(2,2,.1,.1,'parallel')).toBeCloseTo(.2);
  expect(combinedCapacitanceError(2,2,.1,.1,'series')).toBeCloseTo(.05);
  expect(combinedCapacitanceError(3,5,.03,.1,'series')).toBeCloseTo(.02578125);
 });
 it('restores each connection and keeps both specimen values',()=>{
  let stored='';vi.stubGlobal('localStorage',{getItem:()=>stored,setItem:(_key:string,text:string)=>{stored=text;}});
  for(const mode of capacitanceModes){const state=fresh();state.labs[8].mode=mode;state.labs[8].variant=10;applyVariant(8,10,state.labs[8].params,state.labs[8].apparatus);save(state);expect(restore().labs[8]).toEqual(state.labs[8]);}
 });
 it('migrates the former active sample and tagged rows while retaining untagged measurements',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({version:1,labs:{8:{params:{cx:4.7,l:25},mode:'default',apparatus:{selected:1},rows:[
   {id:1,row:{c0:2,l1:40,l2:60},mode:'default',source:'demo',specimen:'c1'},
   {id:2,row:{c0:2,l1:25,l2:75},mode:'default',source:'manual',specimen:'c2'},
   {id:3,row:{c0:2,l1:50,l2:50},mode:'default',source:'manual'},
  ]}}})});
  const state=restore().labs[8];expect(state.variant).toBeUndefined();expect(state.mode).toBe('c2');expect(state.params.cx).toBe(3);expect(state.params.cx2).toBe(4.7);expect(state.params.l).toBe(25);
  expect(state.rows.map(m=>m.mode)).toEqual(['c1','c2','default']);expect(state.rows.map(m=>m.row.l1)).toEqual([40,25,50]);
 });
});
