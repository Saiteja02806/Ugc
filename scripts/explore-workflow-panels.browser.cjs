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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  mkdirSync('.tmp/explore-workflow-panels', { recursive: true });
  try {
    for (const format of ['hook', 'wall_text']) {
      await page.goto(`${base}/e2e/explore-format-preview?format=${format}&sources=1`, { waitUntil: 'networkidle' });
      const aside = page.locator('aside[data-section]');
      for (const [label, mode] of [['Create video', 'generate'], ['Upload video', 'upload'], ['Creative Assets', 'assets']]) {
        await page.getByRole('tab', { name: 'Edit video', exact: true }).click();
        assert.equal(await aside.getByRole('group', { name: 'Choose a video source' }).isVisible(), true);
        assert.equal(await aside.getByText('Generate, upload or choose a video', { exact: false }).count(), 0);
        await aside.getByRole('button', { name: label, exact: true }).click();
        assert.equal(await aside.getAttribute('data-section'), 'create');
        assert.equal(new URL(page.url()).searchParams.get('videoSource'), mode);
        if (mode === 'upload') await aside.getByRole('button', { name: /^Upload video/ }).waitFor({ state: 'visible' });
        if (mode === 'assets') await aside.getByRole('button', { name: 'Choose from Creative Assets', exact: true }).waitFor({ state: 'visible' });
      }
      await page.getByRole('tab', { name: 'Edit video', exact: true }).click();
      await page.screenshot({ path: `.tmp/explore-workflow-panels/${format}-empty-edit.png`, fullPage: true, animations: 'disabled' });
      assert.equal(await page.getByRole('tab', { name: 'Demo', exact: true }).count(), format === 'hook' ? 1 : 0);
      console.log(`PASS ${format}: empty Edit actions reach each source`);
    }
    await page.goto(`${base}/e2e/explore-format-preview?format=hook`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Demo', exact: true }).click();
    const hook = page.getByLabel('Hook preview', { exact: true });
    await hook.waitFor();
    await page.getByLabel('Upload demo video', { exact: true }).setInputFiles('public/explore/covers/hook-video-v1.mp4');
    const demo = page.getByLabel('Demo preview', { exact: true });
    await demo.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Video sequence preview"] video')].every(video => video.readyState >= 2));
    await page.getByRole('button', { name: 'Edit demo video', exact: true }).click();
    await page.getByLabel('Overlay text', { exact: true }).fill('First demo message');
    await page.getByLabel('Text end time').fill('2');
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByLabel('Overlay text', { exact: true }).fill('Second demo message');
    await page.getByLabel('Text start time').fill('3');
    await page.getByLabel('Text end time').fill('5');
    for (const [width, height, name] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `.tmp/explore-workflow-panels/demo-text-${name}.png`, fullPage: true, animations: 'disabled' });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Back to previews', exact: true }).last().click();
    assert.equal(await page.getByRole('button', { name: 'Schedule', exact: true }).isEnabled(), true);
    assert.equal(await page.getByText(/You can add your demo now|Save your opening in Edit video/).count(), 0);
    await hook.evaluate(video => video.play());
    await demo.evaluate(video => video.play());
    await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
    assert.equal(await page.getByLabel('Scheduled hook preview', { exact: true }).isVisible(), true);
    assert.equal(await page.getByLabel('Scheduled demo preview', { exact: true }).isVisible(), true);
    await page.screenshot({ path: '.tmp/explore-workflow-panels/hook-schedule-desktop.png', fullPage: true, animations: 'disabled' });
    assert.equal(await hook.evaluate(video => video.paused), true);
    assert.equal(await demo.evaluate(video => video.paused), true);
    await page.getByRole('tab', { name: 'Demo', exact: true }).click();
    assert.equal(await hook.isVisible(), true); assert.equal(await demo.isVisible(), true);
    const demoUrl = await demo.evaluate(video => video.getAttribute('src'));
    await page.getByRole('tab', { name: 'Create', exact: true }).click();
    await page.locator('aside[data-section]').getByRole('button', { name: 'Creative Assets', exact: true }).click();
    await page.getByRole('button', { name: 'Choose from Creative Assets', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Existing video preview/ }).click();
    await page.getByRole('button', { name: 'Edit this video', exact: true }).click();
    const editActions = page.locator('footer[aria-label="Workflow action"]');
    await page.getByLabel('Overlay text', { exact: true }).fill('Draft survives preview');
    assert.ok((await editActions.getByRole('button', { name: 'Save edits', exact: true }).boundingBox()).width < 180);
    await editActions.getByRole('button', { name: 'Back to preview', exact: true }).click();
    assert.equal(await page.locator('aside[data-section]').getAttribute('data-section'), 'create');
    assert.equal(await page.getByLabel('Your selected video', { exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Edit this video', exact: true }).click();
    assert.equal(await page.getByLabel('Overlay text', { exact: true }).inputValue(), 'Draft survives preview');
    await page.screenshot({ path: '.tmp/explore-workflow-panels/compact-save-back-preview.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('tab', { name: 'Demo', exact: true }).click();
    assert.equal(await demo.evaluate(video => video.getAttribute('src')), demoUrl);
    assert.equal(await hook.evaluate(video => video.getAttribute('src')), '/explore/covers/hook-video-v1.mp4');
    for (const [width, height, name] of [[1440, 1000, 'desktop'], [1280, 720, 'laptop'], [390, 844, 'mobile'], [320, 700, 'small-mobile']]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `.tmp/explore-workflow-panels/hook-demo-${name}.png`, fullPage: true, animations: 'disabled' });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('aside[data-section]').getByRole('button', { name: 'Creative Assets', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Saved creator clip/ }).click();
    assert.equal(await demo.evaluate(video => video.getAttribute('src')), '/explore/covers/hook-video-v1.mp4');
    await page.getByRole('button', { name: 'Remove demo', exact: true }).click();
    assert.equal(await demo.count(), 0); assert.equal(await hook.isVisible(), true);
    await page.goto(`${base}/e2e/explore-format-preview?format=slideshow`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Recreate / }).first().click();
    await page.getByRole('button', { name: 'Add image to your instructions', exact: true }).click();
    await page.getByRole('dialog').getByText('Attach an image', { exact: true }).waitFor();
    await page.getByLabel('Choose instruction reference image', { exact: true }).setInputFiles('public/explore/covers/create-hook-v3.webp');
    await page.getByAltText('Attached reference', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Generate image', exact: true }).isDisabled(), true);
    await page.getByRole('tab', { name: 'Edit slides', exact: true }).click();
    assert.equal(await page.getByText('0 / 10', { exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('button', { name: 'Save slideshow', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Go to Create', exact: true }).click();
    assert.equal(await page.getByAltText('Attached reference', { exact: true }).isVisible(), true);
    for (const [width, height, name] of [[1440, 1000, 'desktop'], [390, 844, 'mobile'], [320, 700, 'small-mobile']]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `.tmp/explore-workflow-panels/slideshow-reference-${name}.png`, fullPage: true, animations: 'disabled' });
    }
    console.log('PASS Slideshow: instructions attachment persists across steps; catalogue does not populate final slides; preview remains locked; responsive layout');
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    console.log('PASS Hook Demo: hook preview before saving, uploaded and saved demos, tab/source persistence, playback pause, removal, desktop/mobile layout');
    console.log('PASS no browser errors or non-GET API requests');
  } catch (error) {
    console.error(error, errors);
    await page.screenshot({ path: '.tmp/explore-workflow-panels/failure.png', fullPage: true, timeout: 10000 }).catch(() => {});
    console.error(await page.locator('aside[data-section]').evaluate(aside => ({ step: aside.dataset.section, text: aside.innerText, panels: [...aside.querySelectorAll('[role="tabpanel"]')].map(panel => ({ label: panel.getAttribute('aria-labelledby'), hidden: panel.hidden, ending: panel.hasAttribute('data-ending-style') })) })).catch(() => null));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
