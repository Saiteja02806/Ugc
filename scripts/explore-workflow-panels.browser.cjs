/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS Playwright runner. */
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.EXPLORE_PREVIEW_BASE_URL || 'http://localhost:3000';
(async () => {
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  mkdirSync('.tmp/explore-workflow-panels', { recursive: true });
  try {
    for (const [width, height] of [[1024, 640], [1280, 640], [1366, 680], [1536, 780], [900, 560]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/e2e/explore-format-preview?format=hook`, { waitUntil: 'networkidle' });
      assert.equal(await page.getByRole('tab', { name: 'Edit video', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Your videos', exact: true }).click();
      await page.getByRole('button', { name: 'Edit hook video', exact: true }).click();
      await page.getByLabel('Clip edit action', { exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `.tmp/explore-workflow-panels/hook-edit-${width}x${height}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Back to previews', exact: true }).click();
      await page.getByRole('tab', { name: 'Demo', exact: true }).click();
      await page.getByLabel('Background audio', { exact: true }).check();
      await page.getByRole('tab', { name: 'Create', exact: true }).click();
      await page.getByRole('tab', { name: 'Demo', exact: true }).click();
      assert.equal(await page.getByLabel('Background audio', { exact: true }).isChecked(), true);
      await page.screenshot({ path: `.tmp/explore-workflow-panels/hook-demo-${width}x${height}.png`, fullPage: true });
      console.log(`PASS ${width}x${height}: preview editing, preserved Demo audio choice, no horizontal overflow`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
