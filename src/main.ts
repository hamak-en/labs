import './style.css';
import { renderFormulas } from './formulas';
import { renderUncertaintyHelp } from './uncertainty';
import { questionAnswers } from './answers';
import { labs, equipmentLimits, limitNote } from './config';
import type { Lab } from './config';
import source from './source.json';
import { simulate, calculateRow, thermalFit, format, diodeVoltage, bridgeModes, bridgeModeLabel, combineResistances, combinedResistanceError } from './physics';
import type { Row } from './physics';
import { Workbench } from './workbench';
import type { BenchState } from './workbench';
import { restore, save, downloadCSV, freshApparatus } from './storage';
import type { Measurement } from './storage';

const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const asset=(path:string)=>import.meta.env.BASE_URL+path;
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const state=restore();let lab:Lab=labs[0];let tab='experiment';let visual:Workbench|undefined;let generation=0;let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let nextId=Math.max(0,...Object.values(state.labs).flatMap(s=>s.rows.map(r=>r.id)))+1;
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
 <main id="workspace" tabindex="-1"><header class="topbar"><div class="tabs" role="tablist" aria-label="Розділи лабораторної"><button id="tab-experiment" role="tab" aria-selected="true" aria-controls="panel-experiment" data-tab="experiment">Експеримент<span>01</span></button><button id="tab-theory" role="tab" aria-selected="false" aria-controls="panel-theory" tabindex="-1" data-tab="theory">Теорія<span>02</span></button><button id="tab-questions" role="tab" aria-selected="false" aria-controls="panel-questions" tabindex="-1" data-tab="questions">Контрольні питання<span>03</span></button></div><div class="top-actions"><a class="source-link" href="${asset('Електрика.%20Лабораторні%20роботи.pdf')}" target="_blank" rel="noopener">Методичка <span>↗</span></a><button id="menu" class="menu-button" aria-expanded="false" aria-controls="sidebar">Роботи ☰</button></div></header><div class="content-body"><h1 class="sr-only">${esc(lab.short)}</h1>
 <section id="panel-experiment" role="tabpanel" aria-labelledby="tab-experiment"><div class="experiment-grid">
 <section class="apparatus-card" aria-label="Інтерактивна лабораторна установка"><p class="bench-pan-hint">На телефоні посунь стенд убік, щоб побачити всі прилади.</p><div class="bench-viewport"><div id="bench" class="bench-host" data-backend="loading"></div></div></section>
 <section class="controls-card"><div class="section-title"><h2>Параметри досліду</h2><button data-action="reset-params" class="text-button">Скинути ↺</button></div><p class="muted small">Перетягни ручку на стенді або введи значення.</p><div class="controls">${lab.fields.filter(f=>!f.hidden).map(f=>`<div class="control" data-control="${f.key}" title="${esc(limitNote(lab.id,f.key))}"><label for="number-${f.key}">${esc(f.label)}<span>${esc(f.unit)}</span></label><div class="control-inputs">${f.choices?`<select id="number-${f.key}" data-param="${f.key}" aria-label="${esc(f.label)}, ${esc(f.unit)}">${f.choices.map(value=>`<option value="${value}" ${s.params[f.key]===value?'selected':''}>${format(value)} ${esc(f.unit)}</option>`).join('')}</select>`:`<input id="range-${f.key}" type="range" data-param="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${s.params[f.key]}" aria-label="${esc(f.label)}, повзунок"><input id="number-${f.key}" type="number" inputmode="decimal" data-param="${f.key}" min="${f.min}" max="${f.max}" step="${f.discrete?f.step:'any'}" value="${s.params[f.key]}" aria-label="${esc(f.label)}, ${esc(f.unit)}">`}</div></div>`).join('')}</div><p id="param-error" class="error-message" role="status" hidden></p>
 ${lab.id===7?'<div class="load-presets"><button data-preset="lamp">Лампи</button><button data-preset="coil">Котушка</button></div>':''}
 ${lab.id===5?'<div class="load-presets"><button data-frequency="50">1:1</button><button data-frequency="100">1:2</button><button data-frequency="150">1:3</button><button data-frequency="200">1:4</button></div>':''}
 <div class="formula-card"><span>КЛЮЧОВА ФОРМУЛА</span>${renderFormulas(lab.formula)}</div><button class="primary-button wide record" data-action="record">Записати покази приладів <span>＋</span></button></section>
 </div>
 <section class="data-card"><div class="data-heading"><div><p class="eyebrow">ТВІЙ ЛАБОРАТОРНИЙ ЖУРНАЛ</p><h2>Вимірювання <span id="row-count" class="count">0</span></h2></div><div class="data-actions"><button class="secondary-button" data-action="export">Експорт CSV ↗</button><button class="primary-button" data-action="add-row">＋ Власний вимір</button></div></div><p class="small muted">${lab.id===6?'Режим RL / RLC зберігається для кожного рядка. ':''}Вводь покази приладів. Результати обчислюються одразу.</p><div class="table-scroll"><table id="measurements"><thead><tr><th scope="col">№</th><th scope="col">Джерело</th>${lab.columns.map(c=>`<th scope="col">${c.label}<span>${c.unit}</span></th>`).join('')}${lab.outputs.map(c=>`<th scope="col" class="computed">${c.label}<span>${c.unit}</span></th>`).join('')}<th scope="col"><span class="sr-only">Дії</span></th></tr></thead><tbody></tbody></table></div><div id="table-summary"></div>${lab.id===1?renderUncertaintyHelp(1):[2,8].includes(lab.id)?`<p class="small muted uncertainty-note">Похибка відліку кожної довжини: 1 мм. ${lab.id===2?'Похибкою еталонної ЕРС знехтувано.':'Похибкою еталонної ємності знехтувано.'}</p>`:''}</section>
 ${[1,8].includes(lab.id)?`<section class="connections-card"><div><p class="eyebrow">ПЕРЕВІР ФОРМУЛИ</p><h2>${lab.id===1?'З’єднання опорів':'З’єднання конденсаторів'}</h2><p class="muted small">Порівняй з результатом окремого вимірювання.</p></div><label>${lab.id===1?'R₁':'C₁'}<input type="number" id="combine-a" min="0.001" step="any" placeholder="—" aria-label="Перший елемент з’єднання"></label><label>${lab.id===1?'R₂':'C₂'}<input type="number" id="combine-b" min="0.001" step="any" placeholder="—" aria-label="Другий елемент з’єднання"></label><div id="combine-result" aria-live="polite"></div></section>`:''}
 </section>
 <section id="panel-theory" role="tabpanel" aria-labelledby="tab-theory" hidden><div class="theory-grid"><article class="theory-card"><p class="eyebrow">СУТЬ ДОСЛІДУ</p><h2>${esc(lab.short)}</h2><p>${esc(lab.principle)}</p><div class="theory-formula">${renderFormulas(lab.formula)}</div><h3>Як виконати роботу</h3><ol class="steps">${lab.steps.map((step,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><p>${esc(step)}</p></li>`).join('')}</ol>${renderUncertaintyHelp(lab.id)}<h3>Обладнання за методичкою</h3><p class="equipment">${esc(src.equipment)}</p><div class="source-note">Опис за методичними вказівками ОНУ, 2014, с. ${src.pages}.</div></article><div class="figures"><p class="eyebrow">СХЕМИ З ОРИГІНАЛУ</p>${src.figures.map((f,i)=>`<figure><button data-image="${i}" aria-label="Збільшити: ${esc(f.alt)}"><img src="${asset(f.url)}" alt="${esc(f.alt)}" loading="lazy"></button><figcaption>${esc(f.alt)}</figcaption></figure>`).join('')}</div></div></section>
 <section id="panel-questions" role="tabpanel" aria-labelledby="tab-questions" hidden><div class="questions-heading"><p class="eyebrow">ПІДГОТОВКА ДО ЗАХИСТУ</p></div><div class="questions">${src.questions.map((q,i)=>`<details><summary><span class="question-number">${String(i+1).padStart(2,'0')}</span><span>${esc(q)}</span><span class="question-plus">＋</span></summary><div class="question-answer">${questionAnswers[lab.id]![i]!.map(block=>'text' in block?`<p>${esc(block.text)}</p>`:renderFormulas(block.equations)).join('')}</div></details>`).join('')}</div></section>
 </div></main><div id="toast" role="status" hidden></div><dialog id="image-dialog"><button class="dialog-close" aria-label="Закрити зображення">×</button><img alt=""><p></p></dialog>`;
 renderRows();updateConnections();updateModel();
 visual=new Workbench($('#bench'),benchState(),changeBenchParam,benchAction,t=>{current().apparatus.temperature=t;updateModel();},backend=>$('#bench').dataset.backend=backend);
}
function benchState():BenchState{return {id:lab.id,params:current().params,mode:current().mode,apparatus:current().apparatus,playing};}
function activeModel(){const s=current(),p=lab.id===3?{...s.params,t:s.apparatus.temperature}:lab.id===4?{...s.params,u:diodeVoltage(s.params.u,s.apparatus.selected===1)}:s.params;return simulate(lab.id,p,s.mode);}
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
 else if(action==='sample'){if(lab.id===8){p.limit=300;a.selected=a.selected===0?1:0;p.cx=a.selected===0?3:5;}}
 else if(action==='polarity')a.selected=a.selected===0?1:0;
 else if(action==='capacitor')current().mode=current().mode==='rl'?'rlc':'rl';
 else if(action==='core'){a.core=!a.core;if(lab.id===6)p.l=Math.min(1000,Number((p.l*(a.core?1.8:1/1.8)).toFixed(4)));}
 else if(action==='load'){a.selected=a.selected===0?1:0;p.phase=a.selected===0?0:60;}
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
 const model=activeModel(),a=current().apparatus,on=a.power&&a.connected;
 const overrange=on&&(lab.id===6&&Number(model.measurement.i)>equipmentLimits.ac.current||lab.id===4&&Math.abs(Number(model.measurement.i))>(Number(model.measurement.u)<0?equipmentLimits.diode.microamps/1000:equipmentLimits.diode.milliamps)||lab.id===7&&Number(model.measurement.i)>currentLimit());
 const noSignal=[4,5,6,7].includes(lab.id)&&(Number(model.measurement.u)===0||([4,6,7].includes(lab.id)&&Number(model.measurement.i)===0));
 const rangeReason=lab.id===7?`Зменш струм: межа приладу для ${a.selected===0?'ламп — 0,5':'котушки — 2,5'} А.`:lab.id===4?'Зменш модуль напруги: струм виходить за шкалу струмового приладу.':'Зменш напругу: струм перевищує межу амперметра 0,5 А.';
 const reason=!a.power?'Увімкни живлення установки.':!a.connected?'Під’єднай вимірювальний провід.':noSignal?'Задай ненульові напругу та струм для вимірювання.':overrange?rangeReason:lab.id===2&&a.selected===0?'Обери невідомий елемент для вимірювання ЕРС.':model.reading!==undefined&&Math.abs(model.reading)>(lab.id===8?equipmentLimits.sotti.resolution/(2*12.6):.005)?'Збалансуй коло: наблизь показ нульового індикатора до нуля.':lab.id===3&&a.heating&&Math.abs(a.temperature-current().params.t)>.5?'Дочекайся температурної рівноваги.':'';
 const record=$<HTMLButtonElement>('[data-action="record"]');record.disabled=Boolean(reason);record.title=reason;
 visual?.set(benchState());
}
function measurementLabel(m:Measurement){return `${m.source==='demo'?'Модель':'Власні'}${lab.id===1?' · '+bridgeModeLabel(m.mode):lab.id===6?' · '+m.mode.toUpperCase():''}`;}
function renderBridgeSummary(valid:Measurement[],total:number){
 const groups=new Map<string,{mean:number;error:number;count:number}>();
 for(const mode of bridgeModes){const results=valid.filter(m=>m.mode===mode).map(m=>rowResult(m).result);if(results.length)groups.set(mode,{mean:results.reduce((sum,r)=>sum+r.rx,0)/results.length,error:results.reduce((sum,r)=>sum+r.error,0)/results.length,count:results.length});}
 const summaries=[...groups].map(([mode,g])=>`<div class="fit-results"><span>${bridgeModeLabel(mode)} · ${g.count} вимірів</span><strong>R = ${format(g.mean)} ± ${format(g.error)} Ом</strong><span>Гранична похибка середнього: ${format(100*g.error/g.mean)}%</span></div>`);
 const a=groups.get('r1'),b=groups.get('r2');
 if(a&&b)for(const mode of ['series','parallel'] as const){const actual=groups.get(mode);if(!actual)continue;const expected=combineResistances(a.mean,b.mean,mode),error=combinedResistanceError(a.mean,b.mean,a.error,b.error,mode),difference=Math.abs(actual.mean-expected);summaries.push(`<div class="fit-results"><span>${bridgeModeLabel(mode)} — порівняння за виміряними R₁ і R₂</span><strong>За формулою: ${format(expected)} ± ${format(error)} Ом</strong><span>Різниця: ${format(difference)} Ом. ${difference<=error+actual.error?'У межах сумарної граничної похибки.':'Різниця перевищує сумарну граничну похибку.'}</span></div>`);}
 const legacy=valid.filter(m=>!bridgeModes.includes(m.mode as typeof bridgeModes[number])).length;
 if(legacy)summaries.push(`<p class="summary-note">${legacy} попередніх вимірів без позначення з’єднання збережено в таблиці; вони не об’єднуються із новими серіями.</p>`);
 $('#table-summary').innerHTML=`<p class="small muted">Коректних вимірів: ${valid.length} / ${total}. Середні обчислюються окремо для кожного з’єднання.</p>${summaries.join('')}`;
}
function rowResult(m:Measurement):{result:Record<string,number>;error?:string}{try{return {result:calculateRow(lab.id,m.row,m.mode)};}catch(e){return {result:{},error:e instanceof Error?e.message:'Некоректні дані'};}}
function renderRows(){
 const rows=current().rows;$('#row-count').textContent=String(rows.length);
 $<HTMLButtonElement>('[data-action="export"]').disabled=rows.length===0;
 $('#measurements tbody').innerHTML=rows.map((m,i)=>{
  const {result,error}=rowResult(m);
  return `<tr data-row="${m.id}" class="${error?'invalid-row':''}"><th scope="row">${i+1}</th><td><span class="source-badge ${m.source==='demo'?'demo':''}">${measurementLabel(m)}</span></td>${lab.columns.map(c=>`<td><input type="number" inputmode="decimal" step="any" data-cell="${c.key}" value="${m.row[c.key]??''}" aria-label="${esc(c.label)}, ${esc(c.unit)}, вимір ${i+1}" placeholder="—"></td>`).join('')}${lab.outputs.map(c=>`<td class="computed" data-result="${c.key}">${format(result[c.key])}</td>`).join('')}<td><button class="delete-row" data-delete="${m.id}" aria-label="Видалити вимір ${i+1}">×</button></td></tr>${error?`<tr class="row-error" data-error-for="${m.id}"><td colspan="${lab.columns.length+lab.outputs.length+3}">${esc(error)}</td></tr>`:''}`;
 }).join('');
 updateSummary();if(visual)updateModel();$('#measurements').setAttribute('aria-label',`Вимірювання роботи ${lab.id}`);
}
function updateRow(element:HTMLTableRowElement,m:Measurement){
 const {result,error}=rowResult(m);element.classList.toggle('invalid-row',Boolean(error));
 for(const output of lab.outputs)element.querySelector(`[data-result="${output.key}"]`)!.textContent=format(result[output.key]);
 let errorRow=document.querySelector<HTMLTableRowElement>(`[data-error-for="${m.id}"]`);
 if(error){if(!errorRow){errorRow=document.createElement('tr');errorRow.className='row-error';errorRow.dataset.errorFor=String(m.id);element.after(errorRow);}errorRow.innerHTML=`<td colspan="${lab.columns.length+lab.outputs.length+3}">${esc(error)}</td>`;}else errorRow?.remove();
 updateSummary();if(visual)updateModel();
}
function updateSummary(){
 const rows=current().rows, valid=rows.filter(m=>!rowResult(m).error);const host=$('#table-summary');
 if(!valid.length){host.innerHTML='';return;}
 if(lab.id===1){renderBridgeSummary(valid,rows.length);return;}
 if(lab.id===3){try{const f=thermalFit(valid.map(m=>m.row));host.innerHTML=`<div class="fit-results"><span>Лінійна апроксимація · ${valid.length} точок</span><strong>α = ${format(f.alpha,6)} К⁻¹</strong><strong>ΔW = ${format(f.gap)} еВ</strong><strong>R₀ = ${format(f.r0)} Ом</strong></div>`;}catch(e){host.innerHTML=`<p class="summary-note">${esc((e as Error).message)}</p>`;}return;}
 const first=lab.outputs[0];const values=valid.map(m=>rowResult(m).result[first.key]).filter(Number.isFinite);
 const mean=values.reduce((s,v)=>s+v,0)/values.length;
 let rectification='';
 if(lab.id===4){
  const pairs=valid.filter(m=>m.row.u!>0).map(m=>{const reverse=valid.find(n=>n.row.u!<0&&Math.abs(n.row.u!+m.row.u!)<1e-6);return reverse?`K(${format(m.row.u!)} В) = ${format(Math.abs(m.row.i!/reverse.row.i!))}`:'';}).filter(Boolean);
  if(pairs.length)rectification=`<div class="fit-results"><span>Коефіцієнт випрямлення K = |Iпр| / |Iзв| при однаковому |U|</span>${pairs.map(p=>`<strong>${p}</strong>`).join('')}</div>`;
 }
 host.innerHTML=`<div class="fit-results"><span>Коректних вимірів: ${valid.length} / ${rows.length}</span><strong>Середнє ${first.label} = ${format(mean)} ${first.unit}</strong>${lab.id===4?'<span>Середнє R для різних напруг має лише описовий зміст.</span>':''}</div>${rectification}`;
}
function updateConnections(){if(![1,8].includes(lab.id))return;const a=$<HTMLInputElement>('#combine-a').valueAsNumber,b=$<HTMLInputElement>('#combine-b').valueAsNumber;
 if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0){$('#combine-result').textContent='Введи два додатні значення.';return;}
 const series=lab.id===1?a+b:a*b/(a+b),parallel=lab.id===1?a*b/(a+b):a+b,unit=lab.id===1?'Ом':'мкФ';
 $('#combine-result').innerHTML=`<span>Послідовно <strong>${format(series)} ${unit}</strong></span><span>Паралельно <strong>${format(parallel)} ${unit}</strong></span>`;
}
function syncParams(){for(const f of lab.fields)for(const el of document.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[data-param="${f.key}"]`)){el.value=String(current().params[f.key]);el.classList.remove('invalid');}$('#param-error').hidden=true;}
function addMeasurement(row:Row,kind:'demo'|'manual',mode=current().mode){if(current().rows.length>=200){toast('Максимум 200 вимірів на роботу. Експортуй журнал і видали непотрібні рядки.');return;}current().rows.push({id:nextId++,row:{...row},mode,source:kind});persist();renderRows();}
function selectTab(next:string){
 tab=next;for(const name of ['experiment','theory','questions']){const active=next===name;$(`#panel-${name}`).hidden=!active;const button=$(`#tab-${name}`);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
 $('#workspace').scrollTop=0;
}
function exportRows(){const rows=current().rows;if(!rows.length){toast('Спочатку додай хоча б один вимір.');return;}
 const headers=['№','Джерело',lab.id===1?'З’єднання':'Режим',...lab.columns.map(c=>`${c.label}${c.unit?', '+c.unit:''}`),...lab.outputs.map(c=>`${c.label}${c.unit?', '+c.unit:''}`),'Помилка'];
 const cells=rows.map((m,i)=>{const {result,error}=rowResult(m);return [i+1,m.source==='demo'?'Модель':'Власні',lab.id===1?bridgeModeLabel(m.mode):m.mode,...lab.columns.map(c=>m.row[c.key]===null?'':String(m.row[c.key]??'')),...lab.outputs.map(c=>Number.isFinite(result[c.key])?String(result[c.key]):''),error??''];});
 downloadCSV(`lab_${lab.id}-measurements.csv`,headers,cells);toast('CSV експортовано з одиницями та позначенням демонстраційних даних.');
}
document.addEventListener('input',event=>{
 const el=event.target as HTMLInputElement|HTMLSelectElement;
 if(el.dataset.param){const f=lab.fields.find(f=>f.key===el.dataset.param)!;const v=el.value===''?NaN:Number(el.value),max=lab.id===7&&f.key==='i'?currentLimit():f.max;
  if(!Number.isFinite(v)||v<f.min||v>max||(f.choices&&!f.choices.includes(v))||(f.discrete&&Math.abs((v-f.min)/f.step-Math.round((v-f.min)/f.step))>1e-8)){el.classList.add('invalid');const e=$('#param-error');e.textContent=f.choices?`${f.label}: обери ${f.choices.map(value=>format(value)).join(', ')} ${f.unit}.`:`${f.label}: введи число від ${f.min} до ${max} ${f.unit}${f.discrete?` з кроком ${format(f.step)} ${f.unit}`:''}.`;e.hidden=false;return;}
  el.classList.remove('invalid');$('#param-error').hidden=true;current().params[f.key]=v;for(const other of document.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[data-param="${f.key}"]`))if(other!==el)other.value=String(v);persist();updateModel();
 }else if(el.dataset.cell){const tr=el.closest<HTMLTableRowElement>('tr')!;const m=current().rows.find(m=>m.id===Number(tr.dataset.row))!;m.row[el.dataset.cell]=el.value!==''&&Number.isFinite(Number(el.value))?Number(el.value):null;m.source='manual';tr.querySelector('.source-badge')!.textContent=measurementLabel(m);tr.querySelector('.source-badge')!.classList.remove('demo');updateRow(tr,m);persist();}
 else if(el.id.startsWith('combine-'))updateConnections();
});
document.addEventListener('click',event=>{
 const b=(event.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;
 if(b.id==='menu'){$('#sidebar').classList.toggle('open');b.setAttribute('aria-expanded',String($('#sidebar').classList.contains('open')));return;}
 if(b.dataset.tab){selectTab(b.dataset.tab);return;}
 if(b.dataset.mode){current().mode=b.dataset.mode;if(lab.id===4)current().apparatus.selected=(current().params.u<0)!==(b.dataset.mode==='reverse')?1:0;persist();updateModel();return;}
 if(b.dataset.preset){current().apparatus.selected=b.dataset.preset==='lamp'?0:1;current().params.phase=b.dataset.preset==='lamp'?0:60;syncParams();persist();updateModel();return;}
 if(b.dataset.frequency){current().params.f=Number(b.dataset.frequency);current().mode='xy';syncParams();persist();updateModel();return;}
 if(b.dataset.delete){current().rows=current().rows.filter(m=>m.id!==Number(b.dataset.delete));persist();renderRows();return;}
 if(b.dataset.image){const f=source[lab.id-1].figures[Number(b.dataset.image)];const d=$<HTMLDialogElement>('#image-dialog');d.querySelector('img')!.src=asset(f.url);d.querySelector('img')!.alt=f.alt;d.querySelector('p')!.textContent=f.alt;d.showModal();return;}
 if(b.classList.contains('dialog-close')){$<HTMLDialogElement>('#image-dialog').close();return;}
 switch(b.dataset.action){
  case 'reset-params':current().apparatus=freshApparatus(lab.id);current().params=Object.fromEntries(lab.fields.map(f=>[f.key,f.value]));syncParams();persist();updateModel();break;
  case 'record':if(!$<HTMLButtonElement>('[data-action="record"]').disabled){addMeasurement(activeModel().measurement,'demo');toast('Покази приладів додано до журналу.');}break;
  case 'add-row':addMeasurement(Object.fromEntries(lab.columns.map(c=>[c.key,lab.id===1&&['dl1','dL'].includes(c.key)?.1:null])),'manual');{const rows=document.querySelectorAll<HTMLTableRowElement>('tr[data-row]');rows[rows.length-1]?.querySelector('input')?.focus();}break;
  case 'export':exportRows();break;
 }
});
document.addEventListener('keydown',event=>{const b=(event.target as HTMLElement).closest<HTMLElement>('[role="tab"]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const names=['experiment','theory','questions'];let i=names.indexOf(tab);i=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:-1)+3)%3;selectTab(names[i]);$(`#tab-${names[i]}`).focus();});
document.addEventListener('click',event=>{const dialog=$<HTMLDialogElement>('#image-dialog');if(event.target===dialog)dialog.close();});
// The browser releases GPU resources on navigation; destroying the device here
// can reject pending WebGPU error scopes before the document unloads.
window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>{save(state);});route();
