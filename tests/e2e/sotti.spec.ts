import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

for(const renderer of ['gpu','canvas'])test(`Sotti connections and manual balance on ${renderer}`,async({page})=>{
 await page.goto(`./${renderer==='canvas'?'?renderer=canvas':''}#/lab/8`);
 await expect(page.locator('#bench')).toHaveAttribute('data-backend',renderer==='gpu'?'WebGPU':'Canvas 2D',{timeout:20000});
 await page.locator('[data-bench-action="power"]').click();
 const contact=page.getByRole('slider',{name:'Рухомий контакт реохорда'});
 await contact.press('ArrowLeft');await contact.press('ArrowLeft');await expect(page.locator('#number-l')).toHaveValue('49.98');
 await page.locator('#number-l').fill('50');
 for(const [mode,l] of [['c1','40'],['c2',String(200/7)],['series',String(1600/31)],['parallel','20']]){
  const previousContact=await page.locator('#number-l').inputValue();
  const button=page.locator(`[data-bench-action="sotti-${mode}"]`);
  if(mode==='series'){await button.focus();await button.press('Enter');await expect(button).toBeFocused();}else await button.click();
  await expect(page.locator('.bench-capacitance-network')).toHaveAttribute('data-connection',mode);
  await expect(page.locator('#number-l')).toHaveValue(previousContact);
  await expect(button).toHaveAttribute('aria-pressed','true');await expect(page.locator('#number-limit')).toHaveValue('300');
  if(mode!=='c1')await expect(page.locator('.bench-meter .bench-readout')).not.toHaveText('0 В');
  await page.locator('#number-l').fill(l);await page.locator('#number-limit').selectOption('1');
  await expect(page.locator('.bench-meter .bench-readout')).toHaveText('0 В');
  if(mode==='series'||mode==='parallel')await page.locator('.bench-viewport').screenshot({path:`test-results/sotti-${mode}-${renderer}.png`});
 }
 await page.reload();
 await expect(page.locator('.bench-capacitance-network')).toHaveAttribute('data-connection','parallel');
 await expect(page.locator('#number-limit')).toHaveValue('1');

});

test('Sotti mobile connections stay accessible inside the pannable stand',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./?renderer=canvas#/lab/8');
 for(const mode of ['series','parallel']){await page.locator(`[data-bench-action="sotti-${mode}"]`).click();await expect(page.locator('.bench-capacitance-network')).toHaveAttribute('data-connection',mode);await page.screenshot({path:`test-results/sotti-${mode}-mobile.png`});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('tab',{name:'Теорія'}).click();await expect(page.locator('#panel-theory math')).not.toHaveCount(0);await page.locator('#panel-theory .uncertainty-help').scrollIntoViewIfNeeded();
 await page.locator('#panel-theory .uncertainty-help .formula-list').last().scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/sotti-theory-mobile.png'});
});


test('Sotti exports legacy readings with their known or unknown connection',async({page})=>{
 await page.addInitScript(()=>{if(sessionStorage.getItem('sotti-seeded'))return;localStorage.setItem('electricity-lab:v1',JSON.stringify({version:1,labs:{8:{variant:1,params:{cx:5,l:40},mode:'default',apparatus:{selected:1,power:true,connected:true},rows:[
  {id:1,row:{c0:2,l1:40,l2:60},mode:'default',source:'demo',variant:1,specimen:'c1'},
  {id:2,row:{c0:2,l1:20,l2:80},mode:'default',source:'manual',variant:1},
 ]}}}));sessionStorage.setItem('sotti-seeded','1');});
 await page.goto('./?renderer=canvas#/lab/8');await expect(page.locator('.bench-capacitance-network')).toHaveAttribute('data-connection','c2');
 await page.locator('[data-bench-action="sotti-c1"]').click();
 await page.reload();
 const download=page.waitForEvent('download');
 await page.locator('[data-action="export"]').click();
 const csv=await readFile((await (await download).path())!,'utf8');
 for(const text of ['З’єднання','Cₓ, мкФ','ΔCₓ, мкФ'])expect(csv).toContain(text);
 expect(csv).toContain('"Модель";"1";"C₁"');
 expect(csv).toContain('"Власні";"1";"Без позначення з’єднання"');
 expect(csv).not.toContain('cx2');
});
