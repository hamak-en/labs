import { circuitWires } from './workbench';
import type { BenchState, Wire } from './workbench';
import { simulate } from './physics';

export interface ParticleSegment {
 a:[number,number];b:[number,number];phase:number;direction:number;kind:number;
}

/** The sign follows conventional current, independently of how a wire is drawn. */
export function particleSegments(state:BenchState):ParticleSegment[]{
 const {id,params:p,apparatus:a}=state;
 const wires:Wire[]=circuitWires(id);
 if(id===1||id===2){
  const compensation=id===2,x=110+580*p[compensation?'lx':'l']/100;
  wires.push({points:[[110,315],[690,315]],color:''});
  wires.push({points:[[compensation?530:445,compensation?286:263],[x,compensation?286:263],[x,291]],color:'',sense:true,flow:compensation?1:-1});
 }
 const residual=id===2?p.en*p.lx/p.ln-(a.selected===0?p.en:p.ex):simulate(id,p,state.mode).reading??0;
 const segments:ParticleSegment[]=[];
 for(const w of wires){
  let direction=w.flow??1;
  if(w.sense)direction*=Math.abs(residual)<.001?0:Math.sign(residual);
  if(id===4)direction*=Math.sign(p.u);
  const kind=w.only==='rl'?1:w.only==='rlc'?2:w.load==='lamp'?4:w.load==='coil'?5:w.probe==='metal'?6:w.probe==='semi'?7:w.cell===0?8:w.cell===1?9:0;
  for(let i=0;i<w.points.length-1;i++)for(let dot=0;dot<2;dot++)segments.push({a:w.points[i],b:w.points[i+1],phase:dot*.5+i*.17,direction,kind});
 }
 if(id===3)for(let i=0;i<8;i++)segments.push({a:[303+i*23,249],b:[303+i*23,219],phase:i/8,direction:1,kind:3});
 return segments;
}

export function particleProgress(elapsed:number,speed:number,segment:ParticleSegment,ac:boolean){
 if(ac)return Math.sin(elapsed*2.4+segment.phase*Math.PI*2)*.42+.5;
 const progress=elapsed*speed*segment.direction+segment.phase;
 return progress-Math.floor(progress);
}
