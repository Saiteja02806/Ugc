// Runs only after a hash-bound visual pass of the caption-v2 opening image.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { GoogleGenAI } from '@google/genai';
import { prepareAIStudioImageOutput } from '../worker/dist/lib/image-output.js';
import { generateGeminiOmniVideoBuffer } from '../worker/dist/lib/gemini-omni-video.js';
import { silenceGeneratedVideo } from '../worker/dist/lib/explore-generated-reference-audio.js';
import frames from '../worker/src/lib/hook-curated-frames.json' with { type: 'json' };
const entry = frames.frames.find(f => f.number === 12);
const pilot = { referenceId: entry.referenceId, sourceSha256: entry.sourceSha256 };

const mode = process.argv[2];
const threeSecond = false;
if (process.argv.length > 3) throw Error('Unsupported trial selection.');
if (!['--preflight', '--video-once', '--recover-video', '--inspect-video', '--record-review'].includes(mode)) throw Error('Choose preflight, video-once, recover-video, inspect-video or record-review.');
const imageFolder = resolve('outputs/hook12-middle-frame-trial-2026-10-26');
const folder = threeSecond ? join(imageFolder, 'motion-3s-v1') : imageFolder;
await mkdir(folder, { recursive: true });
const receiptPath = join(folder, 'trial-receipt.json');
let receipt;
try { receipt = JSON.parse(await readFile(receiptPath, 'utf8')); }
catch (error) {
  if (!threeSecond || error.code !== 'ENOENT') throw error;
  const prior = JSON.parse(await readFile(join(imageFolder, 'trial-receipt.json'), 'utf8'));
  receipt = { version: 1, referenceId: prior.referenceId, sourceSha256: prior.sourceSha256,
    sourceFile: prior.sourceFile, identityAssetId: prior.identityAssetId, imageStatus: prior.imageStatus,
    imageSha256: prior.imageSha256, imageFile: prior.imageFile, priorImageOperationId: prior.imageOperationId,
    priorVideoOperationId: prior.videoOperationId, imagePaidPosts: 0, videoPaidPosts: 0,
    databaseWrites: 0, appCreditChanges: 0 };
}
const review = JSON.parse(await readFile(join(imageFolder, 'image-visual-review.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function save() {
  await writeFile(`${receiptPath}.tmp`, JSON.stringify(receipt, null, 2) + '\n');
  await rename(`${receiptPath}.tmp`, receiptPath);
}
if (receipt.referenceId !== pilot.referenceId || receipt.sourceSha256 !== pilot.sourceSha256 ||
  receipt.imageStatus !== 'completed' || !review.approvedForVideo || review.imageSha256 !== receipt.imageSha256) throw Error('Image is not visually approved for this exact pilot output.');
const image = await readFile(receipt.imageFile);
if (sha(image) !== review.imageSha256) throw Error('Approved image changed.');
const normalized = await prepareAIStudioImageOutput(image, '9:16', { preserveComposition: true, cropNearRatioPadding: true });
await writeFile(join(folder, 'approved-animation-opening.png'), normalized);
const durationSeconds = 3;
const prompt = receipt.videoInput?.prompt ?? (await readFile(resolve('docs/hook12-three-second-test-prompt-2026-10-26.txt'), 'utf8')).trim();
const frozen = { model: 'google_omni', providerModel: process.env.GEMINI_OMNI_MODEL || 'gemini-omni-1.1-flash',
  durationSeconds, sourceDurationSeconds: 73 / 30, resolution: '720p', aspectRatio: '9:16',
  generateAudio: false, openingSha256: sha(normalized), identityAssetId: receipt.identityAssetId,
  identitySha256: '640669439c0ec80020bcaaf03dc76ccbc51c39d0fc1be42d6c0133f1899b920a', prompt };
const inputHash = sha(Buffer.from(JSON.stringify(frozen)));
if (receipt.videoInputSha256 && receipt.videoInputSha256 !== inputHash) throw Error('Frozen video trial inputs changed.');
receipt.videoInputSha256 = inputHash; receipt.videoInput = frozen; receipt.imageVisualReview = review; await save();
await writeFile(join(folder, 'video-prompt.txt'), prompt);
if (mode === '--preflight') {
  console.log(JSON.stringify({ status: 'video-preflight-passed', ...frozen, prompt: `${prompt.length} characters`, paidPosts: receipt.videoPaidPosts }));
} else if (mode === '--record-review') {
  receipt.videoVisualReview = JSON.parse(await readFile(join(folder, 'video-frame-review.json'), 'utf8'));
  await save(); console.log(JSON.stringify({ status: receipt.videoVisualReview.status, reviewedFrames: receipt.videoVisualReview.decodedFrames, imagePaidPosts: receipt.imagePaidPosts, videoPaidPosts: receipt.videoPaidPosts }));
} else if (mode === '--inspect-video') {
  if (!receipt.videoOperationId) throw Error('No accepted video exists to inspect.');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 1 }, timeout: 120000 } });
  const interaction = await ai.interactions.get(receipt.videoOperationId);
  const inputs = [];
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'image' && typeof value.data === 'string') inputs.push({ type: 'image', bytes: Buffer.from(value.data, 'base64').length, sha256: sha(Buffer.from(value.data, 'base64')) });
    else if (value.type === 'text' && typeof value.text === 'string') inputs.push({ type: 'text', text: value.text, sha256: sha(Buffer.from(value.text)) });
    else for (const child of Object.values(value)) if (typeof child === 'object') { if (Array.isArray(child)) child.forEach(collect); else collect(child); }
  }
  collect(interaction.steps);
  const wirePrompt = inputs.find(input => input.type === 'text' && input.text.includes('<FIRST_FRAME>'))?.text;
  const hashes = inputs.filter(input => input.type === 'image').map(input => input.sha256);
  const summary = { id: interaction.id, status: interaction.status, model: interaction.model,
    usage: interaction.usage, inputs, exactImagesMatch: hashes[0] === frozen.openingSha256 && hashes[1] === frozen.identitySha256,
    completePromptMatch: Boolean(wirePrompt?.endsWith(frozen.prompt)),
    firstFrameRole: Boolean(wirePrompt?.includes('<FIRST_FRAME>@Image1')),
    identityReferenceRole: Boolean(wirePrompt?.includes('<IMAGE_REF_0>@Image2')) };
  await writeFile(join(folder, 'retained-video-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  receipt.videoRetainedInputVerified = summary.exactImagesMatch && summary.completePromptMatch && summary.firstFrameRole && summary.identityReferenceRole;
  await save(); console.log(JSON.stringify({ status: summary.status, operationId: summary.id, model: summary.model,
    exactImagesMatch: summary.exactImagesMatch, completePromptMatch: summary.completePromptMatch,
    firstFrameRole: summary.firstFrameRole, identityReferenceRole: summary.identityReferenceRole, usage: summary.usage }));
} else if (receipt.videoStatus === 'completed') {
  console.log(JSON.stringify({ status: 'completed', output: receipt.videoFile, operationId: receipt.videoOperationId }));
} else {
  if (receipt.videoStartedAt && !receipt.videoOperationId) throw Error('Previous video acceptance uncertain; refusing another paid request.');
  if (receipt.videoStatus === 'failed') throw Error('Single video trial failed; no automatic retry.');
  if (mode === '--recover-video' && !receipt.videoOperationId) throw Error('No saved video operation to recover.');
  // The real adapter converts URL responses into inline SDK image blocks.
  // Supply verified local files at that read boundary; no remote upload or
  // storage authorization is necessary, and the Google inference remains real.
  const identity = await readFile(join(imageFolder, 'identity.png'));
  if (sha(identity) !== frozen.identitySha256) throw Error('Verified identity bytes changed.');
  const openingUrl = 'https://hook12-local.invalid/approved-opening.png';
  const identityUrl = 'https://hook12-local.invalid/identity.png';
  receipt.videoInputTransport = 'verified-local-files-to-inline-SDK-images'; await save();
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const endpoint = new URL(typeof url === 'string' ? url : url.url ?? String(url));
    if (endpoint.hostname === 'hook12-local.invalid') {
      const bytes = endpoint.pathname === '/approved-opening.png' ? normalized : endpoint.pathname === '/identity.png' ? identity : null;
      if (!bytes) throw Error('Unknown local diagnostic input.');
      return new Response(bytes, { headers: { 'content-type': 'image/png', 'content-length': String(bytes.length) } });
    }
    const method = options.method ?? (typeof url === 'object' ? url.method : 'GET') ?? 'GET';
    const interactionCall = endpoint.hostname === 'generativelanguage.googleapis.com' && /\/interactions(?:\/|$)/.test(endpoint.pathname);
    if (interactionCall && method === 'POST') {
      if (mode !== '--video-once' || receipt.videoStartedAt || receipt.videoPaidPosts) throw Error('Refusing second video generation submission.');
      receipt.videoStartedAt = new Date().toISOString(); receipt.videoPaidPosts = 1; receipt.videoStatus = 'submitting';
      receipt.videoWireBodySha256 = typeof options.body === 'string' ? sha(Buffer.from(options.body)) : null; await save();
    }
    const response = await nativeFetch(url, options);
    if (interactionCall && response.ok) {
      const value = await response.clone().json().catch(() => null);
      if (value?.id) {
        receipt.videoOperationId = value.id; receipt.videoProviderStatus = value.status;
        if (value.usage) receipt.videoUsage = value.usage;
        await save();
      }
    }
    return response;
  };
  try {
    const raw = await generateGeminiOmniVideoBuffer({ aspectRatio: '9:16', durationSeconds,
      resolution: '720p', prompt, startingFrameImageUrl: openingUrl, referenceImageUrls: [identityUrl],
      providerOperationId: receipt.videoOperationId,
      onOperationCreated: async id => { receipt.videoOperationId = id; receipt.videoStatus = 'accepted'; await save(); console.log(JSON.stringify({ status: 'video-accepted', operationId: id })); },
      onOperationSucceeded: async id => { receipt.videoOperationId = id; receipt.videoStatus = 'provider-completed'; await save(); } });
    await writeFile(join(folder, 'generated-video-raw.mp4'), raw);
    process.env.FFMPEG_PATH = ffmpeg;
    const silent = await silenceGeneratedVideo(raw);
    const filename = join(folder, 'generated-video-silent.mp4');
    await writeFile(filename, silent);
    const info = JSON.parse(execFileSync(ffprobe.path, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', filename], { encoding: 'utf8', windowsHide: true }));
    receipt.videoFile = filename; receipt.videoSha256 = sha(silent); receipt.videoStatus = 'completed';
    receipt.videoOutput = { durationSeconds: Number(info.format.duration), streams: info.streams.map(s => ({ type: s.codec_type, width: s.width, height: s.height, fps: s.avg_frame_rate, frames: s.nb_frames })) };
    await save(); console.log(JSON.stringify({ status: 'completed', output: filename, operationId: receipt.videoOperationId, outputInfo: receipt.videoOutput, paidPosts: receipt.videoPaidPosts }));
  } catch (error) {
    receipt.videoLastError = { name: error.name, code: error.status ?? error.code ?? null,
      message: String(error.message).replace(/AIza[\w-]+/g, '[REDACTED]').slice(0, 1000) };
    receipt.videoStatus = receipt.videoOperationId ? 'recoverable-existing-task' : receipt.videoStartedAt ? 'acceptance-uncertain' : 'not-submitted';
    await save(); console.error(JSON.stringify({ status: receipt.videoStatus, operationId: receipt.videoOperationId, error: receipt.videoLastError, paidPosts: receipt.videoPaidPosts })); process.exitCode = 1;
  } finally { globalThis.fetch = nativeFetch; }
}
