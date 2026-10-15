import { test, expect } from '@playwright/test';

test('every theory tab explains uncertainty with accessible, valid mathematics', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1050 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (let id = 1; id <= 8; id++) {
      await page.goto(`./?renderer=canvas#/lab/${id}`);
      await page.getByRole('tab', { name: 'Теорія' }).click();
      const guide = page.locator(`#panel-theory [data-uncertainty-lab="${id}"]`);
      await expect(guide).toHaveCount(1);
      await expect(guide).toHaveAttribute('open', '');
      await expect(guide.locator('.uncertainty-source')).toContainText('Методичка');
      await expect(guide.locator('.uncertainty-journal')).toContainText('Що обчислює журнал.');
      await expect(guide.locator('mfrac').first()).toBeVisible();
      expect(await guide.locator('math').evaluateAll(elements => elements.filter(el => {
        const doc = new DOMParser().parseFromString(el.outerHTML, 'application/xml');
        return doc.querySelector('parsererror') || el.namespaceURI !== 'http://www.w3.org/1998/Math/MathML';
      }).map(el => el.outerHTML))).toEqual([]);
      // Long equations may scroll inside their own block, never the workspace.
      expect(await page.locator('#workspace').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      for (const equation of await guide.locator('.formula-equation').all()) {
        expect(await equation.evaluate(el => {
          const math = el.querySelector('math')!;
          const bounds = el.getBoundingClientRect();
          return bounds.width > 0 && math.getBoundingClientRect().left >= bounds.left - 1;
        })).toBe(true);
      }
      await guide.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(guide.locator('.uncertainty-source')).toBeHidden();
      await page.keyboard.press('Enter');
      await expect(guide.locator('.uncertainty-source')).toBeVisible();
      if ([2, 3, 7, 8].includes(id)) {
        await guide.evaluate(el => {
          const workspace = document.querySelector('#workspace')!;
          workspace.scrollTop += el.getBoundingClientRect().top - workspace.getBoundingClientRect().top - 20;
        });
        await page.screenshot({ path: `test-results/uncertainty-${id}-${viewport.width}.png` });
      }
    }
  }
  expect(errors).toEqual([]);
});
