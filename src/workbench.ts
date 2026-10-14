import { labs } from './config';
import { simulate, format, metal, semiconductor } from './physics';
import type { Params } from './physics';
import type { Apparatus } from './storage';
import type { ApparatusRenderer } from './apparatus-renderer';

export interface BenchState {id:number;params:Params;mode:string;apparatus:Apparatus;playing:boolean}
export interface Wire {points:[number,number][];color:string;sense?:boolean;only?:'rl'|'rlc';load?:'lamp'|'coil';probe?:'metal'|'semi';cell?:0|1}
const red='#b94d3c',black='#414a46',green='#3a7464';
export const apparatusNames=['Реохордний міст Уітстона','Установка компенсації ЕРС','Мікротермостат із двома зразками','Установка з напівпровідниковим діодом','Осцилограф і генератор сигналів','Послідовне коло RLC','Ватметр і змінні навантаження','Ємнісний міст Сотті'];
export const benchHints=[
 'Увімкни джерело. Перетягни латунний контакт уздовж лінійки та спостерігай за стрілкою гальванометра. Ручка магазину змінює R.',
 'Увімкни джерело. Перемикай еталонний і невідомий елементи, рухай контакт до нульового показу.',
 'Увімкни термостат і нагрівач. Ручкою задай температуру, перемикай щупи між зразками. Перед записом дочекайся теплової рівноваги.',
 'Увімкни джерело. Обертай регулятор напруги та натисни на діод, щоб змінити полярність. Читай покази V і A.',
 'Увімкни осцилограф. Обертай ручки частоти, амплітуди й фази. Перемикач XY показує фігури Ліссажу на екрані приладу.',
 'Увімкни ЛАТР. Обертай його ручку, вилучай конденсатор і вставляй осердя котушки. Спостерігай за амперметром.',
 'Увімкни живлення. Перемикай навантаження між лампами та котушкою, змінюй напругу й порівнюй покази ватметра.',
 'Увімкни джерело AC. Перетягни контакт реохорда до нульового показу. Натисни на досліджуваний конденсатор, щоб замінити його.'
];
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const text=(x:number,y:number,s:string,cls='label',anchor='start')=>`<text x="${x}" y="${y}" class="bench-${cls}" text-anchor="${anchor}">${escape(s)}</text>`;
const plate=(x:number,y:number,w:number,h:number,name:string)=>`<rect x="${x}" y="${y+5}" width="${w}" height="${h}" rx="12" fill="#273830" opacity=".14"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="url(#case)" stroke="#829186" stroke-width="1.4"/>${text(x+15,y+23,name,'instrument')}<circle cx="${x+8}" cy="${y+8}" r="2" fill="#8d9d91"/><circle cx="${x+w-8}" cy="${y+h-8}" r="2" fill="#8d9d91"/>`;
const jack=(x:number,y:number,color:string,interactive=false)=>`<g ${interactive?'role="button" tabindex="0" data-bench-action="connection" aria-label="Під’єднати або від’єднати вимірювальний провід"':''} class="${interactive?'bench-interactive':''}"><circle cx="${x}" cy="${y}" r="13" fill="transparent"/><circle cx="${x}" cy="${y}" r="7" fill="#e6e9d9" stroke="#b4bfac"/><circle cx="${x}" cy="${y}" r="4.7" fill="${color}" stroke="#293e33"/><circle cx="${x}" cy="${y}" r="1.6" fill="#14281d"/></g>`;
function knob(x:number,y:number,key:string,value:number,id:number,label:string,r=22,readoutGap=24){
 const f=labs[id-1].fields.find(f=>f.key===key)!;const fraction=(value-f.min)/(f.max-f.min),angle=-135+fraction*270;
 return `<g class="bench-interactive bench-knob" role="slider" tabindex="0" aria-label="${escape(label)}" aria-valuemin="${f.min}" aria-valuemax="${f.max}" aria-valuenow="${value}" aria-valuetext="${format(value)} ${f.unit}" data-bench-drag="${key}"><circle cx="${x}" cy="${y}" r="${r+11}" fill="transparent"/><path d="M ${x-r-6} ${y+5} A ${r+7} ${r+7} 0 1 1 ${x+r+6} ${y+5}" fill="none" stroke="#a7b5a7" stroke-width="2"/><circle cx="${x}" cy="${y+2}" r="${r}" fill="#667268"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#knob)" stroke="#3f4d43" stroke-width="2"/><path d="M ${x} ${y-r+5} V ${y-5}" stroke="#f4ebbf" stroke-width="3" stroke-linecap="round" transform="rotate(${angle} ${x} ${y})"/>${text(x,y+r+readoutGap,`${format(value)} ${f.unit}`,'value','middle')}</g>`;
}
const button=(x:number,y:number,w:number,label:string,action:string,on=false)=>`<g role="button" tabindex="0" class="bench-interactive" data-bench-action="${action}" aria-label="${escape(label)}" aria-pressed="${on}"><rect x="${x}" y="${y}" width="${w}" height="28" rx="5" fill="${on?'#d9e6b0':'#f3f0df'}" stroke="${on?'#809664':'#a7b3a5'}"/>${text(x+w/2,y+18,label,'button','middle')}</g>`;
function power(x:number,y:number,on:boolean){return `<g role="button" tabindex="0" data-bench-action="power" aria-label="${on?'Вимкнути живлення':'Увімкнути живлення'}" aria-pressed="${on}" class="bench-interactive"><rect x="${x-10}" y="${y-8}" width="85" height="40" rx="5" fill="transparent"/><rect x="${x}" y="${y}" width="29" height="20" rx="3" fill="#313e34" stroke="#6e7d68"/><rect x="${x+3}" y="${on?y+2:y+9}" width="23" height="9" rx="2" fill="${on?'#dbeaa7':'#a8afa0'}"/><circle cx="${x+41}" cy="${y+10}" r="4" fill="${on?'#d7f48b':'#6f7c65'}"/>${text(x+50,y+14,on?'ON':'OFF','small')}</g>`;}
function meter(x:number,y:number,w:number,h:number,label:string,value:number,unit:string,on:boolean,limit:number,center=false){
 const screenHeight=h-62,cx=x+w/2,cy=y+33+screenHeight*.76,r=Math.min((w-24)*.36,screenHeight*.56),normalized=center?Math.max(-1,Math.min(1,value/limit)):Math.max(0,Math.min(1,value/limit))*2-1,angle=normalized*Math.PI*.28;
 let marks='';for(let i=0;i<=10;i++){const a=(-1+i/5)*Math.PI*.28;const xa=cx+Math.sin(a)*(r-7),ya=cy-Math.cos(a)*(r-7),xb=cx+Math.sin(a)*r,yb=cy-Math.cos(a)*r;marks+=`<path d="M ${xa} ${ya} L ${xb} ${yb}" stroke="#73816d" stroke-width="${i%5===0?1.6:.8}"/>`;
  if(i%5===0){const labelValue=center?(i===0?'−'+format(limit):i===5?'0':'+'+format(limit)):format(limit*i/10);marks+=text(cx+Math.sin(a)*(r+12),cy-Math.cos(a)*(r+12)+3,labelValue,'scale','middle');}
 }
 const p=on?angle:center?0:-Math.PI*.28;
 return `${plate(x,y,w,h,label)}<rect x="${x+12}" y="${y+33}" width="${w-24}" height="${h-62}" rx="7" fill="#f9f7df" stroke="#b1bb9e"/><path d="M ${cx-Math.sin(Math.PI*.28)*r} ${cy-Math.cos(Math.PI*.28)*r} A ${r} ${r} 0 0 1 ${cx+Math.sin(Math.PI*.28)*r} ${cy-Math.cos(Math.PI*.28)*r}" fill="none" stroke="#bdc4a7"/>${marks}<path d="M ${cx} ${cy} L ${cx+Math.sin(p)*(r-5)} ${cy-Math.cos(p)*(r-5)}" stroke="#bd6146" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="#344c3e"/>${text(cx,y+h-10,on?`${format(value,4)} ${unit}`:'живлення вимкнене','readout','middle')}${jack(x+w*.25,y+h,red)}${jack(x+w*.75,y+h,black,true)}`;
}
function digital(x:number,y:number,w:number,h:number,label:string,value:number,unit:string,on:boolean){return `${plate(x,y,w,h,label)}<rect x="${x+16}" y="${y+39}" width="${w-32}" height="57" rx="5" fill="#c7d6b0" stroke="#859874"/>${text(x+w-26,y+76,on?format(value,4):'— — —','lcd','end')}${text(x+w-23,y+90,unit,'small','end')}${jack(x+35,y+h,red)}${jack(x+w-35,y+h,black,true)}`;}
function sourceBox(s:BenchState,label='ДЖЕРЕЛО',voltage?:number,key?:string){const p=s.params;return `${plate(27,387,178,119,label)}${text(42,443,`${format(voltage??p.u??5)} V`,'source-reading')}${power(42,471,s.apparatus.power)}${key?knob(159,447,key,p[key],s.id,'Регулятор напруги',17):text(143,487,s.id===8?'50 Hz':'DC','small')}${jack(62,387,red)}${jack(170,387,black)}`;}
const wire=(pts:[number,number][],color=red,sense=false,only?:'rl'|'rlc'):Wire=>({points:pts,color,sense,only});
export function circuitWires(id:number):Wire[]{
 if([1,8].includes(id))return [
  wire([[62,387],[62,315],[110,315]]),
  wire([[170,387],[170,373],[224,373],[224,485],[751,485],[751,315],[690,315]],black),
  wire([[110,315],[110,180]]),
  wire([[190,180],[190,236],[255,236],[255,40],[535,40],[535,236],[595,236],[595,184]]),
  wire([[675,184],[675,250],[690,250],[690,315]],black),
  wire([[445,215],[445,263]],green,true),
  wire([[345,215],[345,236],[255,236]],black,true)
 ];
 if(id===2)return [
  wire([[62,387],[62,315],[110,315]]),
  wire([[170,387],[170,381],[218,381],[218,387],[720,387],[720,315],[690,315]],black),
  {...wire([[170,230],[170,274]],red,true),cell:0},
  {...wire([[597,230],[597,274],[170,274]],red,true),cell:1},
  wire([[170,274],[110,274],[110,315]],red,true),
  {...wire([[100,230],[100,244],[72,244],[72,375],[235,375],[235,456],[310,456]],black,true),cell:0},
  {...wire([[667,230],[667,244],[740,244],[740,412],[480,412],[480,456],[462,456]],black,true),cell:1},
  wire([[340,218],[340,230],[270,230],[270,48],[18,48],[18,518],[385,518],[385,498]],green,true),
  wire([[441,218],[441,258],[508,258],[508,286]],black,true)
 ];
 if(id===3)return [wire([[213,368],[257,368],[257,424],[297,424]],red),{...wire([[595,321],[595,345],[540,345],[540,180],[324,180],[324,198]],green),probe:'metal'},{...wire([[737,321],[737,345],[790,345],[790,94],[359,94],[359,198]],black),probe:'metal'},{...wire([[595,321],[595,345],[540,345],[540,180],[400,180],[400,198]],green),probe:'semi'},{...wire([[737,321],[737,345],[790,345],[790,94],[426,94],[426,198]],black),probe:'semi'}];
 if(id===4)return [wire([[62,387],[62,112],[263,112],[263,218]]),wire([[353,218],[353,325],[363,325]]),wire([[449,325],[663,325],[663,222]],black),wire([[743,222],[765,222],[765,487],[170,487],[170,387]],black),wire([[605,222],[605,282],[449,282],[449,325]],green),wire([[543,222],[543,265],[363,265],[363,325]],black)];
 if(id===5)return [wire([[184,420],[217,420],[217,447],[667,447],[667,391]],green),wire([[184,453],[214,453],[214,487],[699,487],[699,391]],black)];
 if(id===6)return [
  wire([[62,387],[62,245],[263,245],[263,222]]),
  wire([[353,222],[353,263],[145,263],[145,371],[202,371],[202,359]]),
  wire([[282,359],[326,359],[326,319],[352,319]]),
  wire([[462,319],[547,319]],black,false,'rlc'),
  wire([[593,319],[745,319]],black,false,'rlc'),
  wire([[462,319],[490,319],[490,407],[645,407],[645,319],[745,319]],black,false,'rl'),
  wire([[745,319],[745,485],[224,485],[224,380],[170,380],[170,387]],black),
  wire([[353,248],[579.25,248],[579.25,222]],green),
  wire([[681.75,222],[681.75,267],[765,267],[765,319],[745,319]],black)
 ];
 if(id===7)return [wire([[62,387],[62,120],[266,120],[266,223]]),wire([[356,223],[356,250],[228,250],[228,452],[284,452]]),wire([[388,452],[438,452],[438,347],[453,347]]),{...wire([[486,315],[540,315],[540,408],[594,408]]),load:'lamp'},{...wire([[486,339],[557,339],[557,458],[597,458]]),load:'coil'},wire([[700,408],[755,408],[755,486],[170,486],[170,387]],black),wire([[707,458],[755,458]],black),wire([[607,223],[607,261],[438,261],[438,347]],green),wire([[708,223],[740,223],[740,408]],black)];
 return [];
}
function ruler(s:BenchState){const key=s.id===2?'lx':'l',v=s.params[key],x=110+580*v/100,feedY=s.id===2?286:263,feedX=s.id===2?508:445;
 let ticks='';for(let i=0;i<=100;i++){const px=110+i*5.8;ticks+=`<path d="M ${px} 331 v ${i%10===0?14:i%5===0?9:5}" stroke="#817353" stroke-width="${i%10===0?1.3:.6}"/>`;if(i%10===0)ticks+=text(px,363,String(i),'scale','middle');}
 return `<rect x="91" y="292" width="620" height="57" rx="5" fill="#af8152" stroke="#6d543b"/><rect x="102" y="301" width="599" height="43" rx="3" fill="url(#ruler)"/><path d="M 110 315 H 690" stroke="#685d48" stroke-width="2"/>${ticks}${jack(110,315,red)}${jack(690,315,black)}${text(90,s.id===2?285:387,'A','label')}${text(703,s.id===2?285:387,'B','label')}${text(399,s.id===2?426:386,'РЕОХОРД · 100 см','small','middle')}
 <path d="M ${feedX} ${feedY} H ${x} V 297" stroke="${s.apparatus.connected?(s.id===2?black:green):'#9dada1'}" stroke-width="3.2" stroke-dasharray="${s.apparatus.connected?'none':'7 5'}" fill="none"/>
 <g role="slider" tabindex="0" class="bench-interactive" aria-label="Рухомий контакт реохорда" aria-valuemin="1" aria-valuemax="99" aria-valuenow="${v}" data-bench-drag="${key}" data-from="110" data-to="690"><rect x="${x-21}" y="275" width="42" height="79" rx="5" fill="transparent"/><rect x="${x-12}" y="291" width="24" height="51" rx="4" fill="url(#brass)" stroke="#756943"/><circle cx="${x}" cy="304" r="8" fill="#41564b" stroke="#7f957d"/><path d="M ${x-3} 304 h 6" stroke="#d7e1cc" stroke-width="2"/>${text(x,282,'D','small','middle')}</g>
 ${text(256,405,`l₁ = ${format(v)} см`,'label')}${text(540,405,`l₂ = ${format(100-v)} см`,'label')}`;
}
function bridge(s:BenchState){const cap=s.id===8,p=s.params,on=s.apparatus.power&&s.apparatus.connected;let left:string,right:string;
 if(cap){
  left=`${plate(65,76,170,104,'КОНДЕНСАТОР Cₓ')}${capacitor(92,120,p.cx,true)}${button(82,140,135,'Замінити Cₓ','sample')}${jack(110,180,red)}${jack(190,180,black)}`;
  right=`${plate(550,60,178,124,'ЕТАЛОН C₀')}${knob(638,129,'c0',p.c0,s.id,'Ємність еталонного конденсатора',18)}${jack(595,184,red)}${jack(675,184,black)}`;
 }else{
  left=`${plate(65,76,170,104,'ДОСЛІДЖУВАНИЙ Rₓ')}<path d="M 90 121 h 10 l 5 -8 8 16 8 -16 8 16 8 -16 8 16 5 -8 h 14" stroke="#7f6144" stroke-width="3" fill="none"/>${button(80,141,140,'Замінити зразок','sample')}${jack(110,180,red)}${jack(190,180,black)}`;
  right=`${plate(550,53,178,131,'МАГАЗИН ОПОРІВ')}${knob(638,117,'r',p.r,s.id,'Опір магазину',25)}${jack(595,184,red)}${jack(675,184,black)}`;
 }
 const residual=simulate(s.id,p,s.mode).reading!;const reading=cap?residual*12.6:residual*1e6/(4100+p.r*p.rx/(p.r+p.rx)+102*(p.l/100)*(1-p.l/100));
 return `${left}${right}<circle cx="255" cy="236" r="4" fill="${s.apparatus.connected?red:'#9dada1'}"/>${meter(295,60,200,155,cap?'НУЛЬОВИЙ ВОЛЬТМЕТР':'ГАЛЬВАНОМЕТР G',reading,cap?'В':'мкА',on,cap?6.3:500,true)}${ruler(s)}${sourceBox(s,cap?'ДЖЕРЕЛО AC':'ДЖЕРЕЛО DC',cap?12.6:5)}${text(405,451,'Струм діагоналі зникає при нулі.','small')}${text(405,471,'Потягни контакт D уздовж лінійки.','small')}`;
}
const capacitor=(x:number,y:number,c:number,compact=false)=>`<path d="M ${x} ${y} h 18 m 0 -12 v 24 m 8 -24 v 24 m 0 -12 h 18" stroke="#4f6860" stroke-width="3" fill="none"/>${text(compact?x+79:x+22,compact?y+5:y+30,`${format(c)} мкФ`,'small','middle')}`;
function compensation(s:BenchState){const p=s.params,on=s.apparatus.power&&s.apparatus.connected,reading=p.en*p.lx/p.ln-(s.apparatus.selected===0?p.en:p.ex);
 const cell=(x:number,name:string,v:number,selected:boolean)=>`${plate(x,75,140,155,name)}<rect x="${x+44}" y="109" width="51" height="42" rx="5" fill="${selected?'#789975':'#a4ac91'}" stroke="#506851"/><rect x="${x+59}" y="102" width="20" height="7" rx="2" fill="#596c53"/>${text(x+69,140,'+','cell','middle')}${text(x+69,175,`${format(v)} В`,'readout','middle')}${button(x+9,187,122,selected?'Підключений':'Обрати',name.includes('ЕТАЛОН')?'cell-normal':'cell-unknown',selected)}${jack(x+35,230,x===65?black:red)}${jack(x+105,230,x===65?red:black)}`;
 return `${cell(65,'ЕТАЛОН ℰₙ',p.en,s.apparatus.selected===0)}${cell(562,'НЕВІДОМИЙ ℰₓ',p.ex,s.apparatus.selected===1)}${meter(289,59,203,159,'НУЛЬОВИЙ ІНДИКАТОР',reading,'В',on,1,true)}${ruler(s)}${sourceBox(s,'ДОПОМІЖНЕ DC',3)}${plate(558,421,174,84,'РОБОЧИЙ СТРУМ')}${knob(670,472,'ln',p.ln,2,'Калібрування робочого струму',15,14)}${text(573,469,'lₙ','label')}<g role="button" tabindex="0" data-bench-action="cell-toggle" aria-label="Перемкнути еталонний і невідомий елементи" class="bench-interactive"><rect x="310" y="437" width="152" height="61" rx="7" fill="#ded8b7" stroke="#a59b7a"/><circle cx="330" cy="456" r="5" fill="#756d4a"/><circle cx="438" cy="456" r="5" fill="#756d4a"/><path d="M 310 456 h 20 M 462 456 h -24 M 385 478 v 20" fill="none" stroke="#6f6543" stroke-width="3"/>${jack(310,456,black)}${jack(462,456,black)}${jack(385,498,green)}<path d="M 385 478 L ${s.apparatus.selected===0?'330 456':'438 456'}" stroke="#947246" stroke-width="5" stroke-linecap="round"/><circle cx="385" cy="478" r="5" fill="#6f6543"/>${text(328,490,'ℰₙ','small','middle')}${text(440,490,'ℰₓ','small','middle')}</g>`;
}
function thermostat(s:BenchState){const a=s.apparatus,p=s.params,t=a.temperature,on=a.power&&a.connected,value=a.probe==='metal'?metal(t,p.r0,p.alpha):semiconductor(t,p.gap);
 const coil=Array.from({length:10},(_,i)=>`<ellipse cx="342" cy="${276+i*9}" rx="17" ry="6" fill="none" stroke="#b97442" stroke-width="2"/>`).join('');
 return `${plate(44,170,171,222,'ТЕРМОСТАТ')}${text(127,208,'ЦІЛЬОВА t','small','middle')}${knob(127,259,'t',p.t,3,'Температура водяної ванни',31)}${power(60,365,a.power)}${button(61,324,134,a.heating?'Нагрівач ON':'Нагрівач OFF','heat',a.heating)}
 <rect x="260" y="207" width="253" height="245" rx="16" fill="#a6b9b1" stroke="#607e70" stroke-width="2"/><rect x="271" y="221" width="231" height="217" rx="10" fill="url(#water)"/><path d="M 279 246 Q 315 237 345 246 T 414 246 T 491 246" fill="none" stroke="#e8faf1" stroke-width="2"/>
 <rect x="305" y="193" width="153" height="24" rx="5" fill="#728d7c"/>
 <g data-bench-action="probe-metal" role="button" tabindex="0" aria-label="Обрати металевий зразок" class="bench-interactive"><rect x="316" y="192" width="51" height="193" rx="20" fill="#e4f2db" fill-opacity=".55" stroke="${a.probe==='metal'?'#b78048':'#a0b7a1'}" stroke-width="3"/>${coil}${text(342,398,'Cu','label','middle')}</g>
 <g data-bench-action="probe-semi" role="button" tabindex="0" aria-label="Обрати напівпровідник" class="bench-interactive"><rect x="388" y="193" width="50" height="193" rx="20" fill="#e4f2db" fill-opacity=".55" stroke="${a.probe==='semi'?'#3f7564':'#a0b7a1'}" stroke-width="3"/><path d="M 413 214 v 101" stroke="#536158" stroke-width="2"/><rect x="405" y="307" width="16" height="33" rx="4" fill="#4e5144"/>${text(414,398,'Si','label','middle')}</g>
 <rect x="469" y="160" width="16" height="221" rx="8" fill="#f0ecd2" stroke="#9d9d82"/><rect x="475" y="${356-(t-25)*2.5}" width="4" height="${20+(t-25)*2.5}" rx="2" fill="#c45c48"/><circle cx="477" cy="382" r="11" fill="#c45c48" stroke="#8f5f4a"/>
 ${Array.from({length:6},(_,i)=>`<path d="M 470 ${351-i*25} h 9" stroke="#8d967d"/>${text(490,355-i*25,String(30+i*10),'scale')}`).join('')}
 <path d="M 297 420 q 12 -13 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0" fill="none" stroke="${a.power&&a.heating?'#cf7c41':'#7a8980'}" stroke-width="7" stroke-linecap="round"/>
 ${digital(560,114,212,207,'ОММЕТР',value,a.probe==='metal'?'Ω':'kΩ',on)}${button(579,231,76,'Метал','probe-metal',a.probe==='metal')}${button(668,231,85,'Напівпр.','probe-semi',a.probe==='semi')}${text(382,477,`Фактична t: ${format(t,1)} °C`,'readout','middle')}${text(382,503,Math.abs(t-p.t)<.5?'Теплова рівновага':'Зразки змінюють температуру','small','middle')}`;
}
function diodeBench(s:BenchState){const p=s.params,on=s.apparatus.power&&s.apparatus.connected,reverse=p.u<0,i=simulate(4,p,s.mode).metrics[0].value;
 return `${sourceBox(s,'РЕГУЛЬОВАНЕ DC',Math.abs(p.u),'u')}${meter(218,61,180,157,reverse?'МІКРОАМПЕРМЕТР':'МІЛІАМПЕРМЕТР',Math.abs(i)*(reverse?1000:1),reverse?'мкА':'мА',on,reverse?10:15)}${digital(508,64,235,158,'ВОЛЬТМЕТР V',p.u,'V',on)}
 ${plate(278,286,258,84,'ДОСЛІДЖУВАНИЙ ДІОД')}<g role="button" tabindex="0" data-bench-action="polarity" aria-label="Змінити полярність діода" class="bench-interactive"><rect x="342" y="308" width="137" height="39" rx="6" fill="transparent"/><path d="M 345 325 h 139" stroke="#8d9481" stroke-width="3"/><rect x="371" y="311" width="66" height="28" rx="7" fill="#45574b" stroke="#243d2e"/><rect x="${reverse?380:421}" y="312" width="7" height="26" fill="#dfe5c6"/>${text(404,360,reverse?'Зворотне зміщення':'Пряме зміщення','small','middle')}</g>
 ${jack(363,325,red)}${jack(449,325,black)}${text(609,386,'Натисни на діод','label')}${text(609,407,'для зміни полярності.','small')}${text(245,463,'Ручка джерела регулює напругу.','small')}`;
}
function scopeBench(s:BenchState){const p=s.params,a=s.apparatus;
 const grid=Array.from({length:11},(_,i)=>`<path d="M ${240+i*24} 145 V 335" stroke="#3c6948" stroke-width=".7"/>`).join('')+Array.from({length:9},(_,i)=>`<path d="M 240 ${145+i*23.75} H 480" stroke="#3c6948" stroke-width=".7"/>`).join('');
 return `${plate(209,76,568,325,'ЕЛЕКТРОННИЙ ОСЦИЛОГРАФ С 1-1')}<rect x="229" y="133" width="262" height="217" rx="18" fill="#526657" stroke="#93a181" stroke-width="3"/><rect x="239" y="143" width="242" height="193" rx="12" fill="url(#screen)"/>${grid}${text(254,159,a.power?s.mode==='xy'?'XY':'Y(t)':'OFF','crt')}${text(460,325,'0','crt','end')}
 ${text(538,124,'АМПЛІТУДА','small','middle')}${knob(538,171,'u',p.u,5,'Амплітуда сигналу',24)}${text(652,124,'ФАЗА','small','middle')}${knob(652,171,'phase',p.phase,5,'Фаза сигналу',24)}
 ${button(516,256,84,'Розгортка','scope',s.mode==='scope')}${button(616,256,84,'XY','xy',s.mode==='xy')}${button(516,292,184,'Чутливість','sensitivity',s.mode==='sensitivity')}${power(518,355,a.power)}${jack(667,391,green,true)}${jack(699,391,black)}${text(723,379,'Y / X','small')}
 ${plate(25,298,160,186,'ГЕНЕРАТОР ГЗ-33')}${knob(99,370,'f',p.f,5,'Частота звукового генератора',31)}${text(100,439,'50 … 200 Гц','small','middle')}${jack(184,420,green)}${jack(184,453,black)}`;
}
function coil(x:number,y:number,core:boolean){let turns='';for(let i=0;i<11;i++)turns+=`<ellipse cx="${x+16+i*7}" cy="${y}" rx="10" ry="25" fill="none" stroke="${i%2?'#b1774b':'#94613d'}" stroke-width="3"/>`;
 return `<g role="button" tabindex="0" data-bench-action="core" aria-label="${core?'Вийняти осердя':'Вставити осердя'}" class="bench-interactive"><rect x="${x-7}" y="${y-34}" width="126" height="68" rx="8" fill="transparent"/>${core?`<rect x="${x-7}" y="${y-12}" width="123" height="24" rx="5" fill="url(#metal)" stroke="#59695d"/>`:''}${turns}<path d="M ${x} ${y} h 9 m 92 0 h 9" stroke="#6f6551" stroke-width="3"/>${text(x+56,y+48,core?'Осердя вставлене':'Вставити осердя','small','middle')}</g>`;
}
function acBench(s:BenchState){const p=s.params,on=s.apparatus.power&&s.apparatus.connected,m=simulate(6,p,s.mode).metrics;
 return `<circle cx="353" cy="248" r="4" fill="${red}"/><circle cx="745" cy="319" r="4" fill="${black}"/>${sourceBox(s,'ЛАТР · 50 Hz',p.u,'u')}${meter(218,60,180,162,'АМПЕРМЕТР A',m[1].value,'А',on,Math.max(.5,m[1].value*1.1))}${meter(528,60,205,162,'ВОЛЬТМЕТР V',p.u,'В',on,100)}
 ${plate(168,270,143,89,'РЕОСТАТ R')}${knob(238,324,'r',p.r,6,'Активний опір',17,14)}${jack(202,359,red)}${jack(282,359,black)}${coil(352,319,s.apparatus.core)}
 <g role="button" tabindex="0" data-bench-action="capacitor" aria-label="${s.mode==='rl'?'Підключити конденсатор':'Вилучити конденсатор'}" class="bench-interactive"><rect x="522" y="279" width="96" height="80" rx="9" fill="${s.mode==='rl'?'#dedfce':'#c2d0b4'}" stroke="#88977c" stroke-dasharray="${s.mode==='rl'?'5 4':'none'}"/>${text(570,297,'C','label','middle')}${capacitor(547,319,p.c)}${text(570,380,s.mode==='rl'?'Натисни: додати C':'Натисни: вилучити C','small','middle')}</g>${text(352,453,'L = '+format(p.l)+' мГн','label')}${text(352,478,s.mode==='rl'?'Замкнене RL-коло':'Послідовне RLC-коло','small')}`;
}
function powerBench(s:BenchState){const p=s.params,a=s.apparatus,on=a.power&&a.connected,watts=simulate(7,p,s.mode).metrics[0].value;
 const glow=on&&a.selected===0;
 const lamp=(x:number)=>`<g><circle cx="${x}" cy="360" r="43" fill="${glow?'#f3ca67':'#cfdbbf'}" opacity="${glow?Math.max(.08,Math.min(.6,watts/35)):.1}"/><path d="M ${x-17} 368 C ${x-58} 306 ${x+58} 306 ${x+17} 368 v 14 h -34 Z" fill="${glow?'url(#bulb)':'#e1e4cf'}" stroke="#9b9f7f" stroke-width="2"/><path d="M ${x-10} 367 l 3 -16 7 10 7 -10 3 16" fill="none" stroke="${glow?'#fff3c0':'#8d8c70'}" stroke-width="2"/><rect x="${x-18}" y="380" width="36" height="22" rx="3" fill="url(#metal)" stroke="#6f7d6d"/><path d="M ${x-17} 385 h 34 m -34 6 h 34" stroke="#738575"/><rect x="${x-26}" y="402" width="52" height="13" rx="4" fill="#5b6c55"/></g>`;
 return `${sourceBox(s,'ЛАТР · 50 Hz',p.u,'u')}${meter(220,59,181,164,'ВАТМЕТР W',watts,'Вт',on,Math.max(30,p.u*p.i))}${digital(571,63,172,160,'ВОЛЬТМЕТР',p.u,'В',on)}${digital(249,299,174,153,'АМПЕРМЕТР',p.i,'A',on)}
 <g role="button" tabindex="0" data-bench-action="load" aria-label="Перемкнути навантаження" class="bench-interactive"><rect x="440" y="302" width="64" height="61" rx="5" fill="#dfd7b5" stroke="#a49b7b"/><circle cx="453" cy="347" r="5" fill="#665d45"/><path d="M 453 347 L ${a.selected===0?'486 315':'486 339'}" stroke="#916a39" stroke-width="5" stroke-linecap="round"/>${text(513,318,'Лампи','small')}${text(513,343,'Котушка','small')}</g>${lamp(618)}${lamp(698)}${coil(597,458,a.core)}${text(300,478,`P = ${on?format(watts):'—'} Вт`,'readout')}`;
}
function draw(s:BenchState){const a=s.apparatus,wires=circuitWires(s.id).filter(w=>(!w.only||w.only===s.mode)&&(!w.probe||w.probe===a.probe));
 const wireMarkup=wires.map(w=>`<polyline points="${w.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#243e2b" stroke-opacity=".12" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 2)"/><polyline points="${w.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${a.connected?w.color:'#9dada1'}" stroke-width="3.2" stroke-dasharray="${a.connected?'none':'7 5'}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 const content=[bridge,compensation,thermostat,diodeBench,scopeBench,acBench,powerBench,bridge][s.id-1](s);
 return `<defs><linearGradient id="case" x2="0" y2="1"><stop stop-color="#f1f0e1"/><stop offset="1" stop-color="#d7dfc9"/></linearGradient><linearGradient id="knob" x2="1" y2="1"><stop stop-color="#727b70"/><stop offset=".4" stop-color="#48594a"/><stop offset="1" stop-color="#2d4335"/></linearGradient><linearGradient id="brass" x2="1"><stop stop-color="#a68843"/><stop offset=".5" stop-color="#e7cb7c"/><stop offset="1" stop-color="#ac8d47"/></linearGradient><linearGradient id="ruler" x2="0" y2="1"><stop stop-color="#efdfb3"/><stop offset="1" stop-color="#dbbd82"/></linearGradient><linearGradient id="metal" x2="0" y2="1"><stop stop-color="#a9b8ab"/><stop offset=".4" stop-color="#e1e8d9"/><stop offset="1" stop-color="#657a6a"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="#acdbcb"/><stop offset="1" stop-color="#6fbaa6"/></linearGradient><radialGradient id="screen"><stop stop-color="#224733"/><stop offset="1" stop-color="#122e21"/></radialGradient><radialGradient id="bulb"><stop stop-color="#fffbe0"/><stop offset=".5" stop-color="#f8d16e"/><stop offset="1" stop-color="#dfae50"/></radialGradient></defs>
 <rect width="800" height="540" rx="14" fill="#e7ebe0"/><path d="M 0 523 H 800" stroke="#c6d1c0"/>
 ${wireMarkup}${s.id===2?`<g aria-hidden="true"><circle cx="72" cy="315" r="5.5" fill="#e7ebe0"/><path d="M 72 307 v 16" fill="none" stroke="${a.connected?black:'#9dada1'}" stroke-width="3.2"/><circle cx="508" cy="274" r="5.5" fill="#e7ebe0"/><path d="M 508 268 v 18" fill="none" stroke="${a.connected?black:'#9dada1'}" stroke-width="3.2"/><circle cx="170" cy="274" r="4" fill="${a.connected?red:'#9dada1'}"/></g>`:''}${content}${text(774,535,'Потягни ручки · натисни перемикачі','small','end')}`;
}
export class Workbench {
 private svg:SVGSVGElement;private renderer?:ApparatusRenderer;private dead=false;private state:BenchState;private tick=0;private last=0;
 private drag?:{key:string;startX:number;startY:number;value:number;from?:number;to?:number};
 constructor(private host:HTMLElement,state:BenchState,private change:(key:string,value:number)=>void,private action:(action:string)=>void,private warmed:(t:number)=>void,private backend:(name:string)=>void){
  this.state=state;this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');this.svg.setAttribute('viewBox','0 0 800 540');this.svg.setAttribute('aria-label',apparatusNames[state.id-1]);this.svg.classList.add('bench-svg');host.append(this.svg);this.set(state);
  host.addEventListener('pointerdown',this.pointerDown);host.addEventListener('pointermove',this.pointerMove);host.addEventListener('pointerup',this.pointerUp);host.addEventListener('pointercancel',this.pointerUp);host.addEventListener('click',this.click);host.addEventListener('keydown',this.keydown);
  void import('./apparatus-renderer').then(({ApparatusRenderer})=>{if(this.dead)return;this.renderer=new ApparatusRenderer(host,this.state,this.backend);void this.renderer.init();});
  this.tick=requestAnimationFrame(this.animate);
 }
 set(state:BenchState){this.state=state;this.svg.innerHTML=draw(state);this.renderer?.set(state);}
 private coords=(event:PointerEvent)=>new DOMPoint(event.clientX,event.clientY).matrixTransform(this.svg.getScreenCTM()!.inverse());
 private pointerDown=(event:PointerEvent)=>{const target=(event.target as Element).closest<SVGElement>('[data-bench-drag]');if(!target)return;event.preventDefault();const p=this.coords(event);this.drag={key:target.dataset.benchDrag!,startX:p.x,startY:p.y,value:this.state.params[target.dataset.benchDrag!],...(target.dataset.from?{from:Number(target.dataset.from),to:Number(target.dataset.to)}:{})};this.host.setPointerCapture(event.pointerId);};
 private pointerMove=(event:PointerEvent)=>{if(!this.drag)return;const f=labs[this.state.id-1].fields.find(f=>f.key===this.drag!.key)!;const p=this.coords(event);const value=this.drag.from!==undefined?(p.x-this.drag.from)/(this.drag.to!-this.drag.from)*100:this.drag.value+(p.x-this.drag.startX+this.drag.startY-p.y)*(f.max-f.min)/240;this.change(f.key,Math.max(f.min,Math.min(f.max,Number((Math.round(value/f.step)*f.step).toFixed(6)))));};
 private pointerUp=(event:PointerEvent)=>{this.drag=undefined;if(this.host.hasPointerCapture(event.pointerId))this.host.releasePointerCapture(event.pointerId);};
 private click=(event:MouseEvent)=>{const target=(event.target as Element).closest<SVGElement>('[data-bench-action]');if(target){if(target.dataset.benchAction==='probe'){this.action((target.getAttribute('aria-label')??'').includes('метал')?'probe-metal':'probe-semi');}else this.action(target.dataset.benchAction!);}};
 private keydown=(event:KeyboardEvent)=>{const target=(event.target as Element).closest<SVGElement>('[data-bench-drag],[data-bench-action]');if(!target)return;if(target.dataset.benchAction&&['Enter',' '].includes(event.key)){event.preventDefault();this.action(target.dataset.benchAction);const action=target.dataset.benchAction;requestAnimationFrame(()=>this.svg.querySelector<SVGElement>(`[data-bench-action="${action}"]`)?.focus());return;}const key=target.dataset.benchDrag;if(key&&['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const f=labs[this.state.id-1].fields.find(f=>f.key===key)!;const value=event.key==='Home'?f.min:event.key==='End'?f.max:this.state.params[key]+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)*f.step;this.change(key,Math.min(f.max,Math.max(f.min,value)));requestAnimationFrame(()=>this.svg.querySelector<SVGElement>(`[data-bench-drag="${key}"]`)?.focus());}};
 private animate=(now:number)=>{if(this.dead)return;const dt=this.last?Math.min(.3,(now-this.last)/1000):0;const a=this.state.apparatus;if(this.state.id===3&&a.power&&a.heating&&this.state.playing&&document.visibilityState==='visible'&&now-this.last>150){const target=this.state.params.t,diff=target-a.temperature;if(Math.abs(diff)>.03)this.warmed(Math.abs(diff)<.15?target:a.temperature+Math.sign(diff)*Math.min(Math.abs(diff),dt*7));this.last=now;}else if(now-this.last>150)this.last=now;this.tick=requestAnimationFrame(this.animate);};
 dispose(){this.dead=true;cancelAnimationFrame(this.tick);this.renderer?.dispose();for(const [name,fn]of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['click',this.click],['keydown',this.keydown]]as const)this.host.removeEventListener(name,fn as EventListener);this.svg.remove();}
}
