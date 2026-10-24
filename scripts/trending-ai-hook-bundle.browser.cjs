/* eslint-disable @typescript-eslint/no-require-imports -- Browser acceptance for the public bundle. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const bundle = require('../lib/trending/ai-hook-bundle.json');
const { mixTrendingHookVideos } = require('../lib/trending/ai-hook-bundle-order.ts');
const output = path.resolve('.tmp/trending-ai-hooks-qa');
fs.mkdirSync(output, { recursive: true });

(async () => {
  assert.equal(bundle.videos.length, 128);
  assert.equal(new Set(bundle.videos.map(item => item.sha256)).size, 128);
  assert.ok(bundle.videos.every(item => item.videoUrl.includes('/avatars/global/hook-silent-') && !item.videoUrl.includes('/explore/')));
  const mixed = mixTrendingHookVideos(bundle.videos);
  assert.equal(new Set(mixed.map(item => item.id)).size, 128);
  assert.equal(new Set(mixed.slice(0, 12).map(item => item.creatorKey)).size, 12);
  assert.ok(mixed.every((item, index) => index === 0 || item.creatorKey !== mixed[index - 1].creatorKey));
  assert.notDeepEqual(mixed.map(item => item.id), bundle.videos.map(item => item.id));
  assert.deepEqual(mixTrendingHookVideos(bundle.videos), mixed);
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const response = await page.goto(process.argv[2] || process.env.BUNDLE_PAGE_URL || 'http://127.0.0.1:3120/hookvideos', { waitUntil: 'domcontentloaded', timeout: 90000 });
    assert.equal(response.status(), 200);
    await page.getByRole('heading', { name: 'A hook for every reaction.' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Preview / }).count(), 128);
    assert.equal(await page.locator('video').count(), 0);
    assert.equal(await page.getByRole('link', { name: /Download all/i }).count(), 0);
    assert.equal(await page.locator('a[href$=".zip"]').count(), 0);
    assert.doesNotMatch(await page.locator('body').innerText(), /Creator\s*\d+/i);
    assert.doesNotMatch(await page.locator('body').innerText(), /download the full collection/i);
    await page.waitForFunction(() => [...document.querySelectorAll('img')].slice(0, 6).every(image => image.complete && image.naturalWidth > 0));
    assert.deepEqual(await page.locator('section[aria-label="Hook video collection"] img').evaluateAll(images => images.map(image => image.getAttribute('src'))), mixed.map(item => item.posterUrl));
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    const search = page.getByRole('searchbox', { name: 'Search hook videos' });
    await search.fill('shock');
    const expected = bundle.videos.filter(item => item.reaction.toLowerCase().includes('shock')).length;
    assert.equal(await page.getByRole('button', { name: /^Preview / }).count(), expected);
    await search.fill('no matching clip 0000');
    await page.getByText('No hook videos match your search.').waitFor();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByRole('combobox', { name: 'Filter by reaction' }).selectOption('shock_surprise');
    assert.equal(await page.getByRole('button', { name: /^Preview / }).count(), bundle.videos.filter(item => item.reaction === 'shock_surprise').length);
    await page.getByRole('button', { name: /^Preview / }).first().click();
    await page.getByRole('dialog').waitFor();
    assert.doesNotMatch(await page.getByRole('dialog').innerText(), /Creator\s*\d+/i);
    await page.getByRole('dialog').getByRole('heading', { name: 'Shock surprise' }).waitFor();
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    assert.equal(await page.locator('video').evaluate(video => video.controls && video.muted && video.videoWidth > 0), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('video').count(), 0);
    await page.getByRole('combobox').selectOption('');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'mobile.png') });
    await page.getByRole('button', { name: /^Preview / }).first().focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight; }), true);
    await page.screenshot({ path: path.join(output, 'mobile-preview.png') });
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ url: page.url(), videos: 128, checks: ['anonymous access', 'Trending-only provenance', 'mixed creator order', 'bulk download hidden', 'reaction labels only', 'search', 'reaction filter', 'empty state', 'real playback', 'keyboard open/close', 'mobile fit', 'no page errors'] }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
