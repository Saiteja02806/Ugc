// Render the owner's three supplied portrait clips into one lightweight cover.
// Source files are read only; all intermediate renders stay in the workspace.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const { values } = parseArgs({ options: {
  input: { type: "string" },
  demo: { type: "string" },
  "demo-start": { type: "string", default: "2" },
  output: { type: "string", default: "public/explore/covers" },
  temporary: { type: "string", default: ".tmp/explore-hook-cover" },
} });
if (!values.input) throw new Error("Pass --input with the folder containing format1 (1), (2) and (3).mp4.");
if (!ffmpeg) throw new Error("ffmpeg-static is required.");

const input = path.resolve(values.input);
const output = path.resolve(values.output);
const temporary = path.resolve(values.temporary);
for (const destination of [output, temporary]) {
  const relative = path.relative(input, destination);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("Outputs must be outside the supplied source folder.");
  }
  mkdirSync(destination, { recursive: true });
}
const sources = [1, 2, 3].map((number) => path.join(input, `format1 (${number}).mp4`));
sources.forEach((source) => statSync(source));
const demoSource = values.demo ? path.resolve(values.demo) : null;
if (demoSource) statSync(demoSource);
const demoStart = Number(values["demo-start"]);
if (!Number.isFinite(demoStart) || demoStart < 0) throw new Error("Demo start must be a non-negative number.");
const basename = demoSource ? "create-hook-v3" : "create-hook-v1";
const WIDTH = 960;
const HEIGHT = 540;
const FPS = 24;
const TRANSITION_FRAMES = 10;
const EXCERPT_START_SECONDS = 1;
const EXCERPT_FRAMES = 3 * FPS;
const focusY = [0.4, 0.5, 0.36];
const transitionDuration = TRANSITION_FRAMES / FPS;

function run(executable, args, diagnostics) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (diagnostics) writeFileSync(diagnostics, result.stderr ?? "");
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Media preparation failed.");
  return result.stdout;
}
function probe(file) {
  return JSON.parse(run(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
}
function render(inputs, filters, frames, file, crf = "18") {
  run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...inputs,
    "-filter_complex_threads", "2", "-filter_complex", filters, "-map", "[out]", "-an",
    "-frames:v", String(frames), "-r", String(FPS), "-c:v", "libx264", "-preset", "fast",
    "-crf", crf, "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
  console.log(`Prepared ${path.basename(file)} (${frames} frames).`);
}
const sourceFrames = sources.map((source) => {
  const video = probe(source).streams.find((stream) => stream.codec_type === "video");
  return Math.round(Number(video.duration) * FPS);
});
const stages = [];
if (sourceFrames.some((frames) => frames < EXCERPT_START_SECONDS * FPS + EXCERPT_FRAMES)) {
  throw new Error("Each supplied clip must contain the chosen three-second excerpt.");
}

// Diagonal triptych: each portrait stays centered within its own angled slice.
const diagonal = path.join(temporary, "diagonal.mp4");
const diagonalFilters = sources.map((_, index) =>
  `[${index}:v]fps=${FPS},setpts=PTS-STARTPTS,scale=-2:960,crop=${[432, 504, 392][index]}:${HEIGHT}:${[100, 18, 8][index]}:${[130, 210, 100][index]},pad=${WIDTH}:${HEIGHT}:${[0, 248, 568][index]}:0:color=black[canvas${index}]`
);
diagonalFilters.push(
  "[canvas1]format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(between(X,432-184*Y/540,752-184*Y/540),255,0)'[middle]",
  "[canvas2]format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(gte(X,752-184*Y/540),255,0)'[right]",
  "[canvas0][middle]overlay=shortest=1[pair]",
  "[pair][right]overlay=shortest=1,format=yuv420p[out]",
);
render(sources.flatMap((source) => ["-ss", String(EXCERPT_START_SECONDS), "-i", source]), diagonalFilters.join(";"), 72, diagonal);
stages.push({ name: "diagonal", file: diagonal, frames: 72 });

// Sharp, edge-to-edge excerpts. Crop around each creator's face; no letterbox,
// duplicate background or blurred fill. Footage keeps moving through dissolves.
for (const [index, source] of sources.entries()) {
  const file = path.join(temporary, `solo-${index + 1}.mp4`);
  const filters = [
    `[0:v]fps=${FPS},trim=end_frame=${EXCERPT_FRAMES},setpts=PTS-STARTPTS,scale=${WIDTH}:-2,crop=${WIDTH}:${HEIGHT}:0:ih*${focusY[index]}-oh/2,format=yuv420p[out]`,
  ];
  const frames = EXCERPT_FRAMES;
  render(["-ss", String(EXCERPT_START_SECONDS), "-i", source], filters.join(";"), frames, file);
  stages.push({ name: `video-${index + 1}`, file, frames });
}

// The real app demo fills the same wide cover as the creator examples.
// Its caption is overlaid on footage rather than reserving a blank side panel.
const DEMO_FRAMES = 60;
if (demoSource) {
  const duration = Number(probe(demoSource).format.duration);
  if (demoStart + DEMO_FRAMES / FPS > duration) throw new Error("The selected demo excerpt exceeds the source duration.");
  const file = path.join(temporary, "demo.mp4");
  render(["-ss", String(demoStart), "-i", demoSource],
    `[0:v]fps=${FPS},trim=end_frame=${DEMO_FRAMES},setpts=PTS-STARTPTS,scale=${WIDTH}:-2,crop=${WIDTH}:${HEIGHT}:0:ih*0.5-oh/2,setsar=1,format=yuv420p[out]`,
    DEMO_FRAMES, file);
  stages.push({ name: "demo", file, frames: DEMO_FRAMES });
}

// Three sharp horizontal crops span the whole cover, as in the owner's sketch.
const horizontal = path.join(temporary, "horizontal.mp4");
const horizontalFilters = sources.map((_, index) =>
  `[${index}:v]fps=${FPS},setpts=PTS-STARTPTS,scale=${WIDTH}:-2,crop=${WIDTH}:180:0:ih*${focusY[index]}-oh/2[band${index}]`
);
horizontalFilters.push("[band0][band1][band2]vstack=inputs=3,format=yuv420p[out]");
render(sources.flatMap((source) => ["-stream_loop", "-1", "-i", source]), horizontalFilters.join(";"), 72, horizontal);
stages.push({ name: "horizontal", file: horizontal, frames: 72 });

const poster = path.join(output, `${basename}.webp`);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", diagonal, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", poster]);
const closing = path.join(temporary, "loop-return.mp4");
// The closing diagonal plays source seconds 0..1, followed directly by the
// opening diagonal at source second 1 when the browser loops the file.
render(sources.flatMap((source) => ["-i", source]), diagonalFilters.join(";"), FPS, closing);
stages.push({ name: "return-to-diagonal", file: closing, frames: FPS });

