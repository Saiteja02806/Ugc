// Offline evidence summarizer. No credentials, provider calls or database access.
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';

const root = process.cwd();
const inputs = [
  ['list-and-voice', '.tmp/carousel-copy-fixes-2026-10-12/results.json'],
  ['body-feedback', '.tmp/carousel-copy-body-feedback-2026-10-12/results.json'],
  ['counted-repair', '.tmp/carousel-counted-repair-2026-10-12/results.json'],
];
const trials = inputs.map(([id, file]) => ({ id, file, data: JSON.parse(readFileSync(file, 'utf8')) }));
const jiti = createJiti(import.meta.url, { alias: { '@': root }, fsCache: false });
const { inspectCarouselStructure2SlideLayout } = await jiti.import(path.join(root, 'worker/src/lib/carousel-structure-2-render-slide.ts'));
const { buildCarouselStructure2RenderSpecs } = await jiti.import(path.join(root, 'worker/src/lib/carousel-structure-2-render-spec.ts'));
const personal = /\b(?:i|me|my|mine|we|us|our|ours)\b/i;
const metrics = { date: '2026-10-12', scope: 'Isolated fresh text trials; no customer jobs or publication', trials: [] };
for (const trial of trials) {
  const r = trial.data;
  const exported = `docs/carousel-copy-fixes-${trial.id}-provider-evidence-2026-10-12.json`;
  cpSync(trial.file, exported);
  const initialListBodies = [];
  for (const arm of ['before', 'after']) {
    let listSlides = 0, nonNullBodies = 0;
    for (const q of r.requests.filter(q => q.arm === arm && q.schema === 'carousel_content_batch' && q.response)) {
      for (const item of JSON.parse(q.response).items ?? []) for (const s of item.plan?.slides ?? []) {
        if (s.listItems?.length) { listSlides++; if (s.body !== null && s.body !== undefined) nonNullBodies++; }
      }
    }
    initialListBodies.push({ arm, listSlides, nonNullBodies });
  }
  const storyVoice = [];
  for (const arm of ['before', 'after']) {
    const plans = r.runs.filter(x => x.structure === 'structure_2' && x.arm === arm).flatMap(x => x.accepted);
    if (plans.length) storyVoice.push({ arm, plans: plans.length,
      personalStorySlides: plans.flatMap(p => p.plan.slides).filter(s => personal.test([s.headline, s.storyText].filter(Boolean).join(' '))).length });
  }
  metrics.trials.push({ id: trial.id, evidence: exported, startedAt: r.startedAt, completedAt: r.completedAt,
    versions: r.versions, summary: r.summary, usage: r.usage, httpFailures: r.requests.filter(q => q.status !== 200).length,
    initialListBodies, storyVoice, countedRepairCalls: r.requests.filter(q => q.schema === 'counted_carousel_body_repair').length,
    preflight: { unchangedLegacyBusinessPrompts: r.preflight.legacyMessageSchemaComparisons.length,
      unchangedLegacyS2Plans: r.preflight.legacyValidationComparisons,
      s1DraftsReplayed: r.preflight.s1DraftReplay.length,
      replayAcceptedBefore: r.preflight.s1DraftReplay.filter(x => x.before.accepted).length,
      replayAcceptedAfter: r.preflight.s1DraftReplay.filter(x => x.after.accepted).length },
    failedAttempts: r.runs.flatMap(run => run.attempts.filter(a => !a.success).map(a => ({ business: run.business, structure: run.structure, arm: run.arm, ...a }))),
  });
}

