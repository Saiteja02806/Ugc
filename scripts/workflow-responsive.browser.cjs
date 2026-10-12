/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Playwright layout regression. */
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const base = process.env.EXPLORE_PREVIEW_BASE_URL || 'http://127.0.0.1:3000';
const referenceCardsOnly = process.argv.includes('--reference-cards');
const clipEditorOnly = process.argv.includes('--clip-editor');
const output = clipEditorOnly ? '.tmp/talking-head-clip-layout' : referenceCardsOnly ? '.tmp/workflow-reference-cards' : '.tmp/workflow-responsive';
const focusOnly = process.argv.includes('--focus');
const sizes = focusOnly ? [[1280, 720]] : [[1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [1024, 640], [390, 844]];
// A one-second local WAV exercises selection without using a provider.
const voiceFixture = Buffer.alloc(44 + 16000);
voiceFixture.write('RIFF', 0); voiceFixture.writeUInt32LE(voiceFixture.length - 8, 4);
voiceFixture.write('WAVEfmt ', 8); voiceFixture.writeUInt32LE(16, 16);
voiceFixture.writeUInt16LE(1, 20); voiceFixture.writeUInt16LE(1, 22);
voiceFixture.writeUInt32LE(8000, 24); voiceFixture.writeUInt32LE(16000, 28);
voiceFixture.writeUInt16LE(2, 32); voiceFixture.writeUInt16LE(16, 34);
voiceFixture.write('data', 36); voiceFixture.writeUInt32LE(16000, 40);
(async () => {
  const browser = await playwright.chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  const errors = [], writes = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  mkdirSync(output, { recursive: true });
  try {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const kind of clipEditorOnly ? ['talking-head'] : referenceCardsOnly ? ['hook', 'wall_text'] : focusOnly ? ['talking-head'] : ['hook', 'wall_text', 'talking-head', 'phone']) {
        const legacy = kind === 'talking-head' || kind === 'phone';
        const query = legacy ? `legacy=${kind === 'phone' ? 'phone' : 'hook'}` : `format=${kind}&sources=1`;
        await page.goto(`${base}/e2e/explore-format-preview?${query}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const tabs = page.getByRole('tablist', { name: 'Workflow sections', exact: true });
        await tabs.waitFor();
        assert.equal(await tabs.count(), 1, 'one stage navigation');
        assert.equal(await tabs.locator('xpath=ancestor::header').count(), 1, 'stages in existing title row');
        assert.equal(await tabs.getByRole('tab').count(), 3);
        const heading = page.getByRole('heading', { level: 1 });
        const headingBox = await heading.boundingBox(), tabsBox = await tabs.boundingBox();
        if (width >= 1024) assert.ok(tabsBox.y <= headingBox.y + headingBox.height && tabsBox.y + tabsBox.height >= headingBox.y, 'desktop title and tabs share a row');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no page horizontal overflow');
        for (const tab of await tabs.getByRole('tab').all()) {
          const bounds = await tab.boundingBox();
          assert.ok(bounds.height >= 40 && bounds.width >= 40, 'readable stage targets');
        }
        if (clipEditorOnly) {
          const source = page.getByRole('group', {name:'Hook video source',exact:true});
          await source.getByRole('button',{name:'Upload',exact:true}).click();
          await page.locator('input[type="file"][aria-label="Upload hook video"]').setInputFiles(join(process.cwd(),'public/explore/covers/hook-video-v1.mp4'));
          await page.getByRole('button',{name:'Continue to edit',exact:true}).first().click();
          await page.locator('input[type="file"][aria-label="Add demo"]').setInputFiles(join(process.cwd(),'public/explore/covers/hook-video-v1.mp4'));
          await page.getByRole('button',{name:'Edit talking-head video',exact:true}).click();
          await page.getByLabel('Trim start',{exact:true}).waitFor();
          await page.getByLabel('Overlay text',{exact:true}).fill('Opening text stays on this clip');
          await page.getByLabel('Trim start',{exact:true}).fill('.5');
          await page.waitForFunction(()=>{const player=document.querySelector('[aria-label="Video edit preview"] video');return player && player.readyState >= 2 && !player.seeking;});
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false,'clip editor has no horizontal overflow');
          if (width >= 1280) {
            const save = await page.getByRole('button',{name:'Save edits',exact:true}).boundingBox();
            assert.ok(save.y >= 0 && save.y + save.height <= height + 1,'clip save stays visible on laptop');
            const player = await page.getByRole('region',{name:'Video edit preview',exact:true}).boundingBox();
            assert.ok(player.x > (await page.getByLabel('Trim start',{exact:true}).boundingBox()).x,'player and controls remain side by side');
          }
          await page.screenshot({path:`${output}/talking-head-editor-${width}x${height}.png`,fullPage:true,animations:'disabled'});
          await page.getByRole('button',{name:'Back to previews',exact:true}).click();
          await page.getByRole('button',{name:'Edit demo video',exact:true}).click();
          assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'','demo has an independent text draft');
          await page.getByLabel('Overlay text',{exact:true}).fill('Demo text stays on demo');
          await page.screenshot({path:`${output}/demo-editor-${width}x${height}.png`,fullPage:true,animations:'disabled'});
          await tabs.getByRole('tab',{name:'Create',exact:true}).click();
          await tabs.getByRole('tab',{name:'Edit',exact:true}).click();
          assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Demo text stays on demo');
          await page.getByRole('button',{name:'Back to previews',exact:true}).click();
          await page.getByRole('button',{name:'Edit talking-head video',exact:true}).click();
          assert.equal(await page.getByLabel('Overlay text',{exact:true}).inputValue(),'Opening text stays on this clip');
          assert.equal(await page.getByLabel('Trim start',{exact:true}).inputValue(),'0.5');
          await page.getByRole('button',{name:'Back to previews',exact:true}).click();
          await page.getByRole('switch',{name:'Background music',exact:true}).waitFor();
          await page.getByRole('switch',{name:'Auto subtitles',exact:true}).waitFor();
          results.push({kind,width,height,headerHeight:await tabs.locator('xpath=ancestor::header').evaluate(el=>el.getBoundingClientRect().height)});
          console.log(`PASS Talking Head clip editors ${width}x${height}: independent drafts, retained finishing controls, layout and footer`);
          continue;
        }
        const instructions = legacy ? page.locator(`textarea[name="${kind === 'phone' ? 'phone' : 'hook'}Instructions"]`) : page.locator('form[data-workflow-design="classic"] textarea');
        await instructions.fill('My draft must stay exactly as typed.');
        if (legacy) {
          const refs = page.getByRole('region', { name: 'Optional references', exact: true });
          await refs.waitFor();
          for (const title of ['Image reference', 'Video reference', 'Voice reference']) await refs.getByRole('heading', { name: title, exact: true }).waitFor();
          if (kind === 'talking-head' && width === 1280) {
            // This check is opt-in: release gates still apply in unconfigured checkouts.
            const model = page.getByRole('button', { name: /^Hook model, currently/ });
            if (process.argv.includes('--seedance-enabled')) {
              await model.scrollIntoViewIfNeeded();
              await model.click();
              const seedance = page.getByRole('option', { name: 'Seedance 2.5', exact: true });
              await seedance.waitFor();
              assert.equal(await seedance.isEnabled(), true, 'Talking Head offers enabled Seedance');
              await seedance.click();
              assert.match(await model.getAttribute('aria-label'), /currently Seedance 2\.5/);
            }
          }
          assert.ok((await refs.boundingBox()).y < (await instructions.boundingBox()).y, 'references above brief');
          const creator = page.getByRole('button', { name: /^Choose image, currently/ });
          await refs.evaluate(el => { const content = el.closest('[data-workflow-section-content]'); if (content) content.scrollTop = 0; });
          await creator.click();
          await page.getByRole('button', { name: 'Use creator 1', exact: true }).click();
          if (width === 1280 && kind === 'talking-head') {
            await page.getByRole('button', { name: 'Choose video reference', exact: true }).click();
            await page.locator('input[type="file"][aria-label="Attach video reference"]').setInputFiles(join(process.cwd(), 'public/explore/covers/hook-video-v1.mp4'));
            await page.getByRole('button', { name: /^Preview video reference:/ }).waitFor();
            await page.keyboard.press('Escape');
            await page.getByRole('button', { name: /^Select audio, hook audio/ }).click();
            await page.locator('input[type="file"][aria-label="Attach hook audio"]').setInputFiles({ name: 'voice-reference.wav', mimeType: 'audio/wav', buffer: voiceFixture });
            await page.getByRole('button', { name: /^Preview voice reference:/ }).waitFor();
            await page.keyboard.press('Escape');
            for (const mediaKind of ['video', 'voice']) {
              await page.getByRole('button', { name: new RegExp(`^Preview ${mediaKind} reference:`) }).hover();
              const smallPreview = page.getByRole('dialog', { name: `${mediaKind === 'video' ? 'Video' : 'Voice'} reference`, exact: true });
              await smallPreview.waitFor();
              const bounds = await smallPreview.boundingBox();
              assert.ok(bounds.width <= 176 && bounds.height <= 220, `${mediaKind} preview stays compact`);
              if (mediaKind === 'video') assert.equal(await smallPreview.locator('video').evaluate(el => el.paused && !el.autoplay), true, 'hover does not play video');
              await page.keyboard.press('Escape');
            }
          }
          if (width >= 1280) await page.getByRole('button', { name: 'Show preview', exact: true }).click();
          const thumbnail = page.getByRole('button', { name: /^Preview image reference:/ });
          assert.equal(await thumbnail.evaluate(el => getComputedStyle(el).cursor), 'zoom-in', 'reference indicates hover preview');
          await refs.getByText('Hover or tap to preview', { exact: true }).waitFor();
          await thumbnail.hover();
          const fullImage = page.getByRole('img', { name: /^Selected image reference:/ });
          await fullImage.waitFor();
          const imageBounds = await fullImage.boundingBox();
          assert.ok(imageBounds.width > 40 && imageBounds.width <= 160 && imageBounds.height <= 160, 'compact image on hover');
          assert.equal(await fullImage.evaluate(el => getComputedStyle(el).objectFit), 'contain', 'image is not cropped');
          const popup = page.getByRole('dialog', { name: 'Image reference', exact: true });
          await popup.hover();
          await page.waitForFunction(() => { const el = document.querySelector('[role="dialog"]'); return el && getComputedStyle(el).opacity === '1'; });
          const popupBounds = await popup.boundingBox();
          assert.ok(popupBounds.x >= 0 && popupBounds.y >= 0 && popupBounds.x + popupBounds.width <= width + 1 && popupBounds.y + popupBounds.height <= height + 1, 'preview within viewport');
          if (width === 1280 && kind === 'talking-head') await page.screenshot({ path: `${output}/image-hover-${width}x${height}.png`, animations: 'disabled' });
          await page.keyboard.press('Escape');
          await fullImage.waitFor({ state: 'hidden' });
          await instructions.focus();
          await thumbnail.focus();
          await fullImage.waitFor();
          await page.keyboard.press('Escape');
          await fullImage.waitFor({ state: 'hidden' });
          await instructions.focus();
          await thumbnail.click();
          await fullImage.waitFor();
          await page.keyboard.press('Escape');
          await tabs.getByRole('tab', { name: 'Edit', exact: true }).click();
          if (width === 1366) await page.screenshot({ path: `${output}/${kind}-edit-${width}x${height}.png` });
          await tabs.getByRole('tab', { name: 'Schedule', exact: true }).click();
          if (width === 1366) await page.screenshot({ path: `${output}/${kind}-schedule-${width}x${height}.png` });
          await tabs.getByRole('tab', { name: 'Create', exact: true }).click();
          assert.match(await creator.getAttribute('title'), /\S/);
        } else {
          const refs = page.getByRole('region', { name: 'Optional generation references', exact: true });
          assert.equal(await refs.getByRole('heading', { name: 'Voice reference', exact: true }).count(), 0, 'Hook/Wall keep image and video generation inputs');
          await page.getByRole('button', { name: 'Add image reference', exact: true }).click();
          await page.getByRole('tab', { name: 'UGC Pilot images', exact: true }).click();
          await page.getByRole('button', { name: 'Use creator 1', exact: true }).click();
          const thumbnail = page.getByRole('button', { name: /^Preview image reference:/ });
          await thumbnail.waitFor();
          await thumbnail.hover();
          const fullImage = page.getByRole('img', { name: /^Selected image reference:/ });
          await fullImage.waitFor();
          assert.equal(await fullImage.evaluate(el => getComputedStyle(el).objectFit), 'contain');
          const imageBounds = await fullImage.boundingBox();
          assert.ok(imageBounds.width <= 176 && imageBounds.height <= 160, 'gallery-flow hover preview is compact');
          await page.keyboard.press('Escape');
          await fullImage.waitFor({ state: 'hidden' });
          await tabs.getByRole('tab', { name: 'Edit & demo', exact: true }).click();
          await page.getByLabel('Background audio', { exact: true }).check();
          if (width === 1366) await page.screenshot({ path: `${output}/${kind}-edit-${width}x${height}.png` });
          await tabs.getByRole('tab', { name: 'Create', exact: true }).click();
          assert.equal(await instructions.inputValue(), 'My draft must stay exactly as typed.');
          await tabs.getByRole('tab', { name: 'Edit & demo', exact: true }).click();
          assert.equal(await page.getByLabel('Background audio', { exact: true }).isChecked(), true);
          await tabs.getByRole('tab', { name: 'Schedule', exact: true }).click();
          if (width === 1366) await page.screenshot({ path: `${output}/${kind}-schedule-${width}x${height}.png` });
          await tabs.getByRole('tab', { name: 'Create', exact: true }).click();
          const panels = page.getByRole('navigation', { name: 'Workspace panels' });
          if (await panels.isVisible()) await panels.getByRole('button', { name: 'Preview', exact: true }).click();
          const gallery = page.getByRole('region', { name: 'References', exact: true });
          await gallery.waitFor({ state: 'visible' });
          assert.ok(await gallery.getByRole('button', { name: /^Recreate / }).count() > 0, 'examples remain available');
          if (width >= 1280) {
            assert.equal(await instructions.isVisible(), true, 'form and gallery both visible on laptops');
            const controls = await instructions.boundingBox(), galleryBounds = await gallery.boundingBox();
            assert.ok(galleryBounds.x > controls.x + controls.width, 'gallery beside form');
          }
        }
        assert.equal(await instructions.inputValue(), 'My draft must stay exactly as typed.');
        if (width >= 1280) {
          const action = legacy ? page.locator('[data-workflow-action]').first() : page.getByRole('button', { name: 'Generate video', exact: true });
          const bounds = await action.boundingBox();
          assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height + 1, 'generation action visible on laptop');
          assert.ok((await tabs.boundingBox()).y >= 0, 'workflow navigation remains visible');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (width === 1280 && kind === 'talking-head') await page.getByRole('region', { name: 'Optional references', exact: true }).screenshot({ path: `${output}/reference-controls-${width}x${height}.png`, animations: 'disabled' });
        if (referenceCardsOnly && width >= 1280) await page.getByRole('region', { name: 'Optional generation references', exact: true }).screenshot({ path: `${output}/${kind}-reference-cards-${width}x${height}.png`, animations: 'disabled' });
        await page.screenshot({ path: `${output}/${kind}-${width}x${height}.png`, fullPage: true, animations: 'disabled' });
        results.push({ kind, width, height, headerHeight: await tabs.locator('xpath=ancestor::header').evaluate(el => el.getBoundingClientRect().height) });
        console.log(`PASS ${kind} ${width}x${height}: header, drafts, controls, overflow`);
      }
    }
    assert.deepEqual(errors, [], 'no browser exceptions');
    assert.deepEqual(writes, [], 'no provider or publishing writes');
    writeFileSync(`${output}/results.json`, JSON.stringify({ results, errors, writes }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${output}/failed-check.png`, fullPage: true, animations: 'disabled', timeout: 10000 }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
