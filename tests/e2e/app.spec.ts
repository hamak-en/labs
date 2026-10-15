import {test,expect} from '@playwright/test';
import {crtPixels,crtTraceBounds} from './pixels';
const power=async(page:import('@playwright/test').Page)=>{await page.locator('[data-bench-action="power"]').click();};
test('all eight drawn apparatuses: power, readings, recording, theory and questions',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(let id=1;id<=8;id++){
  await page.goto(`./#/lab/${id}`);await expect(page.locator('.bench-svg')).toBeVisible();await expect(page.locator('#bench')).not.toHaveAttribute('data-backend','loading',{timeout:20000});await expect(page.locator('#chart')).toHaveCount(0);
  await expect(page.locator('[data-action="record"]')).toBeDisabled();await power(page);if(id===1)await page.locator('#number-l').fill('42.9');else if(id===2)await page.locator('#number-lx').fill('58.94');else if(id===8)await page.locator('#number-l').fill('40');await page.locator('[data-action="record"]').click();await expect(page.locator('tr[data-row]')).toHaveCount(1);await expect(page.locator('.row-error')).toHaveCount(0);
  await page.locator('.bench-viewport').screenshot({path:`test-results/bench-${id}.png`});
  await page.getByRole('tab',{name:'Теорія'}).click();await expect(page.locator('.figures img').first()).toBeVisible();await expect.poll(()=>page.locator('.figures img').first().evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('tab',{name:'Контрольні питання'}).click();await page.locator('#panel-questions summary').first().click();await expect(page.locator('#panel-questions details[open] p').first()).toBeVisible();
 }
 expect(errors).toEqual([]);
});
test('drag the real rheochord contact, turn a knob with keyboard, and disconnect a wire',async({page})=>{
 await page.goto('./#/lab/1');await power(page);const contact=page.getByRole('slider',{name:'Рухомий контакт реохорда'});const bounds=await contact.boundingBox(),svg=await page.locator('.bench-svg').boundingBox();if(!bounds||!svg)throw new Error('Missing apparatus');
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(svg.x+(110+580*.3)/800*svg.width,bounds.y+bounds.height/2,{steps:10});await page.mouse.up();await expect(page.locator('#number-l')).toHaveValue('30');
 await page.getByRole('slider',{name:'Опір магазину',exact:true}).press('ArrowRight');await expect(page.locator('#number-r')).toHaveValue('2000');
 await expect(page.locator('[data-action="balance"]')).toHaveCount(0);await page.locator('#number-l').fill('27.3');await expect(page.locator('[data-action="record"]')).toBeEnabled();await page.locator('[data-bench-action="connection"]').click();await expect(page.locator('[data-action="record"]')).toBeDisabled();await page.locator('[data-bench-action="connection"]').click();await expect(page.locator('[data-action="record"]')).toBeEnabled();
});
test('compensation selects the actual reference cell and then the unknown',async({page})=>{await page.goto('./#/lab/2');await power(page);await expect(page.locator('#number-ex')).toHaveCount(0);await expect(page.locator('.bench-svg')).toContainText('? В');await expect(page.locator('.bench-svg')).not.toContainText('1,2 В');await page.locator('[data-bench-action="cell-normal"]').click();await expect(page.locator('[data-action="record"]')).toBeDisabled();await expect(page.locator('[data-bench-action="cell-normal"]')).toHaveAttribute('aria-pressed','true');await page.locator('[data-bench-action="cell-toggle"]').click();await page.locator('#number-lx').fill('58.94');await expect(page.locator('[data-action="record"]')).toBeEnabled();});

