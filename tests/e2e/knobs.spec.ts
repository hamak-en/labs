import { test, expect } from '@playwright/test';

const steps: Record<number, Record<string, number>> = {
  1: { r: 1000 }, 2: { ln: .1 }, 3: { t: 1 }, 4: { u: .01 },
  5: { u: .1, phase: 1, f: 1 }, 6: { u: 1, r: .5 }, 7: { u: 1 }, 8: {},
};

test('knob buttons step by one increment, support the keyboard and respect limits', async ({ page }) => {
  for (let id = 1; id <= 8; id++) {
    await page.goto(`./?renderer=canvas#/lab/${id}`);
    await expect(page.locator('[data-bench-step]')).toHaveCount(Object.keys(steps[id]!).length * 2);
    for (const [key, step] of Object.entries(steps[id]!)) {
      const knob = page.locator(`.bench-knob[data-bench-drag="${key}"]`);
      const plus = page.locator(`[data-bench-step="${key}"][data-direction="1"]`);
      const minus = page.locator(`[data-bench-step="${key}"][data-direction="-1"]`);
      const initial = Number(await knob.getAttribute('aria-valuenow'));
      await plus.click();
      await expect(knob).toHaveAttribute('aria-valuenow', String(Number((initial + step).toFixed(6))));
      await minus.click();
      await expect(knob).toHaveAttribute('aria-valuenow', String(initial));
      await plus.focus();
      await page.keyboard.press('Enter');
      await expect(plus).toBeFocused();
      await page.keyboard.press('Space');
      await expect(knob).toHaveAttribute('aria-valuenow', String(Number((initial + 2 * step).toFixed(6))));
      await knob.press('Home');
      await expect(minus).toHaveAttribute('aria-disabled', 'true');
      await minus.dispatchEvent('click');
      await expect(knob).toHaveAttribute('aria-valuenow', (await knob.getAttribute('aria-valuemin'))!);
      await knob.press('End');
      await expect(plus).toHaveAttribute('aria-disabled', 'true');
      await plus.dispatchEvent('click');
      await expect(knob).toHaveAttribute('aria-valuenow', (await knob.getAttribute('aria-valuemax'))!);
      await page.locator(`#number-${key}`).fill(String(initial));
    }
    if ([1, 2, 3, 4, 5, 6, 7].includes(id)) {
      await page.locator('.bench-viewport').screenshot({ path: `test-results/knob-buttons-${id}.png` });
    }
  }
});

test('DC fine adjustment persists and the sensitivity knob uses its own step', async ({ page }) => {
  await page.goto('./?renderer=canvas#/lab/4');
  await page.locator('#number-u').fill('0.54');
  const plus = page.locator('[data-bench-step="u"][data-direction="1"]');
  await expect(plus).toHaveAccessibleName(/на 0,01 В/);
  await plus.click();
  await expect(page.locator('#number-u')).toHaveValue('0.55');
  await page.reload();
  await expect(page.locator('#number-u')).toHaveValue('0.55');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-bench-step="u"][data-direction="-1"]').click();
  await expect(page.locator('#number-u')).toHaveValue('0.54');
  await page.goto('./?renderer=canvas#/lab/5');
  await page.locator('[data-bench-action="sensitivity"]').click();
  await expect(page.locator('[data-bench-step="u"]')).toHaveCount(0);
  await page.locator('[data-bench-step="ux"][data-direction="1"]').click();
  await expect(page.locator('#number-ux')).toHaveValue('3.1');
});
