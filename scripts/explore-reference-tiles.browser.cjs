/* eslint-disable @typescript-eslint/no-require-imports -- Local browser fixture. */
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { mkdirSync, readFileSync } = require('node:fs');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.EXPLORE_PREVIEW_BASE_URL || 'http://localhost:4331';
const output = join(__dirname, '../outputs/reference-tiles');
mkdirSync(output, { recursive: true });

(async () => {
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const video = readFileSync(join(__dirname, '../public/explore/covers/hook-video-v1.mp4'));
  await page.route('**/*.mp4', route => route.fulfill({ status: 200, contentType: 'video/mp4', body: video }));
  for (const file of ['creator-01.png', 'creator-02.png']) {
    const image = readFileSync(join(__dirname, '../public/ai-studio/creator-references', file));
    await page.route(`**/ai-studio/creator-references/${file}`, route => route.fulfill({ status: 200, contentType: 'image/png', body: image }));
  }
  try {
    const viewports = process.env.EXPLORE_REFERENCE_MOBILE_ONLY === '1' ? [[390, 844]] : [[1342, 897], [390, 844]];
    const workflows = process.env.EXPLORE_REFERENCE_WALL_ONLY === '1' ? ['wall_text'] : ['talking-head', 'hook', 'wall_text'];
    for (const [width, height] of viewports) for (const workflow of workflows) {
      console.log(`Checking ${workflow} ${width}`);
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/e2e/explore-format-preview?${workflow === 'talking-head' ? 'legacy=hook' : `format=${workflow}&sources=1`}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      if (workflow === 'talking-head') await page.getByRole('tabpanel', { name: 'Create', exact: true }).waitFor();
      const label = workflow === 'talking-head' ? /^Choose image, currently/ : /^(Add|Replace) image reference$/;
      const add = page.getByRole('button', { name: label });
      await add.waitFor();
      const tile = add.locator('xpath=parent::div');
      const empty = await tile.boundingBox();
      const choose = async index => {
        await add.click();
        await page.getByRole('button', { name: `Use creator ${index}`, exact: true }).click();
        await page.waitForFunction(expectedCount => {
          const images = [...document.querySelectorAll('button[aria-label^="Preview image reference:"] img')];
          return images.length === expectedCount && images.every(image => image.complete && image.naturalWidth > 0);
        }, index, { timeout: 90000 });
        await page.mouse.move(width - 30, 60);
      };
      await choose(1);
      const single = await tile.boundingBox();
      assert.ok(Math.abs(single.width - empty.width) < 1 && Math.abs(single.height - empty.height) < 1, 'Selection keeps the original tile size');
      const one = page.getByRole('button', { name: /^Preview image reference:/ });
      const image = await one.first().locator('img').boundingBox();
      assert.ok(image.width >= single.width - 4 && image.height >= single.height - 4, 'One image fills the reference tile');
      await page.screenshot({ path: join(output, `${workflow}-${width}-single.png`), animations: 'disabled' });
      await choose(2);
      assert.equal(await one.count(), 2, 'Plus appends an image instead of replacing the first');
      const multiple = await tile.boundingBox();
      assert.ok(Math.abs(multiple.width - empty.width) < 1 && Math.abs(multiple.height - empty.height) < 1, 'Multiple images stay inside the same tile');
      for (const preview of await one.all()) {
        const bounds = await preview.boundingBox();
        assert.ok(bounds.x >= multiple.x && bounds.y >= multiple.y && bounds.x + bounds.width <= multiple.x + multiple.width + 1 && bounds.y + bounds.height <= multiple.y + multiple.height + 1);
      }
      await page.screenshot({ path: join(output, `${workflow}-${width}-multiple.png`), animations: 'disabled' });
      const secondName = await one.nth(1).getAttribute('aria-label');
      const remove = page.getByRole('button', { name: /^Remove image reference:/ });
      assert.equal(await remove.count(), 2, 'Each selected image has its own remove control');
      const plusBounds = await add.boundingBox();
      const removeBounds = await remove.last().boundingBox();
      assert.ok(removeBounds.y + removeBounds.height <= plusBounds.y, 'Remove and plus controls do not overlap');
      await remove.first().click();
      await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Preview image reference:"]').length === 1);
      assert.equal(await one.getAttribute('aria-label'), secondName, 'Removing the first image preserves the second');
      assert.equal(await page.getByRole('button', { name: 'Use creator 1', exact: true }).count(), 0, 'Remove does not open the reference picker');
      await page.getByRole('button', { name: /^Remove image reference:/ }).click();
      assert.equal(await one.count(), 0, 'The final image can also be deselected');
      assert.ok(await add.isVisible(), 'Plus remains available after clearing the references');
      await choose(1);
      if (workflow === 'talking-head') {
        await page.getByRole('button', { name: 'Choose video reference', exact: true }).click();
        await page.locator('input[type="file"][aria-label="Attach video reference"]').setInputFiles({ name: 'reference.mp4', mimeType: 'video/mp4', buffer: video });
        await page.keyboard.press('Escape');
      } else {
        await page.locator('input[type="file"][aria-label="Choose optional video reference"]').setInputFiles({ name: 'reference.mp4', mimeType: 'video/mp4', buffer: video });
      }
      const removeVideo = page.getByRole('button', { name: /^Remove video reference:/ });
      await removeVideo.waitFor();
      await removeVideo.click();
      await page.waitForFunction(() => !document.querySelector('button[aria-label^="Preview video reference:"]'));
      assert.equal(await page.getByRole('button', { name: /^Preview video reference:/ }).count(), 0, 'Uploaded video deselects directly');
      assert.equal(await one.count(), 1, 'Video removal keeps the image reference');
      if (workflow !== 'talking-head') {
        if (width < 1024) await page.getByRole('navigation', { name: 'Workspace panels' }).getByRole('button', { name: 'Preview', exact: true }).click();
        await page.getByRole('button', { name: /^Recreate / }).first().click();
        await removeVideo.waitFor();
        await page.screenshot({ path: join(output, `${workflow}-${width}-image-video.png`), animations: 'disabled' });
        await removeVideo.click();
        await page.waitForFunction(() => !document.querySelector('button[aria-label^="Preview video reference:"]'));
        assert.equal(await page.getByRole('button', { name: /^Preview video reference:/ }).count(), 0, 'Gallery video deselects directly');
        assert.equal(await one.count(), 1, 'Gallery video removal keeps the image reference');
      }
      console.log(`PASS ${workflow} ${width}: stable tile, plus appends, individual removal preserves other references, plus remains usable`);
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    console.log('Failed page', page.url(), await page.locator('body').innerText());
    await page.screenshot({ path: join(output, 'remove-check-failure.png'), animations: 'disabled' });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
