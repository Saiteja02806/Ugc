import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildMotionPrompt, buildOpeningPrompt, compileDrafts, defaultOutputDuration, entriesFromDocument, retimeBeats, validateEntry } from './compile-middle-frame-prompt-drafts.mjs';

function fixture() {
  return {
    referenceId: 'reviewed-hook', sourceSha256: 'a'.repeat(64),
    sourceDurationSeconds: 112 / 30, sourceFps: 30, sourceFrameCount: 112,
    clarityFrame: { index: 70, timeSeconds: 70 / 30, sha256: 'b'.repeat(64) },
    openingState: 'Glasses on, hand gripping temple, looking screen-right.',
    camera: 'Low tilted selfie beneath window beams.',
    openingImageRequirement: 'Reconstruct glasses-on t=0, not the later uncovered face.',
    endingState: 'Glasses off, gaze screen-right, mouth parted.',
    captionCleanup: { text: 'Original creator caption', region: 'Lower chest' },
    beats: [
      { startSeconds: 0, endSeconds: .5, action: 'Hold the sideward stare.' },
      { startSeconds: .5, endSeconds: .9, action: 'Remove glasses once.' },
      { startSeconds: .9, endSeconds: 1.6, action: 'Hold the glasses-off sideward stare.' },
      { startSeconds: 1.6, endSeconds: 1.93, action: 'Blink and turn toward lens.' },
      { startSeconds: 1.93, endSeconds: 2.9, action: 'Hold the wide-eyed frontal stare.' },
      { startSeconds: 2.9, endSeconds: 112 / 30, action: 'Turn screen-right and hold to final frame.' },
    ],
  };
}

test('retimes the complete 3.733-second sequence into three seconds without dropping held phases or ending', () => {
  const source = fixture();
  const before = structuredClone(source);
  const beats = retimeBeats(source, 3);
  assert.equal(beats.length, 6);
  assert.equal(beats[0].startSeconds, 0);
  assert.equal(beats.at(-1).endSeconds, 3);
  assert.equal(beats[1].startSeconds, .5 / (112 / 30) * 3);
  assert.equal(beats[4].endSeconds, 2.9 / (112 / 30) * 3);
  for (let index = 1; index < beats.length; index++) assert.equal(beats[index].startSeconds, beats[index - 1].endSeconds);
  assert.deepEqual(source, before);
  const prompt = buildMotionPrompt(source, 3);
  assert.match(prompt, /3-second/);
  assert.match(prompt, /0–0\.4s: Hold/);
  assert.match(prompt, /2\.33–3s: Turn/);
  assert.match(prompt, /Final state: Glasses off/);
  assert.match(prompt, /No added captions, text or generated audio/);
  assert.doesNotMatch(prompt, /aaaaaa|bbbbbb|reviewed-hook|clarityFrame/);
});

test('opening prompt binds original t0, later clarity and every selected influencer image to distinct roles', () => {
  const prompt = buildOpeningPrompt(fixture());
  assert.match(prompt, /Image 1 is the original source t=0/);
  assert.match(prompt, /Image 2 is a later clear frame/);
  assert.match(prompt, /Image 3 and every subsequent image/);
  assert.match(prompt, /not the opening pose or identity authority/);
  assert.match(prompt, /Original creator caption Region: Lower chest/);
  assert.match(prompt, /visually approved/);
  assert.doesNotMatch(prompt, /aaaaaa|bbbbbb/);
});

test('default duration retains long source coverage and respects default bounds', () => {
  assert.equal(defaultOutputDuration(fixture()), 4);
  for (const [count, expected] of [[30, 3], [258, 9], [360, 10]]) {
    const entry = fixture();
    entry.sourceFrameCount = count;
    entry.sourceDurationSeconds = count / 30;
    entry.clarityFrame = { ...entry.clarityFrame, index: 1, timeSeconds: 1 / 30 };
    entry.beats = [{ startSeconds: 0, endSeconds: count / 30, action: 'Hold the observed pose through the end.' }];
    assert.equal(defaultOutputDuration(entry), expected);
    const timing = retimeBeats(entry, expected);
    assert.equal(timing[0].sourceEndSeconds, count / 30);
    assert.equal(timing[0].endSeconds, expected);
  }
});

