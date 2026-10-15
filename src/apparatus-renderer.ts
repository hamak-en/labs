import {WebGPURenderer,Scene,OrthographicCamera,Mesh,InstancedMesh,InstancedBufferAttribute,MeshBasicNodeMaterial,CircleGeometry,PlaneGeometry,Color,Matrix4,DoubleSide} from 'three/webgpu';
import {Fn,If,attribute,uniform,positionLocal,vec2,vec3,mix,float} from 'three/tsl';
import type {BenchState} from './workbench';
import {particleSegments,particleProgress} from './particle-flow';
import type {ParticleSegment} from './particle-flow';
import {diode,diodeVoltage} from './physics';
import {scopeScale,scopePixelsPerVoltX,scopePixelsPerVoltY,scopePixelsPerSensitivityVoltX,scopeTraceSegments,scopeSweepPhasePerHalfWidth} from './scope';

export class ApparatusRenderer {
 private gpu?:WebGPURenderer;private ctx?:CanvasRenderingContext2D;private canvas:HTMLCanvasElement;private scene=new Scene();private camera=new OrthographicCamera(0,800,0,540,.01,100);private state:BenchState;
 private timer=0;private resizeTimer=0;private previous=0;private elapsed=0;private dead=false;private dirty=true;private observer:ResizeObserver;
 private clock=uniform(0);private speed=uniform(.25);private ac=uniform(0);private rl=uniform(0);private heater=uniform(0);private ratio=uniform(2);private phase=uniform(Math.PI/4);private amplitude=uniform(.6);private mode=uniform(0);private load=uniform(1);private probe=uniform(0);
 private particles?:InstancedMesh;private waves:Mesh[]=[];private segments:ParticleSegment[]=[];
 constructor(private host:HTMLElement,state:BenchState,private report:(name:string)=>void){this.state=state;this.camera.position.z=10;this.canvas=document.createElement('canvas');this.canvas.className='bench-gpu';this.canvas.setAttribute('aria-hidden','true');host.append(this.canvas);this.observer=new ResizeObserver(()=>{cancelAnimationFrame(this.resizeTimer);this.resizeTimer=requestAnimationFrame(()=>this.resize());});this.observer.observe(host);}
 async init(){try{
  if(new URLSearchParams(location.search).get('renderer')==='canvas')throw new Error('Canvas requested');
  this.gpu=new WebGPURenderer({canvas:this.canvas,alpha:true,antialias:true});this.gpu.setClearColor(new Color('#000000'),0);this.gpu.setPixelRatio(Math.min(devicePixelRatio,2));await this.gpu.init();if(this.dead){this.gpu.dispose();return;}
  this.makeParticles();if(this.state.id===5)this.makeScope();await this.gpu.compileAsync(this.scene,this.camera);if(this.dead){this.gpu.dispose();return;}this.set(this.state);this.resize();await this.gpu.renderAsync(this.scene,this.camera);if(this.dead)return;this.report((this.gpu.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'WebGPU':'WebGL 2');this.set(this.state);this.resize();this.start();
 }catch{if(!this.dead)this.fallback();}}
 private fallback(){this.gpu?.dispose();this.gpu=undefined;const next=document.createElement('canvas');next.className='bench-gpu';next.setAttribute('aria-hidden','true');this.canvas.replaceWith(next);this.canvas=next;this.ctx=next.getContext('2d')??undefined;if(!this.segments.length)this.buildSegments();this.report('Canvas 2D');this.resize();this.start();}
 private buildSegments(){this.segments=particleSegments(this.state);}
 private makeParticles(){this.buildSegments();const g=new CircleGeometry(2.2,12),n=this.segments.length;const data=(getter:(s:ParticleSegment)=>number[],size:number)=>new InstancedBufferAttribute(new Float32Array(this.segments.flatMap(getter)),size);
  g.setAttribute('pathStart',data(s=>s.a,2));g.setAttribute('pathEnd',data(s=>s.b,2));g.setAttribute('pathPhase',data(s=>[s.phase],1));g.setAttribute('pathDirection',data(s=>[s.direction],1));g.setAttribute('pathKind',data(s=>[s.kind],1));
  const mat=new MeshBasicNodeMaterial({side:DoubleSide,color:'#f4e7a4'}),clock=this.clock,speed=this.speed,ac=this.ac,rl=this.rl,heater=this.heater,load=this.load,probe=this.probe;
  mat.positionNode=Fn(()=>{const start=attribute('pathStart','vec2'),end=attribute('pathEnd','vec2'),kind=attribute('pathKind','float'),direction=attribute('pathDirection','float');const progress=clock.mul(speed).mul(direction).add(attribute('pathPhase','float')).fract().toVar();If(ac.greaterThan(.5),()=>{progress.assign(clock.mul(2.4).add(attribute('pathPhase','float').mul(Math.PI*2)).sin().mul(.42).add(.5));});
   const pos=mix(start,end,progress).add(positionLocal.xy).toVar();
   If(direction.equal(0),()=>pos.assign(vec2(-9999)));
   If(kind.equal(1).and(rl.lessThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(2).and(rl.greaterThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(3).and(heater.lessThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(4).and(load.greaterThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(5).and(load.lessThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(6).and(probe.greaterThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(7).and(probe.lessThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(8).and(load.greaterThan(.5)),()=>pos.assign(vec2(-9999)));If(kind.equal(9).and(load.lessThan(.5)),()=>pos.assign(vec2(-9999)));
   return vec3(pos,float(1));})();
  this.particles=new InstancedMesh(g,mat,n);for(let i=0;i<n;i++)this.particles.setMatrixAt(i,new Matrix4());this.particles.frustumCulled=false;this.scene.add(this.particles);
 }
 private makeScope(){for(let ch=0;ch<2;ch++){
  const mat=new MeshBasicNodeMaterial({side:DoubleSide,color:ch===0?'#67b6a1':'#d4f194'}),mode=this.mode,clock=this.clock,ratio=this.ratio,phase=this.phase,amplitude=this.amplitude;
  mat.positionNode=Fn(()=>{const theta=positionLocal.x.add(1).mul(scopeSweepPhasePerHalfWidth),x=positionLocal.x.mul(scopeScale.width/2).toVar(),y=float(0).toVar(),width=vec2(0,positionLocal.y.mul(87)).toVar();
   If(mode.equal(1),()=>{const tx=theta.add(clock.mul(1.2)),ty=theta.mul(ratio).add(phase).add(clock.mul(ratio).mul(1.2));x.assign(tx.sin().mul(scopeScale.referenceVolts*scopePixelsPerVoltX));y.assign(ty.sin().mul(amplitude).mul(scopePixelsPerVoltY));const tangent=vec2(ty.cos().mul(amplitude).mul(ratio).mul(scopePixelsPerVoltY),tx.cos().mul(scopeScale.referenceVolts*scopePixelsPerVoltX));width.assign(tangent.div(tangent.length().max(.0001)).mul(positionLocal.y).mul(87));})
   .ElseIf(mode.equal(2),()=>{x.assign(positionLocal.x.mul(amplitude).mul(scopePixelsPerSensitivityVoltX));y.assign(0);})
   .Else(()=>{const r=ch===0?float(1):ratio;const phi=ch===0?float(0):phase;const amp=ch===0?float(scopeScale.referenceVolts):amplitude;const t=theta.mul(r).add(phi).add(clock.mul(r).mul(1.2));y.assign(t.sin().mul(amp).mul(scopePixelsPerVoltY));const tangent=vec2(t.cos().mul(amp).mul(scopePixelsPerVoltY).mul(r).mul(scopeSweepPhasePerHalfWidth),float(scopeScale.width/2));width.assign(tangent.div(tangent.length().max(.0001)).mul(positionLocal.y).mul(87));});
   return vec3(x.add(width.x).add(scopeScale.centerX),y.negate().add(width.y).add(scopeScale.centerY),float(2+ch));})();
  const mesh=new Mesh(new PlaneGeometry(2,.018,scopeTraceSegments,1),mat);mesh.frustumCulled=false;this.scene.add(mesh);this.waves.push(mesh);
 }}
 set(state:BenchState){this.state=state;this.dirty=true;const powered=state.apparatus.power&&state.apparatus.connected;
  this.buildSegments();
  if(this.particles){const geometry=this.particles.geometry;for(const [name,values] of [['pathStart',this.segments.flatMap(s=>s.a)],['pathEnd',this.segments.flatMap(s=>s.b)],['pathDirection',this.segments.map(s=>s.direction)]] as const){const attribute=geometry.getAttribute(name) as InstancedBufferAttribute;attribute.array.set(values);attribute.needsUpdate=true;}}
  this.ac.value=[6,7,8].includes(state.id)?1:0;this.rl.value=state.mode==='rl'?1:0;this.heater.value=state.apparatus.heating?1:0;this.load.value=state.apparatus.selected;this.probe.value=state.apparatus.probe==='metal'?0:1;
  const bias=diodeVoltage(state.params.u,state.apparatus.selected===1);
  this.speed.value=state.id===4?(bias<0?.01:Math.min(1,.05+Math.abs(diode(bias))/15)):.25;
  this.ratio.value=(state.params.f??100)/scopeScale.referenceHz;this.phase.value=(state.params.phase??45)*Math.PI/180;this.amplitude.value=state.id===5&&state.mode==='sensitivity'?state.params.ux*Math.SQRT2:state.params.u??3;this.mode.value=state.mode==='xy'?1:state.mode==='sensitivity'?2:0;
  if(this.particles)this.particles.visible=powered;for(let i=0;i<this.waves.length;i++)this.waves[i].visible=powered&&(i===1||state.mode==='scope');
 }
 private resize(){if(this.dead)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;if(this.gpu)this.gpu.setSize(w,h,false);else{const d=Math.min(devicePixelRatio,2);this.canvas.width=w*d;this.canvas.height=h*d;}this.dirty=true;}
 private start(){if(this.timer)return;const run=(now:number)=>{if(this.dead)return;const dt=this.previous?Math.min(.1,(now-this.previous)/1000):0;this.previous=now;if(this.state.playing&&document.visibilityState==='visible'&&this.host.clientWidth){this.elapsed+=dt;if(this.state.apparatus.power)this.dirty=true;}this.clock.value=this.elapsed;if(this.gpu&&this.state.apparatus.power)this.dirty=true;
  if(this.dirty&&this.host.clientWidth&&document.visibilityState==='visible'){this.dirty=false;try{if(this.gpu)this.gpu.render(this.scene,this.camera);else this.paint();}catch{this.fallback();}}
  this.timer=requestAnimationFrame(run);};this.timer=requestAnimationFrame(run);}
 private paint(){const ctx=this.ctx;if(!ctx)return;ctx.clearRect(0,0,this.canvas.width,this.canvas.height);const a=this.state.apparatus;if(!a.power||!a.connected)return;ctx.save();ctx.scale(this.canvas.width/800,this.canvas.height/540);ctx.fillStyle='#efe6a0';
  for(const s of this.segments){if(s.direction===0||s.kind===1&&this.state.mode!=='rl'||s.kind===2&&this.state.mode==='rl'||s.kind===3&&!a.heating||s.kind===4&&a.selected!==0||s.kind===5&&a.selected!==1||s.kind===6&&a.probe!=='metal'||s.kind===7&&a.probe!=='semi'||s.kind===8&&a.selected!==0||s.kind===9&&a.selected!==1)continue;const phase=particleProgress(this.elapsed,this.speed.value,s,[6,7,8].includes(this.state.id));const x=s.a[0]+(s.b[0]-s.a[0])*phase,y=s.a[1]+(s.b[1]-s.a[1])*phase;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();}
  if(this.state.id===5){ctx.save();ctx.beginPath();ctx.rect(240,145,240,190);ctx.clip();const p=this.state.params,mode=this.state.mode,ratio=p.f/scopeScale.referenceHz,phi=p.phase*Math.PI/180,amp=mode==='sensitivity'?p.ux*Math.SQRT2:p.u,clock=this.elapsed*1.2;
   const channels=mode==='scope'?2:1;for(let ch=0;ch<channels;ch++){ctx.strokeStyle=mode==='scope'&&ch===0?'#67b6a1':'#d4f194';ctx.lineWidth=1.6;ctx.beginPath();for(let i=0;i<=scopeTraceSegments;i++){const x=-1+2*i/scopeTraceSegments,theta=(x+1)*scopeSweepPhasePerHalfWidth;let px=360+x*scopeScale.width/2,py=240;if(mode==='xy'){px=360+Math.sin(theta+clock)*scopeScale.referenceVolts*scopePixelsPerVoltX;py=240-Math.sin(theta*ratio+phi+clock*ratio)*amp*scopePixelsPerVoltY;}else if(mode==='sensitivity')px=360+x*amp*scopePixelsPerSensitivityVoltX;else py=240-Math.sin(theta*(ch?ratio:1)+(ch?phi:0)+clock*(ch?ratio:1))*(ch?amp:scopeScale.referenceVolts)*scopePixelsPerVoltY;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();}ctx.restore();}
  ctx.restore();}
 dispose(){this.dead=true;cancelAnimationFrame(this.timer);cancelAnimationFrame(this.resizeTimer);this.observer.disconnect();for(const mesh of [this.particles,...this.waves])if(mesh){mesh.geometry.dispose();(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());}this.gpu?.dispose();this.canvas.remove();}
}