const joinFilters = stages.map((_, index) => `[${index}:v]setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v${index}]`);
let totalFrames = stages[0].frames;
let demoStartFrame = null;
for (let index = 1; index < stages.length; index++) {
  const previous = index === 1 ? "v0" : `joined${index - 1}`;
  const next = index === stages.length - 1 ? "out" : `joined${index}`;
  const touchesDemo = stages[index].name === "demo" || stages[index - 1].name === "demo";
  if (stages[index].name === "demo") demoStartFrame = totalFrames;
  if (touchesDemo) {
    // Clean cuts bound the real demo and its caption to exactly the same frames.
    joinFilters.push(`[${previous}][v${index}]concat=n=2:v=1:a=0[${next}]`);
    totalFrames += stages[index].frames;
  } else {
    joinFilters.push(`[${previous}][v${index}]xfade=transition=fade:duration=${transitionDuration}:offset=${(totalFrames - TRANSITION_FRAMES) / FPS}[${next}]`);
    totalFrames += stages[index].frames - TRANSITION_FRAMES;
  }
}
const video = path.join(output, `${basename}.mp4`);
const baseVideo = demoSource ? path.join(temporary, "cover-with-demo.mp4") : video;
render(stages.flatMap((stage) => ["-i", stage.file]), joinFilters.join(";"), totalFrames, baseVideo, "23");