test('journal: validation, persistence, deletion and CSV',async({page})=>{
 await page.goto('./#/lab/1');await power(page);await page.locator('#number-l').fill('42.8571428571');await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="rx"]')).toHaveText('750');
 await page.locator('[data-cell="l1"]').fill('25');await page.locator('[data-cell="l2"]').fill('75');await expect(page.locator('[data-result="rx"]')).toHaveText(/333/);await expect(page.locator('.source-badge')).toHaveText('Власні · R₁');
 await page.locator('[data-cell="l1"]').fill('0');await expect(page.locator('.row-error')).toBeVisible();await page.locator('[data-cell="l1"]').fill('25');await page.reload();await expect(page.locator('[data-cell="l1"]')).toHaveValue('25');await expect(page.locator('[data-bench-action="power"]')).toHaveAttribute('aria-pressed','true');
 const downloaded=page.waitForEvent('download');await page.locator('[data-action="export"]').click();expect((await downloaded).suggestedFilename()).toBe('lab_1-measurements.csv');await page.locator('[data-delete]').click();await expect(page.locator('tr[data-row]')).toHaveCount(0);
});
test('heating a water bath changes actual temperature and both ohmmeter readings',async({page})=>{
 await page.goto('./#/lab/3');await page.locator('#number-t').fill('40');await page.locator('[data-bench-action="heat"]').click();await expect(page.locator('[data-bench-action="heat"]')).toHaveAttribute('aria-pressed','true');await expect.poll(()=>page.locator('.bench-readout').allTextContents()).not.toContain('Фактична t: 30 °C');
 await page.locator('[data-bench-action="probe-semi"]').first().click();await expect(page.locator('.bench-small').filter({hasText:'kΩ'})).toBeVisible();await expect(page.locator('[data-action="record"]')).toBeDisabled();await expect(page.locator('[data-action="record"]')).toBeEnabled({timeout:12000});await page.locator('[data-action="record"]').click();expect(Number(await page.locator('[data-cell="t"]').inputValue())).toBeGreaterThan(39);
});
test('drawn diode polarity and RL capacitor/core controls change physical readings',async({page})=>{
 await page.goto('./#/lab/4');await power(page);await page.locator('[data-bench-action="polarity"]').click();await expect(page.locator('#number-u')).toHaveValue('0.4');await expect(page.getByRole('slider',{name:'Регулятор напруги',exact:true})).toHaveAttribute('aria-valuenow','0.4');await expect(page.locator('.bench-svg')).toContainText('Зворотне зміщення');await page.locator('[data-action="record"]').click();await expect(page.locator('[data-cell="u"]')).toHaveValue('-0.4');await page.locator('[data-bench-action="polarity"]').click();await expect(page.locator('#number-u')).toHaveValue('0.4');await expect(page.locator('.bench-svg')).toContainText('Пряме зміщення');
 await page.goto('./#/lab/6');await power(page);await page.locator('#number-u').fill('20');await page.locator('.bench-viewport').screenshot({path:'test-results/rlc-wiring.png'});await page.locator('[data-bench-action="capacitor"]').click();await page.locator('.bench-viewport').screenshot({path:'test-results/rl-wiring.png'});await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="l"]')).toHaveText('107,7');await page.locator('[data-bench-action="core"]').click();await expect(page.locator('#number-l')).toHaveCount(0);await expect(page.locator('.bench-svg')).toContainText('Осердя вставлене');await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="l"]').last()).toHaveText('193,86');await page.locator('[data-bench-action="capacitor"]').click();await expect(page.locator('[data-result="l"]').first()).toHaveText('107,7');
});
test('flipping the diode preserves signed DC settings without clamping or replacing zero',async({page})=>{
 await page.goto('./#/lab/4');await power(page);
 const voltage=page.locator('#number-u'),flip=page.locator('[data-bench-action="polarity"]');
 for(const value of ['0.65','-0.8','0']){
  await voltage.fill(value);
  const source=page.getByRole('slider',{name:'Регулятор напруги',exact:true});
  for(let turn=0;turn<2;turn++){
   await flip.click();await expect(voltage).toHaveValue(value);await expect(source).toHaveAttribute('aria-valuenow',value);
   if(value==='-0.8'&&turn===0){await expect(page.locator('.bench-svg')).toContainText('Поза шкалою');await expect(page.locator('[data-action="record"]')).toBeDisabled();}
  }
 }
});
test('galvanometer reports overrange bounds without inventing an exact reading',async({page})=>{
 await page.goto('./#/lab/1');await power(page);
 const meter=page.locator('.bench-meter[aria-label="ГАЛЬВАНОМЕТР G"]');
 await page.locator('[data-bench-action="bridge-r2"]').click();await page.locator('#number-r').fill('1000');await page.locator('#number-l').fill('1');
 await expect(meter.locator('.bench-readout')).toHaveText('< −500 мкА');
 await expect(meter.locator('.bench-overrange')).toHaveText('Поза шкалою');
 await expect(page.locator('[data-action="record"]')).toBeDisabled();
 await page.locator('#number-r').fill('10000');await page.locator('#number-l').fill('99');
 await expect(meter.locator('.bench-readout')).toHaveText('> 500 мкА');
 await expect(meter.locator('.bench-scale')).toHaveText(['−500','0','+500']);
 await page.locator('#number-r').fill('1000');await page.locator('#number-l').fill('56.043956043956');
 await expect(meter.locator('.bench-readout')).toHaveText('0 мкА');
 await expect(meter.locator('.bench-overrange')).toHaveCount(0);
 await expect(page.locator('[data-action="record"]')).toBeEnabled();
 await power(page);await expect(meter.locator('.bench-readout')).toHaveText('живлення вимкнене');
});
test('AC ammeter keeps its 0.5 A scale when the circuit or current changes',async({page})=>{
 await page.goto('./#/lab/6');await power(page);
 const ammeter=page.locator('.bench-meter[aria-label="АМПЕРМЕТР A"]'),scale=ammeter.locator('.bench-scale');
 const fixedScale=['0','0,25','0,5'];
 await expect(scale).toHaveText(fixedScale);
 await page.locator('#number-u').fill('100');await page.locator('#number-r').fill('200');
 await page.locator('[data-bench-action="capacitor"]').click();
 await expect(scale).toHaveText(fixedScale);
 await expect(ammeter.locator('.bench-readout')).toHaveText('0,49 А');
 await page.locator('[data-bench-action="core"]').click();
 await expect(ammeter.locator('.bench-readout')).toHaveText('0,48 А');
 await expect(scale).toHaveText(fixedScale);
 await page.locator('.bench-viewport').screenshot({path:'test-results/ammeter-fixed-scale.png'});
 await page.locator('#number-r').fill('30');
 await expect(ammeter.locator('.bench-overrange')).toHaveText('Поза шкалою');
 await expect(ammeter.locator('.bench-readout')).toHaveText('> 0,5 А');
 await expect(page.locator('[data-action="record"]')).toBeDisabled();
 await expect(scale).toHaveText(fixedScale);
 await ammeter.locator('[data-bench-action="connection"]').click();
 await expect(ammeter.locator('.bench-overrange')).toHaveCount(0);
 await expect(scale).toHaveText(fixedScale);
 await ammeter.locator('[data-bench-action="connection"]').click();
 await page.locator('[data-bench-action="capacitor"]').click();
 await expect(scale).toHaveText(fixedScale);
 await power(page);await expect(scale).toHaveText(fixedScale);
});
test('WebGPU oscilloscope lives inside the instrument, XY and knobs respond',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('./#/lab/5');await expect(page.locator('#bench')).toHaveAttribute('data-backend','WebGPU',{timeout:20000});await power(page);await expect(page.locator('.scope-scale')).toContainText('X: t, мс · 2 мс/под.');await expect(page.locator('.scope-scale')).toContainText('Y: Uᵧ, В · 2 В/под.');await page.locator('[data-bench-action="xy"]').click();await page.getByRole('slider',{name:'Частота звукового генератора'}).press('End');await expect(page.locator('#number-f')).toHaveValue('1000');await page.locator('#number-f').fill('200');await expect(page.locator('[data-bench-action="xy"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.scope-scale')).toContainText('X: Uₓ, В · 1 В/под.');
 const b=await page.locator('.bench-svg').boundingBox();if(!b)throw new Error('Missing scope');const roi={x:b.x+240/800*b.width,y:b.y+145/540*b.height+await page.evaluate(()=>scrollY),width:240/800*b.width,height:190/540*b.height};await expect.poll(async()=>crtPixels(await page.screenshot({fullPage:true}),roi)).toBeGreaterThan(100);await page.locator('#number-u').fill('5');const expectedSpan=5/2*23.75*2*b.width/800;await expect.poll(async()=>{const trace=crtTraceBounds(await page.screenshot({fullPage:true}),roi);return Math.abs(trace.maxY-trace.minY-expectedSpan);}).toBeLessThan(3);await page.screenshot({path:'test-results/oscilloscope.png',fullPage:true});await page.locator('[data-bench-action="scope"]').click();await page.locator('.bench-viewport').screenshot({path:'test-results/scope-grid-sweep.png'});await page.locator('[data-bench-action="sensitivity"]').click();await expect(page.locator('.scope-scale')).toContainText('X: Uₓ, В · 20 В/под.');await page.locator('.bench-viewport').screenshot({path:'test-results/scope-grid-sensitivity.png'});expect(errors).toEqual([]);
});
test('lamp/coil switch and capacitor substitution on drawn equipment',async({page})=>{
 await page.goto('./#/lab/7');await power(page);await page.locator('[data-bench-action="load"]').click();await expect(page.locator('#number-phase')).toHaveCount(0);await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="pf"]')).toHaveText('1');await page.locator('[data-cell="p"]').fill('10000');await expect(page.locator('.row-error')).toContainText('P ≤ UI');
 await page.goto('./#/lab/8');await power(page);await page.locator('[data-bench-action="sample"]').click();await expect(page.locator('#number-cx')).toHaveCount(0);await expect(page.locator('.bench-svg')).toContainText('? мкФ');await page.locator('#number-l').fill('28.5714285714');await page.locator('.bench-viewport').screenshot({path:'test-results/sotti-contact.png'});await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="cx"]')).toHaveText('5');
});
test('mobile has a pannable apparatus and functional Canvas fallback',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./?renderer=canvas#/lab/1');await expect(page.locator('#bench')).toHaveAttribute('data-backend','Canvas 2D');await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.bench-viewport').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);await page.locator('#menu').click();await page.getByRole('link',{name:'05 Електронний осцилограф'}).click();await expect(page).toHaveURL(/lab\/5/);await expect(page.locator('.sidebar')).toBeHidden();await page.locator('[data-bench-action="power"]').click();await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('desktop apparatus preview',async({page})=>{await page.goto('./#/lab/1');await expect(page.locator('#bench')).not.toHaveAttribute('data-backend','loading',{timeout:20000});await power(page);await page.locator('#number-l').fill('42.9');await page.locator('#number-r').fill('2000');await page.locator('#number-r').fill('1000');await page.locator('#toast').waitFor({state:'hidden',timeout:8000});await page.locator('[data-bench-action="power"]').focus();await page.screenshot({path:'test-results/desktop.png',fullPage:true});await page.screenshot({path:'test-results/preview.png',fullPage:false});});

test('topbar scrolls with the content while sidebar navigation stays in place',async({page})=>{
 for(const viewport of [{width:1440,height:800},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.goto('./?renderer=canvas#/lab/5');
  const content=page.locator('#workspace'),header=page.locator('.topbar');
  const initialHeader=await header.boundingBox(),bounds=await content.boundingBox();
  if(!initialHeader||!bounds)throw new Error('Missing layout');
  const initialSidebar=viewport.width>700?await page.locator('.sidebar').boundingBox():null;
  await page.mouse.move(bounds.x+8,bounds.y+bounds.height/2);await page.mouse.wheel(0,600);
  await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(()=>scrollY)).toBe(0);
  expect((await header.boundingBox())!.y).toBeLessThan(initialHeader.y-100);
  await expect(header).not.toBeInViewport();
  if(initialSidebar)expect(await page.locator('.sidebar').boundingBox()).toEqual(initialSidebar);
  await page.getByRole('tab',{name:'Теорія'}).click();await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBe(0);
  if(viewport.width<700){await page.locator('#menu').click();await expect(page.getByRole('link',{name:'08 Міст Сотті'})).toBeInViewport();}
 }
});

test('rheochord buttons step by 0.1 cm, respect limits, and persist the contact position',async({page})=>{
 for(const id of [1,2,8]){
  await page.goto(`./#/lab/${id}`);
  const input=page.locator(id===2?'#number-lx':'#number-l');
  const left=page.locator('[data-bench-action="ruler-left"]'),right=page.locator('[data-bench-action="ruler-right"]');
  await input.fill('50');await left.click();await expect(input).toHaveValue('49.9');
  await right.press('Enter');await expect(input).toHaveValue('50');
  await input.fill('1');await expect(left).toHaveAttribute('aria-disabled','true');
  await right.click();await expect(input).toHaveValue('1.1');
  await input.fill('99');await expect(right).toHaveAttribute('aria-disabled','true');
  await left.press('Space');await expect(input).toHaveValue('98.9');
  await page.reload();await expect(input).toHaveValue('98.9');
  await page.locator('.bench-viewport').screenshot({path:`test-results/rheochord-buttons-${id}.png`});
 }
});

test('unknown specimen values stay hidden while measured inputs and calculated results remain available',async({page})=>{
 const hidden:Record<number,string[]>={1:['rx','rx2'],2:['ex'],3:['r0','alpha','gap'],6:['l'],7:['phase'],8:['cx']};
 for(let id=1;id<=8;id++){
  await page.goto(`./?renderer=canvas#/lab/${id}`);
  for(const key of hidden[id]??[]){
   await expect(page.locator(`[data-param="${key}"]`)).toHaveCount(0);
   await expect(page.locator(`[data-bench-drag="${key}"]`)).toHaveCount(0);
  }
  await expect(page.locator('[data-action="balance"]')).toHaveCount(0);
  await expect(page.locator('tr[data-row]')).toHaveCount(0);
  if(id===1||id===8){await expect(page.locator('#combine-a')).toHaveValue('');await expect(page.locator('#combine-b')).toHaveValue('');}
  if(id===6){await expect(page.locator('.bench-svg')).toContainText('L = ? мГн');await expect(page.locator('.bench-svg')).not.toContainText('107,7 мГн');}
  if(id===8){await expect(page.locator('#number-c0')).toHaveCount(0);await expect(page.locator('.bench-svg')).toContainText('2 мкФ');await expect(page.locator('.bench-svg')).toContainText('? мкФ');}
  if(id===5)await expect(page.locator('#number-phase')).toBeVisible();
 }
 await page.goto('./?renderer=canvas#/lab/7');await power(page);await page.locator('[data-action="record"]').click();
 await expect(page.locator('[data-result="phase"]')).toHaveText('45');
});

test('scope covers the configured generator range, a complete phase cycle and 50 V RMS sensitivity',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./#/lab/5');await power(page);
 const frequency=page.getByRole('slider',{name:'Частота звукового генератора',exact:true});
 await frequency.press('Home');await expect(page.locator('#number-f')).toHaveValue('1');
 await frequency.press('End');await expect(page.locator('#number-f')).toHaveValue('1000');
 await page.getByRole('slider',{name:'Фаза сигналу',exact:true}).press('End');await expect(page.locator('#number-phase')).toHaveValue('360');
 await page.locator('[data-bench-action="sensitivity"]').click();await expect(page.locator('#number-u')).toBeHidden();await expect(page.locator('#number-ux')).toBeVisible();
 await page.getByRole('slider',{name:'Діюча напруга X',exact:true}).press('End');await expect(page.locator('#number-ux')).toHaveValue('50');await expect(page.locator('.scope-scale')).toContainText('20 В/под.');
 await page.locator('[data-action="record"]').click();await expect(page.locator('[data-cell="u"]')).toHaveValue('50');await expect(page.locator('[data-result="alpha"]')).toHaveText('1');
 await page.locator('.bench-viewport').screenshot({path:'test-results/scope-50v.png'});
 await page.locator('#number-ux').fill('0');await expect(page.locator('[data-action="record"]')).toBeDisabled();
 expect(errors).toEqual([]);
});

