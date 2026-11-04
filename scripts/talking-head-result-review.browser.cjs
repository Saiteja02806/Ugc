/* eslint-disable @typescript-eslint/no-require-imports -- Non-build isolated SSR/browser verification. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/talking-head-result-review');
fs.mkdirSync(out, { recursive: true });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const moduleCache = new Map(), cssParts = [];
const sourceModules = {
  '@/lib/utils': 'lib/utils.ts',
  '@/components/ui/button': 'components/ui/button.tsx',
  '@/lib/ai-studio/media-results': 'lib/ai-studio/media-results.ts',
  './hook-workflow-media-controls': 'components/explore/hook-workflow-media-controls.tsx',
  '@/components/explore/hook-workflow-media-controls': 'components/explore/hook-workflow-media-controls.tsx',
  './workflow-preview-canvas': 'components/explore/workflow-preview-canvas.tsx',
  '@/components/generation/ai-studio-copy-button': 'components/generation/ai-studio-copy-button.tsx',
  '@/components/video/video-result-prompt': 'components/video/video-result-prompt.tsx',
};
function cssModule(file) {
  const prefix = path.basename(file).replaceAll(/[^a-zA-Z0-9]/g, '_') + '_';
  const css = read(file), names = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]))];
  const mapping = Object.fromEntries(names.map(name => [name, prefix + name]));
  cssParts.push(css.replace(/\.([a-zA-Z][\w-]*)/g, (match, name) => '.' + mapping[name]).replace(/:global\(([^)]+)\)/g, '$1'));
  return { default: mapping };
}
function load(file) {
  if (moduleCache.has(file)) return moduleCache.get(file);
  const exports = {}; moduleCache.set(file, exports);
  const resolve = name => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'lucide-react') return require(name);
    if (name === 'class-variance-authority' || name === '@base-ui/react/button' || name === 'clsx' || name === 'tailwind-merge') return require(name);
    if (sourceModules[name]) return load(sourceModules[name]);
    if (name.endsWith('.module.css')) return cssModule(name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name));
    if (name === '../explore/remix-source.ts') return { readRemixSource: () => null };
    if (name.endsWith('slideshow-generation-batch.ts')) return { readSlideshowGenerationSlot: () => null };
    if (name === '@/lib/ai-studio/clipboard') return { copyAIStudioPrompt: async () => {}, getAIStudioClipboardError: () => 'Clipboard unavailable' };
    if (name === '@/components/video/video-generation-placeholder') return { VideoGenerationPlaceholder: props => React.createElement('div', { 'data-pending': true, style: { aspectRatio: '9/16', width: 170 } }, props.label) };
    // These imports are not rendered by this fixture (uploads/popovers/local files).
    return new Proxy({}, { get: (_, key) => key === '__esModule' ? true : () => null });
  };
  vm.runInNewContext(ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: resolve, setTimeout, clearTimeout });
  return exports;
}
const { TalkingHeadResultReview } = load('components/explore/talking-head-result-review.tsx');
const { WorkflowPreviewCanvas } = load('components/explore/workflow-preview-canvas.tsx');
cssParts.push(cssModule('components/explore/workflow-section-layout.module.css') && '');
const cssCache = path.join(root, '.next/dev/static/chunks');
const globalFile = fs.readdirSync(cssCache).filter(name => name.startsWith('app_globals_css_') && name.endsWith('.css'))
  .sort((a, b) => fs.statSync(path.join(cssCache, b)).mtimeMs - fs.statSync(path.join(cssCache, a)).mtimeMs)[0];
assert.ok(globalFile, 'Requires existing compiled global CSS; do not start a build without explicit authorization.');
const globals = fs.readFileSync(path.join(cssCache, globalFile), 'utf8');
const media = fs.readFileSync(path.join(root, 'public/explore/talking-head-references/v1/talking-surprised-story.mp4'));
const landscapeMedia = fs.readFileSync(path.join(root, 'public/explore/covers/talking-head-demo-promo-a4aa6e943cf2.mp4'));
const asset = (id, patch = {}) => ({ id, collection: 'video', sourceType: 'generated_video', status: 'ready', title: `Example ${id}`, url: 'https://review-fixture.test/fixture.mp4', createdAt: '', durationSeconds: 3, width: 720, height: 1280, ratio: '9:16', metadata: { model: 'wan_3_0', resolution: '720p', prompt: 'Saved result prompt.\n' + 'Long prompt text preserved without clipping. '.repeat(100) }, ...patch });
function html({ count = 1, state = 'ready', ratio = '9:16', before = false }) {
  const results = Array.from({ length: count }, (_, index) => asset(`video-${index + 1}`, ratio === '16:9' ? { ratio, width: 1280, height: 720, url: 'https://review-fixture.test/fixture-landscape.mp4' } : {}));
  const generation = { results: state === 'pending' || state === 'failed' ? [] : results, selected: state === 'cleared' ? null : results[0], busy: state === 'pending' || state === 'partial', error: state === 'failed' || state === 'partial' ? 'Another video failed. Your completed clip is still available.' : null, pendingCount: 1, message: 'One video is still generating.', selectResult() {}, refreshStatus() {}, onGenerate() {} };
  const rendered = renderToStaticMarkup(React.createElement(before ? WorkflowPreviewCanvas : TalkingHeadResultReview, { kind: 'hook', generation, onContinue() {} }));
  return `<html class="dark"><head><meta charset="utf-8"><style>${globals}\n${cssParts.join('\n')}\nbody{margin:0;font-family:Arial,sans-serif}.app-canvas{padding:16px;min-height:100vh;background:var(--background);color:var(--foreground)}.fixture{background:var(--card);border:1px solid var(--border);border-radius:14px;min-width:0}.fixture-nav{padding:16px 24px;border-bottom:1px solid var(--border);font-size:14px}.workflow_section_layout_module_css_preview video:where(:not([data-reference-preview-video])){max-height:360px}</style></head><body><main class="app-canvas"><section class="fixture workflow_section_layout_module_css_preview"><div class="fixture-nav">References　　Your videos</div>${rendered}</section></main></body></html>`;
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let assertions = 0; const results = [], errors = [];
  for (const width of [1440, 900, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().endsWith('/fixture.mp4') ? route.fulfill({ body: media, contentType: 'video/mp4' }) : route.request().url().endsWith('/fixture-landscape.mp4') ? route.fulfill({ body: landscapeMedia, contentType: 'video/mp4' }) : route.abort());
    for (const scenario of [{ count: 1 }, { count: 4 }, { count: 1, ratio: '16:9' }, { state: 'partial' }, { state: 'cleared' }, { state: 'pending' }, { state: 'failed' }]) {
      await page.setContent(html(scenario));
      const continueButton = page.getByRole('button', { name: 'Continue to Demo' });
      const noOutput = ['pending', 'failed'].includes(scenario.state);
      assert.equal(await continueButton.count(), noOutput ? 0 : 1); assertions++;
      if (!noOutput) { assert.equal(await continueButton.isDisabled(), scenario.state === 'cleared'); assertions++; }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assertions++;
      assert.doesNotMatch(await page.locator('body').innerText(), /Your talking-head clip|Review the expression|Video \d+ selected/); assertions++;
      if (scenario.ratio === '16:9') {
        await page.locator('video').evaluate(async node => { node.muted = true; await node.play(); node.pause(); });
        const ratio = await page.locator('video').evaluate(node => { const rect = node.getBoundingClientRect(); return rect.width / rect.height; });
        assert.ok(Math.abs(ratio - 16 / 9) < .02, `Landscape ratio changed: ${ratio}`); assertions++;
      }
      if (scenario.count === 1 && !scenario.state && !scenario.ratio) {
        const video = page.locator('video');
        await video.evaluate(async node => { node.muted = true; await node.play(); });
        await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0, { timeout: 10000 });
        await video.evaluate(node => node.pause());
        assert.ok(await video.evaluate(node => node.readyState >= 2 && !node.error)); assertions++;
        assert.equal(await video.getAttribute('controls'), ''); assertions++;
        const color = await continueButton.evaluate(node => getComputedStyle(node).backgroundColor);
        assert.equal(color, 'rgb(0, 120, 212)'); assertions++;
        await page.screenshot({ path: path.join(out, `after-${width}.png`), fullPage: true });
        const bounds = await page.evaluate(() => { const video = document.querySelector('video'), button = [...document.querySelectorAll('button')].find(node => node.textContent.includes('Continue to Demo')); return { video: video.getBoundingClientRect().toJSON(), button: button.getBoundingClientRect().toJSON() }; });
        results.push({ width, color, ...bounds });
        await page.locator('summary').press('Enter');
        assert.equal(await page.getByRole('button', { name: 'Copy prompt' }).isVisible(), true); assertions++;
        const prompt = page.locator('[class*="promptText"]');
        assert.ok(await prompt.evaluate(node => node.scrollHeight > node.clientHeight)); assertions++;
        await page.screenshot({ path: path.join(out, `prompt-${width}.png`), fullPage: true });
      }
    }
    await page.setContent(html({ before: true }));
    await page.screenshot({ path: path.join(out, `before-${width}.png`), fullPage: true });
    await page.close();
  }
  assert.deepEqual(errors, []); await browser.close();
  const receipt = { assertions, pageErrors: errors, results, scope: 'Actual review/Button/Copy/MediaPlayer SSR with existing compiled global CSS and current scoped CSS. Controlled owned-result/provider fixture, native disclosure and media metadata; React events tested separately, no hydration/app backend acceptance.' };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify({ assertions, pageErrors: errors, widths: results.map(r => r.width) }));
})().catch(error => { console.error(error); process.exitCode = 1; });
