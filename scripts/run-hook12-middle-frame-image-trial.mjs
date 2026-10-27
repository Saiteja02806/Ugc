// One explicitly requested real trial; no application DB or release mutations.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { decodeHookFirstFrame } from '../lib/explore/hook-source-frame.ts';
import frames from '../worker/src/lib/hook-curated-frames.json' with { type: 'json' };
const entry = frames.frames.find(f => f.number === 12);
const pilot = { referenceId: entry.referenceId, sourceSha256: entry.sourceSha256, identityClarityAnchor: entry };
import { buildGeminiImageRequest, GEMINI_3_PRO_IMAGE_MODEL } from '../worker/dist/lib/gemini-image.js';

const mode = process.argv[2];
if (process.argv.length > 3) throw Error('Unsupported trial selection.');
if (!['--validate-inputs', '--preflight', '--image-once', '--recover-image', '--inspect-image'].includes(mode)) throw Error('Choose preflight, image-once, recover-image or inspect-image.');
const folder = resolve('outputs/hook12-middle-frame-trial-2026-10-26');
await mkdir(folder, { recursive: true });
const receiptPath = join(folder, 'trial-receipt.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let receipt;
try { receipt = JSON.parse(await readFile(receiptPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
receipt ??= { version: 1, id: randomUUID(), ownerId: 'oPQhLloYHKQFCysJ4cznV2dv8v02',
  referenceId: pilot.referenceId, sourceSha256: pilot.sourceSha256,
  identityAssetId: '495d8905-7a1b-4cbf-a38f-7a526a4dbff5',
  imageModel: GEMINI_3_PRO_IMAGE_MODEL, imagePaidPosts: 0, videoPaidPosts: 0,
  appCreditChanges: 0, databaseWrites: 0, imageVisualReview: 'pending', videoVisualReview: 'pending' };
async function save() {
  await writeFile(`${receiptPath}.tmp`, JSON.stringify(receipt, null, 2) + '\n');
  await rename(`${receiptPath}.tmp`, receiptPath);
}
const sourceMeta = JSON.parse(await readFile(resolve('.tmp/middle-frame-audit-20261025-native/public', pilot.referenceId, 'source_metadata.json'), 'utf8'));
const sourcePath = sourceMeta.source;
const source = await readFile(sourcePath);
if (sha(source) !== pilot.sourceSha256) throw Error('Source video hash mismatch.');
const opening = await decodeHookFirstFrame(source);
const anchor = await readFile(resolve('public/explore/curated-hook-frames/v1', `${pilot.identityClarityAnchor.sha256}.png`));
const identity = await readFile(resolve('outputs/hook-keyframe-incident-2026-10-21/main.png'));
if (sha(identity) !== '640669439c0ec80020bcaaf03dc76ccbc51c39d0fc1be42d6c0133f1899b920a') throw Error('Previously verified identity image changed.');
const openingMeta = await sharp(opening).metadata();
const frame = { index: 0, timeSeconds: 0, width: openingMeta.width, height: openingMeta.height, sha256: sha(opening) };
const { index, timeSeconds, width, height, sha256 } = pilot.identityClarityAnchor;
const sourceFrame = { index, timeSeconds, width, height, sha256 };
const prompt = receipt.imageStartedAt
  ? await readFile(join(folder, 'image-prompt.txt'), 'utf8')
  : (await readFile(resolve('docs/hook12-opening-image-test-prompt-2026-10-26.txt'), 'utf8')).trim();
// Diagnostic evidence only: not an application receipt, credit reservation or queue acceptance.
if (sha(anchor) !== pilot.identityClarityAnchor.sha256) throw Error('Clarity bytes changed.');
const contract = { diagnosticOnly: true, referenceId: pilot.referenceId, sourceSha256: pilot.sourceSha256,
  animationOpeningFrame: frame, identityClarityAnchor: sourceFrame, identityAssetId: receipt.identityAssetId,
  identitySha256: sha(identity), promptSha256: sha(Buffer.from(prompt)) };
const request = buildGeminiImageRequest({ aspectRatio: '9:16', model: GEMINI_3_PRO_IMAGE_MODEL,
  prompt, imageSize: '2K', referenceImage: null,
  referenceImages: [opening, anchor, identity].map(buffer => ({ data: buffer.toString('base64'), mimeType: 'image/png' })),
  referenceLabels: ['IMAGE 1: Original source t=0; scene and opening pose authority, not identity.', 'IMAGE 2: Later clarity anchor at source 1.200 seconds; support only, not opening pose or identity.', 'IMAGE 3: Chosen influencer; sole facial identity authority, not scene or clothing.'] });
const requestHash = sha(Buffer.from(JSON.stringify(request)));
if (receipt.imageRequestSha256 && receipt.imageRequestSha256 !== requestHash) throw Error('Frozen request changed; refusing generation.');
receipt.imageRequestSha256 = requestHash;
receipt.imageDiagnosticEvidence = contract;
receipt.sourceFile = sourcePath;
await writeFile(join(folder, 'original-t0.png'), opening);
await writeFile(join(folder, 'clarity-anchor.png'), anchor);
await writeFile(join(folder, 'identity.png'), identity);
await writeFile(join(folder, 'image-prompt.txt'), prompt);
await save();
if (mode === '--validate-inputs') {
  console.log(JSON.stringify({ status: 'offline-input-validation-passed', referenceId: pilot.referenceId,
    originalOpening: frame, laterClarity: sourceFrame, referenceImages: 3, requestSha256: requestHash,
    imagePaidPosts: receipt.imagePaidPosts, videoPaidPosts: receipt.videoPaidPosts, providerCalls: 0, diagnosticOnly: true }));
  process.exit(0);
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 1 }, timeout: 120000 } });
if (mode === '--preflight') {
  const info = await ai.models.get({ model: GEMINI_3_PRO_IMAGE_MODEL });
  console.log(JSON.stringify({ status: 'preflight-passed', model: info.name, images: 3, sourceFrame: frame,
    clarityFrame: sourceFrame, imagePaidPosts: receipt.imagePaidPosts, databaseWrites: 0 }));
} else if (mode === '--inspect-image') {
  if (!receipt.imageOperationId) throw Error('No accepted image exists to inspect.');
  const interaction = await ai.interactions.get(receipt.imageOperationId);
  const retained = [];
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'image' && typeof value.data === 'string' || value.type === 'text' && typeof value.text === 'string') retained.push(value);
    else for (const child of Object.values(value)) if (typeof child === 'object') {
      if (Array.isArray(child)) child.forEach(collect); else collect(child);
    }
  }
  collect(interaction.steps);
  const input = interaction.user_input ?? interaction.input ?? retained;
  const summary = { id: interaction.id, status: interaction.status,
    keys: Object.keys(interaction), usage: interaction.usage ?? interaction.usage_metadata ?? null,
    inputs: Array.isArray(input) ? input.map(part => ({ type: part.type,
      ...(part.text ? { text: part.text, sha256: sha(Buffer.from(part.text)) } : {}),
      ...(part.data ? { mimeType: part.mime_type, bytes: Buffer.from(part.data, 'base64').length, sha256: sha(Buffer.from(part.data, 'base64')) } : {}) })) : [] };
  await writeFile(join(folder, 'retained-image-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  try { receipt.imageVisualReview = JSON.parse(await readFile(join(folder, 'image-visual-review.json'), 'utf8')); await save(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log(JSON.stringify({ status: summary.status, operationId: summary.id, keys: summary.keys,
    retainedInputs: summary.inputs.length, usage: summary.usage }));
} else {
if (receipt.imageStatus === 'completed') { console.log(JSON.stringify({ status: 'completed', output: receipt.imageFile, operationId: receipt.imageOperationId })); process.exit(0); }
if (receipt.imageStartedAt && !receipt.imageOperationId) throw Error('Prior image acceptance is uncertain; refusing a second paid request.');
if (receipt.imageStatus === 'failed') throw Error('The single trial failed; no automatic retry.');
if (mode === '--recover-image' && !receipt.imageOperationId) throw Error('No saved image operation exists.');
try {
  let interaction;
  if (receipt.imageOperationId) interaction = await ai.interactions.get(receipt.imageOperationId);
  else {
    receipt.imageStartedAt = new Date().toISOString(); receipt.imagePaidPosts = 1; receipt.imageStatus = 'submitting'; await save();
    interaction = await ai.interactions.create(request);
    if (!interaction.id) throw Error('No operation ID returned.');
    receipt.imageOperationId = interaction.id; receipt.imageStatus = interaction.status; await save();
    console.log(JSON.stringify({ status: 'image-accepted', operationId: interaction.id }));
  }
  const began = Date.now();
  while (interaction.status === 'in_progress' && Date.now() - began < 8 * 60_000) {
    await new Promise(done => setTimeout(done, 15000));
    interaction = await ai.interactions.get(receipt.imageOperationId);
    receipt.imageStatus = interaction.status; await save();
  }
  if (interaction.status !== 'completed' || !interaction.output_image?.data) {
    receipt.imageStatus = interaction.status === 'in_progress' ? 'pending' : 'failed';
    receipt.imageProviderSummary = { status: interaction.status, error: interaction.error ?? null }; await save();
    throw Error('Image did not complete with valid image bytes.');
  }
  const raw = Buffer.from(interaction.output_image.data, 'base64');
  const png = await sharp(raw).png().toBuffer();
  const filename = join(folder, 'generated-opening.png');
  await writeFile(filename, png);
  await writeFile(join(folder, 'provider-image-original.bin'), raw);
  receipt.imageFile = filename; receipt.imageSha256 = sha(png); receipt.imageStatus = 'completed';
  const metadata = await sharp(png).metadata();
  receipt.imageOutput = { width: metadata.width, height: metadata.height, bytes: png.length };
  receipt.imageUsage = interaction.usage ?? interaction.usage_metadata ?? null;
  await save();
  console.log(JSON.stringify({ status: 'completed', output: filename, operationId: receipt.imageOperationId, dimensions: receipt.imageOutput, paidPosts: receipt.imagePaidPosts }));
} catch (error) {
  receipt.imageLastError = { name: error.name, code: error.status ?? error.code ?? null,
    message: String(error.message).replace(/AIza[\w-]+/g, '[REDACTED]').slice(0, 1200) };
  await save(); console.error(JSON.stringify({ status: 'trial-incomplete', ...receipt.imageLastError, operationId: receipt.imageOperationId ?? null, paidPosts: receipt.imagePaidPosts })); process.exitCode = 1;
}
}
