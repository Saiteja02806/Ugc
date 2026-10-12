import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, mock, test } from "node:test";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const originalProbePath = process.env.FFPROBE_PATH;
delete process.env.FFPROBE_PATH;
let fixture, bytes, calls = [], state = {};
mock.module("@/lib/storage/storage", { namedExports: {
  buildPublicStorageUrl: () => { throw new Error("Private probe attempted a public URL"); },
  getStorageObject: async () => { throw new Error("Private probe attempted a public storage read"); },
} });
mock.module("@/lib/media/private-media-storage", { namedExports: {
  assertPrivateMediaIdentity: key => key,
  privateMediaObject: async params => {
    calls.push(params);
    if (state.failure) throw new Error("private-provider-details-should-not-escape");
    return { size: state.size ?? bytes.length, contentType: state.contentType ?? "video/mp4",
      body: new ReadableStream({ start(controller) {
        const data = state.bytes ?? bytes;
        for (let n = 0; n < data.length; n += 113) controller.enqueue(data.subarray(n,n+113));
        if (state.streamError) controller.error(new Error("private-stream-detail"));
        else controller.close();
      }, cancel() { calls.push({cancelled:true}); } }) };
  },
} });
const { probeStoredMcpUpload } = await import("../lib/mcp/upload-probe.ts");
before(async () => {
  fixture = await mkdtemp(join(tmpdir(), "ugc-private-probe-fixture-"));
  const video = join(fixture,"private.mp4");
  await run(ffmpeg,["-v","error","-f","lavfi","-i","color=c=green:s=96x160:r=10","-t","1","-an","-c:v","libx264",video],{windowsHide:true});
  bytes = await readFile(video);
});
after(async () => {
  mock.restoreAll();
  if (originalProbePath === undefined) delete process.env.FFPROBE_PATH;
  else process.env.FFPROBE_PATH = originalProbePath;
  if (fixture) await rm(fixture,{recursive:true,force:true});
});
const row = () => ({ collection:"video",mime_type:"video/mp4",file_size_bytes:bytes.length,
  storage_key:"media/owner/video/private.mp4",url:"https://untrusted.invalid/not-a-source",
  metadata:{mcpUpload:true,storageLocation:"private_user_media"} });
const fails = (promise, code) => assert.rejects(promise,error => {
  assert.equal(error.code,code);
  assert.doesNotMatch(error.message,/private-provider|private-stream|untrusted/);
  return true;
});

test("actual private media bytes are measured through the persisted private location, never the row URL or public bucket", async () => {
  state={}; calls=[];
  const actual = await probeStoredMcpUpload(row());
  assert.equal(actual.width,96); assert.equal(actual.height,160);
  assert.ok(Math.abs(actual.durationSeconds-1)<0.1);
  assert.deepEqual(calls,[{key:"media/owner/video/private.mp4"}]);
});

test("private size bounds and streamed truncation/overflow reject readiness", async () => {
  state={size:bytes.length+1}; calls=[]; await fails(probeStoredMcpUpload(row()),"UPLOAD_MISMATCH");
  assert.ok(calls.some(call => call.cancelled));
  state={contentType:"image/png"}; await fails(probeStoredMcpUpload(row()),"UPLOAD_MISMATCH");
  state={bytes:bytes.subarray(0,bytes.length-1)}; await fails(probeStoredMcpUpload(row()),"UPLOAD_MISMATCH");
  state={bytes:Buffer.concat([bytes,Buffer.from([0])])}; await fails(probeStoredMcpUpload(row()),"UPLOAD_MISMATCH");
});

test("private provider and stream failures remain retryable without leaking details or falling back to public storage", async () => {
  state={failure:true}; await fails(probeStoredMcpUpload(row()),"UPLOAD_PROBE_UNAVAILABLE");
  state={streamError:true}; await fails(probeStoredMcpUpload(row()),"UPLOAD_PROBE_UNAVAILABLE");
});

test("a private media label cannot turn a forged container into visual media", async () => {
  state={bytes:Buffer.alloc(bytes.length)};
  await fails(probeStoredMcpUpload(row()),"UNSUPPORTED_MEDIA_TYPE");
});
