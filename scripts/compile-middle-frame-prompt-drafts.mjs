/** Offline, draft-only authoring. Never imported by application generation routes. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EPSILON = 1e-6;
const hash = /^[a-f0-9]{64}$/i;
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be nonempty text`);
  return value.trim().replace(/\s+/g, ' ');
}
function positive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be positive and finite`);
  return value;
}
function outputDuration(value) {
  positive(value, 'output duration');
  if (!Number.isInteger(value) || value < 3 || value > 10) throw new RangeError('output duration must be an integer from 3 through 10 seconds for the reviewed pilot provider');
  return value;
}
function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
}

export function validateEntry(entry) {
  object(entry, 'entry');
  text(entry.referenceId, 'referenceId');
  if (!hash.test(entry.sourceSha256 ?? '')) throw new TypeError('sourceSha256 must be a SHA256');
  const duration = positive(entry.sourceDurationSeconds, 'sourceDurationSeconds');
  positive(entry.sourceFps, 'sourceFps');
  if (!Number.isSafeInteger(entry.sourceFrameCount) || entry.sourceFrameCount < 1) throw new TypeError('sourceFrameCount must be a positive integer');
  if (Math.abs(entry.sourceFrameCount / entry.sourceFps - duration) > EPSILON) throw new RangeError('source duration must cover frameCount/fps elapsed clock');
  object(entry.clarityFrame, 'clarityFrame');
  if (!hash.test(entry.clarityFrame.sha256 ?? '')) throw new TypeError('clarityFrame.sha256 must be a SHA256');
  if (!Number.isSafeInteger(entry.clarityFrame.index) || entry.clarityFrame.index < 0 || entry.clarityFrame.index >= entry.sourceFrameCount) throw new RangeError('clarity frame index out of bounds');
  const anchorTime = entry.clarityFrame.timeSeconds;
  if (typeof anchorTime !== 'number' || !Number.isFinite(anchorTime) || anchorTime < 0 || anchorTime >= duration) throw new RangeError('clarity frame time out of bounds');
  // Do not equate index/fps to provenance time: Hook71 has a documented PTS discrepancy.
  for (const field of ['openingState', 'camera', 'endingState', 'openingImageRequirement']) text(entry[field], field);
  object(entry.captionCleanup, 'captionCleanup');
  text(entry.captionCleanup.text, 'captionCleanup.text');
  text(entry.captionCleanup.region, 'captionCleanup.region');
  if (!Array.isArray(entry.beats) || !entry.beats.length) throw new TypeError('beats must be nonempty');
  let cursor = 0;
  for (const [index, beat] of entry.beats.entries()) {
    object(beat, `beat ${index}`);
    if (typeof beat.startSeconds !== 'number' || !Number.isFinite(beat.startSeconds) || Math.abs(beat.startSeconds - cursor) > EPSILON) throw new RangeError(`beat ${index} must begin at previous ending (initially zero)`);
    if (typeof beat.endSeconds !== 'number' || !Number.isFinite(beat.endSeconds) || beat.endSeconds <= beat.startSeconds || beat.endSeconds > duration + EPSILON) throw new RangeError(`beat ${index} has invalid ending`);
    text(beat.action, `beat ${index} action`);
    cursor = beat.endSeconds;
  }
  if (Math.abs(cursor - duration) > EPSILON) throw new RangeError('beats must include the complete source ending');
  return entry;
}

export function defaultOutputDuration(entry) {
  validateEntry(entry);
  return Math.min(10, Math.max(3, Math.ceil(entry.sourceDurationSeconds)));
}

export function retimeBeats(entry, duration) {
  validateEntry(entry);
  outputDuration(duration);
  return entry.beats.map((beat, index) => ({
    sourceStartSeconds: beat.startSeconds,
    sourceEndSeconds: beat.endSeconds,
    startSeconds: index === 0 ? 0 : beat.startSeconds / entry.sourceDurationSeconds * duration,
    endSeconds: index === entry.beats.length - 1 ? duration : beat.endSeconds / entry.sourceDurationSeconds * duration,
    action: text(beat.action, 'action'),
  }));
}

function seconds(value) {
  const rounded = Number(value.toFixed(2));
  return String(value !== 0 && rounded === 0 ? value : rounded);
}

export function buildMotionPrompt(entry, duration = defaultOutputDuration(entry)) {
  const beats = retimeBeats(entry, duration);
  return [
    `Create a ${seconds(duration)}-second continuous portrait video from the approved reconstructed opening image, matching the original opening pose: ${text(entry.openingState, 'openingState')}`,
    `Scene and camera: ${text(entry.camera, 'camera')}`,
    ...beats.map(beat => `${seconds(beat.startSeconds)}–${seconds(beat.endSeconds)}s: ${beat.action}`),
    `Final state: ${text(entry.endingState, 'endingState')}`,
    'Keep the approved influencer identity, source clothing, scene and hand/prop continuity through the final frame; any appearance reference affects identity only, never its portrait background. No added captions, text or generated audio.',
  ].join('\n');
}

export function buildOpeningPrompt(entry) {
  validateEntry(entry);
  return [
    'Create one photorealistic portrait opening image, reconstructing the original video at t=0.',
    'Image 1 is the original source t=0 image: it controls opening pose, hands/props, composition and scene. Image 2 is a later clear frame from the same source, used only as supporting visibility/continuity evidence, not the opening pose or identity authority. Image 3 and every subsequent image are the selected influencer identity references; use their identity without their background or clothing.',
    `Opening: ${text(entry.openingState, 'openingState')}`,
    `Scene and camera: ${text(entry.camera, 'camera')}`,
    text(entry.openingImageRequirement, 'openingImageRequirement'),
    `Remove the source caption/graphic overlay: ${text(entry.captionCleanup.text, 'captionCleanup.text')} Region: ${text(entry.captionCleanup.region, 'captionCleanup.region')} Restore the underlying scene naturally without erasing physical props or real scene signage.`,
    'Preserve the original opening hand/prop occlusion while transferring the selected influencer identity. No added text. This still must be visually approved against the original opening before animation.',
  ].join('\n');
}

export function entriesFromDocument(document) {
  if (Array.isArray(document)) return document;
  object(document, 'candidate document');
  const keys = ['items', 'entries'].filter(key => Array.isArray(document[key]));
  if (keys.length !== 1) throw new TypeError('candidate document must contain exactly one items or entries array');
  return document[keys[0]];
}

export function compileDrafts(documents, duration) {
  if (!Array.isArray(documents) || !documents.length) throw new TypeError('candidate documents required');
  if (duration !== undefined) outputDuration(duration);
  const seen = new Set();
  const drafts = documents.flatMap(entriesFromDocument).map(entry => {
    validateEntry(entry);
    if (seen.has(entry.referenceId)) throw new TypeError(`duplicate referenceId: ${entry.referenceId}`);
    seen.add(entry.referenceId);
    const outputDurationSeconds = duration ?? defaultOutputDuration(entry);
    return {
      referenceId: entry.referenceId,
      sourceSha256: entry.sourceSha256,
      sourceDurationSeconds: entry.sourceDurationSeconds,
      sourceFps: entry.sourceFps,
      sourceFrameCount: entry.sourceFrameCount,
      clarityFrame: entry.clarityFrame,
      outputDurationSeconds,
      timing: retimeBeats(entry, outputDurationSeconds),
      openingPrompt: buildOpeningPrompt(entry),
      motionPrompt: buildMotionPrompt(entry, outputDurationSeconds),
      evidence: entry.evidence,
      risks: entry.risks ?? [],
      visualQualification: 'not_tested',
      requiredGate: 'Approve the reconstructed source-t0 image, then review every generated video frame against the retimed source before activation. One pilot must pass before applying other references.',
    };
  });
  if (!drafts.length) throw new TypeError('candidate documents contain no entries');
  return { version: 1, status: 'drafts_only_not_activated', providerCalls: 0, drafts };
}

async function main(args) {
  const inputs = [];
  let output;
  let duration;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!['--input', '--out', '--duration'].includes(arg) || !args[index + 1] || args[index + 1].startsWith('--')) throw new TypeError(`Unknown or incomplete argument: ${arg}`);
    const value = args[++index];
    if (arg === '--input') inputs.push(resolve(value));
    if (arg === '--out') {
      if (output) throw new TypeError('Specify --out once');
      output = resolve(value);
    }
    if (arg === '--duration') {
      if (duration !== undefined) throw new TypeError('Specify --duration once');
      duration = outputDuration(Number(value));
    }
  }
  if (!inputs.length || !output) throw new TypeError('Usage: node scripts/compile-middle-frame-prompt-drafts.mjs --input candidates.json [--input more.json] --out drafts.json [--duration seconds]');
  if (inputs.includes(output)) throw new TypeError('Output must not replace candidate input');
  const documents = await Promise.all(inputs.map(async path => JSON.parse(await readFile(path, 'utf8'))));
  const result = compileDrafts(documents, duration);
  // Exclusive creation protects existing authored drafts. No provider or runtime mutation.
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(`Wrote ${result.drafts.length} draft-only prompts to ${output}; no activation or provider calls.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
