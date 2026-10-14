import {test,expect} from '@playwright/test';
import {crtPixels} from './pixels';
const power=async(page:import('@playwright/test').Page)=>{await page.locator('[data-bench-action="power"]').click();};
test('all eight drawn apparatuses: power, readings, recording, theory and questions',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(let id=1;id<=8;id++){
  await page.goto(`/#/lab/${id}`);await expect(page.locator('.bench-svg')).toBeVisible();await expect(page.locator('#bench')).not.toHaveAttribute('data-backend','loading',{timeout:20000});await expect(page.locator('#chart')).toHaveCount(0);
  await expect(page.locator('[data-action="record"]')).toBeDisabled();await power(page);if([1,2,8].includes(id))await page.locator('[data-action="balance"]').click();await page.locator('[data-action="record"]').click();await expect(page.locator('tr[data-row]')).toHaveCount(1);await expect(page.locator('.row-error')).toHaveCount(0);
  await page.locator('.bench-viewport').screenshot({path:`test-results/bench-${id}.png`});
  await page.getByRole('tab',{name:'Теорія'}).click();await expect(page.locator('.figures img').first()).toBeVisible();await expect.poll(()=>page.locator('.figures img').first().evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('tab',{name:'Контрольні питання'}).click();await page.locator('summary').first().click();await expect(page.locator('details[open] p')).toBeVisible();
 }
 expect(errors).toEqual([]);
});
test('drag the real rheochord contact, turn a knob with keyboard, and disconnect a wire',async({page})=>{
 await page.goto('/#/lab/1');await power(page);const contact=page.getByRole('slider',{name:'Рухомий контакт реохорда'});const bounds=await contact.boundingBox(),svg=await page.locator('.bench-svg').boundingBox();if(!bounds||!svg)throw new Error('Missing apparatus');
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(svg.x+(110+580*.3)/800*svg.width,bounds.y+bounds.height/2,{steps:10});await page.mouse.up();await expect(page.locator('#number-l')).toHaveValue('30');
 await page.getByRole('slider',{name:'Опір магазину',exact:true}).press('ArrowRight');await expect(page.locator('#number-r')).toHaveValue('1010');
 await page.locator('[data-action="balance"]').click();await expect(page.locator('[data-action="record"]')).toBeEnabled();await page.locator('[data-bench-action="connection"]').click();await expect(page.locator('#model-note')).toContainText('Провід від’єднано');await expect(page.locator('[data-action="record"]')).toBeDisabled();await page.locator('[data-bench-action="connection"]').click();await expect(page.locator('[data-action="record"]')).toBeEnabled();
});
test('compensation selects the actual reference cell and then the unknown',async({page})=>{await page.goto('/#/lab/2');await power(page);await page.locator('[data-bench-action="cell-normal"]').click();await expect(page.locator('[data-action="record"]')).toBeDisabled();await expect(page.locator('[data-bench-action="cell-normal"]')).toHaveAttribute('aria-pressed','true');await page.locator('[data-bench-action="cell-toggle"]').click();await page.locator('[data-action="balance"]').click();await expect(page.locator('[data-action="record"]')).toBeEnabled();});