const scenarioRuns = trials[0].data.runs.filter(x => x.structure === 'structure_2' && x.arm === 'after');
const layouts = [];
for (const run of scenarioRuns) for (const p of run.accepted) {
  // Exercise canonical role assignment with placeholder URLs. Inspection does not fetch images.
  const roles = ['hook', 'human', 'static', 'human', 'static', 'product_asset'];
  const specs = buildCarouselStructure2RenderSpecs({ storyPlan: p.plan,
    assets: roles.map((role, index) => ({ asset_id: `audit-${index}`, asset_role: role, slide_number: index + 1,
      base_url: 'https://example.invalid/no-image-download' })) });
  for (const format of ['1:1', '4:5']) for (const spec of specs) {
    try { const d = await inspectCarouselStructure2SlideLayout({ format, spec });
      layouts.push({ business: run.business, slot: p.slot, slide: spec.slideNumber, format, safeAreaContained: d.safeAreaContained,
        storyFontSize: d.storyFontSize, storyLineCount: d.storyLineCount, bodyBlockLineCounts: d.bodyBlockLineCounts });
    } catch (e) { layouts.push({ business: run.business, slot: p.slot, slide: spec.slideNumber, format, error: e.message }); }
  }
}
metrics.layout = { inspections: layouts.length, failures: layouts.filter(x => x.error || !x.safeAreaContained).length, results: layouts };
metrics.totalUsage = metrics.trials.reduce((a, t) => ({ calls: a.calls + t.usage.calls, totalTokens: a.totalTokens + t.usage.totalTokens }), { calls: 0, totalTokens: 0 });
const countedRequest = trials[2].data.requests.find(q => q.schema === 'counted_carousel_body_repair');
metrics.countedRepairExample = { business: countedRequest.business, providerRequestId: countedRequest.requestId,
  response: JSON.parse(countedRequest.response), finalError: trials[2].data.runs.find(x => x.business === countedRequest.business && x.arm === countedRequest.arm).attempts.at(-1).error };
writeFileSync('docs/carousel-copy-fixes-metrics-2026-10-12.json', JSON.stringify(metrics, null, 2) + '\n');

const samples = ['# Fresh copy-fix samples: 2026-10-12', '',
  'All 20 accepted Structure 2 scenario decks are shown below, including weak copy. Acceptance means passing existing mechanical/voice/layout checks, not factual approval, human preference or TikTok engagement.', '',
  'Editorial findings are AI-agent review. References use zero-based batch slots; slides are one-based.', ''];
for (const run of scenarioRuns) for (const p of run.accepted) {
  samples.push(`## ${run.business}: slot ${p.slot}, ${p.format}`, '');
  for (const s of p.slides) samples.push(`### Slide ${s.n}`, '', ...(s.headline ? [s.headline, ''] : []), s.body, '', ...(s.cta ? [`Separate CTA: ${s.cta}`, ''] : []));
}
samples.push('## Counted-repair failure', '', 'UGCPilot, attempt 2: the only live counted repair targeted slide 5.', '',
  'Returned body:', '', Object.values(JSON.parse(countedRequest.response).bodiesBySlide)[0].firstWords.join(' '), '',
  Object.values(JSON.parse(countedRequest.response).bodiesBySlide)[0].secondWords.join(' '), '',
  'The 19-word body still failed the one-idea check. The schema enforced token counts but did not resolve meaning.', '');
writeFileSync('docs/carousel-copy-fixes-samples-2026-10-12.md', samples.join('\n'));

const manifest = {};
function hashTree(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? hashTree(file, base) : [{ path: path.relative(base, file).replaceAll('\\', '/'), sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }];
  });
}
for (const trial of trials) {
  const current = path.join(path.dirname(trial.file), 'current');
  manifest[trial.id] = ['worker/src', 'lib/carousel'].flatMap(dir => hashTree(path.join(current, dir)).map(x => ({ ...x, path: `${dir}/${x.path}` })));
}
writeFileSync('scripts/audits/carousel-copy-fixes-2026-10-12-source-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ summaries: metrics.trials.map(t => ({ id: t.id, summary: t.summary, initialListBodies: t.initialListBodies,
  storyVoice: t.storyVoice, countedRepairCalls: t.countedRepairCalls })), layout: { inspections: metrics.layout.inspections, failures: metrics.layout.failures }, usage: metrics.totalUsage }, null, 2));
