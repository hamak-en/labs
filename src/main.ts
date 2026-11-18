import './style.css';
import { renderFormulas } from './formulas';
import { renderUncertaintyHelp } from './uncertainty';
import { questionAnswers } from './answers';
import { renderEquipment } from './equipment';
import { labs, equipmentLimits, limitNote } from './config';
import type { Lab } from './config';
import source from './source.json';
import { calculateRow, format, diodeVoltage, bridgeModes, bridgeModeLabel, capacitanceModes, capacitanceModeLabel } from './physics';
import { Workbench } from './workbench';
import type { BenchState } from './workbench';
import { restore, save, downloadCSV, freshApparatus } from './storage';
import type { Measurement } from './storage';
import { applyVariant, validVariant, variantNumbers, variantLabel, hasVariants } from './variants';

const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const asset=(path:string)=>import.meta.env.BASE_URL+path;
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const tabNames=['experiment','theory','questions','equipment'] as const;
const state=restore();let lab:Lab=labs[0];let tab='experiment';let visual:Workbench|undefined;let generation=0;let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer:ReturnType<typeof setTimeout>;
let powerConductance=state.labs[7].params.u>0?state.labs[7].params.i/state.labs[7].params.u:.3/24;
const current=()=>state.labs[lab.id];

function persist(){save(state);}
function toast(message:string){const e=$('#toast');e.innerHTML=`<span>${esc(message)}</span>`;e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{e.hidden=true;},6000);}
function route(){if(location.hash==='#workspace'){$('#workspace')?.focus();return;}const n=Number(location.hash.match(/^#\/lab\/(\d+)$/)?.[1]??1);lab=labs.find(l=>l.id===n)??labs[0];tab='experiment';render();}
function render(){
 ++generation;visual?.dispose();visual=undefined;playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const s=current(),src=source[lab.id-1];
 $('#app').innerHTML=`<a href="#workspace" class="skip-link">Перейти до досліду</a>
 <aside id="sidebar" class="sidebar"><div class="sidebar-heading">ТВОЯ ЛАБОРАТОРІЯ <span>08</span></div><nav aria-label="Лабораторні роботи">${labs.map(l=>`<a href="#/lab/${l.id}" class="nav-item ${l.id===lab.id?'active':''}" ${l.id===lab.id?'aria-current="page"':''}><span class="nav-number">${String(l.id).padStart(2,'0')}</span><span>${esc(l.short)}</span>${l.id===lab.id?'<span class="nav-arrow">↗</span>':''}</a>`).join('')}</nav></aside>
 <main id="workspace" tabindex="-1"><header class="topbar"><div class="tabs" role="tablist" aria-label="Розділи лабораторної"><button id="tab-experiment" role="tab" aria-selected="true" aria-controls="panel-experiment" data-tab="experiment">Експеримент<span>01</span></button><button id="tab-theory" role="tab" aria-selected="false" aria-controls="panel-theory" tabindex="-1" data-tab="theory">Теорія<span>02</span></button><button id="tab-questions" role="tab" aria-selected="false" aria-controls="panel-questions" tabindex="-1" data-tab="questions">Контрольні питання<span>03</span></button><button id="tab-equipment" role="tab" aria-selected="false" aria-controls="panel-equipment" tabindex="-1" data-tab="equipment">Обладнання<span>04</span></button></div><div class="top-actions"><a class="source-link" href="${asset('Електрика.%20Лабораторні%20роботи.pdf')}" target="_blank" rel="noopener">Методичка <span>↗</span></a><button id="menu" class="menu-button" aria-expanded="false" aria-controls="sidebar">Роботи ☰</button></div></header><div class="content-body"><h1 class="sr-only">${esc(lab.short)}</h1>
 <section id="panel-experiment" role="tabpanel" aria-labelledby="tab-experiment"><div class="experiment-grid">
 <section class="apparatus-card" aria-label="Інтерактивна лабораторна установка"><p class="bench-pan-hint">На телефоні посунь стенд убік, щоб побачити всі прилади.</p><div class="bench-viewport"><div id="bench" class="bench-host" data-backend="loading"></div></div></section>
 <section class="controls-card"><div class="section-title"><h2>Параметри досліду</h2><button data-action="reset-params" class="text-button">Скинути ↺</button></div><p class="muted small">Перетягни ручку на стенді або введи значення.</p>${hasVariants(lab.id)?`<div class="variant-control"><label for="lab-variant">Варіант досліду</label><select id="lab-variant">${!validVariant(s.variant)?'<option value="" selected disabled>Попередня установка</option>':''}${variantNumbers.map(v=>`<option value="${v}" ${s.variant===v?'selected':''}>${variantLabel(v)}</option>`).join('')}</select></div>`:''}<div class="controls">${lab.fields.filter(f=>!f.hidden).map(f=>`<div class="control" data-control="${f.key}" title="${esc(limitNote(lab.id,f.key))}"><label for="number-${f.key}">${esc(f.label)}<span>${esc(f.unit)}</span></label><div class="control-inputs">${f.choices?`<select id="number-${f.key}" data-param="${f.key}" aria-label="${esc(f.label)}, ${esc(f.unit)}">${f.choices.map(value=>`<option value="${value}" ${s.params[f.key]===value?'selected':''}>${format(value)} ${esc(f.unit)}</option>`).join('')}</select>`:`<input id="range-${f.key}" type="range" data-param="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${s.params[f.key]}" aria-label="${esc(f.label)}, повзунок"><input id="number-${f.key}" type="number" inputmode="decimal" data-param="${f.key}" min="${f.min}" max="${f.max}" step="${f.discrete?f.step:'any'}" value="${s.params[f.key]}" aria-label="${esc(f.label)}, ${esc(f.unit)}">`}</div></div>`).join('')}</div><p id="param-error" class="error-message" role="status" hidden></p>
 ${lab.id===7?'<div class="load-presets"><button data-preset="lamp">Лампи</button><button data-preset="coil">Котушка</button></div>':''}
 ${lab.id===5?'<div class="load-presets"><button data-frequency="50">1:1</button><button data-frequency="100">1:2</button><button data-frequency="150">1:3</button><button data-frequency="200">1:4</button></div>':''}
 <div class="formula-card"><span>КЛЮЧОВА ФОРМУЛА</span>${renderFormulas(lab.formula)}</div>
 ${s.rows.length?'<button class="secondary-button" data-action="export">Експорт збережених вимірів CSV</button>':''}</section>
 </div>
 </section>
 <section id="panel-theory" role="tabpanel" aria-labelledby="tab-theory" hidden><div class="theory-grid"><article class="theory-card"><p class="eyebrow">СУТЬ ДОСЛІДУ</p><h2>${esc(lab.short)}</h2><p>${esc(lab.principle)}</p><div class="theory-formula">${renderFormulas(lab.formula)}</div><h3>Як виконати роботу</h3><ol class="steps">${lab.steps.map((step,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><p>${esc(step)}</p></li>`).join('')}</ol>${renderUncertaintyHelp(lab.id)}<button class="secondary-button theory-equipment-link" data-tab="equipment">Характеристики обладнання</button><div class="source-note">Опис за методичними вказівками ОНУ, 2014, с. ${src.pages}.</div></article><div class="figures"><p class="eyebrow">СХЕМИ З ОРИГІНАЛУ</p>${src.figures.map((f,i)=>`<figure><button data-image="${i}" aria-label="Збільшити: ${esc(f.alt)}"><img src="${asset(f.url)}" alt="${esc(f.alt)}" loading="lazy"></button><figcaption>${esc(f.alt)}</figcaption></figure>`).join('')}</div></div></section>
 <section id="panel-questions" role="tabpanel" aria-labelledby="tab-questions" hidden><div class="questions-heading"><p class="eyebrow">ПІДГОТОВКА ДО ЗАХИСТУ</p></div><div class="questions">${src.questions.map((q,i)=>`<details><summary><span class="question-number">${String(i+1).padStart(2,'0')}</span><span>${esc(q)}</span><span class="question-plus">＋</span></summary><div class="question-answer">${questionAnswers[lab.id]![i]!.map(block=>'text' in block?`<p>${esc(block.text)}</p>`:renderFormulas(block.equations)).join('')}</div></details>`).join('')}</div></section>
 <section id="panel-equipment" role="tabpanel" aria-labelledby="tab-equipment" hidden>${renderEquipment(lab.id,src.pages,asset('Електрика.%20Лабораторні%20роботи.pdf'))}</section>
 </div></main><div id="toast" role="status" hidden></div><dialog id="image-dialog"><button class="dialog-close" aria-label="Закрити зображення">×</button><img alt=""><p></p></dialog>`;
 updateModel();
 visual=new Workbench($('#bench'),benchState(),changeBenchParam,benchAction,t=>{current().apparatus.temperature=t;updateModel();},backend=>$('#bench').dataset.backend=backend);
}
function benchState():BenchState{return {id:lab.id,params:current().params,mode:current().mode,apparatus:current().apparatus,playing};}
function changeBenchParam(key:string,value:number){if(lab.id===7&&key==='u'){const previous=current().params.u;if(previous>0)powerConductance=current().params.i/previous;current().params.i=Math.max(0,Math.min(currentLimit(),powerConductance*value));}current().params[key]=value;syncParams();persist();updateModel();}
function benchAction(action:string){
 const a=current().apparatus,p=current().params;
 if(action==='power')a.power=!a.power;
 else if(action==='connection')a.connected=!a.connected;
 else if(action==='ruler-left'||action==='ruler-right'){
  if(![1,2,8].includes(lab.id))return;
  const key=lab.id===2?'lx':'l',field=lab.fields.find(f=>f.key===key)!;
  const value=Number((p[key]+(action==='ruler-left'?-field.step:field.step)).toFixed(6));
  changeBenchParam(key,Math.max(field.min,Math.min(field.max,value)));return;
 }
 else if(lab.id===8&&action.startsWith('limit-')){const value=Number(action.slice(6));if(equipmentLimits.sotti.ranges.includes(value as 300|3|1))p.limit=value;}
 else if(action==='heat'){a.heating=!a.heating;if(a.heating)a.power=true;}
 else if(action==='probe-metal')a.probe='metal';
 else if(action==='probe-semi')a.probe='semi';
 else if(action==='cell-toggle')a.selected=a.selected===0?1:0;else if(action==='cell-normal')a.selected=0;else if(action==='cell-unknown')a.selected=1;
 else if(lab.id===1&&action.startsWith('bridge-')){const mode=action.slice(7);if(bridgeModes.includes(mode as typeof bridgeModes[number]))current().mode=mode;}
 else if(lab.id===8&&action.startsWith('sotti-')){const mode=action.slice(6);if(capacitanceModes.includes(mode as typeof capacitanceModes[number])){current().mode=mode;p.limit=300;}}
 else if(action==='polarity')a.selected=a.selected===0?1:0;
 else if(action==='capacitor')current().mode=current().mode==='rl'?'rlc':'rl';
 else if(action==='core'){a.core=!a.core;if(lab.id===6){if(validVariant(current().variant))applyVariant(lab.id,current().variant!,p,a);else p.l=Math.min(1000,Number((p.l*(a.core?1.8:1/1.8)).toFixed(4)));}}
 else if(action==='load'){a.selected=a.selected===0?1:0;if(validVariant(current().variant))applyVariant(7,current().variant!,p,a);else p.phase=a.selected===0?0:60;}
 else if(['scope','xy','sensitivity'].includes(action))current().mode=action;
 syncParams();persist();updateModel();
}
function currentLimit(){return current().apparatus.selected===0?equipmentLimits.power.lampCurrent:equipmentLimits.power.coilCurrent;}
function updateModel(){
 for(const control of document.querySelectorAll<HTMLElement>('[data-control]')){
  const key=control.dataset.control!;
  if(lab.id===5)control.hidden=current().mode==='sensitivity'?key!=='ux':key==='ux';
  if(lab.id===7&&key==='i')for(const input of control.querySelectorAll<HTMLInputElement>('input'))input.max=String(currentLimit());
 }

 if(lab.id===4)current().mode=diodeVoltage(current().params.u,current().apparatus.selected===1)<0?'reverse':'forward';
 visual?.set(benchState());
}
function specimenLabel(specimen:string|undefined){return ({air:'Без осердя',core:'З осердям',lamp:'Лампи',coil:'Котушка',c1:'C₁',c2:'C₂',pair:'C₁, C₂'} as Record<string,string>)[specimen??'']??'';}
function rowResult(m:Measurement):{result:Record<string,number>;error?:string}{try{return {result:calculateRow(lab.id,m.row,m.mode)};}catch(e){return {result:{},error:e instanceof Error?e.message:'Некоректні дані'};}}
function syncParams(){for(const f of lab.fields)for(const el of document.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[data-param="${f.key}"]`)){el.value=String(current().params[f.key]);el.classList.remove('invalid');}$('#param-error').hidden=true;}
function selectTab(next:string){
 if(!tabNames.some(name=>name===next))return;
 tab=next;for(const name of tabNames){const active=next===name;$(`#panel-${name}`).hidden=!active;const button=$(`#tab-${name}`);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
 $(`#tab-${next}`).scrollIntoView({block:'nearest',inline:'nearest'});
 $('#workspace').scrollTop=0;
}
function exportRows(){const rows=current().rows;if(!rows.length)return;
 const includeVariant=hasVariants(lab.id)||rows.some(m=>validVariant(m.variant));
 const headers=['№','Джерело',...(includeVariant?['Варіант']:[]),[1,8].includes(lab.id)?'З’єднання':'Режим','Зразок',...lab.columns.map(c=>`${c.label}${c.unit?', '+c.unit:''}`),...lab.outputs.map(c=>`${c.label}${c.unit?', '+c.unit:''}`),'Помилка'];
 const cells=rows.map((m,i)=>{const {result,error}=rowResult(m);return [i+1,m.source==='demo'?'Модель':'Власні',...(includeVariant?[validVariant(m.variant)?m.variant:lab.id===5?'Без варіанта':'Попередні']:[]),lab.id===1?bridgeModeLabel(m.mode):lab.id===8?capacitanceModeLabel(m.mode):m.mode,specimenLabel(m.specimen),...lab.columns.map(c=>m.row[c.key]===null?'':String(m.row[c.key]??'')),...lab.outputs.map(c=>Number.isFinite(result[c.key])?String(result[c.key]):''),error??''];});
 downloadCSV(`lab_${lab.id}-measurements.csv`,headers,cells);toast('Збережені виміри експортовано.');
}
document.addEventListener('input',event=>{
 const el=event.target as HTMLInputElement|HTMLSelectElement;
 if(el.id==='lab-variant'){const v=Number(el.value);if(!hasVariants(lab.id)||!validVariant(v))return;current().variant=v;applyVariant(lab.id,v,current().params,current().apparatus);if(lab.id===8)current().params.limit=300;syncParams();persist();updateModel();return;}
 if(el.dataset.param){const f=lab.fields.find(f=>f.key===el.dataset.param)!;const v=el.value===''?NaN:Number(el.value),max=lab.id===7&&f.key==='i'?currentLimit():f.max;
  if(!Number.isFinite(v)||v<f.min||v>max||(f.choices&&!f.choices.includes(v))||(f.discrete&&Math.abs((v-f.min)/f.step-Math.round((v-f.min)/f.step))>1e-8)){el.classList.add('invalid');const e=$('#param-error');e.textContent=f.choices?`${f.label}: обери ${f.choices.map(value=>format(value)).join(', ')} ${f.unit}.`:`${f.label}: введи число від ${f.min} до ${max} ${f.unit}${f.discrete?` з кроком ${format(f.step)} ${f.unit}`:''}.`;e.hidden=false;return;}
  el.classList.remove('invalid');$('#param-error').hidden=true;current().params[f.key]=v;for(const other of document.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[data-param="${f.key}"]`))if(other!==el)other.value=String(v);persist();updateModel();
 }
});
document.addEventListener('click',event=>{
 const b=(event.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;
 if(b.id==='menu'){$('#sidebar').classList.toggle('open');b.setAttribute('aria-expanded',String($('#sidebar').classList.contains('open')));return;}
 if(b.dataset.tab){selectTab(b.dataset.tab);if(b.getAttribute('role')!=='tab')$(`#tab-${b.dataset.tab}`).focus();return;}
 if(b.dataset.mode){current().mode=b.dataset.mode;if(lab.id===4)current().apparatus.selected=(current().params.u<0)!==(b.dataset.mode==='reverse')?1:0;persist();updateModel();return;}
 if(b.dataset.preset){current().apparatus.selected=b.dataset.preset==='lamp'?0:1;if(validVariant(current().variant))applyVariant(7,current().variant!,current().params,current().apparatus);else current().params.phase=b.dataset.preset==='lamp'?0:60;syncParams();persist();updateModel();return;}
 if(b.dataset.frequency){current().params.f=Number(b.dataset.frequency);current().mode='xy';syncParams();persist();updateModel();return;}
 if(b.dataset.image){const f=source[lab.id-1].figures[Number(b.dataset.image)];const d=$<HTMLDialogElement>('#image-dialog');d.querySelector('img')!.src=asset(f.url);d.querySelector('img')!.alt=f.alt;d.querySelector('p')!.textContent=f.alt;d.showModal();return;}
 if(b.classList.contains('dialog-close')){$<HTMLDialogElement>('#image-dialog').close();return;}
 switch(b.dataset.action){
  case 'reset-params':{const s=current();s.apparatus=freshApparatus(lab.id);s.params=Object.fromEntries(lab.fields.map(f=>[f.key,f.value]));s.variant=hasVariants(lab.id)?s.variant??1:undefined;if(validVariant(s.variant)){applyVariant(lab.id,s.variant,s.params,s.apparatus);$<HTMLSelectElement>('#lab-variant').value=String(s.variant);}syncParams();persist();updateModel();break;}
  case 'export':exportRows();break;
 }
});
document.addEventListener('keydown',event=>{const b=(event.target as HTMLElement).closest<HTMLElement>('[role="tab"]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const names=tabNames;let i=names.findIndex(name=>name===tab);i=event.key==='Home'?0:event.key==='End'?names.length-1:(i+(event.key==='ArrowRight'?1:-1)+names.length)%names.length;selectTab(names[i]);$(`#tab-${names[i]}`).focus();});
document.addEventListener('click',event=>{const dialog=$<HTMLDialogElement>('#image-dialog');if(event.target===dialog)dialog.close();});
// The browser releases GPU resources on navigation; destroying the device here
// can reject pending WebGPU error scopes before the document unloads.
window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>{save(state);});route();