test('documented source, resistor and capacitor limits apply to controls and restored data',async({page})=>{
 await page.goto('./#/lab/1');await page.getByRole('slider',{name:'Опір магазину',exact:true}).press('Home');await expect(page.locator('#number-r')).toHaveValue('1000');await expect(page.locator('#number-r')).toHaveAttribute('step','1000');await page.locator('#number-r').fill('1500');await expect(page.locator('#param-error')).toContainText('з кроком 1 000 Ом');await expect(page.getByRole('slider',{name:'Опір магазину',exact:true})).toHaveAttribute('aria-valuenow','1000');
 await page.locator('#number-r').fill('999');await expect(page.locator('#param-error')).toBeVisible();await expect(page.getByRole('slider',{name:'Опір магазину',exact:true})).toHaveAttribute('aria-valuenow','1000');
 await page.goto('./#/lab/4');const source=page.getByRole('slider',{name:'Регулятор напруги',exact:true});await source.press('End');await expect(page.locator('#number-u')).toHaveValue('2');await source.press('Home');await expect(page.locator('#number-u')).toHaveValue('-2');
 await page.goto('./#/lab/6');await expect(page.locator('#number-f')).toHaveCount(0);await expect(page.locator('#number-c option')).toHaveText(['5 мкФ','10 мкФ','20 мкФ']);await page.locator('#number-c').selectOption('5');await expect(page.locator('.bench-svg')).toContainText('5 мкФ');
 await page.addInitScript(()=>{const s=JSON.parse(localStorage.getItem('electricity-lab:v1')!);s.labs[6].params.f=200;s.labs[6].params.c=150;s.labs[8].params.c0=7;localStorage.setItem('electricity-lab:v1',JSON.stringify(s));});
 await page.reload();await expect(page.locator('#number-c')).toHaveValue('20');await expect(page.locator('.bench-svg')).toContainText('50 Hz');
 await page.goto('./#/lab/8');await expect(page.locator('#number-c0')).toHaveCount(0);await expect(page.locator('.bench-svg')).toContainText('2 мкФ');
});

