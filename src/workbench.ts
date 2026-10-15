import { labs, equipmentLimits, limitNote, generatorRange } from './config';
import { simulate, format, metal, semiconductor, diodeVoltage, bridgeResistance, bridgeModeLabel } from './physics';
import type { Params } from './physics';
import type { Apparatus } from './storage';
import type { ApparatusRenderer } from './apparatus-renderer';
import { scopeScale } from './scope';

export interface BenchState {id:number;params:Params;mode:string;apparatus:Apparatus;playing:boolean}
export interface Wire {points:[number,number][];color:string;sense?:boolean;flow?:-1|0|1;only?:'rl'|'rlc';load?:'lamp'|'coil';probe?:'metal'|'semi';cell?:0|1}
const red='#b94d3c',black='#414a46',green='#3a7464';
export const apparatusNames=['Реохордний міст Уітстона','Установка компенсації ЕРС','Мікротермостат із двома зразками','Установка з напівпровідниковим діодом','Осцилограф і генератор сигналів','Послідовне коло RLC','Ватметр і змінні навантаження','Ємнісний міст Сотті'];
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const text=(x:number,y:number,s:string,cls='label',anchor='start')=>`<text x="${x}" y="${y}" class="bench-${cls}" text-anchor="${anchor}">${escape(s)}</text>`;
const plate=(x:number,y:number,w:number,h:number,name:string)=>`<rect x="${x}" y="${y+5}" width="${w}" height="${h}" rx="12" fill="#273830" opacity=".14"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="url(#case)" stroke="#829186" stroke-width="1.4"/>${text(x+15,y+23,name,'instrument')}<circle cx="${x+8}" cy="${y+8}" r="2" fill="#8d9d91"/><circle cx="${x+w-8}" cy="${y+h-8}" r="2" fill="#8d9d91"/>`;
const jack=(x:number,y:number,color:string,interactive=false)=>`<g ${interactive?'role="button" tabindex="0" data-bench-action="connection" aria-label="Під’єднати або від’єднати вимірювальний провід"':''} class="${interactive?'bench-interactive':''}"><circle cx="${x}" cy="${y}" r="13" fill="transparent"/><circle cx="${x}" cy="${y}" r="7" fill="#e6e9d9" stroke="#b4bfac"/><circle cx="${x}" cy="${y}" r="4.7" fill="${color}" stroke="#293e33"/><circle cx="${x}" cy="${y}" r="1.6" fill="#14281d"/></g>`;
function knob(x:number,y:number,key:string,value:number,id:number,label:string,r=22,readoutGap=24,buttonsBelow=false){
 const f=labs[id-1].fields.find(f=>f.key===key)!;const fraction=(value-f.min)/(f.max-f.min),angle=-135+fraction*270;
 const radius=r+7,endpoint=radius/Math.sqrt(2);
 const intervals=f.discrete?Math.round((f.max-f.min)/f.step):4;
 const ticks=Array.from({length:intervals+1},(_,i)=>{const a=(-135+i*270/intervals)*Math.PI/180,end=i===0||i===intervals;return `<path d="M ${x+Math.sin(a)*radius} ${y-Math.cos(a)*radius} L ${x+Math.sin(a)*(radius+(end?5:3))} ${y-Math.cos(a)*(radius+(end?5:3))}" stroke="${end?'#6c806c':'#a7b5a7'}" stroke-width="${end?1.6:1}"/>`;}).join('');
 const stepButtons=([-1,1] as const).map(direction=>{
  const disabled=direction<0?value<=f.min:value>=f.max;
  const bx=x+direction*(buttonsBelow?17:r+23),by=buttonsBelow?y+r+readoutGap+26:y-3;
  const description=`${direction<0?'Зменшити':'Збільшити'} ${label.toLocaleLowerCase('uk-UA')} на ${format(f.step)} ${f.unit}`;
  return `<g role="button" tabindex="${disabled?-1:0}" class="bench-interactive${disabled?' bench-disabled':''}" data-bench-step="${key}" data-direction="${direction}" aria-disabled="${disabled}" aria-label="${escape(description)}"><title>${escape(description)}</title><rect x="${bx-12}" y="${by-12}" width="24" height="24" rx="5" fill="#f3f0df" stroke="#a7b3a5"/>${text(bx,by+5,direction<0?'−':'+','button','middle')}</g>`;
 }).join('');
 return `<g class="bench-interactive bench-knob" role="slider" tabindex="0" aria-label="${escape(label)}" aria-valuemin="${f.min}" aria-valuemax="${f.max}" aria-valuenow="${value}" aria-valuetext="${format(value)} ${f.unit}" data-bench-drag="${key}"><title>${escape(limitNote(id,key))}</title><circle cx="${x}" cy="${y}" r="${r+11}" fill="transparent"/><path d="M ${x-endpoint} ${y+endpoint} A ${radius} ${radius} 0 1 1 ${x+endpoint} ${y+endpoint}" fill="none" stroke="#a7b5a7" stroke-width="2"/>${ticks}${text(x-r-6,y+endpoint+1,format(f.min),'knob-limit','end')}${text(x+r+6,y+endpoint+1,format(f.max),'knob-limit')}<circle cx="${x}" cy="${y+2}" r="${r}" fill="#667268"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#knob)" stroke="#3f4d43" stroke-width="2"/><path d="M ${x} ${y-r+5} V ${y-5}" stroke="#f4ebbf" stroke-width="3" stroke-linecap="round" transform="rotate(${angle} ${x} ${y})"/>${text(x,y+r+readoutGap,`${format(value)} ${f.unit}`,'value','middle')}</g><g class="bench-knob-controls">${stepButtons}</g>`;
}
const button=(x:number,y:number,w:number,label:string,action:string,on=false,height=28)=>`<g role="button" tabindex="0" class="bench-interactive" data-bench-action="${action}" aria-label="${escape(label)}" aria-pressed="${on}"><rect x="${x}" y="${y}" width="${w}" height="${height}" rx="5" fill="${on?'#d9e6b0':'#f3f0df'}" stroke="${on?'#809664':'#a7b3a5'}"/>${text(x+w/2,y+(height+8)/2,label,'button','middle')}</g>`;
function power(x:number,y:number,on:boolean){return `<g role="button" tabindex="0" data-bench-action="power" aria-label="${on?'Вимкнути живлення':'Увімкнути живлення'}" aria-pressed="${on}" class="bench-interactive"><rect x="${x-10}" y="${y-8}" width="85" height="40" rx="5" fill="transparent"/><rect x="${x}" y="${y}" width="29" height="20" rx="3" fill="#313e34" stroke="#6e7d68"/><rect x="${x+3}" y="${on?y+2:y+9}" width="23" height="9" rx="2" fill="${on?'#dbeaa7':'#a8afa0'}"/><circle cx="${x+41}" cy="${y+10}" r="4" fill="${on?'#d7f48b':'#6f7c65'}"/>${text(x+50,y+14,on?'ON':'OFF','small')}</g>`;}
function meter(x:number,y:number,w:number,h:number,label:string,value:number,unit:string,on:boolean,limit:number,center=false,readoutStep=0){
 const screenHeight=h-62,cx=x+w/2,cy=y+33+screenHeight*.76,r=Math.min((w-24)*.36,screenHeight*.56),normalized=center?Math.max(-1,Math.min(1,value/limit)):Math.max(0,Math.min(1,value/limit))*2-1,angle=normalized*Math.PI*.28;
 let marks='';for(let i=0;i<=10;i++){const a=(-1+i/5)*Math.PI*.28;const xa=cx+Math.sin(a)*(r-7),ya=cy-Math.cos(a)*(r-7),xb=cx+Math.sin(a)*r,yb=cy-Math.cos(a)*r;marks+=`<path d="M ${xa} ${ya} L ${xb} ${yb}" stroke="#73816d" stroke-width="${i%5===0?1.6:.8}"/>`;
  if(i%5===0){const labelValue=center?(i===0?'−'+format(limit):i===5?'0':'+'+format(limit)):format(limit*i/10);marks+=text(cx+Math.sin(a)*(r+12),cy-Math.cos(a)*(r+12)+3,labelValue,'scale','middle');}
 }
 const p=on?angle:center?0:-Math.PI*.28,lowerLimit=center?-limit:0,overrange=on&&(value<lowerLimit||value>limit);
 const displayedValue=readoutStep?(Math.round(value/readoutStep)*readoutStep||0):value;
 const readout=!on?'живлення вимкнене':overrange?`${value<lowerLimit?'<':'>'} ${format(value<lowerLimit?lowerLimit:limit).replace('-','−')} ${unit}`:`${format(displayedValue,4)} ${unit}`;
 return `<g class="bench-meter" aria-label="${escape(label)}">${plate(x,y,w,h,label)}<rect x="${x+12}" y="${y+33}" width="${w-24}" height="${h-62}" rx="7" fill="#f9f7df" stroke="#b1bb9e"/><path d="M ${cx-Math.sin(Math.PI*.28)*r} ${cy-Math.cos(Math.PI*.28)*r} A ${r} ${r} 0 0 1 ${cx+Math.sin(Math.PI*.28)*r} ${cy-Math.cos(Math.PI*.28)*r}" fill="none" stroke="#bdc4a7"/>${marks}<path d="M ${cx} ${cy} L ${cx+Math.sin(p)*(r-5)} ${cy-Math.cos(p)*(r-5)}" stroke="#bd6146" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="#344c3e"/>${overrange?text(cx,y+h-35,'Поза шкалою','overrange','middle'):''}${text(cx,y+h-10,readout,'readout','middle')}${jack(x+w*.25,y+h,red)}${jack(x+w*.75,y+h,black,true)}</g>`;
}
function digital(x:number,y:number,w:number,h:number,label:string,value:number,unit:string,on:boolean,limit=Infinity){
 const overrange=on&&Math.abs(value)>limit,readout=!on?'— — —':overrange?`${value<0?'< −':'> '}${format(limit)}`:format(value,4);
 return `<g class="bench-digital" aria-label="${escape(label)}">${plate(x,y,w,h,label)}<rect x="${x+16}" y="${y+39}" width="${w-32}" height="57" rx="5" fill="#c7d6b0" stroke="#859874"/>${text(x+w-26,y+76,readout,'lcd','end')}${text(x+w-23,y+90,unit,'small','end')}${overrange?text(x+w/2,y+125,'Поза шкалою','overrange','middle'):''}${jack(x+35,y+h,red)}${jack(x+w-35,y+h,black,true)}</g>`;
}
function sourceBox(s:BenchState,label='ДЖЕРЕЛО',voltage?:number,key?:string){const p=s.params;return `${plate(27,387,178,key?142:119,label)}${text(42,443,`${format(voltage??p.u??5)} V`,'source-reading')}${power(42,471,s.apparatus.power)}${key?knob(159,447,key,p[key],s.id,'Регулятор напруги',17,24,true):text(143,487,s.id===8?'50 Hz':'DC','small')}${jack(62,387,red)}${jack(170,387,black)}`;}
const wire=(pts:[number,number][],color=red,sense=false,only?:'rl'|'rlc'):Wire=>({points:pts,color,sense,only});
export function circuitWires(id:number):Wire[]{
 if([1,8].includes(id))return [
  wire([[62,387],[62,315],[110,315]]),
  {...wire([[170,387],[170,373],[224,373],[224,485],[751,485],[751,315],[690,315]],black),flow:-1},
  wire([[110,315],[110,180]]),
  wire([[190,180],[190,236],[255,236],[255,40],[535,40],[535,236],[595,236],[595,184]]),
  wire([[675,184],[675,250],[690,250],[690,315]],black),
  {...wire([[445,215],[445,263]],green,true),flow:-1},
  wire([[345,215],[345,236],[255,236]],black,true)
 ];
 if(id===2)return [
  wire([[62,387],[62,315],[110,315]]),
  {...wire([[170,387],[170,373],[224,373],[224,505],[785,505],[785,222],[735,222],[735,205]],black),flow:-1},
  {...wire([[655,205],[655,250],[690,250],[690,315]],black),flow:-1},
  {...wire([[35,84],[20,84],[20,216]],red,true),cell:0,flow:-1},
  {...wire([[35,216],[20,216]],red,true),cell:1,flow:-1},
  {...wire([[20,216],[20,280],[110,280],[110,315]],red,true),flow:-1},
  {...wire([[185,84],[205,84],[205,142],[225,142]],black,true),cell:0},
  {...wire([[185,216],[205,216],[205,190],[225,190]],black,true),cell:1},
  wire([[330,166],[348,166],[348,234],[420,234],[420,205]],green,true),
  wire([[530,205],[530,286]],black,true)
 ];
 if(id===3)return [wire([[213,368],[257,368],[257,424],[297,424]],red),{...wire([[595,321],[595,345],[540,345],[540,180],[324,180],[324,198]],green),probe:'metal'},{...wire([[737,321],[737,345],[790,345],[790,94],[359,94],[359,198]],black),probe:'metal',flow:-1},{...wire([[595,321],[595,345],[540,345],[540,180],[400,180],[400,198]],green),probe:'semi'},{...wire([[737,321],[737,345],[790,345],[790,94],[426,94],[426,198]],black),probe:'semi',flow:-1}];
 if(id===4)return [
  wire([[62,387],[62,240],[263,240],[263,218]]),
  wire([[353,218],[353,258],[250,258],[250,325],[278,325]]),
  wire([[536,325],[708,325]],black),
  wire([[708,325],[772,325],[772,515],[224,515],[224,365],[170,365],[170,387]],black),
  {...wire([[543,222],[543,276],[250,276]],green),flow:0},
  {...wire([[708,325],[708,222]],black),flow:0}
 ];
 if(id===5)return [wire([[184,420],[217,420],[217,447],[667,447],[667,391]],green),wire([[184,453],[214,453],[214,487],[699,487],[699,391]],black)];
 if(id===6)return [
  wire([[62,387],[62,245],[263,245],[263,222]]),
  wire([[353,222],[353,263],[145,263],[145,371],[202,371],[202,359]]),
  wire([[282,359],[326,359],[326,319],[352,319]]),
  wire([[462,319],[522,319]],black,false,'rlc'),
  wire([[618,319],[745,319]],black,false,'rlc'),
  wire([[462,319],[490,319],[490,407],[645,407],[645,319],[745,319]],black,false,'rl'),
  wire([[745,319],[745,485],[224,485],[224,380],[170,380],[170,387]],black),
  wire([[353,248],[579.25,248],[579.25,222]],green),
  wire([[681.75,222],[681.75,267],[765,267],[765,319],[745,319]],black)
 ];
 if(id===7)return [
  wire([[62,387],[62,246],[265.25,246],[265.25,223]]),
  wire([[355.75,223],[355.75,268],[228,268],[228,468],[284,468],[284,452]]),
  wire([[388,452],[388,480],[442,480],[442,347],[460,347]]),
  wire([[606,223],[606,252],[442,252],[442,347]],green),
  wire([[170,387],[170,365],[211,365],[211,515],[772,515],[772,236],[708,236],[708,223]],black),
  {...wire([[560,315],[578,315],[578,408],[592,408]]),load:'lamp'},
  {...wire([[644,408],[672,408]],black),load:'lamp'},
  {...wire([[724,408],[772,408]],black),load:'lamp'},
  {...wire([[510,412],[510,458],[597,458]]),load:'coil'},
  {...wire([[707,458],[772,458]],black),load:'coil'}
 ];
 return [];
}
function ruler(s:BenchState){const key=s.id===2?'lx':'l',v=s.params[key],x=110+580*v/100,feedY=s.id===2?286:263,feedX=s.id===2?530:445;
 const field=labs[s.id-1].fields.find(f=>f.key===key)!;
 const stepButton=(bx:number,direction:'left'|'right',disabled:boolean)=>`<g role="button" tabindex="${disabled?-1:0}" class="bench-interactive${disabled?' bench-disabled':''}" data-bench-action="ruler-${direction}" aria-disabled="${disabled}" aria-label="Посунути контакт ${direction==='left'?'вліво':'вправо'} на ${format(field.step)} см"><rect x="${bx}" y="399" width="30" height="28" rx="5" fill="#f3f0df" stroke="#a7b3a5"/>${text(bx+15,418,direction==='left'?'−':'+','button','middle')}</g>`;
 let ticks='';for(let i=0;i<=100;i++){const px=110+i*5.8;ticks+=`<path d="M ${px} 331 v ${i%10===0?14:i%5===0?9:5}" stroke="#817353" stroke-width="${i%10===0?1.3:.6}"/>`;if(i%10===0)ticks+=text(px,363,String(i),'scale','middle');}
 return `<rect x="91" y="292" width="620" height="57" rx="5" fill="#af8152" stroke="#6d543b"/><rect x="102" y="301" width="599" height="43" rx="3" fill="url(#ruler)"/><path d="M 110 315 H 690" stroke="#685d48" stroke-width="2"/>${ticks}${jack(110,315,red)}${jack(690,315,black)}${text(90,387,'A','label')}${text(703,387,'B','label')}${text(399,386,'РЕОХОРД · 100 см','small','middle')}
 <path d="M ${feedX} ${feedY} H ${x} V 297" stroke="${s.apparatus.connected?(s.id===2?black:green):'#9dada1'}" stroke-width="3.2" stroke-dasharray="${s.apparatus.connected?'none':'7 5'}" fill="none"/>
 <g role="slider" tabindex="0" class="bench-interactive" aria-label="Рухомий контакт реохорда" aria-valuemin="${field.min}" aria-valuemax="${field.max}" aria-valuenow="${v}" data-bench-drag="${key}" data-from="110" data-to="690"><rect x="${x-21}" y="275" width="42" height="79" rx="5" fill="transparent"/><rect x="${x-12}" y="291" width="24" height="51" rx="4" fill="url(#brass)" stroke="#756943"/><circle cx="${x}" cy="304" r="8" fill="#41564b" stroke="#7f957d"/><path d="M ${x-3} 304 h 6" stroke="#d7e1cc" stroke-width="2"/>${text(x,282,'D','small','middle')}</g>
 ${text(256,405,`l₁ = ${format(v)} см`,'label')}${text(540,405,`l₂ = ${format(100-v)} см`,'label')}
 <g class="bench-ruler-controls">${stepButton(365,'left',v<=field.min)}${text(415,417,`${format(field.step)} см`,'scale','middle')}${stepButton(435,'right',v>=field.max)}</g>`;
}
function bridgeSpecimen(s:BenchState){
 const resistor=(x:number,y:number,w=42)=>`<path d="M ${x} ${y} h 5 l 4 -5 6 10 6 -10 6 10 6 -10 4 5 H ${x+w}" fill="none" stroke="#7f6144" stroke-width="2.4"/>`;
 let diagram:string;
 if(s.mode==='parallel')diagram=`<path d="M 90 90 V 76 H 125 M 90 90 V 103 H 125 M 175 76 H 210 V 103 H 175" fill="none" stroke="#687862" stroke-width="2"/>${resistor(125,76,50)}${resistor(125,103,50)}${text(150,89,'R₁','scale','middle')}${text(150,116,'R₂','scale','middle')}`;
 else if(s.mode==='series')diagram=`<path d="M 90 91 H 105 M 195 91 H 210" stroke="#687862" stroke-width="2"/>${resistor(105,91,45)}${resistor(150,91,45)}${text(125,80,'R₁','scale','middle')}${text(174,80,'R₂','scale','middle')}`;
 else diagram=`<path d="M 90 91 H 125 M 175 91 H 210" stroke="#687862" stroke-width="2"/>${resistor(125,91,50)}${text(150,80,bridgeModeLabel(s.mode),'scale','middle')}`;
 return `${plate(65,35,170,145,'НЕВІДОМІ ОПОРИ')}<g class="bench-resistance-network" data-connection="${s.mode}" role="img" aria-label="${bridgeModeLabel(s.mode)}">${diagram}</g>${button(75,120,70,'R₁','bridge-r1',s.mode==='r1',22)}${button(155,120,70,'R₂','bridge-r2',s.mode==='r2',22)}${button(75,146,70,'Послідовно','bridge-series',s.mode==='series',22)}${button(155,146,70,'Паралельно','bridge-parallel',s.mode==='parallel',22)}${jack(110,180,red)}${jack(190,180,black)}`;
}
function bridge(s:BenchState){const cap=s.id===8,p=s.params,on=s.apparatus.power&&s.apparatus.connected;let left:string,right:string;
 if(cap){
  left=`${plate(65,76,170,104,'КОНДЕНСАТОР Cₓ')}${capacitor(92,120,null,true)}${button(82,140,135,'Замінити Cₓ','sample')}${jack(110,180,red)}${jack(190,180,black)}`;
  right=`${plate(550,60,178,124,'ЕТАЛОН C₀')}${capacitor(575,118,p.c0,true)}${jack(595,184,red)}${jack(675,184,black)}`;
 }else{
  left=bridgeSpecimen(s);
  right=`${plate(550,53,178,131,'МАГАЗИН ОПОРІВ')}${knob(638,117,'r',p.r,s.id,'Опір магазину',25)}${text(638,179,'Клас 0,1','scale','middle')}${jack(595,184,red)}${jack(675,184,black)}`;
 }
 const residual=simulate(s.id,p,s.mode).reading!,rx=cap?0:bridgeResistance(p,s.mode);const reading=cap?Math.abs(residual*12.6):residual*1e6/(4100+p.r*rx/(p.r+rx)+102*(p.l/100)*(1-p.l/100));
 return `${left}${right}<circle cx="255" cy="236" r="4" fill="${s.apparatus.connected?red:'#9dada1'}"/>${meter(295,60,200,155,cap?'НУЛЬОВИЙ ВОЛЬТМЕТР':'ГАЛЬВАНОМЕТР G',reading,cap?'В':'мкА',on,cap?p.limit:500,!cap,cap?equipmentLimits.sotti.resolution:.5)}${ruler(s)}${sourceBox(s,cap?'ДЖЕРЕЛО AC':'ДЖЕРЕЛО DC',cap?12.6:5)}${cap?`${text(300,435,'Межа індикатора','small')}${equipmentLimits.sotti.ranges.map((limit,i)=>button(300+i*78,446,70,`${limit} В`,`limit-${limit}`,p.limit===limit)).join('')}`:`${text(405,451,'Струм діагоналі зникає при нулі.','small')}${text(405,471,'Потягни контакт D уздовж лінійки.','small')}`}`;
}
const capacitor=(x:number,y:number,c:number|null,compact=false)=>`<path d="M ${x} ${y} h 18 m 0 -12 v 24 m 8 -24 v 24 m 0 -12 h 18" stroke="#4f6860" stroke-width="3" fill="none"/>${text(compact?x+79:x+22,compact?y+5:y+30,`${c===null?'?':format(c)} мкФ`,'small','middle')}`;
function compensation(s:BenchState){const p=s.params,on=s.apparatus.power&&s.apparatus.connected,reading=p.en*p.lx/p.ln-(s.apparatus.selected===0?p.en:p.ex);
 const cell=(y:number,name:string,index:0|1)=>{
  const selected=s.apparatus.selected===index;
  return `${plate(35,y,150,108,name)}<rect x="51" y="${y+38}" width="24" height="36" rx="4" fill="${selected?'#789975':'#a4ac91'}" stroke="#506851"/><rect x="58" y="${y+33}" width="10" height="5" rx="2" fill="#596c53"/>${text(63,y+64,'+','cell','middle')}${text(95,y+57,index===0?`${format(p.en)} В`:'? В','readout')}${button(85,y+68,88,selected?'Підключений':'Обрати',index===0?'cell-normal':'cell-unknown',selected)}${jack(35,y+52,red)}${jack(185,y+52,black)}`;
 };
 const selector=`<g role="button" tabindex="0" data-bench-action="cell-toggle" aria-label="Перемкнути еталонний і невідомий елементи" class="bench-interactive">${plate(225,100,105,132,'ВИБІР ЕРС')}<path d="M 225 142 h 20 M 225 190 h 20 M 282 166 h 48" fill="none" stroke="#6f6543" stroke-width="3"/><circle cx="245" cy="142" r="5" fill="#756d4a"/><circle cx="245" cy="190" r="5" fill="#756d4a"/><path d="M 282 166 L ${s.apparatus.selected===0?'245 142':'245 190'}" stroke="#947246" stroke-width="5" stroke-linecap="round"/><circle cx="282" cy="166" r="5" fill="#6f6543"/>${jack(225,142,black)}${jack(225,190,black)}${jack(330,166,green)}</g>`;
 return `${cell(32,'ЕТАЛОН ℰₙ',0)}${cell(164,'НЕВІДОМИЙ ℰₓ',1)}${selector}${meter(365,40,220,165,'НУЛЬОВИЙ ІНДИКАТОР',reading,'В',on,1,true,.01)}
 ${plate(620,40,150,165,'РОБОЧИЙ СТРУМ')}${text(695,84,'lₙ','small','middle')}${knob(695,125,'ln',p.ln,2,'Калібрування робочого струму',24,18)}${jack(655,205,black)}${jack(735,205,black)}
 <circle cx="20" cy="216" r="3" fill="${s.apparatus.connected?red:'#9dada1'}"/>${ruler(s)}${sourceBox(s,'ДОПОМІЖНЕ DC',3)}`;
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
function diodeBench(s:BenchState){const p=s.params,on=s.apparatus.power&&s.apparatus.connected,flipped=s.apparatus.selected===1,u=diodeVoltage(p.u,flipped),reverse=u<0,i=simulate(4,{...p,u},s.mode).metrics[0].value;
 return `${sourceBox(s,'РЕГУЛЬОВАНЕ DC',p.u,'u')}${meter(218,61,180,157,reverse?'МІКРОАМПЕРМЕТР':'МІЛІАМПЕРМЕТР',Math.abs(i)*(reverse?1000:1),reverse?'мкА':'мА',on,reverse?equipmentLimits.diode.microamps:equipmentLimits.diode.milliamps,false,0.01)}${digital(508,64,235,158,'ВОЛЬТМЕТР V',p.u,'V',on,equipmentLimits.diode.voltage)}
 ${plate(278,286,258,84,'ДОСЛІДЖУВАНИЙ ДІОД')}<g role="button" tabindex="0" data-bench-action="polarity" aria-label="Змінити полярність діода" class="bench-interactive"><rect x="342" y="308" width="137" height="39" rx="6" fill="transparent"/><path d="M 278 325 H 371 M 437 325 H 536" stroke="#8d9481" stroke-width="3"/><rect x="371" y="311" width="66" height="28" rx="7" fill="#45574b" stroke="#243d2e"/><rect x="${flipped?380:421}" y="312" width="7" height="26" fill="#dfe5c6"/>${text(404,360,reverse?'Зворотне зміщення':'Пряме зміщення','small','middle')}</g>
 ${jack(278,325,red)}${jack(536,325,black)}<circle cx="250" cy="276" r="3.5" fill="${s.apparatus.connected?red:'#9dada1'}"/><circle cx="708" cy="325" r="3.5" fill="${s.apparatus.connected?black:'#9dada1'}"/>${text(609,386,'Натисни на діод','label')}${text(609,407,'для зміни полярності.','small')}${text(245,463,'Ручка джерела регулює напругу.','small')}`;
}
function scopeBench(s:BenchState){const p=s.params,a=s.apparatus;
 const time=s.mode==='scope',sensitivity=s.mode==='sensitivity',xUnit=time?'мс':'В',xStep=time?scopeScale.millisecondsPerDivision:sensitivity?scopeScale.sensitivityVoltsPerDivision:scopeScale.voltsPerXDivision;
 const xLabels=[-4,-2,0,2,4].map(i=>text(360+i*24,363,format(i*xStep),'scope-tick','middle')).join('');
 const yLabels=[-3,-2,-1,0,1,2,3].map(i=>text(224,243-i*23.75,format(i*scopeScale.voltsPerYDivision),'scope-tick','end')).join('');
 const axes=`<g class="scope-scale" aria-label="Шкала осцилографа"><path d="M 240 240 H 480 M 360 145 V 335 M 476 237 l 4 3 -4 3 M 357 149 l 3 -4 3 4" fill="none" stroke="#89a47b" stroke-width="1.3"/><circle cx="360" cy="240" r="2.3" fill="#a5b695"/>${text(366,252,'0','crt')}${xLabels}${yLabels}${text(240,123,`Y: Uᵧ, В · ${scopeScale.voltsPerYDivision} В/под.`,'scope-caption')}${text(360,383,`X: ${time?'t':'Uₓ'}, ${xUnit} · ${xStep} ${xUnit}/под.`,'scope-caption','middle')}</g>`;
 const grid=Array.from({length:11},(_,i)=>`<path d="M ${240+i*24} 145 V 335" stroke="#3c6948" stroke-width=".7"/>`).join('')+Array.from({length:9},(_,i)=>`<path d="M 240 ${145+i*23.75} H 480" stroke="#3c6948" stroke-width=".7"/>`).join('');
 return `${plate(209,76,568,325,'ЕЛЕКТРОННИЙ ОСЦИЛОГРАФ С 1-1')}<rect x="229" y="133" width="262" height="217" rx="18" fill="#526657" stroke="#93a181" stroke-width="3"/><rect x="239" y="143" width="242" height="193" rx="12" fill="url(#screen)"/>${grid}${axes}${text(254,159,a.power?s.mode==='xy'?'XY':time?'Y(t)':'ЧУТЛИВІСТЬ':'OFF','crt')}
 ${text(580,124,sensitivity?'НАПРУГА X · RMS':'АМПЛІТУДА','small','middle')}${knob(580,171,sensitivity?'ux':'u',sensitivity?p.ux:p.u,5,sensitivity?'Діюча напруга X':'Амплітуда сигналу',24)}${sensitivity?'':`${text(700,124,'ФАЗА','small','middle')}${knob(700,171,'phase',p.phase,5,'Фаза сигналу',24)}`}
 ${button(536,256,96,'Розгортка','scope',s.mode==='scope')}${button(650,256,96,'Ліссажу (XY)','xy',s.mode==='xy')}${button(536,292,210,'Чутливість','sensitivity',s.mode==='sensitivity')}${power(538,355,a.power)}${jack(667,391,green,true)}${jack(699,391,black)}${text(723,379,'Y / X','small')}
 ${plate(25,298,160,186,'ГЕНЕРАТОР ГЗ-33')}${knob(99,370,'f',p.f,5,'Частота звукового генератора',31)}${text(100,439,`${format(generatorRange.min)} … ${format(generatorRange.max)} Гц`,'small','middle')}${jack(184,420,green)}${jack(184,453,black)}`;
}
function coil(x:number,y:number,core:boolean){let turns='';for(let i=0;i<11;i++)turns+=`<ellipse cx="${x+16+i*7}" cy="${y}" rx="10" ry="25" fill="none" stroke="${i%2?'#b1774b':'#94613d'}" stroke-width="3"/>`;
 return `<g role="button" tabindex="0" data-bench-action="core" aria-label="${core?'Вийняти осердя':'Вставити осердя'}" class="bench-interactive"><rect x="${x-7}" y="${y-34}" width="126" height="68" rx="8" fill="transparent"/>${core?`<rect x="${x-7}" y="${y-12}" width="123" height="24" rx="5" fill="url(#metal)" stroke="#59695d"/>`:''}${turns}<path d="M ${x} ${y} h 9 m 92 0 h 9" stroke="#6f6551" stroke-width="3"/>${text(x+56,y+48,core?'Осердя вставлене':'Вставити осердя','small','middle')}</g>`;
}
function acBench(s:BenchState){const p=s.params,on=s.apparatus.power&&s.apparatus.connected,m=simulate(6,p,s.mode).metrics;
 return `<circle cx="353" cy="248" r="4" fill="${red}"/><circle cx="745" cy="319" r="4" fill="${black}"/>${sourceBox(s,'ЛАТР · 50 Hz',p.u,'u')}${meter(218,60,180,162,'АМПЕРМЕТР A',m[1].value,'А',on,equipmentLimits.ac.current,false,.01)}${meter(528,60,205,162,'ВОЛЬТМЕТР V',p.u,'В',on,equipmentLimits.ac.voltage)}
 ${plate(168,270,143,89,'РЕОСТАТ R')}${knob(238,324,'r',p.r,6,'Активний опір',17,14)}${jack(202,359,red)}${jack(282,359,black)}${coil(352,319,s.apparatus.core)}
 <g role="button" tabindex="0" data-bench-action="capacitor" aria-label="${s.mode==='rl'?'Підключити конденсатор':'Вилучити конденсатор'}" class="bench-interactive"><rect x="522" y="279" width="96" height="80" rx="9" fill="${s.mode==='rl'?'#dedfce':'#c2d0b4'}" stroke="#88977c" stroke-dasharray="${s.mode==='rl'?'5 4':'none'}"/>${text(570,297,'C','label','middle')}${capacitor(547,319,p.c)}<g opacity="${s.mode==='rl'?.4:1}"><path d="M 522 319 H 547 M 593 319 H 618" stroke="#4f6860" stroke-width="3" fill="none"/>${jack(522,319,black)}${jack(618,319,black)}</g>${text(570,380,s.mode==='rl'?'Натисни: додати C':'Натисни: вилучити C','small','middle')}</g>${text(352,453,'L = ? мГн','label')}${text(352,478,s.mode==='rl'?'Замкнене RL-коло':'Послідовне RLC-коло','small')}`;
}
function powerBench(s:BenchState){const p=s.params,a=s.apparatus,on=a.power&&a.connected,watts=simulate(7,p,s.mode).metrics[0].value;
 const glow=on&&a.selected===0;
 const lamp=(x:number)=>`<g><circle cx="${x}" cy="360" r="43" fill="${glow?'#f3ca67':'#cfdbbf'}" opacity="${glow?Math.max(.08,Math.min(.6,watts/35)):.1}"/><path d="M ${x-17} 368 C ${x-58} 306 ${x+58} 306 ${x+17} 368 v 14 h -34 Z" fill="${glow?'url(#bulb)':'#e1e4cf'}" stroke="#9b9f7f" stroke-width="2"/><path d="M ${x-10} 367 l 3 -16 7 10 7 -10 3 16" fill="none" stroke="${glow?'#fff3c0':'#8d8c70'}" stroke-width="2"/><rect x="${x-18}" y="380" width="36" height="22" rx="3" fill="url(#metal)" stroke="#6f7d6d"/><path d="M ${x-17} 385 h 34 m -34 6 h 34" stroke="#738575"/><rect x="${x-26}" y="402" width="52" height="13" rx="4" fill="#5b6c55"/></g>`;
 return `${sourceBox(s,'ЛАТР · 50 Hz',p.u,'u')}${meter(220,59,181,164,'ВАТМЕТР W',watts,'Вт',on,equipmentLimits.power.watts)}${digital(571,63,172,160,'ВОЛЬТМЕТР',p.u,'В',on,equipmentLimits.power.voltage)}${digital(249,299,174,153,a.selected===0?'МІЛІАМПЕРМЕТР':'АМПЕРМЕТР',a.selected===0?p.i*1000:p.i,a.selected===0?'мА':'А',on,a.selected===0?equipmentLimits.power.lampCurrent*1000:equipmentLimits.power.coilCurrent)}
 <circle cx="442" cy="347" r="3.5" fill="${a.connected?red:'#9dada1'}"/>
 <g role="button" tabindex="0" data-bench-action="load" aria-label="Перемкнути навантаження" class="bench-interactive">${text(510,279,'НАВАНТАЖЕННЯ','small','middle')}${plate(460,292,100,120,'')}<path d="M 460 347 h 24 M 530 315 h 30 M 510 390 v 22" fill="none" stroke="#6f6543" stroke-width="3"/><circle cx="530" cy="315" r="5" fill="#756d4a"/><circle cx="510" cy="390" r="5" fill="#756d4a"/><path d="M 484 347 L ${a.selected===0?'530 315':'510 390'}" stroke="#916a39" stroke-width="5" stroke-linecap="round"/><circle cx="484" cy="347" r="5" fill="#665d45"/>${jack(460,347,red)}${jack(560,315,red)}${jack(510,412,red)}</g>
 ${text(658,300,'Лампи','small','middle')}${lamp(618)}${lamp(698)}${jack(592,408,red)}${jack(644,408,black)}${jack(672,408,black)}${jack(724,408,black)}
 ${text(652,428,'Котушка','small','middle')}${coil(597,458,a.core)}${text(300,505,`P = ${on?format(watts):'—'} Вт`,'readout')}`;
}
function draw(s:BenchState){const a=s.apparatus,wires=circuitWires(s.id).filter(w=>(!w.only||w.only===s.mode)&&(!w.probe||w.probe===a.probe));
 const wireMarkup=wires.map(w=>`<polyline points="${w.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#243e2b" stroke-opacity=".12" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 2)"/><polyline points="${w.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${a.connected?w.color:'#9dada1'}" stroke-width="3.2" stroke-dasharray="${a.connected?'none':'7 5'}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 const content=[bridge,compensation,thermostat,diodeBench,scopeBench,acBench,powerBench,bridge][s.id-1](s);
 return `<defs><linearGradient id="case" x2="0" y2="1"><stop stop-color="#f1f0e1"/><stop offset="1" stop-color="#d7dfc9"/></linearGradient><linearGradient id="knob" x2="1" y2="1"><stop stop-color="#727b70"/><stop offset=".4" stop-color="#48594a"/><stop offset="1" stop-color="#2d4335"/></linearGradient><linearGradient id="brass" x2="1"><stop stop-color="#a68843"/><stop offset=".5" stop-color="#e7cb7c"/><stop offset="1" stop-color="#ac8d47"/></linearGradient><linearGradient id="ruler" x2="0" y2="1"><stop stop-color="#efdfb3"/><stop offset="1" stop-color="#dbbd82"/></linearGradient><linearGradient id="metal" x2="0" y2="1"><stop stop-color="#a9b8ab"/><stop offset=".4" stop-color="#e1e8d9"/><stop offset="1" stop-color="#657a6a"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="#acdbcb"/><stop offset="1" stop-color="#6fbaa6"/></linearGradient><radialGradient id="screen"><stop stop-color="#224733"/><stop offset="1" stop-color="#122e21"/></radialGradient><radialGradient id="bulb"><stop stop-color="#fffbe0"/><stop offset=".5" stop-color="#f8d16e"/><stop offset="1" stop-color="#dfae50"/></radialGradient></defs>
 <rect width="800" height="540" rx="14" fill="#e7ebe0"/>
 ${wireMarkup}${content}`;
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
 private stepKnob=(target:SVGElement)=>{
  if(target.getAttribute('aria-disabled')==='true')return;
  const key=target.dataset.benchStep!,direction=Number(target.dataset.direction);
  const f=labs[this.state.id-1].fields.find(field=>field.key===key)!;
  const value=Number((this.state.params[key]+direction*f.step).toFixed(6));
  this.change(key,Math.max(f.min,Math.min(f.max,value)));
  requestAnimationFrame(()=>this.svg.querySelector<SVGElement>(`[data-bench-step="${key}"][data-direction="${direction}"]`)?.focus());
 };
 private click=(event:MouseEvent)=>{const step=(event.target as Element).closest<SVGElement>('[data-bench-step]');if(step){this.stepKnob(step);return;}const target=(event.target as Element).closest<SVGElement>('[data-bench-action]');if(target&&target.getAttribute('aria-disabled')!=='true'){if(target.dataset.benchAction==='probe'){this.action((target.getAttribute('aria-label')??'').includes('метал')?'probe-metal':'probe-semi');}else this.action(target.dataset.benchAction!);}};
 private keydown=(event:KeyboardEvent)=>{const step=(event.target as Element).closest<SVGElement>('[data-bench-step]');if(step&&['Enter',' '].includes(event.key)){event.preventDefault();this.stepKnob(step);return;}const target=(event.target as Element).closest<SVGElement>('[data-bench-drag],[data-bench-action]');if(!target||target.getAttribute('aria-disabled')==='true')return;if(target.dataset.benchAction&&['Enter',' '].includes(event.key)){event.preventDefault();this.action(target.dataset.benchAction);const action=target.dataset.benchAction;requestAnimationFrame(()=>this.svg.querySelector<SVGElement>(`[data-bench-action="${action}"]`)?.focus());return;}const key=target.dataset.benchDrag;if(key&&['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const f=labs[this.state.id-1].fields.find(f=>f.key===key)!;const value=event.key==='Home'?f.min:event.key==='End'?f.max:this.state.params[key]+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)*f.step;this.change(key,Math.min(f.max,Math.max(f.min,value)));requestAnimationFrame(()=>this.svg.querySelector<SVGElement>(`[data-bench-drag="${key}"]`)?.focus());}};
 private animate=(now:number)=>{if(this.dead)return;const dt=this.last?Math.min(.3,(now-this.last)/1000):0;const a=this.state.apparatus;if(this.state.id===3&&a.power&&a.heating&&this.state.playing&&document.visibilityState==='visible'&&now-this.last>150){const target=this.state.params.t,diff=target-a.temperature;if(Math.abs(diff)>.03)this.warmed(Math.abs(diff)<.15?target:a.temperature+Math.sign(diff)*Math.min(Math.abs(diff),dt*7));this.last=now;}else if(now-this.last>150)this.last=now;this.tick=requestAnimationFrame(this.animate);};
 dispose(){this.dead=true;cancelAnimationFrame(this.tick);this.renderer?.dispose();for(const [name,fn]of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['click',this.click],['keydown',this.keydown]]as const)this.host.removeEventListener(name,fn as EventListener);this.svg.remove();}
}
