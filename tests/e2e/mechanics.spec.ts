import { expect, test } from '@playwright/test';

test('switch subjects, preserve independent settings and open the matching handout', async ({ page, request }) => {
  await page.goto('./#/lab/1');
  const subject = page.locator('#sidebar').getByLabel('Розділ фізики');
  await expect(subject).toHaveValue('electricity');
  await page.locator('#number-r').fill('2000');
  await subject.selectOption('mechanics');
  await expect(page).toHaveURL(/#\/mechanics\/1$/);
  await expect(subject).toBeFocused();
  await expect(page.locator('#sidebar nav a')).toHaveCount(9);
  const pdf = await page.getByRole('link', { name: 'Методичка' }).getAttribute('href');
  const response = await request.get(pdf!);
  expect(response.headers()['content-type']).toContain('application/pdf');

  await page.locator('#bench').getByLabel('Режим досліду').selectOption('sphere');
  await expect(page).toHaveURL(/#\/mechanics\/1\/sphere$/);
  await page.getByRole('button', { name: 'Підвести гвинт тріскачкою' }).click();
  await expect(page.locator('#bench .mechanics-status')).toContainText('Гвинт торкається кулі');
  const gap = await page.locator('#mechanics-number-jaw').inputValue();
  await subject.selectOption('electricity');
  await expect(page).toHaveURL(/#\/lab\/1$/);
  await expect(page.locator('#number-r')).toHaveValue('2000');
  await expect(page.locator('#sidebar nav a')).toHaveCount(8);
  await subject.selectOption('mechanics');
  await expect(page).toHaveURL(/#\/mechanics\/1\/sphere$/);
  await expect(page.locator('#mechanics-number-jaw')).toHaveValue(gap);
  await page.reload();
  await expect(page.locator('#mechanics-number-jaw')).toHaveValue(gap);
});

test('the mobile works menu keeps the new subject list open after switching', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/lab/1');
  const sidebar = page.locator('#sidebar');
  const menu = page.getByRole('button', { name: 'Роботи' });
  const subject = sidebar.getByLabel('Розділ фізики');
  await expect(sidebar).toBeHidden();
  await menu.press('Enter');
  await expect(subject).toBeFocused();
  await subject.selectOption('mechanics');
  await expect(page).toHaveURL(/#\/mechanics\/1$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(subject).toBeFocused();
  await sidebar.getByRole('link', { name: /Вологість повітря/ }).click();
  await expect(page).toHaveURL(/#\/mechanics\/9$/);
  await expect(sidebar).toBeHidden();
});

test('each mechanical lab with two methods switches from the stand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [lab, mode, title] of [[1, 'sphere', 'МІКРОМЕТР'], [2, 'bend', 'ЗГИН ПЛАСТИНИ'], [5, 'resonance', 'РЕЗОНАНС У ЗАКРИТІЙ ТРУБІ']] as const) {
    await page.goto(`./#/mechanics/${lab}`);
    const bench = page.locator('#bench');
    const picker = bench.getByLabel('Режим досліду');
    await picker.selectOption(mode);
    await expect(bench).toContainText(title);
    await expect(picker).toHaveValue(mode);
    await expect(picker).toBeFocused();
    await expect(picker).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.mechanics-controls-card').getByLabel('Режим досліду')).toHaveCount(0);
  }
});

test('wide windows center the experiment and fit the complete stand at both heights', async ({ page }) => {
  for (const route of ['#/mechanics/1', '#/lab/1']) {
    await page.setViewportSize({ width: 2560, height: 1100 });
    await page.goto(`./${route}`);
    const stand = page.locator('.bench-viewport');
    const checkAlignment = async () => {
      const { left, right, tabLeft } = await page.locator('#workspace').evaluate(workspace => {
        const workspaceLeft = workspace.getBoundingClientRect().left;
        const grid = workspace.querySelector('.experiment-grid')!.getBoundingClientRect();
        return {
          left: grid.left - workspaceLeft,
          right: workspaceLeft + workspace.clientWidth - grid.right,
          tabLeft: workspace.querySelector('#tab-experiment')!.getBoundingClientRect().left - workspaceLeft,
        };
      });
      expect(left).toBeCloseTo(right, 0);
      expect(tabLeft).toBeCloseTo(left, 0);
    };
    const tall = (await stand.boundingBox())!;
    expect(tall.y + tall.height).toBeLessThanOrEqual(1100);
    expect(tall.width).toBeGreaterThan(1200);
    await checkAlignment();

    await page.setViewportSize({ width: 2560, height: 650 });
    const short = (await stand.boundingBox())!;
    expect(short.y + short.height).toBeLessThanOrEqual(650);
    expect(short.width).toBeLessThan(tall.width);
    expect(short.width / short.height).toBeCloseTo(800 / 540, 2);
    await checkAlignment();
  }
});

test('nine mechanical labs have their own stand, solvable questions, formulas and source figures', async ({ page }) => {
  const counts = [6, 5, 6, 5, 14, 3, 7, 6, 6];
  for (const [index, count] of counts.entries()) {
    await page.goto(`./#/mechanics/${index + 1}`);
    await expect(page.locator('#bench svg')).toBeVisible();
    await expect(page.locator('#panel-experiment math').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Контрольні питання' }).click();
    await expect(page.locator('#panel-questions details')).toHaveCount(count);
    await page.locator('#panel-questions summary').last().click();
    await expect(page.locator('#panel-questions details[open] .question-answer')).toBeVisible();
    await page.getByRole('tab', { name: 'Обладнання' }).click();
    await expect(page.locator('#panel-equipment .mechanics-equipment')).toBeVisible();
    await page.getByRole('tab', { name: 'Теорія' }).click();
    await page.locator('[data-mechanics-image]').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => page.locator('#image-dialog img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  }
});

test('wire diameter and initial length stay visible while the measurement point moves', async ({ page }) => {
  await page.goto('./#/mechanics/2');
  const bench = page.locator('#bench');
  const diameter = bench.locator('.mechanics-compact-readout').filter({ hasText: 'Діаметр дроту' }).locator('.mechanics-reading');
  const length = bench.locator('.mechanics-compact-readout').filter({ hasText: 'Початкова довжина' }).locator('.mechanics-reading');
  const point = bench.getByRole('slider', { name: 'Місце вимірювання діаметра' });
  const mark = bench.locator('.mechanics-wire-point circle');
  const firstPosition = Number(await mark.getAttribute('cy'));
  await expect(diameter).toHaveText('0,80 мм');
  await expect(length).toHaveText('1120 мм');

  await point.press('End');
  expect(Number(await mark.getAttribute('cy'))).toBeGreaterThan(firstPosition);
  await expect(diameter).toHaveText('0,82 мм');
  await expect(length).toHaveText('1120 мм');
  await expect(bench.getByRole('button', { name: /^(Діаметр|Довжина)( дроту)?$/ })).toHaveCount(0);
});

test('manual steps move the setup together and respect their limits on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/mechanics/2/bend');
  const bench = page.locator('#bench');
  const deflection = bench.locator('.mechanics-reading').first();
  const mass = page.locator('#mechanics-number-load');
  const lower = page.locator('.mechanics-controls-card').getByRole('button', { name: 'Маса тягарів, зменшити на 0,5 кг' });
  const raise = page.locator('.mechanics-controls-card').getByRole('button', { name: 'Маса тягарів, збільшити на 0,5 кг' });
  await expect(bench.getByText('Прогин посередині', { exact: true })).toBeAttached();
  await expect(lower).toBeDisabled();
  await page.getByRole('button', { name: 'Встановити нуль' }).click();
  await expect(deflection).toHaveText('0,00 мм');
  await raise.click();
  await expect(mass).toHaveValue('0.5');
  await expect(deflection).toHaveText('0,52 мм');
  const slider = page.getByRole('slider', { name: 'Маса тягарів, повзунок' });
  await slider.press('End');
  await expect(mass).toHaveValue('2.5');
  await expect(deflection).toHaveText('2,61 мм');
  await expect(raise).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Встановити нуль' })).toBeDisabled();
  const readouts = bench.locator('.mechanics-compact-readout .mechanics-reading');
  const marker = bench.locator('.mechanics-plate-point circle');
  const firstPosition = Number(await marker.getAttribute('cx'));
  await expect(readouts).toHaveText(['31,2 мм', '4,2 мм', '420,0 мм']);
  await bench.getByRole('slider', { name: 'Переріз для заміру ширини й товщини' }).press('End');
  expect(Number(await marker.getAttribute('cx'))).toBeGreaterThan(firstPosition);
  await expect(readouts).toHaveText(['31,4 мм', '4,4 мм', '420,0 мм']);

  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth, viewport: window.innerWidth,
    bench: (document.querySelector('.bench-viewport') as HTMLElement).scrollWidth,
    benchViewport: (document.querySelector('.bench-viewport') as HTMLElement).clientWidth,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.bench).toBeGreaterThan(overflow.benchViewport);
  const menu = page.getByRole('button', { name: 'Роботи' });
  await menu.click();
  await page.getByRole('link', { name: /Вологість повітря/ }).click();
  await expect(page).toHaveURL(/#\/mechanics\/9$/);
});

test('benzene plots use only entered points and remember edits', async ({ page }) => {
  await page.goto('./#/mechanics/7');
  const entry = page.locator('#mech-benzene-form');
  await expect(page.locator('.mechanics-graphs')).toHaveCount(0);
  for (const [t, p] of [[20, 10], [40, 24.4]]) {
    await entry.locator('[name=temperature]').fill(String(t));
    await entry.locator('[name=pressure]').fill(String(p));
    await entry.getByRole('button', { name: 'Додати точку' }).click();
  }
  await expect(page.locator('.mechanics-chart')).toHaveCount(2);
  await expect(page.getByText(/Нахил відносно 1\/T: -[0-9]/)).toBeVisible();
  await page.reload();
  await expect(page.locator('.mechanics-chart')).toHaveCount(2);
  await page.getByRole('button', { name: /Видалити точку при 20,0/ }).click();
  await expect(page.locator('.mechanics-chart')).toHaveCount(0);
});

test('psychrometer reaches equilibrium after preparation and uses a manual saturation lookup', async ({ page }) => {
  await page.goto('./#/mechanics/9');
  const bench = page.locator('#bench');
  const crank = bench.getByRole('button', { name: 'Зробити оберт ключем' });
  const rotor = (await bench.locator('.mechanics-fan').elementHandle())!;
  const center = await rotor.evaluate(el => {
    const { e, f } = (el as SVGGElement).getCTM()!;
    return { x: e, y: f };
  });
  const labelsClear = await bench.locator('.mechanics-psychrometer-thermometer').evaluateAll(thermometers => thermometers.every(thermometer => {
    const casing = thermometer.querySelector('rect')!.getBBox();
    return [...thermometer.querySelectorAll('text')].every(label => {
      const box = label.getBBox();
      return box.x + box.width < casing.x;
    });
  }));
  expect(labelsClear).toBe(true);
  await expect(crank).toBeDisabled();
  await page.getByRole('button', { name: 'Змочити батист' }).click();
  for (let i = 0; i < 4; i++) await crank.click();
  await expect(bench).toContainText('Обертів ключа: 4 із 5');
  expect(await rotor.evaluate(el => el.getAnimations().length)).toBe(0);
  await expect(bench.locator('.mechanics-reading').nth(1)).toHaveText('24,0 °C');
  await crank.click();
  await expect(bench).toContainText('Вентилятор працює');
  await crank.click();
  await expect(crank).toBeDisabled();
  await expect(bench.locator('.mechanics-status')).toContainText('Рівновага', { timeout: 10000 });
  const rotation = await rotor.evaluate(el => {
    const { e, f } = (el as SVGGElement).getCTM()!;
    return { x: e, y: f, time: Number(el.getAnimations()[0]?.currentTime) };
  });
  expect(rotation.x).toBeCloseTo(center.x);
  expect(rotation.y).toBeCloseTo(center.y);
  expect(rotation.time).toBeGreaterThan(1000);
  await page.getByRole('tab', { name: 'Теорія' }).click();
  await page.getByLabel('Температура, °C').fill('20');
  await page.getByRole('button', { name: 'Знайти тиск насиченої пари' }).click();
  await expect(page.locator('#mech-saturation-output')).toContainText('2,339 кПа');
  const chart = page.locator('.mechanics-nomogram svg');
  await expect(chart).toBeVisible();
  expect((await chart.boundingBox())!.height).toBeGreaterThan(200);
});

test('phase setup responds to frequency, microphone position and both power switches', async ({ page }) => {
  await page.goto('./#/mechanics/5/phase');
  const frequency = page.locator('#mechanics-number-frequency');
  await frequency.fill('2250');
  await page.getByRole('button', { name: 'Осцилограф', exact: true }).click();
  await page.getByRole('button', { name: 'Генератор', exact: true }).click();
  await page.locator('#mechanics-number-amplitude').fill('2');
  await expect(page.locator('#bench')).toContainText('2250 Гц', { timeout: 7500 });
  const trace = page.locator('#bench path[stroke="#b8f287"]');
  const previous = await trace.getAttribute('d');
  await page.locator('#mechanics-number-microphone').fill('55.3');
  await expect(trace).not.toHaveAttribute('d', previous!);
  await page.getByRole('button', { name: 'Генератор', exact: true }).click();
  await expect(trace).toHaveCount(0);
  await expect(frequency).toHaveValue('2250');
});

test('the electrolysis time and collected volume remain fixed while waiting for the meniscus', async ({ page }) => {
  await page.goto('./#/mechanics/8');
  const stop = page.getByRole('button', { name: 'Вимкнути струм і секундомір' });
  const record = page.locator('#bench').getByRole('button', { name: 'Записати час' });
  await expect(stop).toBeDisabled();
  await expect(record).toBeDisabled();
  await page.getByRole('button', { name: 'Увімкнути струм і секундомір' }).click();
  await expect(page.locator('#mechanics-number-current')).toBeDisabled();
  await expect(page.locator('#bench')).toContainText('0,275 А');
  await expect(record).toBeEnabled();
  await record.click();
  await expect(page.locator('#mech-time-log tbody tr')).toHaveCount(1);
  await expect(stop).toBeEnabled();
  await expect(page.locator('#bench')).toContainText('0,275 А');
  await stop.click();
  await record.click();
  const time = await page.locator('#bench .mechanics-reading').nth(1).textContent();
  await expect(page.locator('#bench')).toContainText('Меніск стабілізувався');
  await expect(page.locator('#bench .mechanics-reading').nth(1)).toHaveText(time!);
  await page.getByRole('button', { name: 'Випустити газ і підготувати повтор' }).click();
  await expect(page.locator('#mechanics-number-current')).toBeEnabled();
  await expect(page.locator('#bench .mechanics-reading').nth(1)).toHaveText('0,0 с');
  const savedTime = page.locator('#mech-time-log tbody tr').last().getByRole('cell', { name: time!.replace(' с', ''), exact: true });
  await expect(savedTime).toBeVisible();
});

test('the caliper jaw can be dragged and adjusted from the stand without passing through the sample', async ({ page }) => {
  await page.goto('./#/mechanics/1');
  const bench = page.locator('#bench');
  const jaw = bench.getByRole('slider', { name: 'Розведення губок' });
  const input = page.locator('#mechanics-number-jaw');
  const initialGap = await input.inputValue();
  await bench.getByRole('button', { name: 'Діаметр', exact: true }).click();
  const bounds = (await jaw.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 45, bounds.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(Number(await input.inputValue())).toBeLessThan(42);
  const previous = Number(await input.inputValue());
  await jaw.press('ArrowRight');
  expect(Number(await input.inputValue())).toBeCloseTo(previous + .1, 6);
  await expect(jaw).toBeFocused();
  await jaw.press('Home');
  await expect(bench.locator('.mechanics-status')).toContainText('Губки торкаються зразка');
  await expect(bench.getByRole('button', { name: /^Розведення губок,/ })).toHaveCount(0);
  const controls = page.locator('.mechanics-controls-card');
  const minus = controls.getByRole('button', { name: 'Розведення губок, зменшити на 0,1 мм' });
  await expect(minus).toBeDisabled();
  await controls.getByRole('button', { name: 'Розведення губок, збільшити на 0,1 мм' }).click();
  await expect(minus).toBeEnabled();
  await expect(bench.getByRole('button', { name: 'Звести губки до контакту' })).toHaveCount(0);

  const cylinder = bench.locator('.mechanics-cylinder-body');
  const point = bench.getByRole('slider', { name: 'Точка заміру на циліндрі' });
  const increasePoint = bench.getByRole('button', { name: 'Точка заміру на циліндрі, збільшити на 1' });
  const shape = (await cylinder.locator('path').first().getAttribute('d'))!;
  const upright = (await cylinder.boundingBox())!;
  await jaw.press('Home');
  const firstDiameter = Number(await input.inputValue());
  await increasePoint.click();
  await expect(input).toHaveValue(initialGap);
  await expect(minus).toBeEnabled();
  await jaw.press('Home');
  expect(firstDiameter - Number(await input.inputValue())).toBeCloseTo(.1);
  await expect(cylinder.locator('path').first()).toHaveAttribute('d', shape);

  await bench.getByRole('button', { name: 'Висота', exact: true }).click();
  await expect(bench.locator('[data-caliper-specimen="height"]')).toBeVisible();
  await expect(cylinder).toHaveAttribute('transform', /rotate\(-90\)/);
  const sideways = (await cylinder.boundingBox())!;
  expect(sideways.width).toBeCloseTo(upright.height, 2);
  expect(sideways.height).toBeCloseTo(upright.width, 2);
  expect(Number(await input.inputValue())).toBeGreaterThan(Number(await jaw.getAttribute('aria-valuemin')));
  await jaw.press('Home');
  await expect(bench.locator('.mechanics-status')).toContainText('Губки торкаються зразка');
  const firstHeight = Number(await input.inputValue());
  await point.press('ArrowRight');
  await expect(point).toBeFocused();
  await expect(input).toHaveValue(initialGap);
  await jaw.press('Home');
  expect(Number(await input.inputValue()) - firstHeight).toBeCloseTo(.1);
  await expect(cylinder.locator('path').first()).toHaveAttribute('d', shape);
});

test('the micrometer opens to its starting gap when the sphere turns', async ({ page }) => {
  await page.goto('./#/mechanics/1/sphere');
  const bench = page.locator('#bench');
  const gap = page.locator('#mechanics-number-jaw');
  const initialGap = await gap.inputValue();
  const mark = bench.locator('.mechanics-sphere-orientation');
  const ratchet = bench.getByRole('button', { name: 'Підвести гвинт тріскачкою' });
  const nextPoint = bench.getByRole('button', { name: 'Місце вимірювання, збільшити на 1' });
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('transform', /^rotate\(0 /);
  await ratchet.click();
  const firstReading = Number(await gap.inputValue());
  expect(firstReading).toBeLessThan(Number(initialGap));

  await nextPoint.click();
  await expect(mark).toHaveAttribute('transform', /^rotate\(36 /);
  await expect(gap).toHaveValue(initialGap);
  await expect(bench.locator('.mechanics-status')).toContainText('Тріскачка обмежує натиск');
  await ratchet.click();
  const secondReading = await gap.inputValue();
  expect(Number(secondReading)).toBeGreaterThan(firstReading);
  await ratchet.click();
  await expect(gap).toHaveValue(secondReading);
  await expect(bench.locator('.mechanics-status')).toContainText('Гвинт торкається кулі');

  const fallback = page.getByRole('slider', { name: 'Місце вимірювання, повзунок' });
  await fallback.press('End');
  await expect(mark).toHaveAttribute('transform', /^rotate\(144 /);
  await expect(gap).toHaveValue(initialGap);
});

test('local controls remain focused during animation and keep the fallback in sync', async ({ page }) => {
  await page.goto('./#/mechanics/5/phase');
  const bench = page.locator('#bench');
  const scope = bench.getByRole('button', { name: 'Осцилограф', exact: true });
  await scope.press('Enter');
  await bench.getByRole('button', { name: 'Генератор', exact: true }).click();
  const knob = bench.getByRole('slider', { name: 'Частота генератора' });
  await knob.press('ArrowUp');
  await expect(page.locator('#mechanics-number-frequency')).toHaveValue('2010');
  await expect(bench).toContainText('2010 Гц', { timeout: 7000 });
  await expect(knob).toBeFocused();
  await page.locator('.mechanics-backup summary').click();
  await expect(page.locator('.mechanics-backup').getByRole('button', { name: 'Осцилограф', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(scope).toHaveAttribute('aria-pressed', 'true');
});

test('a carriage can be dragged by touch inside the panned stand', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('./#/mechanics/5/phase');
    const viewport = page.locator('.bench-viewport');
    await viewport.evaluate(element => { element.scrollLeft = 95; });
    const mic = page.locator('#bench').getByRole('slider', { name: 'Положення мікрофона' });
    const bounds = (await mic.boundingBox())!;
    const x = Math.round(bounds.x + bounds.width / 2), y = Math.round(bounds.y + bounds.height / 2);
    const device = await context.newCDPSession(page);
    await device.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await device.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 24, y }] });
    await device.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 43, y }] });
    await device.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(Number(await page.locator('#mechanics-number-microphone').inputValue())).toBeGreaterThan(45);
  } finally { await context.close(); }
});

test('a stopwatch resumes after stop and can record, restore and export the displayed time', async ({ page }) => {
  await page.goto('./#/mechanics/3');
  const bench = page.locator('#bench');
  const log = page.getByRole('region', { name: 'Журнал часу' });
  const start = bench.getByRole('button', { name: 'Запустити секундомір' });
  const stop = bench.getByRole('button', { name: 'Зупинити секундомір' });
  const record = bench.getByRole('button', { name: 'Записати час' });
  const reset = bench.getByRole('button', { name: 'Обнулити секундомір' });
  const reading = bench.locator('.mechanics-reading').first();
  const dimensions = bench.locator('.mechanics-compact-readout .mechanics-reading');
  await expect(dimensions).toHaveText(['35,9 мм', '65,0 см', '280,0 мм', '176,0 мм']);
  const mark = bench.locator('.mechanics-shaft-point circle').first();
  const firstPosition = Number(await mark.getAttribute('cx'));
  await bench.getByRole('slider', { name: 'Місце вимірювання вала' }).press('End');
  expect(Number(await mark.getAttribute('cx'))).toBeGreaterThan(firstPosition);
  await expect(dimensions).toHaveText(['36,1 мм', '65,0 см', '280,0 мм', '176,0 мм']);
  const seconds = async () => Number((await reading.textContent())!.replace(' с', '').replace(',', '.'));
  await expect(record).toBeDisabled();
  await expect(log.getByRole('button', { name: 'Експорт CSV' })).toBeDisabled();
  await start.click();
  await expect.poll(seconds).toBeGreaterThan(.1);
  await record.click();
  const snapshot = log.locator('tbody tr').first().locator('td').nth(2);
  const firstTime = (await snapshot.textContent())!;
  await expect(stop).toBeEnabled();
  await expect.poll(seconds).toBeGreaterThan(Number(firstTime.replace(',', '.')) + .06);
  await expect(snapshot).toHaveText(firstTime);
  await stop.click();
  const paused = await seconds();
  await expect(start).toBeEnabled();
  await start.click();
  await expect.poll(seconds).toBeGreaterThan(paused + .06);
  await stop.click();
  const stopped = (await reading.textContent())!.replace(' с', '');
  await expect(log.locator('tbody tr')).toHaveCount(1);
  await bench.getByRole('button', { name: 'Зняти колесо' }).click();
  await expect(dimensions).toHaveText(['36,1 мм', '65,0 см', '—', '—']);
  await expect(reading).toHaveText(`${stopped} с`);
  await record.click();
  await expect(log.locator('tbody tr').last()).toContainText('З колесом');
  await expect(log.getByRole('cell', { name: stopped, exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await log.getByRole('button', { name: 'Експорт CSV' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('mechanics-3-flywheel-time.csv');
  const csv = await (await download.createReadStream()).toArray();
  expect(Buffer.concat(csv).toString('utf8')).toContain(`"З колесом";"65";"${stopped}";"Секундомір"`);

  await reset.click();
  await expect(reading).toHaveText('0,00 с');
  await expect(record).toBeDisabled();
  await page.reload();
  await expect(log.getByRole('cell', { name: stopped, exact: true })).toBeVisible();
  await page.goto('./#/mechanics/4');
  await expect(log.locator('tbody tr')).toHaveCount(0);
  await log.getByLabel('Час, с', { exact: true }).fill('1.25');
  await log.getByRole('button', { name: 'Додати вручну' }).click();
  await expect(log.getByRole('cell', { name: '1,25', exact: true })).toBeVisible();
  await log.getByRole('button', { name: 'Змінити час у рядку 1' }).click();
  await log.getByLabel('Час, с', { exact: true }).fill('1.20');
  await log.getByRole('button', { name: 'Зберегти зміну' }).click();
  await expect(log.getByRole('cell', { name: '1,20', exact: true })).toBeVisible();
  await log.getByRole('button', { name: 'Видалити рядок 1' }).click();
  await expect(log.getByRole('button', { name: 'Експорт CSV' })).toBeDisabled();
});

test('the Stokes bench shows three simultaneous readings and depicts a change of measurement direction', async ({ page }) => {
  await page.goto('./#/mechanics/4');
  const bench = page.locator('#bench');
  const readouts = bench.locator('.mechanics-compact-readout .mechanics-reading');
  const ball = bench.locator('circle[fill="url(#mech-ball)"]').first();
  const startingRadius = Number(await ball.getAttribute('r'));
  await expect(readouts).toHaveText(['4,82 мм', '50,0 мм', '14,0 см']);
  await expect(bench.getByRole('button', { name: /діаметр посудини|відстань між мітками/i })).toHaveCount(0);

  const orientation = bench.locator('.mechanics-stokes-orientation');
  await expect(orientation).toHaveAttribute('transform', /^rotate\(0 /);
  await bench.getByRole('button', { name: 'Точка вимірювання діаметра, збільшити на 1' }).click();
  await expect(orientation).toHaveAttribute('transform', /^rotate\(36 /);
  await expect(readouts).toHaveText(['4,86 мм', '50,0 мм', '14,0 см']);
  expect(Number(await ball.getAttribute('r'))).toBe(startingRadius);

  await bench.getByRole('button', { name: 'Номер кульки, збільшити на 1' }).click();
  await expect(readouts).toHaveText(['4,91 мм', '50,0 мм', '14,0 см']);
  const radius = Number(await ball.getAttribute('r'));
  expect(radius / startingRadius).toBeCloseTo(1 + 3 * (4.90 - 4.85) / 4.85, 6);

  const centers = () => bench.locator('.mechanics-stokes-ball').evaluate(el =>
    [...el.querySelectorAll('circle')].map(circle => [circle.cx.baseVal.value, circle.cy.baseVal.value]));
  await bench.getByRole('button', { name: 'Опустити кульку' }).click();
  await expect.poll(async () => (await centers())[0][1]).toBeGreaterThan(113);
  const [bodyCenter, markerCenter] = await centers();
  expect(markerCenter).toEqual(bodyCenter);
});
