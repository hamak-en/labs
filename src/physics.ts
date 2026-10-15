export type Params = Record<string, number>;
export type Row = Record<string, number | null>;
export interface Metric { label: string; value: number; unit: string; detail?: string }
const k=8.617333262e-5;
const rad=(v:number)=>v*Math.PI/180;
export function metal(t:number,r0:number,alpha:number){ return r0*(1+alpha*t); }
export function semiconductor(t:number,gap:number){ return 1000*Math.exp(gap/(2*k)*(1/(t+273.15)-1/303.15)); } // kΩ, normalized to 1 MΩ at 30 °C
export function diode(u:number){return 0.00005*Math.expm1(u/0.052); } // mA; illustrative Shockley model, no breakdown
export function diodeVoltage(sourceVoltage:number,flipped:boolean){return sourceVoltage*(flipped?-1:1);}
export function rlc(r:number,l:number,c:number,f:number,rl=false){const w=2*Math.PI*f;const x=w*l-(rl?0:1/(w*c));return {z:Math.hypot(r,x),phase:Math.atan2(x,r),x};}
export const bridgeModes=['r1','r2','series','parallel'] as const;
export type BridgeMode=typeof bridgeModes[number];
export const bridgeModeLabel=(mode:string)=>({r1:'R₁',r2:'R₂',series:'Послідовно',parallel:'Паралельно'}[mode]??'Без позначення з’єднання');
export function combineResistances(a:number,b:number,mode:'series'|'parallel'){return mode==='series'?a+b:a*b/(a+b);}
export function bridgeResistance(p:Params,mode:string){const first=p.rx,second=p.rx2??1275;return mode==='r2'?second:mode==='series'||mode==='parallel'?combineResistances(first,second,mode):first;}
export function combinedResistanceError(a:number,b:number,da:number,db:number,mode:'series'|'parallel'){return mode==='series'?da+db:(b*b*da+a*a*db)/((a+b)*(a+b));}
export function balance(id:number,p:Params,mode=''):number{
 if(id===1){const rx=bridgeResistance(p,mode);return 100*rx/(rx+p.r);}
 if(id===2)return p.ex*p.ln/p.en;
 if(id===8)return 100*p.c0/(p.c0+p.cx);
 throw new Error('Цей дослід не має контакту балансування.');
}
export function simulate(id:number,p:Params,mode:string):{metrics:Metric[];measurement:Row;reading?:number;note:string}{
 let metrics:Metric[]=[],measurement:Row={},reading:number|undefined,note='Змінюй параметри установки й спостерігай за приладами.';
 const m=(label:string,value:number,unit:string,detail?:string)=>({label,value,unit,detail});
 if(id===1){const rx=bridgeResistance(p,mode);reading=5*(p.l/100-rx/(p.r+rx));metrics=[m('Опір за формулою',p.r*p.l/(100-p.l),'Ом'),m('Небаланс моста',reading,'В'),m('Положення рівноваги',balance(id,p,mode),'см')];measurement={r:p.r,l1:p.l,l2:100-p.l,dR:p.r*.001,dl1:.1,dL:.1};}
 else if(id===2){reading=p.en*p.lx/p.ln-p.ex;metrics=[m('ЕРС за формулою',p.en*p.lx/p.ln,'В'),m('Небаланс',reading,'В'),m('Контакт рівноваги',balance(id,p),'см')];measurement={en:p.en,ln:p.ln,lx:p.lx};}
 else if(id===3){const rm=metal(p.t,p.r0,p.alpha),rs=semiconductor(p.t,p.gap);metrics=[m('Опір металу',rm,'Ом'),m('Опір напівпровідника',rs,'кОм'),m('Фактична температура',p.t+273.15,'К')];measurement={t:p.t,metal:rm,semi:rs};note='Напівпровідниковий зразок моделі має опір 1 МОм при 30 °C.';}
 else if(id===4){const i=diode(p.u);metrics=[m('Струм через діод',i,'мА'),m('Статичний опір',i===0?NaN:Math.abs(p.u/(i/1000)),'Ом'),m('Полярність',p.u>=0?1:-1,'',p.u>=0?'Пряма':'Зворотна')];measurement={u:p.u,i};note='Модель Шоклі: Iₛ = 0,05 мкА, nUₜ = 0,052 В. Пробій не моделюється.';}
 else if(id===5){metrics=[m('Частота Y',p.f,'Гц'),m('Період Y',1000/p.f,'мс'),m('Співвідношення X:Y',p.f/50,'',`1 : ${format(p.f/50)}`)];measurement=mode==='sensitivity'?{u:p.ux,length:2*Math.SQRT2*p.ux}:{u:p.u/Math.SQRT2,length:2*p.u};note='Чутливість демонстраційної трубки: αₓ = 1 мм/В.';}
 else if(id===6){const v=rlc(p.r,p.l/1000,p.c*1e-6,p.f,mode==='rl');metrics=[m('Повний опір Z',v.z,'Ом'),m('Діючий струм',p.u/v.z,'А'),m('Зсув фаз φ',v.phase*180/Math.PI,'°')];measurement={u:p.u,i:p.u/v.z,r:p.r,f:p.f};}
 else if(id===7){const pf=Math.cos(rad(p.phase)),power=p.u*p.i*pf;metrics=[m('Активна потужність',power,'Вт'),m('Коефіцієнт потужності',pf,''),m('Повна потужність',p.u*p.i,'ВА')];measurement={u:p.u,i:p.i,p:power};}
 else if(id===8){reading=p.l/100-p.c0/(p.c0+p.cx);metrics=[m('Ємність за формулою',p.c0*(100-p.l)/p.l,'мкФ'),m('Небаланс',reading,''),m('Контакт рівноваги',balance(id,p),'см')];measurement={c0:p.c0,l1:p.l,l2:100-p.l};note='Модель використовує ідеальні конденсатори.';}
 return {metrics,measurement,reading,note};
}
function value(row:Row,key:string,positive=false):number{const v=row[key];if(v===null||v===undefined||!Number.isFinite(v))throw new Error('Заповни всі поля числами.');if(positive&&v<=0)throw new Error('Опори, довжини, частоти та модулі показів мають бути більшими за нуль.');return v;}
export function calculateRow(id:number,row:Row,mode=''):Params{
 if(id===1){
  const r=value(row,'r',true),a=value(row,'l1',true),b=value(row,'l2',true),rx=r*a/b;
  const uncertainty=(key:string,fallback:number)=>{const v=row[key]===undefined?fallback:value(row,key);if(v<0)throw new Error('Похибки не можуть бути від’ємними.');return v;};
  const dR=uncertainty('dR',.001*r),dl1=uncertainty('dl1',.1),dL=uncertainty('dL',.1);
  const delta=dR/r+dl1/a+(dL+dl1)/b;
  return {rx,relativeError:100*delta,error:rx*delta};
 }
 if(id===2){const en=value(row,'en',true),a=value(row,'lx',true),b=value(row,'ln',true),ex=en*a/b;return {ex,error:ex*(0.1/a+0.1/b)};}
 if(id===3){const t=value(row,'t');if(t<=-273.15)throw new Error('Температура має бути вище абсолютного нуля.');value(row,'metal',true);const r=value(row,'semi',true);return {T:t+273.15,invT:1/(t+273.15),logR:Math.log(r*1000)};}
 if(id===4){const u=value(row,'u'),i=value(row,'i');if(i===0)throw new Error('При I = 0 статичний опір не визначений.');if(u*i<0)throw new Error('У та I мають мати однаковий знак у прийнятій домовленості.');return {r:Math.abs(u/(i/1000))};}
 if(id===5){const u=value(row,'u',true),l=value(row,'length',true);return {alpha:l/(2*Math.SQRT2*u)};}
 if(id===6){const u=value(row,'u',true),i=value(row,'i',true),r=value(row,'r',true),f=value(row,'f',true),z=u/i;if(mode==='rl'&&z<r)throw new Error('Для RL-кола має виконуватися Z ≥ R.');return {z,l:mode==='rl'?Math.sqrt(z*z-r*r)/(2*Math.PI*f)*1000:NaN};}
 if(id===7){const u=value(row,'u',true),i=value(row,'i',true),p=value(row,'p');if(p<0||p>u*i*(1+1e-10))throw new Error('Має виконуватися 0 ≤ P ≤ UI. Перевір одиниці й покази.');const z=u/i,pf=Math.min(1,p/(u*i)),r=p/(i*i);return {pf,phase:Math.acos(pf)*180/Math.PI,z,r,x:Math.sqrt(Math.max(0,z*z-r*r))};}
 if(id===8){const c=value(row,'c0',true),a=value(row,'l1',true),b=value(row,'l2',true),cx=c*b/a;return {cx,error:cx*(0.1/a+0.1/b)};}
 throw new Error('Невідома робота.');
}
export function fit(xs:number[],ys:number[]){if(xs.length<2||xs.length!==ys.length)throw new Error('Потрібно щонайменше дві точки.');const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;const den=xs.reduce((s,x)=>s+(x-mx)**2,0);if(den===0)throw new Error('Потрібні різні значення температури.');const slope=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/den;return {slope,intercept:my-slope*mx};}
export function thermalFit(rows:Row[]){const valid=rows.filter(r=>{try{calculateRow(3,r);return true;}catch{return false;}});const a=fit(valid.map(r=>r.t!),valid.map(r=>r.metal!));const b=fit(valid.map(r=>1/(r.t!+273.15)),valid.map(r=>Math.log(r.semi!*1000)));if(a.intercept<=0)throw new Error('Апроксимація дає R₀ ≤ 0. Перевір дані.');return {alpha:a.slope/a.intercept,gap:2*k*b.slope,r0:a.intercept};}
export function format(v:number,digits=3):string{if(!Number.isFinite(v))return '—';if(v!==0&&(Math.abs(v)<0.001||Math.abs(v)>=1e7))return v.toExponential(2).replace('.',',');return new Intl.NumberFormat('uk-UA',{maximumFractionDigits:digits}).format(v);}
