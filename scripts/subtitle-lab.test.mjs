/** Real FFmpeg integration checks with supplied timestamps; no network or API key. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, basename, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import { generateSubtitles } from "../worker/dist/subtitles/generate.js";
import { runMediaCommand } from "../worker/dist/subtitles/media.js";
import { SubtitleError } from "../worker/dist/subtitles/contracts.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tools = { ffmpeg, ffprobe: ffprobe.path, fontsDir: join(root, "worker", "src", "assets", "fonts") };
const hash = async path => createHash("sha256").update(await readFile(path)).digest("hex");
const audioHash = async path => (await runMediaCommand(ffmpeg, ["-v", "error", "-i", path, "-map", "0:a:0", "-c:a", "copy", "-f", "md5", "-"])).stdout.trim();
const expectedError = code => error => error instanceof SubtitleError && error.code === code;

async function temporary(run) {
  const dir = await mkdtemp(join(tmpdir(), "ugc-subtitle-integration-"));
  try { await run(dir); } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("ugc-subtitle-integration-"));
    await rm(dir, {recursive:true, force:true});
  }
}

async function sample(path, audio = "sine=frequency=440:sample_rate=48000", duration = 3) {
  await runMediaCommand(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", "-f", "lavfi", "-i", "color=c=0x203247:s=360x640:r=15",
    ...(audio ? ["-f", "lavfi", "-i", audio] : []), "-t", String(duration), "-c:v", "libx264", "-preset", "ultrafast",
    "-pix_fmt", "yuv420p", ...(audio ? ["-c:a", "aac"] : []), path]);
}

function fixture(onCall = () => {}) {
  return {id: "offline:test", transcribe: async (_path, durationMs) => {
    onCall();
    return {schemaVersion:1, provider:"fixture", model:"offline-test", language:"en", durationMs,
      words:[{text:"Hello", startMs:200, endMs:700}, {text:"world.", startMs:800, endMs:1200}, {text:"Later", startMs:1800, endMs:2300}]};
  }};
}

test("all three styles preserve the source, AAC audio, exports and transcript cache", async () => temporary(async dir => {
  const inputPath = join(dir, "original.mp4");
  await sample(inputPath);
  const originalHash = await hash(inputPath), originalAudio = await audioHash(inputPath);
  let calls = 0;
  const provider = fixture(() => calls++);
  for (const [index, style] of ["clean", "bold-box", "active-word"].entries()) {
    const outputDir = join(dir, style);
    const result = await generateSubtitles({inputPath, outputDir, cacheDir:join(dir,"cache"), style, placement:"bottom", provider, tools});
    assert.equal(result.cacheHit, index > 0);
    assert.equal(result.durationMs, 3000);
    assert.deepEqual([result.width,result.height], [360,640]);
    assert.equal(await audioHash(result.videoPath), originalAudio);
    for (const file of ["captions.ass","captions.srt","captions.vtt","transcript.json","manifest.json"]) await access(join(outputDir,file));
    assert.equal(JSON.parse(await readFile(join(outputDir,"manifest.json"),"utf8")).style, style);
    // Caption frames change pixels; after the final cue, video returns to its original frame.
    const caption = join(dir, `${style}-frame.png`), pause = join(dir, `${style}-pause.png`);
    for (const [time,path] of [[0.4,caption],[2.7,pause]]) {
      await runMediaCommand(ffmpeg,["-v","error","-n","-ss",String(time),"-i",result.videoPath,"-frames:v","1",path]);
    }
    const captionPixels = await sharp(caption).extract({left:30,top:475,width:300,height:60}).raw().toBuffer();
    const pausePixels = await sharp(pause).extract({left:30,top:475,width:300,height:60}).raw().toBuffer();
    let changed = 0, yellow = 0;
    for (let i=0;i<captionPixels.length;i+=3) {
      if (Math.abs(captionPixels[i]-pausePixels[i]) > 35 || Math.abs(captionPixels[i+1]-pausePixels[i+1]) > 35) changed++;
      if (captionPixels[i] > 180 && captionPixels[i+1] > 150 && captionPixels[i+2] < 140) yellow++;
    }
    assert.ok(changed > 50, `${style} must visibly render captions`);
    if (style === "active-word") assert.ok(yellow > 20, "active word must have the yellow highlight");
  }
  assert.equal(calls,1);
  assert.equal(await hash(inputPath), originalHash);
}));

test("no-audio, exact-silence and over-duration videos fail before calling a provider", async () => temporary(async dir => {
  const provider = fixture(() => assert.fail("Invalid source must not call a provider"));
  for (const [label,audio,duration,code] of [["no-audio",null,1,"NO_AUDIO"],["silence","anullsrc=r=48000:cl=mono",1,"NO_SPEECH"],["too-long","sine=frequency=440:sample_rate=48000",121,"VIDEO_DURATION_INVALID"]]) {
    const inputPath=join(dir,`${label}.mp4`);
    await sample(inputPath,audio,duration);
    const before=await hash(inputPath);
    const outputDir=join(dir,`${label}-output`);
    await assert.rejects(generateSubtitles({inputPath,outputDir,cacheDir:join(dir,"cache"),style:"clean",placement:"bottom",provider,tools}), expectedError(code));
    await assert.rejects(access(join(outputDir,"manifest.json")));
    assert.equal(await hash(inputPath),before);
  }
}));

test("existing outputs are preserved and cancellation cannot publish a completion", async () => temporary(async dir => {
  const inputPath=join(dir,"source.mp4");
  await sample(inputPath);
  const outputDir=join(dir,"existing");
  await mkdir(outputDir);
  await writeFile(join(outputDir,"keep.txt"),"keep this");
  const provider=fixture(() => assert.fail("Must not transcribe"));
  const input={inputPath,outputDir,cacheDir:join(dir,"cache"),style:"clean",placement:"bottom",provider,tools};
  await assert.rejects(generateSubtitles(input),expectedError("OUTPUT_EXISTS"));
  assert.equal(await readFile(join(outputDir,"keep.txt"),"utf8"),"keep this");
  const controller=new AbortController();
  const cancelledOutput=join(dir,"cancelled");
  await assert.rejects(generateSubtitles({...input,outputDir:cancelledOutput,signal:controller.signal,
    onStage:stage=>{if(stage==="extracting_audio")controller.abort();}}),expectedError("CANCELLED"));
  await assert.rejects(access(join(cancelledOutput,"manifest.json")));
}));

test("media processes terminate on cancellation and time limits", async () => {
  const args=["-e","setInterval(() => {}, 1000)"];
  await assert.rejects(runMediaCommand(process.execPath,args,{timeoutMs:100}),expectedError("MEDIA_TIMEOUT"));
  const controller=new AbortController();
  const result=runMediaCommand(process.execPath,args,{signal:controller.signal});
  setTimeout(()=>controller.abort(),100);
  await assert.rejects(result,expectedError("CANCELLED"));
});
