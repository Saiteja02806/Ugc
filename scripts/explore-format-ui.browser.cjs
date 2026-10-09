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
  page.setDefaultNavigationTimeout(60000);
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  mkdirSync('.tmp/explore-format-split', { recursive: true });
  try {
    if (!process.argv.includes('--routes-only')) {
    await page.goto(`${base}/explore?preview=1`, { waitUntil: 'networkidle' });
    for (const title of ['Hook video', 'Wall of text', 'Slideshows']) assert.equal(await page.getByRole('heading', { name: title, exact: true }).count(), 1);
    assert.equal(await page.locator('a[href="/audio-generation"]').count(), 0);
    assert.equal(await page.locator('a[href*="/explore/create-hook"],a[href*="/explore/creator-phone"]').count(), 0);
    assert.equal(await page.locator('[data-explore-shortcut]').count(), 6);
    for (const [id, pathname, mode] of [['video', '/ai-studio', 'videos'], ['image', '/ai-studio', 'images'], ['schedule', '/scheduling', null]]) {
      const shortcut = new URL(await page.locator(`[data-explore-shortcut="${id}"]`).getAttribute('href'), base);
      assert.equal(shortcut.pathname, pathname);
      assert.equal(shortcut.searchParams.get('preview'), '1');
      assert.equal(shortcut.searchParams.get('mode'), mode);
    }
    await page.waitForFunction(() => [...document.querySelectorAll('[data-workflow-cover] video')].length === 3 && [...document.querySelectorAll('[data-workflow-cover] video')].every(video => video.readyState >= 2 && !video.paused && video.videoWidth === 960 && video.videoHeight === 540));
    const coverPaths = ['/explore/covers/hook-video-v2.mp4', '/explore/covers/wall-of-text-v3.mp4', '/explore/covers/slideshows-v2.mp4'];
    for (const [index, video] of (await page.locator('[data-workflow-cover] video').all()).entries()) {
      assert.equal(await video.evaluate(element => element.muted && element.loop && element.playsInline), true);
      assert.equal(await video.evaluate(element => new URL(element.currentSrc).pathname), coverPaths[index]);
      assert.equal(await video.evaluate(element => getComputedStyle(element).objectFit), 'cover');
    }
    assert.ok(Math.abs(await page.locator('[data-workflow-cover] video').nth(1).evaluate(video => video.duration) - 15.6667) < .05);
    // A stable view of each current cover's opening example.
    await page.locator('[data-workflow-cover] video').evaluateAll(videos => videos.forEach(video => { video.pause(); video.currentTime = video.currentSrc.includes('wall-of-text') ? 2 : .5; }));
    await page.waitForFunction(() => [...document.querySelectorAll('[data-workflow-cover] video')].every(video => !video.seeking));
    await page.screenshot({ path: '.tmp/explore-format-split/explore-desktop.png', fullPage: true });
    for (const [width, height, name] of [[1280, 720, 'laptop'], [390, 844, 'mobile']]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      for (const cover of await page.locator('[data-workflow-cover]').all()) {
        const bounds = await cover.boundingBox();
        assert.ok(Math.abs(bounds.width / bounds.height - 16 / 9) < .02);
      }
      await page.screenshot({ path: `.tmp/explore-format-split/explore-covers-${name}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-workflow-cover] video')].every(video => video.paused && !video.autoplay));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-workflow-cover] video')].every(video => !video.paused && video.autoplay));
    console.log('PASS Explore: three edge-to-edge cover loops, six quick starts, correct studio modes, responsive layout and reduced motion');
    if (process.argv.includes('--covers-only')) {
      assert.deepEqual(errors, []); assert.deepEqual(writes, []);
      console.log('PASS no browser errors or provider/account writes');
      return;
    }
    for (const [route, title, view, generate] of [['hook-video','Hook video','Your Video','Generate video'], ['wall-of-text','Wall of text','Your Video','Generate video'], ['slideshows','Slideshows','Your Slides','Generate image']]) {
      await page.goto(`${base}/explore/${route}?preview=1`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
      const gallery = page.getByRole('region', { name: 'References', exact: true });
      const recreateButtons = gallery.getByRole('button', { name: /^Recreate / });
      assert.ok(await recreateButtons.count() > 0 && await recreateButtons.count() <= 12);
      assert.equal(await page.getByRole('button', { name: /^(Use reference|Selected reference) / }).count(), 0);
      assert.equal(await page.getByRole('tablist', { name: 'Workflow sections' }).count(), 1);
      assert.equal(await page.locator('footer[aria-label="Workflow action"]').count(), 1);
      assert.equal(await page.getByRole('button', { name: generate, exact: true }).evaluate(button => Boolean(button.form && button.form.dataset.layout === 'workflow')), true);
      assert.equal(await page.getByRole('button', { name: 'Generate', exact: true }).count(), route === 'slideshows' ? 0 : 1);
      await recreateButtons.first().click();
      assert.equal(await recreateButtons.first().getAttribute('aria-pressed'), 'true');
      if (route !== 'slideshows') {
        const optional = page.getByRole('region', { name: 'Optional generation references', exact: true });
        assert.equal(await optional.getByRole('button', { name: 'Add image reference', exact: true }).isEnabled(), true);
        const styleButton=optional.getByRole('button', { name: 'Preview video style reference', exact: true });
        assert.equal(await styleButton.isEnabled(), true);
        await styleButton.click();
        const stylePlayer=page.getByLabel('Selected style video preview', {exact:true});
        await stylePlayer.waitFor();
        assert.equal(await stylePlayer.evaluate(video => video.tagName), 'VIDEO');
        assert.equal(await stylePlayer.evaluate(video => video.currentSrc.includes('.mp4')), true);
        await stylePlayer.evaluate(video => video.play());
        await page.screenshot({ path: `.tmp/explore-format-split/${route}-selected-style-video.png`, fullPage: false });
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="popover-content"]').waitFor({state:'detached'});
        assert.equal(await page.getByText('Choose a reference', { exact: true }).count(), 0);
        await optional.getByRole('button', { name: 'Add image reference', exact: true }).click();
        await page.getByLabel('Choose optional image reference', { exact: true }).setInputFiles('public/explore/covers/hook-video-v2.webp');
        await page.getByRole('button', { name: 'Remove image reference', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Use creator 1', exact: true }).click();
        await page.waitForFunction(() => { const tile = document.querySelector('[aria-label="Replace image reference"]'); return tile && !tile.disabled && !tile.getAttribute('title').includes('hook-video-v2.webp'); });
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
        await optional.getByRole('button', { name: 'Preview video style reference', exact: true }).click();
        await page.getByLabel('Choose optional video reference', { exact: true }).setInputFiles(join(process.env.USERPROFILE, 'OneDrive/Desktop/workflow/format2/hook.mp4'));
        await page.getByRole('button', { name: 'Remove video reference', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Remove image reference', exact: true }).count(), 0);
        assert.match(await page.getByRole('button', { name: /^Video model, currently / }).textContent(), /Runway/);
        await page.getByLabel('Choose optional video reference', { exact: true }).setInputFiles('public/explore/covers/hook-video-v2.mp4');
        await optional.getByRole('alert').waitFor();
        assert.match(await optional.getByRole('alert').textContent(), /up to 3 seconds/);
        assert.equal(await optional.getByRole('button', { name: 'Replace video reference', exact: true }).getAttribute('title'), 'hook.mp4');
        assert.equal(await page.getByRole('button', { name: 'Generate video', exact: true }).isDisabled(), true);
        await page.screenshot({ path: `.tmp/explore-format-split/${route}-optional-video.png`, fullPage: false });
        await page.getByRole('button', { name: 'Remove video reference', exact: true }).click();
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
        assert.equal(await page.getByRole('region', { name: 'Selected style example' }).count(), 0);
        assert.equal(await recreateButtons.first().getAttribute('aria-pressed'), 'true');
        await optional.getByRole('button', {name:'Preview video style reference',exact:true}).click();
        await page.getByRole('button',{name:'Clear style example',exact:true}).click();
        assert.equal(await recreateButtons.first().getAttribute('aria-pressed'), 'false');
        await recreateButtons.first().click();
      } else assert.equal(await page.getByRole('region', { name: 'Optional generation references', exact: true }).count(), 0);
      const iconBox = await recreateButtons.first().boundingBox();
      const imageBox = await gallery.getByRole('button', { name: /^Preview / }).first().boundingBox();
      assert.ok(iconBox.y >= imageBox.y && iconBox.y - imageBox.y < 20, 'Recreate belongs at the top of the image');
      assert.equal(await page.locator('form[data-layout="workflow"] fieldset').count(), 0);
      const settingsButton = page.getByRole('button', { name: 'Generation settings', exact: true });
      if (route === 'slideshows') {
      assert.equal(await settingsButton.evaluate(button => Boolean(button.closest('footer[aria-label="Workflow action"]'))), true);
      assert.match(await settingsButton.textContent(), route === 'slideshows' ? /Nano Banana.*1 image/ : /Google Omni.*1 video/);
      await settingsButton.click();
      assert.equal(await page.getByRole('button', { name: route === 'slideshows' ? /^Image model, currently / : /^Video model, currently / }).isVisible(), true);
      assert.equal(await page.getByRole('button', { name: route === 'slideshows' ? /^Number of images, currently / : /^Number of videos, currently / }).isVisible(), true);
      assert.equal(await page.getByRole('button', { name: /^Aspect ratio, currently / }).isVisible(), true);
      if (route !== 'slideshows') assert.equal(await page.getByRole('button', { name: /^Video duration, currently / }).isVisible(), true);
      await page.locator('[data-slot="popover-content"]').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
      const desktopPopupBox = await page.locator('[data-slot="popover-content"]').boundingBox();
      assert.ok(desktopPopupBox.x >= 0 && desktopPopupBox.x + desktopPopupBox.width <= 1440 && desktopPopupBox.y >= 0 && desktopPopupBox.y + desktopPopupBox.height <= 1000, 'Settings must fit the desktop viewport');
      await page.screenshot({ path: `.tmp/explore-format-split/${route}-settings.png`, fullPage: false, animations: 'disabled' });
      await page.keyboard.press('Escape');
      await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
      assert.equal(await settingsButton.getAttribute('aria-expanded'), 'false');
      assert.equal(await settingsButton.evaluate(button => button === document.activeElement), true);
      await settingsButton.click();
      await page.getByRole('tab', { name: 'Edit ' + (route === 'slideshows' ? 'slides' : 'video'), exact: true }).click();
      await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
      await page.getByRole('tab', { name: 'Create', exact: true }).click();
      assert.equal(await settingsButton.getAttribute('aria-expanded'), 'false');
      } else {
        assert.equal(await settingsButton.count(), 0);
        assert.equal(await page.getByRole('group', { name: 'Video generation settings', exact: true }).count(), 1);
        assert.equal(await page.getByRole('button', { name: /^Video model, currently / }).isVisible(), true);
        assert.equal(await page.getByRole('button', { name: /^Number of videos, currently / }).isVisible(), true);
        assert.equal(await page.getByRole('button', { name: /^Aspect ratio, currently / }).isVisible(), true);
        assert.equal(await page.getByRole('button', { name: /^Video duration, currently / }).isVisible(), true);
        const tiles = page.getByRole('region', { name: 'Optional generation references' }).locator('button[data-state]');
        assert.equal(await tiles.count(), 2);
        const tile = await tiles.first().boundingBox();
        assert.ok(Math.abs(tile.width - tile.height) < 1, 'Reference tiles match the square older workflow cards');
        assert.equal(await page.getByText('Select audio', { exact: true }).count(), 0);
        await page.getByRole('region', { name: 'Optional generation references' }).getByRole('button', { name: /^(Add|Replace) image reference$/ }).click();
        await page.getByRole('tab', { name: 'Edit video', exact: true }).click();
        await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
        await page.getByRole('tab', { name: 'Create', exact: true }).click();
        assert.equal(await page.locator('[data-slot="popover-content"]').count(), 0);
      }
      await gallery.getByRole('button', { name: /^Preview / }).first().click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button', { name: generate, exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: generate === 'Generate video' ? 'Generate image' : 'Generate video', exact: true }).count(), 0);
      await page.getByRole('button', { name: view, exact: true }).click();
      assert.equal(await page.getByRole('heading', { name: /will appear here/ }).isVisible(), true);
      await page.getByRole('button', { name: 'References', exact: true }).click();
      await page.screenshot({ path: `.tmp/explore-format-split/${route}-create.png`, fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      const generateBox = await page.getByRole('button', { name: generate, exact: true }).boundingBox();
      assert.ok(generateBox && generateBox.y >= 0 && generateBox.y + generateBox.height <= 720, `${title} generation action must stay in view`);
      const promptBox = await page.getByRole('textbox', { name: route === 'slideshows' ? 'Image prompt' : 'Video prompt', exact: true }).boundingBox();
      assert.ok(promptBox && promptBox.y >= 0 && promptBox.y + promptBox.height < generateBox.y, `${title} instructions must stay above the action without scrolling`);
      await page.screenshot({ path: `.tmp/explore-format-split/${route}-short-desktop.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Review schedule', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Review schedule', exact: true }).evaluate(button => Boolean(button.closest('footer[aria-label="Workflow action"]'))), true);
      await page.screenshot({ path: `.tmp/explore-format-split/${route}-schedule.png`, fullPage: false });
      await page.getByRole('textbox', { name: /caption/i }).fill('Keep my scheduling draft');
      await page.getByRole('tab', { name: 'Create', exact: true }).click();
      await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: /caption/i }).inputValue(), 'Keep my scheduling draft');
      await page.getByRole('tab', { name: 'Create', exact: true }).click();
      if (route === 'slideshows') {
        await page.getByRole('button', { name: 'Recreate slide 3', exact: true }).click();
        await page.getByRole('tab', { name: 'Edit slides', exact: true }).click();
        assert.equal(await page.getByRole('img', { name: /Slide 3 of/ }).isVisible(), true);
        assert.equal(await page.getByRole('button', { name: 'Save slideshow', exact: true }).evaluate(button => Boolean(button.closest('footer[aria-label="Workflow action"]'))), true);
        await page.screenshot({ path: '.tmp/explore-format-split/slideshows-edit.png', fullPage: false });
        await page.getByRole('tab', { name: 'Create', exact: true }).click();
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await page.getByRole('button', { name: 'Recreate slide 3', exact: true }).getAttribute('aria-pressed'), 'true');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (route === 'slideshows') {
        await settingsButton.click();
        const popupBox = await page.locator('[data-slot="popover-content"]').boundingBox();
        assert.ok(popupBox.x >= 0 && popupBox.x + popupBox.width <= 390 && popupBox.y >= 0 && popupBox.y + popupBox.height <= 844, 'Settings must fit the mobile viewport');
        await page.screenshot({ path: `.tmp/explore-format-split/${route}-settings-mobile.png`, fullPage: false, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
      } else {
        await page.getByRole('region', { name: 'Optional generation references' }).getByRole('button', { name: /^(Add|Replace) image reference$/ }).click();
        await page.locator('[data-slot="popover-content"]').waitFor();
        const imagePopup = await page.locator('[data-slot="popover-content"]').boundingBox();
        assert.ok(imagePopup.x >= 0 && imagePopup.x + imagePopup.width <= 391 && imagePopup.y >= 0 && imagePopup.y + imagePopup.height <= 845,'Image picker must fit mobile');
        await page.screenshot({ path: `.tmp/explore-format-split/${route}-image-mobile.png`, fullPage: false, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
        await page.getByRole('button',{name:'Preview video style reference',exact:true}).click();
        await page.waitForFunction(()=>{const v=document.querySelector('video[aria-label="Selected style video preview"]');return v&&v.readyState>=1;});
        await page.locator('[data-slot="popover-content"]').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
        const videoPopup = await page.locator('[data-slot="popover-content"]').boundingBox();
        assert.ok(videoPopup.x >= 0 && videoPopup.x + videoPopup.width <= 391 && videoPopup.y >= 0 && videoPopup.y + videoPopup.height <= 845,'Video picker must fit mobile');
        await page.screenshot({path:`.tmp/explore-format-split/${route}-video-mobile.png`,fullPage:false,animations:'disabled'});
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="popover-content"]').waitFor({state:'detached'});
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.screenshot({ path: `.tmp/explore-format-split/${route}-mobile.png`, fullPage: false });
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log(`PASS ${title}: media type, results view, schedule draft, mobile layout`);
    }
    if (process.argv.includes('--creation-only')) {
      assert.deepEqual(errors, []); assert.deepEqual(writes, []);
      console.log('PASS no browser errors or provider/account writes');
      return;
    }
    for (const format of ['hook', 'wall_text']) {
      await page.goto(`${base}/e2e/explore-format-preview?format=${format}&sources=1`, { waitUntil: 'networkidle' });
      for (const mode of ['Generate', 'Upload', 'Creative Assets']) assert.equal(await page.getByRole('button', { name: mode, exact: true }).isVisible(), true);
      await page.getByRole('button', { name: 'Upload', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Your Video', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByRole('button', { name: 'Generate video', exact: true }).isVisible(), false);
      await page.getByLabel(format === 'hook' ? 'Upload hook video' : 'Upload wall of text', { exact: true }).setInputFiles('public/explore/covers/hook-video-v1.mp4');
      await page.getByLabel('Your selected video', { exact: true }).waitFor();
      const editSelected = () => page.getByRole('button', { name: 'Edit this video', exact: true }).first();
      await editSelected().waitFor();
      assert.equal(await editSelected().isEnabled(), true);
      await page.screenshot({ path: `.tmp/explore-format-split/${format}-upload.png`, fullPage: true });
      await editSelected().click();
      assert.equal(await page.getByRole('spinbutton', { name: 'Trim start', exact: true }).isVisible(), true);
      await page.getByRole('tab', { name: 'Create', exact: true }).click();
      await page.getByRole('button', { name: 'Creative Assets', exact: true }).click();
      await page.getByRole('button', { name: 'Choose from Creative Assets', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: /Saved creator clip/ }).click();
      assert.equal(await page.getByLabel('Your selected video', { exact: true }).isVisible(), true);
      await editSelected().click();
      assert.equal(await page.getByRole('textbox', { name: format === 'hook' ? 'Overlay text' : 'Wall of text', exact: true }).isVisible(), true);
      await page.getByRole('tab', { name: 'Create', exact: true }).click();
      await page.getByRole('button', { name: 'Upload', exact: true }).click();
      assert.equal(await page.getByLabel('Your selected video', { exact: true }).isVisible(), true);
      await page.getByRole('button', { name: 'Remove uploaded video', exact: true }).click();
      assert.equal(await editSelected().isDisabled(), true);
      assert.equal(await page.getByLabel('Your selected video', { exact: true }).count(), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `.tmp/explore-format-split/${format}-sources-mobile.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log(`PASS ${format}: upload, saved creator video, source switching, editor and mobile layout`);
      await page.goto(`${base}/e2e/explore-format-preview?format=${format}`, { waitUntil: 'networkidle' });
      const textarea = page.getByRole('textbox', { name: format === 'hook' ? 'Overlay text' : 'Wall of text', exact: true });
      await page.getByRole('spinbutton', { name: 'Trim start', exact: true }).fill('1');
      await page.getByRole('spinbutton', { name: 'Trim end', exact: true }).fill('6');
      const text = 'First line\n\nSecond paragraph';
      await textarea.fill(text);
      assert.equal(await page.getByRole('button', { name: 'Save edits', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Save edits', exact: true }).evaluate(button => Boolean(button.closest('footer[aria-label="Workflow action"]'))), true);
      assert.equal(await page.getByText(/subtitles/i).count(), 0);
      await page.getByRole('tab', { name: 'Create', exact: true }).click();
      await page.getByRole('tab', { name: 'Edit video', exact: true }).click();
      assert.equal(await textarea.inputValue(), text);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await textarea.inputValue(), text);
      assert.equal(await page.getByRole('spinbutton', { name: 'Trim start', exact: true }).inputValue(), '1');
      assert.equal(await page.getByRole('spinbutton', { name: 'Trim end', exact: true }).inputValue(), '6');
      await page.waitForFunction(() => document.querySelector('section[aria-label="Video edit preview"] video')?.currentTime >= .99);
      await page.screenshot({ path: `.tmp/explore-format-split/${format}-edit.png`, fullPage: true });
      console.log(`PASS ${format}: actual editor, trim/text drafts, navigation and refresh`);
    }
    for (const legacy of ['hook', 'phone']) {
      await page.goto(`${base}/e2e/explore-format-preview?legacy=${legacy}`, { waitUntil: 'networkidle' });
      for (const [tab, name] of [['Create','create'], ['Edited demo','edit'], ['Schedule','schedule']]) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.screenshot({ path: `.tmp/explore-format-split/legacy-${legacy}-${name}.png`, fullPage: false });
      }
      console.log(`PASS existing ${legacy} workflow: create/edit/schedule visual reference`);
    }
    }
    for (const route of ['/audio-generation', '/explore/create-hook?preview=1', '/explore/creator-phone?preview=1']) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      const html = await response.text();
      assert.ok(html.includes('NEXT_HTTP_ERROR_FALLBACK;404'), `Server must reject the hidden route ${route}`);
      assert.ok(await page.getByText('404 · Page not found', { exact: true }).isVisible() || new URL(page.url()).pathname === '/sign-in');
      console.log(`PASS hidden route ${route}`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    console.log('PASS no browser errors or provider/account writes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