test('power uses the 500 mA lamp meter and 2.5 A coil meter with explicit overrange',async({page})=>{
 await page.goto('./#/lab/7');await power(page);await page.locator('#number-i').fill('1');
 await page.locator('[data-bench-action="load"]').click();const milli=page.locator('.bench-digital[aria-label="МІЛІАМПЕРМЕТР"]');await expect(milli.locator('.bench-lcd')).toHaveText('> 500');await expect(milli).toContainText('Поза шкалою');await expect(page.locator('[data-action="record"]')).toBeDisabled();await expect(page.locator('#number-i')).toHaveAttribute('max','0.5');
 await page.locator('#number-i').fill('0.5');await expect(milli.locator('.bench-lcd')).toHaveText('500');await expect(page.locator('[data-action="record"]')).toBeEnabled();
 await page.locator('[data-bench-action="load"]').click();await expect(page.locator('#number-i')).toHaveAttribute('max','2.5');await expect(page.locator('.bench-digital[aria-label="АМПЕРМЕТР"] .bench-lcd')).toHaveText('0,5');await expect(page.locator('.bench-meter[aria-label="ВАТМЕТР W"] .bench-scale')).toHaveText(['0','375','750']);const source=page.getByRole('slider',{name:'Регулятор напруги',exact:true});await source.press('Home');await expect(page.locator('#number-u')).toHaveValue('0');await expect(page.locator('[data-action="record"]')).toBeDisabled();await source.press('ArrowRight');await expect.poll(async()=>Number(await page.locator('#number-i').inputValue())).toBeGreaterThan(0);
});

