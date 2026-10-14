import './style.css';
import { labs } from './config';
import type { Lab } from './config';
import source from './source.json';
import { simulate, calculateRow, thermalFit, format, balance } from './physics';
import type { Row } from './physics';
import { Workbench, benchHints } from './workbench';
import type { BenchState } from './workbench';
import { restore, save, downloadCSV, freshApparatus } from './storage';
import type { Measurement } from './storage';

const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const asset=(path:string)=>import.meta.env.BASE_URL+path;
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const bolt='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m13.5 2-9 12H11L9.5 22l10-13H13l.5-7Z" fill="currentColor"/></svg>';
const arrow='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.6"/></svg>';
const state=restore();let lab:Lab=labs[0];let tab='experiment';let visual:Workbench|undefined;let generation=0;let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;let undo:{lab:number;rows:Measurement[]}|undefined;
let nextId=Math.max(0,...Object.values(state.labs).flatMap(s=>s.rows.map(r=>r.id)))+1;
let toastTimer:ReturnType<typeof setTimeout>;
const current=()=>state.labs[lab.id];

function persist(){const ok=save(state);$('#save-status').textContent=ok?'Збережено в браузері':'Збереження недоступне';}
function toast(message:string,canUndo=false){const e=$('#toast');e.innerHTML=`<span>${esc(message)}</span>${canUndo?'<button data-action="undo">Скасувати очищення</button>':''}`;e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{e.hidden=true;},6000);}
function route(){if(location.hash==='#workspace'){$('#workspace')?.focus();return;}const n=Number(location.hash.match(/^#\/lab\/(\d+)$/)?.[1]??1);lab=labs.find(l=>l.id===n)??labs[0];tab='experiment';render();}
function render(){
 ++generation;visual?.dispose();visual=undefined;playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const s=current(),src=source[lab.id-1];
 $('#app').innerHTML=`<a href="#workspace" class="skip-link">Перейти до досліду</a>
 <header class="topbar"><a class="brand" href="#/lab/1"><span class="brand-icon">${bolt}</span><span>електрика<span class="brand-sub">ІНТЕРАКТИВНИЙ ПРАКТИКУМ</span></span></a><div class="top-actions"><span class="local-status"><i></i><span id="save-status">Збережено в браузері</span></span><a class="source-link" href="${asset('Електрика.%20Лабораторні%20роботи.pdf')}" target="_blank" rel="noopener">Методичка <span>↗</span></a><button id="menu" class="menu-button" aria-expanded="false" aria-controls="sidebar">Роботи ☰</button></div></header>
 <div class="layout"><aside id="sidebar" class="sidebar"><div class="sidebar-heading">ТВОЯ ЛАБОРАТОРІЯ <span>08</span></div><nav aria-label="Лабораторні роботи">${labs.map(l=>`<a href="#/lab/${l.id}" class="nav-item ${l.id===lab.id?'active':''}" ${l.id===lab.id?'aria-current="page"':''}><span class="nav-number">${String(l.id).padStart(2,'0')}</span><span>${esc(l.short)}</span>${l.id===lab.id?'<span class="nav-arrow">↗</span>':''}</a>`).join('')}</nav><div class="sidebar-bottom"><span class="mini-orbit">◎</span><strong>Від формули<br>до експерименту.</strong><p>Змінюй. Спостерігай.<br>Перевіряй власні дані.</p><span>ОНУ · ЗАГАЛЬНА ФІЗИКА</span></div></aside>
 <main id="workspace" tabindex="-1"><h1 class="sr-only">${esc(lab.short)}</h1>
 <div class="tabs" role="tablist" aria-label="Розділи лабораторної"><button id="tab-experiment" role="tab" aria-selected="true" aria-controls="panel-experiment" data-tab="experiment">Експеримент<span>01</span></button><button id="tab-theory" role="tab" aria-selected="false" aria-controls="panel-theory" tabindex="-1" data-tab="theory">Теорія<span>02</span></button><button id="tab-questions" role="tab" aria-selected="false" aria-controls="panel-questions" tabindex="-1" data-tab="questions">Контрольні питання<span>03</span></button></div>
 <section id="panel-experiment" role="tabpanel" aria-labelledby="tab-experiment"><div class="experiment-grid">
 <section class="visual-card apparatus-card" aria-label="Інтерактивна лабораторна установка"><p class="bench-pan-hint">На телефоні посунь стенд убік, щоб побачити всі прилади.</p><div class="bench-viewport"><div id="bench" class="bench-host" data-backend="loading"></div></div><p id="model-note"></p></section>
 <section class="controls-card"><div class="section-title"><h2>Параметри досліду</h2><button data-action="reset-params" class="text-button">Скинути ↺</button></div><p class="muted small">Перетягни ручку на стенді або введи значення.</p><div class="controls">${lab.fields.map(f=>`<div class="control"><label for="number-${f.key}">${esc(f.label)}<span>${esc(f.unit)}</span></label><div class="control-inputs"><input id="range-${f.key}" type="range" data-param="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${s.params[f.key]}" aria-label="${esc(f.label)}, повзунок"><input id="number-${f.key}" type="number" inputmode="decimal" data-param="${f.key}" min="${f.min}" max="${f.max}" step="any" value="${s.params[f.key]}" aria-label="${esc(f.label)}, ${esc(f.unit)}"></div></div>`).join('')}</div><p id="param-error" class="error-message" role="status" hidden></p>
 ${[1,2,8].includes(lab.id)?'<button class="primary-button wide" data-action="balance">Збалансувати міст '+arrow+'</button>':''}
 ${lab.id===7?'<div class="load-presets"><button data-preset="lamp">Лампа · φ = 0°</button><button data-preset="coil">Котушка · φ = 60°</button></div>':''}
 ${lab.id===5?'<div class="load-presets"><button data-frequency="50">1:1</button><button data-frequency="100">1:2</button><button data-frequency="150">1:3</button><button data-frequency="200">1:4</button></div>':''}
 <div class="formula-card"><span>КЛЮЧОВА ФОРМУЛА</span><p>${esc(lab.formula)}</p></div><button class="primary-button wide record" data-action="record">Записати покази приладів <span>＋</span></button><p class="small muted model-disclaimer">Демонстраційні покази позначаються в таблиці. Власні дані введи нижче.</p></section>
 </div><div id="metrics" class="metrics" aria-live="polite"></div>
 <section class="data-card"><div class="data-heading"><div><p class="eyebrow">ТВІЙ ЛАБОРАТОРНИЙ ЖУРНАЛ</p><h2>Вимірювання <span id="row-count" class="count">0</span></h2></div><div class="data-actions"><button class="secondary-button" data-action="demo">Демо серія</button><button class="secondary-button" data-action="export">Експорт CSV ↗</button><button class="primary-button" data-action="add-row">＋ Власний вимір</button></div></div><p class="small muted">${lab.id===6?'Режим RL / RLC зберігається для кожного рядка. ':''}Вводь покази приладів. Результати обчислюються одразу.</p><div class="table-scroll"><table id="measurements"><thead><tr><th scope="col">№</th><th scope="col">Джерело</th>${lab.columns.map(c=>`<th scope="col">${c.label}<span>${c.unit}</span></th>`).join('')}${lab.outputs.map(c=>`<th scope="col" class="computed">${c.label}<span>${c.unit}</span></th>`).join('')}<th scope="col"><span class="sr-only">Дії</span></th></tr></thead><tbody></tbody></table></div><div id="table-summary"></div>${[1,2,8].includes(lab.id)?`<p class="small muted uncertainty-note">Похибка відліку кожної довжини: 1 мм.${lab.id===1?" Для магазину опору умовно взято ΔR/R = 0,1%; фактичну похибку визначай за паспортом.":lab.id===2?" Похибкою еталонної ЕРС знехтувано.":" Похибкою еталонної ємності знехтувано."}</p>`:""}<div class="table-footer"><span>Дані залишаються у цьому браузері.</span><button class="text-button danger" data-action="clear">Очистити таблицю</button></div></section>
 ${[1,8].includes(lab.id)?`<section class="connections-card"><div><p class="eyebrow">ПЕРЕВІР ФОРМУЛИ</p><h2>${lab.id===1?'З’єднання опорів':'З’єднання конденсаторів'}</h2><p class="muted small">Порівняй з результатом окремого вимірювання.</p></div><label>${lab.id===1?'R₁':'C₁'}<input type="number" id="combine-a" min="0.001" step="any" value="${lab.id===1?750:3}" aria-label="Перший елемент з’єднання"></label><label>${lab.id===1?'R₂':'C₂'}<input type="number" id="combine-b" min="0.001" step="any" value="${lab.id===1?1000:2}" aria-label="Другий елемент з’єднання"></label><div id="combine-result" aria-live="polite"></div></section>`:''}
 </section>
 <section id="panel-theory" role="tabpanel" aria-labelledby="tab-theory" hidden><div class="theory-grid"><article class="theory-card"><p class="eyebrow">СУТЬ ДОСЛІДУ</p><h2>${esc(lab.short)}</h2><p>${esc(lab.principle)}</p><div class="theory-formula">${esc(lab.formula)}</div><h3>Як виконати роботу</h3><ol class="steps">${lab.steps.map((step,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><p>${esc(step)}</p></li>`).join('')}</ol><h3>Обладнання за методичкою</h3><p class="equipment">${esc(src.equipment)}</p><div class="source-note">Опис за методичними вказівками ОНУ, 2014, с. ${src.pages}. Повний опис, формули похибок та уточнення помилок джерела є у Markdown-файлі.</div><a class="secondary-button" href="${asset(`docs/lab_${lab.id}/README.md`)}" target="_blank" rel="noopener">Повний опис .md ↗</a></article><div class="figures"><p class="eyebrow">СХЕМИ З ОРИГІНАЛУ</p>${src.figures.map((f,i)=>`<figure><button data-image="${i}" aria-label="Збільшити: ${esc(f.alt)}"><img src="${asset(f.url)}" alt="${esc(f.alt)}" loading="lazy"></button><figcaption>${esc(f.alt)} <span>↗</span></figcaption></figure>`).join('')}</div></div></section>
 <section id="panel-questions" role="tabpanel" aria-labelledby="tab-questions" hidden><div class="questions-heading"><p class="eyebrow">ПІДГОТОВКА ДО ЗАХИСТУ</p><h2>Перевір своє розуміння.</h2><p class="muted">Спробуй відповісти самостійно, потім відкрий підказку.</p></div><div class="questions">${src.questions.map((q,i)=>`<details><summary><span class="question-number">${String(i+1).padStart(2,'0')}</span><span>${esc(q)}</span><span class="question-plus">＋</span></summary><p>${esc(lab.hints[i]??'Звернися до теорії та повного опису роботи.')}</p></details>`).join('')}</div></section>
 <footer class="page-footer"><span>ЕЛЕКТРИКА / ІНТЕРАКТИВНИЙ ПРАКТИКУМ</span><span>За методичними вказівками ОНУ · 2014</span></footer>
 </main></div><div id="toast" role="status" hidden></div><dialog id="image-dialog"><button class="dialog-close" aria-label="Закрити зображення">×</button><img alt=""><p></p></dialog>`;
 renderRows();updateConnections();updateModel();
 visual=new Workbench($('#bench'),benchState(),changeBenchParam,benchAction,t=>{current().apparatus.temperature=t;updateModel();},backend=>$('#bench').dataset.backend=backend);
}
function benchState():BenchState{return {id:lab.id,params:current().params,mode:current().mode,apparatus:current().apparatus,playing};}
function activeModel(){const p=lab.id===3?{...current().params,t:current().apparatus.temperature}:current().params;return simulate(lab.id,p,current().mode);}
function changeBenchParam(key:string,value:number){if(lab.id===7&&key==='u')current().params.i=Math.max(.01,Math.min(2.5,current().params.i*value/current().params.u));current().params[key]=value;syncParams();persist();updateModel();}
function benchAction(action:string){
 const a=current().apparatus,p=current().params;
 if(action==='power')a.power=!a.power;
 else if(action==='connection')a.connected=!a.connected;
 else if(action==='heat'){a.heating=!a.heating;if(a.heating)a.power=true;}
 else if(action==='probe-metal')a.probe='metal';
 else if(action==='probe-semi')a.probe='semi';
 else if(action==='cell-toggle')a.selected=a.selected===0?1:0;else if(action==='cell-normal')a.selected=0;else if(action==='cell-unknown')a.selected=1;
 else if(action==='sample'){a.selected=a.selected===0?1:0;p[lab.id===8?'cx':'rx']=lab.id===8?(a.selected===0?3:5):(a.selected===0?750:1275);}
 else if(action==='polarity'){current().mode=current().mode==='reverse'?'forward':'reverse';p.u=current().mode==='reverse'?-Math.abs(p.u||.4):Math.min(.65,Math.abs(p.u));}
 else if(action==='capacitor')current().mode=current().mode==='rl'?'rlc':'rl';
 else if(action==='core'){a.core=!a.core;if(lab.id===6)p.l=Math.min(1000,Number((p.l*(a.core?1.8:1/1.8)).toFixed(4)));}
 else if(action==='load'){a.selected=a.selected===0?1:0;p.phase=a.selected===0?0:60;}
 else if(['scope','xy','sensitivity'].includes(action))current().mode=action;
 syncParams();persist();updateModel();
}
function updateModel(){
 const model=activeModel(),a=current().apparatus,on=a.power&&a.connected;
 $('#metrics').innerHTML=model.metrics.map((m,i)=>`<article class="metric"><span>${esc(m.label)}</span><div>${on?esc(m.detail??format(m.value)):'—'}<small>${esc(m.detail?'':m.unit)}</small></div><span class="metric-foot">${on?(i===0?'За показами установки':i===1?'Демонстраційний показ':'Для порівняння'):'Увімкни установку'}</span></article>`).join('');
 let hint=benchHints[lab.id-1];
 if(!a.connected)hint='Провід від’єднано. Натисни на гніздо вимірювального приладу, щоб відновити коло.';
 else if(!a.power)hint='Спочатку ввімкни живлення на стенді. '+hint;
 else if([1,2,8].includes(lab.id)&&model.reading!==undefined&&Math.abs(model.reading)<(lab.id===8?.001:.005))hint='Нульовий показ: установка урівноважена. Можна записати довжини плечей.';
 if(lab.id===2&&a.selected===0)hint='Підключено еталон ℰₙ. Відрегулюй робочий струм, потім натисни на невідомий елемент.';
 $('#model-note').textContent=hint;
 const record=$<HTMLButtonElement>('[data-action="record"]');record.disabled=!on||(model.reading!==undefined&&Math.abs(model.reading)>(lab.id===8?.001:.005))||(lab.id===2&&a.selected===0)||(lab.id===3&&a.heating&&Math.abs(a.temperature-current().params.t)>.5);record.title=record.disabled?'Увімкни й підготуй установку до вимірювання':'';
 visual?.set(benchState());
}
function rowResult(m:Measurement):{result:Record<string,number>;error?:string}{try{return {result:calculateRow(lab.id,m.row,m.mode)};}catch(e){return {result:{},error:e instanceof Error?e.message:'Некоректні дані'};}}
function renderRows(){
 const rows=current().rows;$('#row-count').textContent=String(rows.length);
 $('#measurements tbody').innerHTML=rows.length?rows.map((m,i)=>{
  const {result,error}=rowResult(m);
  return `<tr data-row="${m.id}" class="${error?'invalid-row':''}"><th scope="row">${i+1}</th><td><span class="source-badge ${m.source==='demo'?'demo':''}">${m.source==='demo'?'Модель':'Власні'}${lab.id===6?' · '+m.mode.toUpperCase():''}</span></td>${lab.columns.map(c=>`<td><input type="number" inputmode="decimal" step="any" data-cell="${c.key}" value="${m.row[c.key]??''}" aria-label="${esc(c.label)}, ${esc(c.unit)}, вимір ${i+1}" placeholder="—"></td>`).join('')}${lab.outputs.map(c=>`<td class="computed" data-result="${c.key}">${format(result[c.key])}</td>`).join('')}<td><button class="delete-row" data-delete="${m.id}" aria-label="Видалити вимір ${i+1}">×</button></td></tr>${error?`<tr class="row-error" data-error-for="${m.id}"><td colspan="${lab.columns.length+lab.outputs.length+3}">${esc(error)}</td></tr>`:''}`;
 }).join(''):`<tr class="empty-row"><td colspan="${lab.columns.length+lab.outputs.length+3}"><span class="empty-icon">＋</span><strong>Перший вимір — початок дослідження.</strong><p>Запиши показ моделі або додай власні дані.</p><button class="secondary-button" data-action="add-row">Додати власний вимір</button></td></tr>`;
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
function syncParams(){for(const f of lab.fields)for(const el of document.querySelectorAll<HTMLInputElement>(`[data-param="${f.key}"]`)){el.value=String(current().params[f.key]);el.classList.remove('invalid');}$('#param-error').hidden=true;}
function addMeasurement(row:Row,kind:'demo'|'manual',mode=current().mode){if(current().rows.length>=200){toast('Максимум 200 вимірів на роботу. Експортуй журнал перед очищенням.');return;}current().rows.push({id:nextId++,row:{...row},mode,source:kind});persist();renderRows();}
function selectTab(next:string){
 tab=next;for(const name of ['experiment','theory','questions']){const active=next===name;$(`#panel-${name}`).hidden=!active;const button=$(`#tab-${name}`);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
}
function demoSeries(){
 const p=current().params;if([1,2,8].includes(lab.id)&&(balance(lab.id,p)<1||balance(lab.id,p)>99)){toast('Рівновага за межами реохорда. Зміни параметри перед демо серією.');return;}const choices=lab.id===3?[30,40,50,60,70,80]:lab.id===4?(current().mode==='reverse'?[-0.1,-0.3,-0.5,-0.7,-1]:[0.1,0.2,0.3,0.4,0.5,0.6]):[0.6,0.8,1,1.2];
 const rows:Row[]=choices.map((v,i)=>{
  const q={...p};if(lab.id===1)q.l=balance(1,q)+[-0.1,0,0.1,0][i];else if(lab.id===2)q.lx=balance(2,q)+[-0.1,0,0.1,0][i];else if(lab.id===3)q.t=v;else if(lab.id===4)q.u=v;else if(lab.id===5)q.u=p.u*v;else if(lab.id===6||lab.id===7)q.u=p.u*v;else if(lab.id===8)q.l=balance(8,q)+[-0.1,0,0.1,0][i];
  return simulate(lab.id,q,current().mode).measurement;
 });
 if(current().rows.length+rows.length>200){toast('Для демо серії недостатньо місця: максимум 200 рядків.');return;}
 for(const row of rows)current().rows.push({id:nextId++,row,mode:current().mode,source:'demo'});persist();renderRows();toast(`Додано ${rows.length} демонстраційних вимірів. Власні дані збережено.`);
}
function exportRows(){const rows=current().rows;if(!rows.length){toast('Спочатку додай хоча б один вимір.');return;}
 const headers=['№','Джерело','Режим',...lab.columns.map(c=>`${c.label}${c.unit?', '+c.unit:''}`),...lab.outputs.map(c=>`${c.label}${c.unit?', '+c.unit:''}`),'Помилка'];
 const cells=rows.map((m,i)=>{const {result,error}=rowResult(m);return [i+1,m.source==='demo'?'Модель':'Власні',m.mode,...lab.columns.map(c=>m.row[c.key]===null?'':String(m.row[c.key]??'')),...lab.outputs.map(c=>Number.isFinite(result[c.key])?String(result[c.key]):''),error??''];});
 downloadCSV(`lab_${lab.id}-measurements.csv`,headers,cells);toast('CSV експортовано з одиницями та позначенням демонстраційних даних.');
}
document.addEventListener('input',event=>{
 const el=event.target as HTMLInputElement;
 if(el.dataset.param){const f=lab.fields.find(f=>f.key===el.dataset.param)!;const v=el.valueAsNumber;
  if(!Number.isFinite(v)||v<f.min||v>f.max){el.classList.add('invalid');const e=$('#param-error');e.textContent=`${f.label}: введи число від ${f.min} до ${f.max} ${f.unit}.`;e.hidden=false;return;}
  el.classList.remove('invalid');$('#param-error').hidden=true;current().params[f.key]=v;for(const other of document.querySelectorAll<HTMLInputElement>(`[data-param="${f.key}"]`))if(other!==el)other.value=String(v);persist();updateModel();
 }else if(el.dataset.cell){const tr=el.closest<HTMLTableRowElement>('tr')!;const m=current().rows.find(m=>m.id===Number(tr.dataset.row))!;m.row[el.dataset.cell]=Number.isFinite(el.valueAsNumber)?el.valueAsNumber:null;m.source='manual';tr.querySelector('.source-badge')!.textContent='Власні'+(lab.id===6?' · '+m.mode.toUpperCase():'');tr.querySelector('.source-badge')!.classList.remove('demo');updateRow(tr,m);persist();}
 else if(el.id.startsWith('combine-'))updateConnections();
});
document.addEventListener('click',event=>{
 const b=(event.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;
 if(b.id==='menu'){$('#sidebar').classList.toggle('open');b.setAttribute('aria-expanded',String($('#sidebar').classList.contains('open')));return;}
 if(b.dataset.tab){selectTab(b.dataset.tab);return;}
 if(b.dataset.mode){current().mode=b.dataset.mode;if(lab.id===4){current().params.u=b.dataset.mode==='reverse'?-Math.abs(current().params.u||0.4):Math.min(0.65,Math.abs(current().params.u));syncParams();}persist();updateModel();return;}
 if(b.dataset.preset){current().apparatus.selected=b.dataset.preset==='lamp'?0:1;current().params.phase=b.dataset.preset==='lamp'?0:60;syncParams();persist();updateModel();return;}
 if(b.dataset.frequency){current().params.f=Number(b.dataset.frequency);current().mode='xy';syncParams();persist();updateModel();return;}
 if(b.dataset.delete){current().rows=current().rows.filter(m=>m.id!==Number(b.dataset.delete));persist();renderRows();return;}
 if(b.dataset.image){const f=source[lab.id-1].figures[Number(b.dataset.image)];const d=$<HTMLDialogElement>('#image-dialog');d.querySelector('img')!.src=asset(f.url);d.querySelector('img')!.alt=f.alt;d.querySelector('p')!.textContent=f.alt;d.showModal();return;}
 if(b.classList.contains('dialog-close')){$<HTMLDialogElement>('#image-dialog').close();return;}
 switch(b.dataset.action){
  case 'balance':{const f=lab.id===2?'lx':'l',v=balance(lab.id,current().params);if(v<1||v>99){toast('Рівновага за межами реохорда. Зміни еталонні параметри.');break;}current().params[f]=v;syncParams();persist();updateModel();toast('Міст урівноважено. Запиши покази приладів.');break;}
  case 'reset-params':current().apparatus=freshApparatus(lab.id);current().params=Object.fromEntries(lab.fields.map(f=>[f.key,f.value]));syncParams();persist();updateModel();break;
  case 'record':if(!$<HTMLButtonElement>('[data-action="record"]').disabled){addMeasurement(activeModel().measurement,'demo');toast('Покази приладів додано до журналу.');}break;
  case 'add-row':addMeasurement(Object.fromEntries(lab.columns.map(c=>[c.key,null])),'manual');{const rows=document.querySelectorAll<HTMLTableRowElement>('tr[data-row]');rows[rows.length-1]?.querySelector('input')?.focus();}break;
  case 'demo':demoSeries();break;
  case 'export':exportRows();break;
  case 'clear':if(current().rows.length){undo={lab:lab.id,rows:current().rows};current().rows=[];persist();renderRows();toast('Таблицю очищено.',true);}break;
  case 'undo':if(undo){state.labs[undo.lab].rows=[...undo.rows,...state.labs[undo.lab].rows].slice(0,200);if(undo.lab===lab.id)renderRows();persist();undo=undefined;toast('Вимірювання відновлено.');}break;
 }
});
document.addEventListener('keydown',event=>{const b=(event.target as HTMLElement).closest<HTMLElement>('[role="tab"]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const names=['experiment','theory','questions'];let i=names.indexOf(tab);i=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:-1)+3)%3;selectTab(names[i]);$(`#tab-${names[i]}`).focus();});
document.addEventListener('click',event=>{const dialog=$<HTMLDialogElement>('#image-dialog');if(event.target===dialog)dialog.close();});
window.addEventListener('hashchange',route);window.addEventListener('pagehide',event=>{save(state);if(!event.persisted)visual?.dispose();});route();
