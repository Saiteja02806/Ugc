import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as manual from "../worker/dist/lib/carousel-manual-text.js";
const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
function functions(file, names, scope = {}) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const source = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast).replace(/^export /, '')).join('\n');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code};return {${names.join(',')}}`)(...Object.values(scope));
}
const base = { slideId: 'slide', slideNumber: 2, renderFormat: '4:5', textPosition: { x: .5, y: .5 }, headline: 'Useful habits', subtext: 'Start with ten minutes.', ctaText: '', backgroundAssetId: 'image', backgroundUrl: 'https://owned.test/image.webp' };
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
const service = functions('lib/trending/creative-edit-service.ts', ['mergeSubmittedContent', 'mergeStoredContentWithOwnerDefaults'], { ...manual, clampNormalizedTextPosition: position => position, TrendingCreativeEditAccessError: AccessError });
const bodyEdit = functions('lib/trending/carousel-body-text-edit.ts', ['applyCarouselBodyTextEdit', 'getCarouselTextOverflowSlides'], manual);

test('body styling propagates only changed fields, wraps each copy and preserves the hook, images and per-slide copy', () => {
  const source = { ...base, slideNumber: 2, textStyle: manual.defaultCarouselManualTextStyle() };
  const other = { ...base, slideId: 'other', slideNumber: 3, headline: 'Different heading', subtext: 'Different supporting copy.', textStyle: { ...manual.defaultCarouselManualTextStyle(), headingColor: '#eeaa00' } };
  const cover = { ...base, slideId: 'hook', slideNumber: 1 };
  const content = { format: 'carousel', slides: [cover, source, other] };
  const next = { ...source, headline: 'Edited only here', textStyle: { ...source.textStyle, font: 'montserrat', fontSize: 36, textWidth: 450 } };
  const result = bodyEdit.applyCarouselBodyTextEdit(content, next, 'body');
  assert.equal(result.slides[0], cover); assert.equal(result.slides[1].headline, next.headline);
  assert.equal(result.slides[2].headline, other.headline); assert.equal(result.slides[2].subtext, other.subtext);
  assert.equal(result.slides[2].backgroundAssetId, other.backgroundAssetId);
  assert.equal(result.slides[2].textStyle.font, 'montserrat'); assert.equal(result.slides[2].textStyle.fontSize, 36);
  assert.equal(result.slides[2].textStyle.headingColor, '#eeaa00');
  assert.equal(result.slides[2].textStyle.textWidth, 450);
  const moved = bodyEdit.applyCarouselBodyTextEdit(result, { ...result.slides[1], textPosition: { x: 0, y: 1 } }, 'body');
  assert.deepEqual(moved.slides[2].textPosition, { x: 0, y: 1 });
  assert.equal(moved.slides[0], cover);
  const individual = bodyEdit.applyCarouselBodyTextEdit(result, { ...result.slides[1], textStyle: { ...next.textStyle, color: '#ff0000' } }, 'slide');
  assert.equal(individual.slides[2], result.slides[2]);
  assert.equal(bodyEdit.applyCarouselBodyTextEdit(content, { ...cover, textStyle: next.textStyle }, 'body').slides[1], source);
});

test('whole-layout reuse and reset stay scoped to bodies; overflow is surfaced without changing copy or shrinking it', () => {
  const source = { ...base, textStyle: { ...manual.defaultCarouselManualTextStyle(), fontSize: 38 } };
  const long = { ...base, slideId: 'long', slideNumber: 3, subtext: 'A long paragraph. '.repeat(90) };
  const content = { format: 'carousel', slides: [{ ...base, slideId: 'hook', slideNumber: 1 }, source, long] };
  const applied = bodyEdit.applyCarouselBodyTextEdit(content, source, 'body', true);
  assert.deepEqual(applied.slides[2].textStyle, source.textStyle);
  assert.equal(applied.slides[2].subtext, long.subtext);
  assert.deepEqual(bodyEdit.getCarouselTextOverflowSlides(applied).map(s => s.slideId), ['long']);
  const reset = bodyEdit.applyCarouselBodyTextEdit(applied, { ...source, textStyle: null, textPosition: { x: .5, y: .5 } }, 'body');
  assert.equal(reset.slides[2].textStyle, null); assert.equal(reset.slides[0], content.slides[0]);
});

test('shared styles support one, two, five and ten slides without changing sequence identity', () => {
  for (const count of [1, 2, 5, 10]) {
    const slides = Array.from({ length: count }, (_, i) => ({ ...base, slideId: `slide-${i}`, slideNumber: i + 1, headline: `Copy ${i}`, textStyle: manual.defaultCarouselManualTextStyle() }));
    const content = { format: 'carousel', slides };
    const source = slides[count > 1 ? 1 : 0];
    const result = bodyEdit.applyCarouselBodyTextEdit(content, { ...source, textStyle: { ...source.textStyle, color: '#ff0000' } }, 'body');
    assert.deepEqual(result.slides.map(s => s.slideId), slides.map(s => s.slideId));
    assert.deepEqual(result.slides.map(s => s.headline), slides.map(s => s.headline));
    if (count > 1) { assert.equal(result.slides[0], slides[0]); assert.ok(result.slides.slice(1).every(s => s.textStyle.color === '#ff0000')); }
  }
});

test('individual body edits remain protected across later shared changes and complete layout copies', () => {
  const shared = { ...base, textStyle: manual.defaultCarouselManualTextStyle() };
  const other = { ...shared, slideId:'custom',slideNumber:3 };
  const legacy = { ...shared, slideId:'legacy',slideNumber:4,textStyle:{font:'inter',fontSize:30,headingSize:48,color:'#ffffff',headingColor:'#ffffff'} };
  const content={format:'carousel',slides:[{...base,slideId:'hook',slideNumber:1},shared,other,legacy]};
  const individual=bodyEdit.applyCarouselBodyTextEdit(content,{...other,textStyle:{...other.textStyle,fontSize:41}},'slide');
  assert.equal(individual.slides[2].textStyle.bodyStyleMode,'individual');
  const changed=bodyEdit.applyCarouselBodyTextEdit(individual,{...shared,textStyle:{...shared.textStyle,fontSize:55,color:'#ee0000'}},'body');
  assert.equal(changed.slides[2],individual.slides[2]);assert.equal(changed.slides[3],legacy);
  const full=bodyEdit.applyCarouselBodyTextEdit(changed,changed.slides[1],'body',true);
  assert.equal(full.slides[2],individual.slides[2]);assert.equal(full.slides[3],legacy);
  const reopened=service.mergeStoredContentWithOwnerDefaults(individual,{content_json:individual});
  assert.equal(reopened.slides[2].textStyle.bodyStyleMode,'individual');
  const joined={...changed,slides:changed.slides.map(s=>s.slideId==='custom'?{...s,textStyle:{...s.textStyle,bodyStyleMode:'shared'}}:s)};
  assert.equal(bodyEdit.applyCarouselBodyTextEdit(joined,{...joined.slides[1],textStyle:{...joined.slides[1].textStyle,fontSize:44}},'body').slides[2].textStyle.fontSize,44);
});
test('appearance travels from editor PATCH through validation, stored content and reopen without trusting source URLs', () => {
  const editor = functions('components/trending/trending-creative-editor.tsx', ['toPatchPayload', 'hasCarouselSlidePreviewChanged']);
  const textStyle = { ...manual.defaultCarouselManualTextStyle(), font: 'montserrat', fontSize: 38, headingSize: 52, color: '#ff8800', textWidth: 600, align: 'right', lineHeight: 1.4, fontWeight: 700, headingBackground: 'none', bodyBackground: 'box', backgroundColor: '#112233', backgroundOpacity: .45, outline: false };
  const content = { format: 'carousel', version: 'trending-creative-edit-v1', slides: [{ ...base, headline: 'Useful\nhabits\ntoday', textPosition: { x: .35, y: .7 }, textStyle }] };
  const payload = editor.toPatchPayload({ assignmentId: 'assignment', revision: 3 }, content);
  assert.deepEqual(payload.slides[0].textStyle, textStyle); assert.equal(payload.slides[0].backgroundUrl, undefined);
  const merged = service.mergeSubmittedContent({ ...content, slides: [base] }, { ...content, slides: payload.slides });
  const reopened = service.mergeStoredContentWithOwnerDefaults({ ...content, slides: [base] }, { content_json: merged });
  assert.deepEqual(reopened.slides[0].textStyle, textStyle); assert.deepEqual(reopened.slides[0].textPosition, { x: .35, y: .7 });
  assert.equal(reopened.slides[0].headline, 'Useful\nhabits\ntoday');
  assert.equal(editor.hasCarouselSlidePreviewChanged(base, reopened.slides[0]), true);
  assert.equal(editor.hasCarouselSlidePreviewChanged(reopened.slides[0], structuredClone(reopened.slides[0])), false);
  const reset = service.mergeSubmittedContent(reopened, { ...reopened, slides: [{ ...payload.slides[0], textStyle: null }] });
  assert.equal(reset.slides[0].textStyle, null);
  const old = service.mergeStoredContentWithOwnerDefaults({ ...content, slides: [base] }, { content_json: { ...content, slides: [base] } });
  assert.equal(old.slides[0].textStyle, null);
});
test('server rejects oversized user typography before persisting a revision', () => {
  const content = { format: 'carousel', slides: [base] };
  assert.throws(() => service.mergeSubmittedContent(content, { ...content, slides: [{ ...base, textStyle: { ...manual.defaultCarouselManualTextStyle(), fontSize: 120 }, subtext: 'A long paragraph. '.repeat(35) }] }), { status: 400 });
});
test('PATCH accepts only validated appearance and preserves legacy absent style', () => {
  const route = read('app/api/trending/creatives/[format]/[creativeId]/edit/route.ts');
  assert.match(route, /textStyle: z\.unknown\(\)\.optional\(\)\.transform/);
  assert.match(route, /parseCarouselManualTextStyle\(value\)/);
  assert.match(route, /slides: data\.slides/);
});
