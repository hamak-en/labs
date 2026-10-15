import { test, expect } from '@playwright/test';
import source from '../../src/source.json' with { type: 'json' };

test('all control questions have complete answers and valid native mathematics', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (let id = 1; id <= 8; id++) {
    await page.goto(`./?renderer=canvas#/lab/${id}`);
    await page.getByRole('tab', { name: 'Контрольні питання' }).click();
    const questions = page.locator('#panel-questions details');
    await expect(questions).toHaveCount(source[id - 1]!.questions.length);
    for (let i = 0; i < source[id - 1]!.questions.length; i++) {
      const question = questions.nth(i);
      await question.locator('summary').click();
      await expect(question.locator('.question-answer')).toBeVisible();
      await expect(question.locator('summary')).toContainText(source[id - 1]!.questions[i]!);
      expect(await question.locator('.question-answer p').count()).toBeGreaterThanOrEqual(2);
    }
    // XML parsing also detects broken nesting/escaping that HTML recovery would hide.
    const invalid = await page.locator('#panel-questions math').evaluateAll(elements => elements.filter(el => {
      const document = new DOMParser().parseFromString(el.outerHTML, 'application/xml');
      return document.querySelector('parsererror') || el.namespaceURI !== 'http://www.w3.org/1998/Math/MathML';
    }).map(el => el.outerHTML));
    expect(invalid).toEqual([]);
    await expect(page.locator('#panel-questions mfrac').first()).toBeVisible();
    expect(await page.locator('#workspace').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (id === 1) {
      await questions.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'test-results/answers-desktop.png' });
    }
  }
  expect(errors).toEqual([]);
});

test('answer derivations remain readable on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of [1, 6, 7, 8]) {
    await page.goto(`./?renderer=canvas#/lab/${id}`);
    await page.getByRole('tab', { name: 'Контрольні питання' }).click();
    // Exercise keyboard disclosure as well as mouse disclosure in the desktop test.
    for (const summary of await page.locator('#panel-questions summary').all()) {
      await summary.focus();
      await page.keyboard.press('Enter');
    }
    expect(await page.locator('#workspace').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const clipped = await page.locator('.question-answer .formula-equation').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
    expect(clipped).toEqual([]);
    if (id === 1) {
      await page.locator('#panel-questions details').nth(3).scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'test-results/answers-mobile.png' });
    }
  }
});
