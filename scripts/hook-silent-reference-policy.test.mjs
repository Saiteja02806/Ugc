import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { getExplorePairedReferences, getGenerationReferenceSoundtrack, getAssetReferenceSoundtrack, isSilentExploreReference } from "../worker/dist/lib/explore-reference-soundtrack.js";
import { applyGeneratedReferenceAudio } from "../worker/dist/lib/explore-generated-reference-audio.js";

const id = "explore-paired-hook-ef59f4b5e69bc9e125f8ada7";
const reference = getGenerationReferenceSoundtrack({ referenceId: id, referenceType: "hook", exploreFormat: "hook" });
test("only the three rejected soundtracks are silent; new provenance has no automatic soundtrack and saved mappings survive", () => {
  const rejected=[id,"explore-paired-hook-4f4ca22ed141ee115d1eb913","explore-paired-hook-bfd6368d9fc52f44c6422a2b"];
  assert.deepEqual(getExplorePairedReferences().filter(isSilentExploreReference).map(item => item.id).sort(), [...rejected].sort());
  for(const referenceId of rejected){
    assert.equal(getAssetReferenceSoundtrack({exploreReferenceId:referenceId}),null);
    assert.ok(getGenerationReferenceSoundtrack({referenceId,referenceType:"hook",exploreFormat:"hook"}).videoStorageKey);
  }
  assert.equal(getAssetReferenceSoundtrack({ exploreReferenceId: id }), null);
  const saved = { version: 1, referenceId: id, audioSha256: reference.audioSha256, volume: .2 };
  assert.deepEqual(getAssetReferenceSoundtrack({ render: { referenceSoundtrack: saved } }), saved);
});

test("silent policy removes actual native audio without changing a single decoded picture or its timestamps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ugc-hook-silent-test-"));
  const previous = process.env.FFMPEG_PATH;
  try {
    process.env.FFMPEG_PATH = ffmpeg;
    const input = join(dir, "input.mp4"), output = join(dir, "output.mp4");
    const run = args => execFileSync(ffmpeg, ["-nostdin", "-v", "error", ...args], { windowsHide: true });
    run(["-n", "-f", "lavfi", "-i", "testsrc2=size=180x320:rate=30:duration=1", "-f", "lavfi", "-i", "sine=frequency=660:duration=1", "-c:v", "libx264", "-c:a", "aac", "-shortest", input]);
    for (const reference of getExplorePairedReferences().filter(isSilentExploreReference)) {
    await writeFile(output, await applyGeneratedReferenceAudio(await readFile(input), reference));
    const probe = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", output], { encoding: "utf8", windowsHide: true }));
    assert.equal(probe.streams.filter(stream => stream.codec_type === "audio").length, 0);
    const pictures = file => run(["-i", file, "-map", "0:v:0", "-f", "framemd5", "pipe:1"]).toString();
    assert.equal(pictures(output), pictures(input));
    // A second pass on an already silent input also succeeds without an audio download.
    assert.ok((await applyGeneratedReferenceAudio(await readFile(output), reference)).length > 0);
    }
  } finally {
    if (previous === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
