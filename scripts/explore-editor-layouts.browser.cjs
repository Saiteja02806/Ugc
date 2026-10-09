/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local browser check. */
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.EXPLORE_PREVIEW_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  mkdirSync('.tmp/explore-editor-layouts', { recursive: true });
  try {
    await page.goto(`${base}/e2e/explore-format-preview?format=hook&compare=1&editorLayout=controls`, { waitUntil: 'networkidle' });
    const editor = page.getByLabel('Video edit preview', { exact: true });
    const video = editor.locator('video').first();
    await video.waitFor();
    await page.waitForFunction(() => document.querySelector('section[aria-label="Video edit preview"] video')?.readyState >= 2);
    await video.evaluate(player => player.play());
    await page.waitForFunction(() => document.querySelector('section[aria-label="Video edit preview"] video')?.currentTime > .1);
    await video.evaluate(player => player.pause());
    await page.getByLabel('Trim start', { exact: true }).fill('1');
    await page.getByLabel('Trim end', { exact: true }).fill('7');
    assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('Text overlay preview', { exact: true }).count(), 0);
    await page.getByLabel('Overlay text', { exact: true }).fill('First timed message');
    await page.getByLabel('Text end time', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByLabel('Overlay text', { exact: true }).fill('Second timed message');
    await page.getByLabel('Text start time', { exact: true }).fill('2');
    await page.getByLabel('Text end time', { exact: true }).fill('4');

    for (const [layout, button] of [['controls', 'A · Controls on the left'], ['preview', 'B · Edit beside preview']]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.getByLabel('Trim start', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Trim start', { exact: true }).inputValue(), '1');
      assert.equal(await page.getByLabel('Trim end', { exact: true }).inputValue(), '7');
      assert.equal(await page.getByRole('button', { name: 'Edit text block 1', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Edit text block 2', exact: true }).count(), 1);
      assert.equal(await page.getByLabel('Trim start', { exact: true }).evaluate(input => !!input.closest('aside')), layout === 'controls');
      assert.equal(await page.getByRole('tab', { name: 'Edit video', exact: true }).count(), layout === 'controls' ? 1 : 0);
      assert.equal(await page.getByRole('button', { name: 'Save edits', exact: true }).isDisabled(), true);
      assert.ok((await page.getByRole('button', { name: 'Save edits', exact: true }).boundingBox()).width < 180);
      await page.getByRole('button', { name: 'Edit text block 2', exact: true }).click();
      assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), 'Second timed message');
      await page.getByRole('button', { name: 'Back to preview', exact: true }).last().click();
      await page.getByLabel('Your selected video', { exact: true }).waitFor();
      await page.getByRole('button', { name: layout === 'controls' ? 'Edit this video' : 'Edit hook video', exact: true }).click();
      await page.getByRole('button', { name: 'Edit text block 2', exact: true }).click();
      assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), 'Second timed message');
      for (const [width, height, size] of [[1440, 1000, 'desktop'], [1280, 720, 'laptop'], [390, 844, 'mobile'], [320, 700, 'small-mobile']]) {
        await page.setViewportSize({ width, height });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${layout} ${size} must fit`);
        if (width >= 1280) assert.ok((await video.boundingBox()).width >= 300, `${layout} ${size} must leave a readable video`);
        await page.screenshot({ path: `.tmp/explore-editor-layouts/${layout}-${size}.png`, fullPage: true, animations: 'disabled' });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log(`PASS ${layout}: correct placement, playable clip, trim and timed text retained, compact actions, preview/reopen, responsive 320–1440px`);
    }
    // A direct B link also starts with a useful clip and functional preview navigation.
    await page.goto(`${base}/e2e/explore-format-preview?format=hook&compare=1&editorLayout=preview`, { waitUntil: 'networkidle' });
    await page.getByLabel('Trim start', { exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Edit video', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Back to preview', exact: true }).last().click();
    await page.getByLabel('Your selected video', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit hook video', exact: true }).click();
    while (await page.getByRole('button', { name: /^Remove text block/ }).count()) await page.getByRole('button', { name: /^Remove text block/ }).first().click();
    assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), '');
    await page.getByLabel('Text start time', { exact: true }).fill('1');
    await page.getByLabel('Text end time', { exact: true }).fill('3');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('Text start time', { exact: true }).inputValue(), '1');
    assert.equal(await page.getByLabel('Text end time', { exact: true }).inputValue(), '3');
    assert.equal(await page.getByLabel('Text overlay preview', { exact: true }).count(), 0);
    // Hook and demo editors identify their clip and preserve separate drafts.
    await page.getByLabel('Overlay text', { exact: true }).fill('Hook-only message');
    await page.getByRole('button', { name: 'Back to preview', exact: true }).last().click();
    await page.getByRole('button', { name: 'Continue to Demo', exact: true }).click();
    await page.getByLabel('Upload demo video', { exact: true }).setInputFiles('public/explore/covers/hook-video-v1.mp4');
    await page.getByRole('button', { name: 'Edit demo video', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit demo video', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), '');
    await page.getByLabel('Overlay text', { exact: true }).fill('Demo-only message');
    await page.getByRole('button', { name: 'Back to previews', exact: true }).last().click();
    await page.getByRole('button', { name: 'Edit hook video', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit hook video', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), 'Hook-only message');
    await page.getByRole('button', { name: 'Back to previews', exact: true }).last().click();
    await page.getByLabel('Demo preview', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit demo video', exact: true }).click();
    assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), 'Demo-only message');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '.tmp/explore-editor-layouts/demo-default-text-mobile.png', fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log('PASS direct preview link; no browser errors or non-GET API requests');
    console.log('PASS default empty text box, blank draft reload, no blank preview, isolated hook/demo drafts and correct return destination');
  } catch (error) {
    await page.screenshot({ path: '.tmp/explore-editor-layouts/failure.png', fullPage: true }).catch(() => {});
    console.error(errors);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