test('rejects invalid duration, gaps, overlaps, incomplete endings and invalid source data', () => {
  for (const duration of [0, -1, 1, 2, 3.5, 11, NaN, Infinity, '3', null]) {
    assert.throws(() => buildMotionPrompt(fixture(), duration));
    assert.throws(() => retimeBeats(fixture(), duration));
    assert.throws(() => compileDrafts([{ items: [fixture()] }], duration));
  }
  for (const duration of [3, 10]) {
    assert.equal(retimeBeats(fixture(), duration).at(-1).endSeconds, duration);
    assert.equal(compileDrafts([{ items: [fixture()] }], duration).drafts[0].outputDurationSeconds, duration);
  }
  const mutations = [
    entry => { entry.beats[0].startSeconds = .1; },
    entry => { entry.beats[1].startSeconds += .1; },
    entry => { entry.beats[1].startSeconds -= .1; },
    entry => { entry.beats.at(-1).endSeconds = 3; },
    entry => { entry.beats.at(-1).endSeconds = 5; },
    entry => { entry.beats[1].endSeconds = NaN; },
    entry => { entry.beats[1].endSeconds = entry.beats[1].startSeconds; },
    entry => { entry.beats[1].action = ''; },
    entry => { entry.endingState = ' '; },
    entry => { delete entry.openingState; },
    entry => { delete entry.openingImageRequirement; },
    entry => { entry.sourceSha256 = 'bad'; },
    entry => { entry.referenceId = ''; },
    entry => { entry.sourceDurationSeconds = NaN; },
    entry => { entry.sourceFrameCount = 113; },
    entry => { entry.sourceFps = Infinity; },
    entry => { entry.clarityFrame.index = 112; },
    entry => { entry.clarityFrame.index = -1; },
    entry => { entry.clarityFrame.timeSeconds = entry.sourceDurationSeconds; },
    entry => { entry.clarityFrame.timeSeconds = NaN; },
    entry => { entry.clarityFrame.sha256 = 'unknown'; },
  ];
  for (const mutate of mutations) { const entry = fixture(); mutate(entry); assert.throws(() => validateEntry(entry)); }
});

test('permits explicitly preserved differing anchor PTS while keeping source motion clock unchanged', () => {
  const entry = fixture();
  entry.clarityFrame.timeSeconds = 2.3;
  assert.doesNotThrow(() => validateEntry(entry));
  assert.equal(retimeBeats(entry, 3)[0].startSeconds, 0);
});

test('supports public items/private entries containers but rejects unknown and ambiguous input', () => {
  assert.equal(entriesFromDocument({ items: [fixture()] }).length, 1);
  assert.equal(entriesFromDocument({ entries: [fixture()] }).length, 1);
  assert.equal(entriesFromDocument([fixture()]).length, 1);
  for (const input of [null, 'unknown', {}, { frames: [] }, { items: [], entries: [] }]) assert.throws(() => entriesFromDocument(input));
  assert.throws(() => compileDrafts([]));
  assert.throws(() => compileDrafts([{ items: [] }]));
  assert.throws(() => compileDrafts([{ items: [fixture(), fixture()] }]));
  const result = compileDrafts([{ entries: [fixture()] }], 3);
  assert.equal(result.status, 'drafts_only_not_activated');
  assert.equal(result.providerCalls, 0);
  assert.equal(result.drafts[0].visualQualification, 'not_tested');
  assert.equal(result.drafts[0].outputDurationSeconds, 3);
  assert.match(result.drafts[0].requiredGate, /One pilot must pass/);
});

test('compiles current public reviewed catalogues without runtime activation', async () => {
  const documents = await Promise.all(['public-a', 'public-b'].map(async part => JSON.parse(await readFile(new URL(`../docs/prompt-reviews/middle-frame-${part}-2026-10-26.json`, import.meta.url), 'utf8'))));
  const result = compileDrafts(documents);
  assert.equal(result.drafts.length, 21);
  assert.equal(result.drafts.find(entry => entry.sourceDurationSeconds === 8.6).outputDurationSeconds, 9);
  for (const draft of result.drafts) {
    assert.equal(draft.timing[0].startSeconds, 0);
    assert.equal(draft.timing.at(-1).endSeconds, draft.outputDurationSeconds);
    assert.equal(draft.visualQualification, 'not_tested');
  }
});