const captions = [];
if (demoSource) {
  const fonts = path.resolve("worker/src/assets/fonts/subtitle-editorial");
  for (const name of ["editorial-500.ttf", "editorial-500i.ttf", "editorial-900i.ttf", "OFL.txt"]) statSync(path.join(fonts, name));
  const demoBegin = demoStartFrame / FPS;
  const demoEnd = (demoStartFrame + DEMO_FRAMES) / FPS;
  captions.push(
    { text: "Create a talking hook video", start: 0.25, end: 4.5 },
    { text: "Add your own demo", start: demoBegin, end: demoEnd },
  );
  const time = (seconds) => {
    const centiseconds = Math.round(seconds * 100);
    return `0:${String(Math.floor(centiseconds / 6000)).padStart(2, "0")}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
  };
  const lines = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${WIDTH}`, `PlayResY: ${HEIGHT}`, "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Editorial,UGCPilot Editorial Study,52,&H00ECF8FF,&H00ECF8FF,&H60131307,&H80131307,500,0,0,0,100,100,0,0,1,1.2,1.4,1,0,0,0,1", "",
    "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const event = (start, end, tags, text) => lines.push(`Dialogue: 0,${time(start)},${time(end)},Editorial,,0,0,0,,{${tags}\\fad(100,200)}${text}`);
  const lead = "\\an1\\move(56,432,56,422,0,220)\\fs52\\b500\\i1";
  const hero = "\\an1\\pos(56,528)\\fs154\\b900\\i1\\c&H00E5D89D&\\fscx94\\fscy94\\t(0,180,\\fscx100\\fscy100)";
  event(0.25, 4.5, lead, "Create a talking");
  // One shaped hero row preserves natural spacing and italic overhang.
  event(0.25, 4.5, hero, "hook{\\fs52\\b500\\i0\\c&H00ECF8FF&} video");
  event(demoBegin, demoEnd, lead, "Add your own");
  event(demoBegin, demoEnd, hero, "demo");
  const ass = path.join(temporary, "editorial-captions.ass");
  writeFileSync(ass, lines.join("\n") + "\n");
  const escaped = (value) => value.replaceAll("\\", "/").replaceAll(":", "\\:").replaceAll("'", "\\'");
  const log = path.join(temporary, "editorial-render.log");
  const filters = `color=c=black:s=${WIDTH}x${HEIGHT}:r=${FPS},format=rgba,geq=r='0':g='0':b='0':a='177*clip((Y-300)/240,0,1)'[shade];[0:v][shade]overlay=enable='between(t,0.25,4.5)+between(t,${demoBegin},${demoEnd})'[shaded];[shaded]ass=filename='${escaped(ass)}':fontsdir='${escaped(fonts)}'[out]`;
  run(ffmpeg, ["-hide_banner", "-loglevel", "info", "-y", "-i", baseVideo,
    "-filter_complex_threads", "2", "-filter_complex", filters, "-map", "[out]", "-an", "-frames:v", String(totalFrames),
    "-r", String(FPS), "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video], log);
  const fontLog = readFileSync(log, "utf8");
  if (!["UGCPilot-Editorial-Study-Medium", "UGCPilot-Editorial-Study-Black-Italic"].every((font) => fontLog.includes(font))) {
    throw new Error("The intended Editorial Serif fonts were not selected by the renderer.");
  }
  run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", "1.25", "-i", video, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", poster]);
}
const result = probe(video);
const encodedVideo = result.streams.find((stream) => stream.codec_type === "video");
if (encodedVideo.width !== WIDTH || encodedVideo.height !== HEIGHT || Number(encodedVideo.nb_frames) !== totalFrames || result.streams.some((stream) => stream.codec_type === "audio")) {
  throw new Error("The final cover's dimensions, frame count or silent playback contract do not match.");
}
// The MP4 index must come before media bytes for immediate browser playback.
const bytes = readFileSync(video);
let foundIndex = false;
for (let offset = 0; offset + 8 <= bytes.length;) {
  const length = bytes.readUInt32BE(offset);
  const type = bytes.toString("ascii", offset + 4, offset + 8);
  if (type === "moov") { foundIndex = true; break; }
  if (type === "mdat" || length < 8) break;
  offset += length;
}
if (!foundIndex) throw new Error("The final MP4 is missing fast-start metadata.");
writeFileSync(path.join(output, `${basename}.json`), JSON.stringify({
  width: WIDTH, height: HEIGHT, fps: FPS, frames: totalFrames, duration: totalFrames / FPS,
  video: path.basename(video), poster: path.basename(poster), bytes: statSync(video).size,
  sources: sources.map((source, index) => ({ name: path.basename(source), frames: sourceFrames[index] })),
  excerptStartSeconds: EXCERPT_START_SECONDS, excerptFrames: EXCERPT_FRAMES,
  stages: stages.map(({ name, frames }) => ({ name, frames })), transitionFrames: TRANSITION_FRAMES,
  ...(demoSource ? {
    demo: { name: path.basename(demoSource), sourceStart: demoStart, startFrame: demoStartFrame, endFrame: demoStartFrame + DEMO_FRAMES, frames: DEMO_FRAMES, duration: DEMO_FRAMES / FPS, framing: "edge-to-edge sharp crop with caption over the footage" },
    captions, captionStyle: "compact editorial serif, ivory support and heavy italic pale-teal keyword",
  } : {}),
}, null, 2) + "\n");
console.log(`Verified silent ${WIDTH}x${HEIGHT} cover: ${(totalFrames / FPS).toFixed(2)}s, ${(statSync(video).size / 1024 / 1024).toFixed(2)} MiB, fast start.`);