test('Sotti uses a fixed 2 uF reference and selectable 300, 3 and 1 V ranges',async({page})=>{
 await page.goto('./#/lab/8');await power(page);const meter=page.locator('.bench-meter[aria-label="НУЛЬОВИЙ ВОЛЬТМЕТР"]');
 await expect(meter.locator('.bench-scale')).toHaveText(['0','150','300']);
 await page.locator('[data-bench-action="limit-3"]').click();await expect(meter.locator('.bench-scale')).toHaveText(['0','1,5','3']);await expect(page.locator('#number-limit')).toHaveValue('3');
 await page.locator('#number-limit').selectOption('1');await expect(meter.locator('.bench-scale')).toHaveText(['0','0,5','1']);await page.locator('#number-l').fill('1');await expect(meter.locator('.bench-readout')).toHaveText('> 1 В');
 await page.locator('#number-l').fill('40');await expect(meter.locator('.bench-readout')).toHaveText('0 В');await expect(page.locator('[data-action="record"]')).toBeEnabled();await page.locator('.bench-viewport').screenshot({path:'test-results/sotti-ranges.png'});
 await page.locator('[data-bench-action="sample"]').click();await expect(meter.locator('.bench-scale')).toHaveText(['0','150','300']);
});

test('bridge measures one persistent pair separately, in series and in parallel',async({page})=>{
 await page.goto('./#/lab/1');await power(page);
 const settings=[['r1','1000','42.9'],['r2','1000','56'],['series','2000','50.3'],['parallel','1000','32.1']];
 for(const [mode,r,l] of settings){
  await page.locator(`[data-bench-action="bridge-${mode}"]`).click();await expect(page.locator('.bench-resistance-network')).toHaveAttribute('data-connection',mode);
  await page.locator('#number-r').fill(r);await page.locator('#number-l').fill(l);await expect(page.locator('[data-action="record"]')).toBeEnabled();await page.locator('[data-action="record"]').click();
  if(mode==='series'||mode==='parallel')await page.locator('.bench-viewport').screenshot({path:`test-results/bridge-${mode}.png`});
 }
 await expect(page.locator('tr[data-row]')).toHaveCount(4);await expect(page.locator('.source-badge')).toHaveText(['Модель · R₁','Модель · R₂','Модель · Послідовно','Модель · Паралельно']);
 expect(await page.locator('[data-cell="dR"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value))).toEqual(['1','1','2','1']);expect(await page.locator('[data-cell="dl1"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value))).toEqual(['0.1','0.1','0.1','0.1']);
 await expect(page.locator('#table-summary')).toContainText('Послідовно — порівняння за виміряними R₁ і R₂');await expect(page.locator('#table-summary')).toContainText('Паралельно — порівняння за виміряними R₁ і R₂');await expect(page.locator('#table-summary').getByText(/У межах сумарної граничної похибки/)).toHaveCount(2);
 const first=await page.locator('[data-result="rx"]').first().innerText();await page.reload();await expect(page.locator('.bench-resistance-network')).toHaveAttribute('data-connection','parallel');await expect(page.locator('[data-result="rx"]').first()).toHaveText(first);await expect(page.locator('#number-rx')).toHaveCount(0);await expect(page.locator('#number-rx2')).toHaveCount(0);
});

