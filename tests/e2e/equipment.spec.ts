import { test, expect } from '@playwright/test';

test('equipment is available in every lab without exposing specimen answers or losing measurements', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const protectedValues: Record<number, string[]> = {
    1: ['750 Ом', '1275', '1 275'],
    2: ['1,2 В'],
    3: ['22 Ом', '0,004', '0,4 еВ', '25 Ом', '1 МОм'],
    5: ['20 В/поділку'],
    6: ['107,7', '193,86'],
    7: ['90 мГн', '165 мГн', '6,3 Ом', '60°'],
    8: ['3 мкФ', '5 мкФ'],
  };
  for (let id = 1; id <= 8; id++) {
    await page.goto(`./?renderer=canvas#/lab/${id}`);
    await page.getByRole('button', { name: 'Власний вимір' }).click();
    const input = page.locator('tr[data-row] input').first();
    await input.fill('2');
    const equipment = page.getByRole('tab', { name: 'Обладнання' });
    await expect(page.getByRole('tab')).toHaveCount(4);
    await equipment.click();
    const panel = page.locator('#panel-equipment');
    await expect(panel).toBeVisible();
    await expect(equipment).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
    const items = panel.getByRole('listitem');
    for (const entry of await items.all()) {
      const name = await entry.getByRole('heading').innerText();
      await expect(entry.getByRole('img', { name: `${name} — схематичне зображення`, exact: true })).toBeVisible();
    }
    // Illustrations are reference pictures and must not become apparatus controls.
    await expect(items.locator('[data-bench-action], [role="slider"], [tabindex]')).toHaveCount(0);
    for (const value of protectedValues[id] ?? []) await expect(panel).not.toContainText(value);
    // The theory overview must not reintroduce the original nominal-value list.
    await page.getByRole('button', { name: 'Теорія та обробка похибок' }).click();
    await expect(page.locator('#tab-theory')).toBeFocused();
    await expect(page.locator('#panel-theory .equipment')).toHaveCount(0);
    await page.getByRole('button', { name: 'Характеристики обладнання' }).click();
    await expect(equipment).toBeFocused();
    const link = panel.getByRole('link', { name: /Методичка/ });
    const url = await link.getAttribute('href');
    expect(url).toMatch(/\.pdf#page=\d+$/);
    expect((await page.request.get(url!.split('#')[0])).ok()).toBe(true);
    expect(await page.locator('#workspace').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/equipment-${id}-desktop.png` });
    for (let i = 0; i < await items.count(); i++) {
      await items.nth(i).screenshot({ path: `test-results/equipment-${id}-item-${i + 1}.png` });
    }
    await equipment.press('Home');
    await expect(page.locator('#tab-experiment')).toBeFocused();
    await expect(input).toHaveValue('2');
    await page.reload();
    await expect(page.locator('tr[data-row]')).toHaveCount(1);
    await expect(input).toHaveValue('2');
  }
  expect(errors).toEqual([]);
});

test('four tabs wrap keyboard navigation and equipment stays readable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (let id = 1; id <= 8; id++) {
    await page.goto(`./?renderer=canvas#/lab/${id}`);
    const experiment = page.getByRole('tab', { name: 'Експеримент' });
    const equipment = page.getByRole('tab', { name: 'Обладнання' });
    await experiment.press('End');
    await expect(equipment).toBeFocused();
    await expect(page.locator('#panel-equipment')).toBeVisible();
    await equipment.press('ArrowRight');
    await expect(experiment).toBeFocused();
    await experiment.press('ArrowLeft');
    await expect(equipment).toBeFocused();
    const tabBox = await equipment.boundingBox();
    expect(tabBox!.x).toBeGreaterThanOrEqual(0);
    expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(390);
    expect(await page.locator('#workspace').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const clipped = await page.locator('.equipment-item dd, .equipment-controls table').evaluateAll(elements =>
      elements.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
    expect(clipped).toEqual([]);
    await page.screenshot({ path: `test-results/equipment-${id}-mobile.png` });
    await page.locator('.equipment-controls').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/equipment-${id}-controls-mobile.png` });
  }
});
