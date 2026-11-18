import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import data from '../../src/variants.json' with {type:'json'};
import {crtTraceBounds} from './pixels';

test('all ten variants can be selected in the seven labs with variants without resetting independent settings',async({page})=>{
 const hidden:Record<number,string[]>={1:['rx','rx2'],2:['ex'],3:['r0','alpha','gap','rs30'],4:['isMicroamps','thermalVoltage'],5:['sensitivity'],6:['l'],7:['phase'],8:['cx']};
 for(const id of [1,2,3,4,6,7,8]){
  await page.goto(`./?renderer=canvas#/lab/${id}`);
  const selector=page.getByLabel('Варіант досліду');await expect(selector.locator('option')).toHaveCount(10);
  const before=await page.locator('[data-param]').evaluateAll(nodes=>nodes.map(n=>({key:n.getAttribute('data-param'),value:(n as HTMLInputElement).value})));
  for(let v=1;v<=10;v++){await selector.selectOption(String(v));await expect(selector).toHaveValue(String(v));}
  expect(await page.locator('[data-param]').evaluateAll(nodes=>nodes.map(n=>({key:n.getAttribute('data-param'),value:(n as HTMLInputElement).value})))).toEqual(before);
  for(const key of hidden[id])await expect(page.locator(`[data-param="${key}"]`)).toHaveCount(0);
  await page.locator('[data-bench-action="power"]').click();
  if(id===1)await page.locator('#number-l').fill(String(100*data[1][9].rx/(1000+data[1][9].rx)));
  if(id===2)await page.locator('#number-lx').fill(String(data[2][9].ex*50/1.018));
  if(id===6){await page.locator('#number-u').fill('10');await page.locator('[data-bench-action="capacitor"]').click();}
  if(id===8)await page.locator('#number-l').fill(String(200/(2+data[8][9].cx1)));
  if([1,2,8].includes(id))await expect(page.locator('.bench-meter .bench-readout')).toHaveText(id===1?'0 мкА':'0 В');
  await page.reload();await expect(selector).toHaveValue('10');
  await page.screenshot({path:`test-results/variant-${id}-desktop.png`});
  await page.setViewportSize({width:390,height:844});await selector.scrollIntoViewIfNeeded();await expect(selector).toBeVisible();await page.screenshot({path:`test-results/variant-${id}-mobile.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1050});
 }
});

test('saved measurements remain exportable without a journal or an answer key',async({page})=>{
 await page.addInitScript(()=>{
  if(sessionStorage.getItem('bridge-seeded'))return;
  localStorage.setItem('electricity-lab:v1',JSON.stringify({version:1,labs:{1:{params:{r:2000,rx:1275,l:50},mode:'default',apparatus:{selected:1,power:true,connected:true},rows:[
   {id:1,row:{r:1000,l1:50,l2:50},mode:'default',source:'manual'},
   {id:2,row:{r:1000,l1:36,l2:64},mode:'r1',source:'demo',variant:2},
  ]}}}));
  sessionStorage.setItem('bridge-seeded','1');
 });
 await page.goto('./?renderer=canvas#/lab/1');
 await expect(page.locator('.bench-resistance-network')).toHaveAttribute('data-connection','r2');
 await page.getByLabel('Варіант досліду').selectOption('10');
 await page.getByRole('button',{name:'Скинути'}).click();
 await page.reload();
 await expect(page.locator('#panel-experiment table')).toHaveCount(0);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Експорт збережених вимірів CSV'}).click();
 const file=await download;
 expect(file.suggestedFilename()).toBe('lab_1-measurements.csv');
 const csv=await readFile((await file.path())!,'utf8');
 expect(csv.charCodeAt(0)).toBe(0xfeff);
 expect(csv).toContain('"Варіант"');
 expect(csv).toContain('"Власні";"Попередні";"Без позначення з’єднання"');
 expect(csv).toContain('"Модель";"2";"R₁"');
 expect(csv).not.toContain('rx2');
 expect(csv.trimEnd().split('\r\n')).toHaveLength(3);
});

test('lab 5 keeps previous measurements exportable after resetting',async({page})=>{
 await page.addInitScript(()=>{if(sessionStorage.getItem('scope-seeded'))return;localStorage.setItem('electricity-lab:v1',JSON.stringify({version:1,labs:{5:{variant:10,params:{ux:10,sensitivity:1.2},mode:'sensitivity',apparatus:{power:true,connected:true},rows:[{id:1,row:{u:10,length:24*Math.SQRT2},mode:'sensitivity',source:'demo',variant:10}]}}}));sessionStorage.setItem('scope-seeded','1');});
 await page.goto('./?renderer=canvas#/lab/5');await expect(page.getByLabel('Варіант досліду')).toHaveCount(0);
 await page.getByRole('button',{name:'Скинути'}).click();
 await page.reload();
 await expect(page.getByLabel('Варіант досліду')).toHaveCount(0);
 const download=page.waitForEvent('download');
 await page.locator('[data-action="export"]').click();
 const csv=await readFile((await (await download).path())!,'utf8');
 expect(csv).toContain('"Модель";"10";"sensitivity"');
 expect(Number(csv.trimEnd().split('\r\n')[1].split(';').at(-2)?.replaceAll('"',''))).toBeCloseTo(1.2);
 await page.screenshot({path:'test-results/scope-no-variants-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('.controls-card').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/scope-no-variants-mobile.png'});
});

test('the same selected specimens survive core, load and capacitor switches',async({page})=>{
 await page.goto('./?renderer=canvas#/lab/6');await page.getByLabel('Варіант досліду').selectOption('10');await page.locator('[data-bench-action="power"]').click();await page.locator('#number-u').fill('10');await page.locator('[data-bench-action="capacitor"]').click();
 const current=page.locator('.bench-meter[aria-label="АМПЕРМЕТР A"] .bench-readout');
 await expect(current).toHaveText('0,11 А');
 await page.locator('[data-bench-action="core"]').click();await expect(current).toHaveText('0,07 А');
 await page.getByRole('button',{name:'Скинути'}).click();await expect(page.getByLabel('Варіант досліду')).toHaveValue('10');
 await page.goto('./?renderer=canvas#/lab/7');await page.getByLabel('Варіант досліду').selectOption('10');await page.locator('[data-bench-action="power"]').click();
 const watts=page.locator('.bench-meter[aria-label="ВАТМЕТР W"] .bench-readout');
 await page.locator('[data-bench-action="load"]').click();await expect(watts).toHaveText('7,2 Вт');
 await page.locator('[data-bench-action="load"]').click();await expect(watts).toHaveText('1,2503 Вт');
 await page.goto('./?renderer=canvas#/lab/8');await page.getByLabel('Варіант досліду').selectOption('10');await page.locator('[data-bench-action="power"]').click();await page.locator('[data-bench-action="sotti-c2"]').click();await page.locator('#number-l').fill(String(200/12));
 await expect(page.locator('.bench-meter .bench-readout')).toHaveText('0 В');
 await page.reload();await expect(page.getByLabel('Варіант досліду')).toHaveValue('10');await expect(page.locator('#number-limit')).toHaveValue('300');
});

for(const renderer of ['canvas','gpu'])test(`the fixed tube shows the calibrated trace on ${renderer}`,async({page})=>{
 await page.goto(`./${renderer==='canvas'?'?renderer=canvas':''}#/lab/5`);await expect(page.locator('#bench')).not.toHaveAttribute('data-backend','loading',{timeout:20000});if(renderer==='gpu')await expect(page.locator('#bench')).toHaveAttribute('data-backend','WebGPU');
 await page.locator('[data-bench-action="power"]').click();await page.locator('[data-bench-action="sensitivity"]').click();await page.locator('#number-ux').fill('10');
 for(const ux of [5,10,20]){
  await expect(page.getByLabel('Варіант досліду')).toHaveCount(0);await page.locator('#number-ux').fill(String(ux));const svg=await page.locator('.bench-svg').boundingBox();if(!svg)throw new Error('Missing apparatus');
  const scale=svg.width/800,roi={x:svg.x+240*scale,y:svg.y+234*scale,width:240*scale,height:12*scale},span=2*Math.SQRT2*ux*1.2*scale;
  await expect.poll(async()=>{const trace=crtTraceBounds(await page.screenshot(),roi);return Math.abs(trace.maxX-trace.minX-span);}).toBeLessThan(3);
 }
 await page.locator('.bench-viewport').screenshot({path:`test-results/variant-scope-${renderer}.png`});
});