test('bridge uncertainty inputs use the total ruler uncertainty and remain editable',async({page})=>{
 await page.goto('./#/lab/1');await page.locator('[data-action="add-row"]').click();
 for(const [key,value] of Object.entries({r:'1000',l1:'50',l2:'50',dR:'1',dl1:'0.1',dL:'0.1'}))await page.locator(`[data-cell="${key}"]`).fill(value);
 await expect(page.locator('[data-result="rx"]')).toHaveText('1 000');await expect(page.locator('[data-result="relativeError"]')).toHaveText('0,7');await expect(page.locator('[data-result="error"]')).toHaveText('7');
 await page.locator('[data-cell="dL"]').fill('0');await expect(page.locator('[data-result="error"]')).toHaveText('5');
 await page.locator('[data-cell="dR"]').fill('-1');await expect(page.locator('.row-error')).toContainText('Похибки не можуть бути від’ємними');await page.locator('[data-cell="dR"]').fill('1');await expect(page.locator('.row-error')).toHaveCount(0);
 await page.reload();await expect(page.locator('[data-cell="dL"]')).toHaveValue('0');await expect(page.locator('[data-result="error"]')).toHaveText('5');await expect(page.locator('#panel-experiment .bridge-uncertainty')).toContainText('Крок перемикання 1 кОм не є похибкою');
});

test('bridge keeps legacy readings and maps the former second specimen to R2',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('electricity-lab:v1',JSON.stringify({version:1,labs:{1:{params:{r:2000,rx:1275,l:50},mode:'default',apparatus:{selected:1,power:true,connected:true},rows:[{id:1,row:{r:1000,l1:50,l2:50},mode:'default',source:'demo'}]}}})));
 await page.goto('./#/lab/1');await expect(page.locator('.bench-resistance-network')).toHaveAttribute('data-connection','r2');await expect(page.locator('tr[data-row]')).toHaveCount(1);await expect(page.locator('[data-cell="dR"]')).toHaveValue('1');await expect(page.locator('[data-cell="dl1"]')).toHaveValue('0.1');await expect(page.locator('[data-result="error"]')).toHaveText('7');await expect(page.locator('#table-summary')).toContainText('без позначення з’єднання');
 await page.locator('#number-r').fill('1000');await page.locator('#number-l').fill('56');await expect(page.locator('[data-action="record"]')).toBeEnabled();
});