test('journal: validation, persistence, undo and CSV',async({page})=>{
 await page.goto('/#/lab/1');await power(page);await page.locator('[data-action="balance"]').click();await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="rx"]')).toHaveText('750');
 await page.locator('[data-cell="l1"]').fill('25');await page.locator('[data-cell="l2"]').fill('75');await expect(page.locator('[data-result="rx"]')).toHaveText(/333/);await expect(page.locator('.source-badge')).toHaveText('Власні');
 await page.locator('[data-cell="l1"]').fill('0');await expect(page.locator('.row-error')).toBeVisible();await page.locator('[data-cell="l1"]').fill('25');await page.reload();await expect(page.locator('[data-cell="l1"]')).toHaveValue('25');await expect(page.locator('[data-bench-action="power"]')).toHaveAttribute('aria-pressed','true');
 const downloaded=page.waitForEvent('download');await page.locator('[data-action="export"]').click();expect((await downloaded).suggestedFilename()).toBe('lab_1-measurements.csv');await page.locator('[data-action="clear"]').click();await page.locator('[data-action="undo"]').click();await expect(page.locator('tr[data-row]')).toHaveCount(1);
});
test('heating a water bath changes actual temperature and both ohmmeter readings',async({page})=>{
 await page.goto('/#/lab/3');await page.locator('#number-t').fill('40');await page.locator('[data-bench-action="heat"]').click();await expect(page.locator('[data-bench-action="heat"]')).toHaveAttribute('aria-pressed','true');await expect.poll(()=>page.locator('.bench-readout').allTextContents()).not.toContain('Фактична t: 30 °C');
 await page.locator('[data-bench-action="probe-semi"]').first().click();await expect(page.locator('.bench-small').filter({hasText:'kΩ'})).toBeVisible();await expect(page.locator('[data-action="record"]')).toBeDisabled();await expect(page.locator('[data-action="record"]')).toBeEnabled({timeout:12000});await page.locator('[data-action="record"]').click();expect(Number(await page.locator('[data-cell="t"]').inputValue())).toBeGreaterThan(39);
 await page.locator('[data-action="demo"]').click();await expect(page.locator('#table-summary')).toContainText('0,004');await expect(page.locator('#table-summary')).toContainText('0,4');
});
test('drawn diode polarity and RL capacitor/core controls change physical readings',async({page})=>{
 await page.goto('/#/lab/4');await power(page);await page.locator('[data-bench-action="polarity"]').click();await expect(page.locator('#number-u')).toHaveValue('-0.4');await expect(page.locator('.bench-svg')).toContainText('Зворотне зміщення');
 await page.goto('/#/lab/6');await power(page);await page.locator('.bench-viewport').screenshot({path:'test-results/rlc-wiring.png'});await page.locator('[data-bench-action="capacitor"]').click();await page.locator('.bench-viewport').screenshot({path:'test-results/rl-wiring.png'});await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="l"]')).toHaveText('107,7');await page.locator('[data-bench-action="core"]').click();await expect(page.locator('#number-l')).toHaveValue('193.86');await page.locator('[data-bench-action="capacitor"]').click();await expect(page.locator('[data-result="l"]')).toHaveText('107,7');
});
test('WebGPU oscilloscope lives inside the instrument, XY and knobs respond',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/#/lab/5');await expect(page.locator('#bench')).toHaveAttribute('data-backend','WebGPU',{timeout:20000});await power(page);await page.locator('[data-bench-action="xy"]').click();await page.getByRole('slider',{name:'Частота звукового генератора'}).press('End');await expect(page.locator('#number-f')).toHaveValue('200');await expect(page.locator('[data-bench-action="xy"]')).toHaveAttribute('aria-pressed','true');
 const b=await page.locator('.bench-svg').boundingBox();if(!b)throw new Error('Missing scope');const roi={x:b.x+240/800*b.width,y:b.y+145/540*b.height+await page.evaluate(()=>scrollY),width:240/800*b.width,height:190/540*b.height};await expect.poll(async()=>crtPixels(await page.screenshot({fullPage:true}),roi)).toBeGreaterThan(100);await page.screenshot({path:'test-results/oscilloscope.png',fullPage:true});expect(errors).toEqual([]);
});
test('lamp/coil switch and capacitor substitution on drawn equipment',async({page})=>{
 await page.goto('/#/lab/7');await power(page);await page.locator('[data-bench-action="load"]').click();await expect(page.locator('#number-phase')).toHaveValue('0');await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="pf"]')).toHaveText('1');await page.locator('[data-cell="p"]').fill('10000');await expect(page.locator('.row-error')).toContainText('P ≤ UI');
 await page.goto('/#/lab/8');await power(page);await page.locator('[data-bench-action="sample"]').click();await expect(page.locator('#number-cx')).toHaveValue('5');await page.locator('[data-action="balance"]').click();await page.locator('.bench-viewport').screenshot({path:'test-results/sotti-contact.png'});await page.locator('[data-action="record"]').click();await expect(page.locator('[data-result="cx"]')).toHaveText('5');
});
test('mobile has a pannable apparatus and functional Canvas fallback',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?renderer=canvas#/lab/1');await expect(page.locator('#bench')).toHaveAttribute('data-backend','Canvas 2D');await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.bench-viewport').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);await page.locator('#menu').click();await page.getByRole('link',{name:'05 Електронний осцилограф'}).click();await expect(page).toHaveURL(/lab\/5/);await expect(page.locator('.sidebar')).toBeHidden();await page.locator('[data-bench-action="power"]').click();await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('desktop apparatus preview',async({page})=>{await page.goto('/#/lab/1');await expect(page.locator('#bench')).not.toHaveAttribute('data-backend','loading',{timeout:20000});await power(page);await page.locator('[data-action="balance"]').click();await page.locator('#number-r').fill('1001');await page.locator('#number-r').fill('1000');await page.locator('#toast').waitFor({state:'hidden',timeout:8000});await page.locator('[data-bench-action="power"]').focus();await page.screenshot({path:'test-results/desktop.png',fullPage:true});await page.screenshot({path:'test-results/preview.png',fullPage:false});});
