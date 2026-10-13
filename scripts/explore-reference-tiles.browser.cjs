/* eslint-disable @typescript-eslint/no-require-imports -- Local browser fixture. */
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { mkdirSync } = require('node:fs');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.EXPLORE_PREVIEW_BASE_URL || 'http://localhost:4331';
const output = join(__dirname, '../outputs/reference-tiles');
mkdirSync(output, { recursive: true });

(async () => {
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const [width, height] of [[1342, 897], [390, 844]]) for (const workflow of ['talking-head', 'hook', 'wall_text']) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/e2e/explore-format-preview?${workflow === 'talking-head' ? 'legacy=hook' : `format=${workflow}&sources=1`}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (workflow === 'talking-head') await page.getByRole('tabpanel', { name: 'Create', exact: true }).waitFor();
      const label = workflow === 'talking-head' ? /^Choose image, currently/ : /^(Add|Replace) image reference$/;
      const add = page.getByRole('button', { name: label });
      const tile = add.locator('xpath=parent::div');
      const empty = await tile.boundingBox();
      const choose = async index => {
        await add.click();
        await page.getByRole('button', { name: `Use creator ${index}`, exact: true }).click();
        await page.waitForFunction(() => {
          const images = [...document.querySelectorAll('button[aria-label^="Preview image reference:"] img')];
          return images.length && images.every(image => image.complete && image.naturalWidth > 0);
        });
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
      console.log(`PASS ${workflow} ${width}: stable tile, full image, plus appends, all images contained`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
