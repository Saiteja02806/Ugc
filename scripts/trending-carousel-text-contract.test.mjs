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
test('appearance travels from editor PATCH through validation, stored content and reopen without trusting source URLs', () => {
  const editor = functions('components/trending/trending-creative-editor.tsx', ['toPatchPayload', 'hasCarouselSlidePreviewChanged']);
  const textStyle = { ...manual.defaultCarouselManualTextStyle(), font: 'montserrat', fontSize: 38, headingSize: 52, color: '#ff8800' };
  const content = { format: 'carousel', version: 'trending-creative-edit-v1', slides: [{ ...base, textPosition: { x: .35, y: .7 }, textStyle }] };
  const payload = editor.toPatchPayload({ assignmentId: 'assignment', revision: 3 }, content);
  assert.deepEqual(payload.slides[0].textStyle, textStyle); assert.equal(payload.slides[0].backgroundUrl, undefined);
  const merged = service.mergeSubmittedContent({ ...content, slides: [base] }, { ...content, slides: payload.slides });
  const reopened = service.mergeStoredContentWithOwnerDefaults({ ...content, slides: [base] }, { content_json: merged });
  assert.deepEqual(reopened.slides[0].textStyle, textStyle); assert.deepEqual(reopened.slides[0].textPosition, { x: .35, y: .7 });
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
