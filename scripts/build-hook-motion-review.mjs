import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHookAnimationPrompt, hookKeyframeMotionCatalog, hookKeyframeMotionRewrites, hookMotionPlanDirections } from "../lib/explore/hook-keyframe-motion.ts";

// Local review artifact only: no model/API call, no app asset or database writes.
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, "outputs", "hook-motion-rewrite-2026-10-21");
const receipts = (await Promise.all(["a/receipts.json", "b/receipt.json", "c/visual-evidence.json"].map(async name =>
  JSON.parse(await readFile(path.join(directory, name), "utf8"))))).flat();
const byId = new Map(receipts.map(item => [item.referenceId, item]));
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function localPath(value) {
  const absolute = path.resolve(value);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw Error("Review evidence must stay inside this workspace.");
  return absolute;
}
const href = value => path.relative(directory, localPath(value)).split(path.sep).map(encodeURIComponent).join("/");
const cards = [], summary = [];
for (const source of Object.values(hookKeyframeMotionCatalog)) {
  const item = hookKeyframeMotionRewrites[source.referenceId], receipt = byId.get(source.referenceId);
  if (!item || !receipt || receipt.sourceSha256 !== source.sourceSha256 || receipt.frameCount !== source.sourceReviewedFrameCount) {
    throw Error(`Incomplete review evidence: ${source.referenceId}`);
  }
  const sourcePath = localPath(receipt.sourcePath);
  const hash = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
  if (hash !== source.sourceSha256) throw Error(`Canonical source changed: ${source.referenceId}`);
  const sheet = localPath(receipt.contactSheet ?? receipt.sheet);
  await readFile(sheet); // Missing evidence prevents publishing a misleading review page.
  const decision = item.review.status === "needs_decision";
  const directions = hookMotionPlanDirections(item.plan);
  const durationSeconds = item.previewDurationSeconds ?? 4;
  const prompt = buildHookAnimationPrompt({ directions, durationSeconds, generateAudio: false });
  summary.push({ referenceId: source.referenceId, title: source.displayTitle, sourceSha256: hash,
    status: item.review.status, durationSeconds, frameCount: receipt.frameCount, sampledFrames: item.review.sampledFrameIndices,
    sourcePath, contactSheet: sheet, issues: item.review.issues, canSubmitPaidAnimation: false, visualQualification: "not_tested" });
  cards.push(`<article data-decision="${decision}" id="${escape(source.referenceId)}"><header><h2>${escape(source.displayTitle)}</h2><span class="badge">${decision ? "Decision needed" : "Source sequence reviewed"}</span></header>
    <p class="identity">${escape(source.referenceId)}<br>SHA ${escape(hash.slice(0, 16))}… · ${receipt.frameCount} decoded frames · ${item.review.sampledFrameIndices.length} reviewed frame indices</p>
    ${decision ? `<ul class="issues">${item.review.issues.map(issue => `<li>${escape(issue)}</li>`).join("")}</ul>` : ""}
    <div class="content"><section><h3>Source video</h3><video controls muted playsinline preload="none" src="${href(sourcePath)}"></video><p>Original reference, not a generated result. Sound starts muted for review.</p>
      <details><summary>View inspected frame sequence</summary><a href="${href(sheet)}"><img loading="lazy" src="${href(sheet)}" alt="Inspected canonical frame sequence for ${escape(source.displayTitle)}"></a></details></section>
      <section><h3>Adapted animation prompt</h3><pre>${escape(prompt)}</pre><p>${escape(item.review.reviewNote)}</p></section></div>
    <footer>Review preview only · starting-image approval still required · no paid generation submitted · generated facial fidelity untested</footer></article>`);
}
const decisions = summary.filter(item => item.status === "needs_decision");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hook starting-frame motion review</title>
<style>:root{color-scheme:dark;font-family:Arial,sans-serif;background:#1e1e1e;color:#eee}*{box-sizing:border-box}body{margin:0}main{max-width:1250px;margin:auto;padding:28px}h1{font-size:28px;letter-spacing:-.03em}p{line-height:1.7;color:#b9b5af;font-size:13px}.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;position:sticky;top:0;padding:14px;background:#1e1e1e;z-index:1;border-bottom:1px solid #444}button{padding:10px 14px;border-radius:8px;background:#292929;border:1px solid #666;color:#eee;cursor:pointer}button[aria-pressed=true]{border-color:#ff6b3b}button:focus-visible,summary:focus-visible{outline:2px solid #ff6b3b;outline-offset:4px}article{margin:22px 0;border:1px solid #444;border-radius:14px;padding:22px;background:#292929}article[hidden]{display:none}header{display:flex;gap:15px;align-items:center;justify-content:space-between}h2{font-size:19px;margin:0}.badge{font-size:11px;border:1px solid #777;border-radius:6px;padding:6px 9px}.identity{font-size:11px;overflow-wrap:anywhere}.content{display:grid;grid-template-columns:minmax(260px,.7fr) minmax(0,1fr);gap:24px}video{width:100%;height:400px;object-fit:contain;background:#111;border-radius:10px}h3{font-size:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 Arial,sans-serif;color:#ddd;margin:0;max-height:520px;overflow:auto;background:#202020;padding:16px;border-radius:10px}.issues{font-size:13px;line-height:1.7;border-left:3px solid #ff6b3b;padding:10px 14px 10px 30px}summary{font-size:12px;cursor:pointer;padding:10px 0}img{width:100%;height:auto}footer{font-size:11px;color:#aaa;border-top:1px solid #444;margin-top:18px;padding-top:13px}@media(max-width:700px){main{padding:14px}.content{grid-template-columns:1fr}video{height:320px}header{align-items:start;flex-direction:column}}</style></head><body><main>
<h1>Hook starting-frame motion review</h1><p>98 adapted prompts. ${summary.length - decisions.length} source-sequence reviews; ${decisions.length} decisions needed. Each plan is bound to the canonical video hash. Hook 15 uses the requested eight-second adaptation; other previews use four seconds. Adapted timing does not promise the original clip's exact speed. These are prompts and source footage, not generated results.</p>
<div class="toolbar"><button type="button" aria-pressed="true" data-filter="decisions">Show ${decisions.length} decisions</button><button type="button" aria-pressed="false" data-filter="all">Show all 98</button><span id="count" aria-live="polite"></span></div>${cards.join("\n")}
<script>const buttons=[...document.querySelectorAll('[data-filter]')];function filter(value){let n=0;for(const card of document.querySelectorAll('article')){card.hidden=value==='decisions'&&card.dataset.decision!=='true';if(!card.hidden)n++}for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.filter===value));document.getElementById('count').textContent=n+' references shown'}for(const button of buttons)button.addEventListener('click',()=>filter(button.dataset.filter));filter('decisions');</script></main></body></html>`;
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, "review-summary.json"), JSON.stringify({ date: "2026-10-21", entries: summary, paidOperations: 0 }, null, 2));
await writeFile(path.join(directory, "index.html"), html);
console.log(JSON.stringify({ entries: summary.length, staticReviewed: summary.length - decisions.length,
  needsDecision: decisions.length, page: path.join(directory, "index.html"), canonicalVideosRehashed: summary.length, paidOperations: 0 }));
