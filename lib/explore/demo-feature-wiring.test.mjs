import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { mock, test } from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { requestFinish } from "./workflow-finishing-client.ts";
import { parseExploreFinishDraft, ExploreFinishError } from "../../worker/src/lib/explore-finishing-contract.ts";
import { runFinishExploreVideoJob } from "../../worker/src/jobs/finish-explore-video.ts";
import { finishExploreVideo } from "../../worker/src/lib/explore-video-finishing.ts";

// Actual client -> API/service -> serialized receipt/job -> actual worker and
// FFmpeg renderer -> correlated status. Only auth, DB/queue/storage are fakes.
const local = file => new URL(file, import.meta.url), owner = "demo-wiring-owner";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = new Map(), receipts = new Map(), jobs = new Map(), verified = new Set(), downloads = [];
let creates = 0, renderCount = 0;
class AuthError extends Error { status = 401; }
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => ({ uid: owner }) } });
mock.module(local("../ai-studio/server-access.ts"), { namedExports: { requireAIStudioProUser: async () => ({ uid: owner }) } });
mock.module(local("../queues/job-queue.ts"), { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module(local("../jobs/background-jobs.ts"), { namedExports: {
  getMissingBackgroundJobStorageEnvVars: () => [], getBackgroundJobForUser: async ({ jobId, userId }) => { assert.equal(userId, owner); return jobs.get(jobId) ?? null; },
} });
mock.module(local("../jobs/background-job-service.ts"), { namedExports: { dispatchQueuedBackgroundJobForRecovery: async job => job } });
class LocalStore {
  async read(user, key) { assert.equal(user, owner); return receipts.get(key) ?? null; }
  async asset(user, assetId, collection) {
    const row = rows.get(assetId);
    if (!row || row.user_id !== user || row.collection !== collection || row.status !== "ready" || row.deleted_at !== null) throw new ExploreFinishError("The selected media is unavailable.", 404);
    verified.add(assetId); return row;
  }
  async create(user, key, fingerprint, draft) {
    for (const [assetId, kind] of [[draft.sourceAssetId, "video"], [draft.demoAssetId, "video"], [draft.demoAudioAssetId, "audio"], [draft.backgroundAssetId, "audio"]]) if (assetId) await this.asset(user, assetId, kind);
    creates++;
    const receipt = JSON.parse(JSON.stringify({ user_id: user, request_key: key, fingerprint, draft, job_id: id(200 + creates), output_asset_id: id(100 + creates), status: "queued" }));
    receipts.set(key, receipt);
    jobs.set(receipt.job_id, { id: receipt.job_id, userId: user, jobType: "render_demo_video", projectId: "explore", idempotencyKey: `explore-finish:${key}`, status: "queued",
      input: { version: 1, userId: user, requestKey: key, fingerprint, outputAssetId: receipt.output_asset_id } });
    return receipt;
  }
}
mock.module(local("./workflow-finishing-store.ts"), { namedExports: { ExploreFinishingRequestStore: LocalStore } });
mock.method(globalThis, "fetch", async () => assert.fail("No external network/ASR/provider calls are allowed"));
const { handleWorkflowFinishingStart, handleWorkflowFinishingStatus } = await import("./workflow-finishing-api.ts");
const command = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
const hash = async file => createHash("sha256").update(await readFile(file)).digest("hex");
const edit = (start, end) => ({ version: 1, format: "hook", trimStartMs: start, trimEndMs: end, originalVolume: 1, musicVolume: .4, text: null });
const api = { token: async () => "synthetic", assertActive() {}, fetch: async (_url, init) => {
  const request = new Request(`https://local.test${_url}`, init);
  return init.method === "POST" ? handleWorkflowFinishingStart(request) : handleWorkflowFinishingStatus(request);
} };
function power(file, start, frequency) {
  const buffer = command(["-ss", String(start), "-i", file, "-t", "0.2", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]);
  let real = 0, imaginary = 0;
  for (let index = 0; index < buffer.length / 4; index++) {
    const sample = buffer.readFloatLE(index * 4), phase = 2 * Math.PI * frequency * index / 16000;
    real += sample * Math.cos(phase); imaginary += sample * Math.sin(phase);
  }
  return real ** 2 + imaginary ** 2;
}
function pixel(file, start) { return command(["-ss", String(start), "-i", file, "-frames:v", "1", "-vf", "format=rgb24,crop=1:1:32:64:exact=1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]); }

test("Demo exact selection and independent audio survive API/job/worker and change real rendered pixels/audio, with read-only recovery", async t => {
  Object.assign(process.env, { EXPLORE_FINISHING_ENABLED: "true", EXPLORE_FORMAT_EDITING_ENABLED: "true", FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe.path });
  const parent = resolve(".tmp"), artifacts = resolve(".tmp/remaining-wiring-artifacts"); await mkdir(parent, { recursive: true }); await mkdir(artifacts, { recursive: true });
  const directory = await mkdtemp(join(parent, "demo-wiring-"));
  t.after(async () => { if (dirname(resolve(directory)) !== parent || !basename(directory).startsWith("demo-wiring-")) throw Error("Unsafe test cleanup"); await rm(directory, { recursive: true, force: true }); });
  for (const [number, color, tone, duration] of [[1, "blue", 440, 2], [2, "red", 880, 4], [5, "green", 990, 4]]) {
    const file = join(directory, `${number}.mp4`);
    command(["-n", "-f", "lavfi", "-i", `color=c=${color}:s=64x128:r=30:d=${duration}`, "-f", "lavfi", "-i", `sine=frequency=${tone}:sample_rate=48000:duration=${duration}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file]);
    rows.set(id(number), { id: id(number), user_id: owner, collection: "video", status: "ready", deleted_at: null, storage_key: String(number), path: file, ratio: "9:16", mime_type: "video/mp4", metadata: {}, file_size_bytes: (await stat(file)).size });
  }
  for (const [number, frequency] of [[3, 1320], [4, 220]]) {
    const file = join(directory, `${number}.wav`);
    command(["-n", "-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=48000:duration=0.4`, "-c:a", "pcm_s16le", file]);
    rows.set(id(number), { id: id(number), user_id: owner, collection: "audio", status: "ready", deleted_at: null, storage_key: String(number), path: file, mime_type: "audio/wav", metadata: {}, file_size_bytes: (await stat(file)).size });
  }
  const originalHashes = await Promise.all([...rows.values()].map(row => hash(row.path))), store = new LocalStore();
  const deps = { store: {
    read: (user, key) => store.read(user, key), asset: (user, key, kind) => store.asset(user, key, kind),
    claimSpeech: async () => assert.fail("Subtitles off must never claim paid speech"), saveSpeech: async () => assert.fail("Subtitles off"), hasPendingSchedule: async () => false,
    finalize: async (receipt, _claim, output) => { receipt.status = "completed"; const job = jobs.get(receipt.job_id); job.status = "completed"; job.output = output;
      rows.set(receipt.output_asset_id, { id: receipt.output_asset_id, user_id: owner, collection: "video", status: "ready", deleted_at: null, url: output.url }); },
  }, storage: {
    existing: async () => null,
    download: async (key, destination, maximum) => {
      assert.ok([...required].every(id => verified.has(id)), "All selected records must be checked before download/render");
      const row = rows.get(id(Number(key))); assert.ok(row && row.file_size_bytes <= maximum); downloads.push(row.id); await copyFile(row.path, destination);
    },
    upload: async (receipt, outputPath, details) => {
      const destination = join(artifacts, `demo-selected-${receipt.output_asset_id}.mp4`); await copyFile(outputPath, destination);
      return { mediaAssetId: receipt.output_asset_id, url: `https://owned.example.test/${receipt.output_asset_id}.mp4`, key: receipt.output_asset_id, path: destination, ...details };
    },
  }, finish: async options => { renderCount++; return finishExploreVideo(options); } };
  let required;
  const draft = parseExploreFinishDraft({ version: 1, kind: "hook", sourceAssetId: id(1), demoAssetId: id(2), demoAudioAssetId: id(3), demoAudioPlayback: "repeat", backgroundAssetId: id(4), backgroundPlayback: "repeat", subtitles: null,
    composition: { version: 1, sourceEditing: edit(500, 1500), demoEditing: edit(500, 2500), sourceAudioAssetId: null, sourceAudioPlayback: "once" } });
  for (const [index, selected] of [draft, { ...draft, demoAssetId: id(5), demoAudioAssetId: null, demoAudioPlayback: "once" }].entries()) {
    const saved = JSON.parse(JSON.stringify({ version: 1, ownerId: owner, kind: "hook", requestKey: id(20 + index), draft: selected }));
    const pending = await requestFinish(api, saved, true); assert.equal(pending.outcome, "pending");
    const receipt = receipts.get(saved.requestKey), job = jobs.get(receipt.job_id);
    assert.deepEqual(receipt.draft, selected); verified.clear(); downloads.length = 0;
    required = [selected.sourceAssetId, selected.demoAssetId, selected.backgroundAssetId, ...(selected.demoAudioAssetId ? [selected.demoAudioAssetId] : [])];
    const workerJob = { id: job.id, user_id: owner, job_type: "render_demo_video", project_id: "explore", idempotency_key: job.idempotencyKey, claim_token: id(50), input_json: JSON.parse(JSON.stringify(job.input)) };
    const output = await runFinishExploreVideoJob(workerJob, { checkpoint: async () => {} }, deps);
    assert.equal(output.mediaAssetId, receipt.output_asset_id); assert.deepEqual(new Set(downloads), new Set(required));
    const status = await requestFinish(api, saved); assert.equal(status.outcome, "completed"); assert.equal(status.mediaAssetId, output.mediaAssetId);
    const file = job.output.path; assert.ok(Math.abs(job.output.durationSeconds - 3) < .15);
    const opening = pixel(file, .2), demo = pixel(file, 1.4); assert.ok(opening[2] > opening[0] * 4, "Opening remains blue");
    assert.ok(index === 0 ? demo[0] > demo[1] * 4 : demo[1] > demo[0] * 4, "Latest selected demo determines actual output pixels");
    assert.ok(power(file, .2, 440) > power(file, .2, 1320) * 30, "Opening speech preserved; demo-only audio absent");
    assert.ok(power(file, .2, 220) > power(file, .2, 700) * 20 && power(file, 2.6, 220) > power(file, 2.6, 700) * 20, "Background track spans both clips");
    if (index === 0) assert.ok(power(file, 2.6, 1320) > power(file, .2, 1320) * 30, "Added audio repeats only across the demo");
    else assert.ok(power(file, 2.6, 990) > power(file, 2.6, 1320) * 30, "Removing demo audio changes the rendered mix");
    const rendered = renderCount; await runFinishExploreVideoJob(workerJob, { checkpoint: async () => {} }, deps); assert.equal(renderCount, rendered, "Completed recovery must not render again");
  }
  assert.deepEqual(await Promise.all([...rows.values()].filter(row => row.path).map(row => hash(row.path))), originalHashes, "Original uploads unchanged");
});