test('display boundaries use two decimals and remain adjacent while timing retains full precision', () => {
  const entry = fixture();
  const intervals = [...buildMotionPrompt(entry, 3).matchAll(/^(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)s:/gm)];
  assert.equal(intervals.length, entry.beats.length);
  for (let index = 0; index < intervals.length; index++) {
    for (const displayed of intervals[index].slice(1, 3)) assert.ok((displayed.split('.')[1]?.length ?? 0) <= 2);
    if (index) assert.equal(intervals[index][1], intervals[index - 1][2]);
  }
  assert.notEqual(retimeBeats(entry, 3)[0].endSeconds, .4);
});

test('all31 drafts exactly match active inventory and public/private clarity manifests with no missing or extra entries', async () => {
  const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const documents = await Promise.all(['public-a', 'public-b', 'private'].map(part => load(`../docs/prompt-reviews/middle-frame-${part}-2026-10-26.json`)));
  const [publicManifest, privateManifest, inventory] = await Promise.all([
    load('../worker/src/lib/hook-curated-frames.json'),
    load('../worker/src/lib/creator-source-frames.json'),
    load('../docs/middle-frame-case-inventory-2026-10-26.json'),
  ]);
  const expected = [...publicManifest.frames, ...privateManifest.frames].filter(frame => frame.index > 0);
  const drafts = compileDrafts(documents).drafts;
  const sortedIds = rows => rows.map(row => row.referenceId).sort();
  assert.equal(expected.length, 31);
  assert.equal(drafts.length, 31);
  assert.deepEqual(sortedIds(drafts), sortedIds(expected));
  assert.deepEqual(sortedIds(drafts), sortedIds(inventory.cases));
  for (const draft of drafts) {
    const manifest = expected.find(frame => frame.referenceId === draft.referenceId);
    const active = inventory.cases.find(row => row.referenceId === draft.referenceId);
    assert.equal(draft.sourceSha256, manifest.sourceSha256, draft.referenceId);
    assert.equal(draft.sourceSha256, active.sourceSha256, draft.referenceId);
    assert.equal(draft.clarityFrame.index, manifest.index, draft.referenceId);
    assert.equal(draft.clarityFrame.timeSeconds, manifest.timeSeconds, draft.referenceId);
    assert.equal(draft.clarityFrame.sha256, manifest.sha256, draft.referenceId);
    assert.equal(draft.clarityFrame.index, active.clarityFrameIndex, draft.referenceId);
    assert.equal(draft.clarityFrame.timeSeconds, active.sourceElapsedSeconds, draft.referenceId);
    assert.equal(draft.clarityFrame.sha256, active.clarityFrameSha256, draft.referenceId);
    assert.equal(draft.timing[0].startSeconds, 0);
    assert.equal(draft.timing.at(-1).endSeconds, draft.outputDurationSeconds);
    assert.equal(draft.visualQualification, 'not_tested');
  }
});

test('Hook12 retains source sip, mug lowering, thin trickle and final held mug rather than inventing cup placement', async () => {
  const document = JSON.parse(await readFile(new URL('../docs/prompt-reviews/middle-frame-public-a-2026-10-26.json', import.meta.url), 'utf8'));
  const entry = entriesFromDocument(document).find(row => row.referenceId === 'explore-paired-hook-03d314d5268b8c31ec390bf1');
  const prompt = buildMotionPrompt(entry, 3);
  const sip = prompt.indexOf('for a sip');
  const lower = prompt.indexOf('Lower the mug');
  const trickle = prompt.indexOf('thin trickle of drink falls');
  const ending = prompt.indexOf('Final state:');
  assert.ok(sip >= 0 && lower > sip && trickle > lower && ending > trickle);
  assert.match(prompt.slice(ending), /mug still held under chin.*thin drink trickle/);
  assert.match(prompt, /trickle continues; free fingers remain on the laptop/);
  assert.doesNotMatch(prompt, /place (?:the )?(?:cup|mug)|set (?:the )?(?:cup|mug) down/i);
  assert.equal(retimeBeats(entry, 3).at(-1).endSeconds, 3);
});
