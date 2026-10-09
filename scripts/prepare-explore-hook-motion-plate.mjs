// Move the real demonstration directly after the four-second opening.
// Range endpoints are exclusive and come from decoded v4 footage, not rounded
// stage-duration arithmetic. Source media stays read only.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const { values } = parseArgs({ options: {
  source: { type: "string" },
  output: { type: "string", default: "design/explore-hook-motion/Media/cover-plate-v5.mp4" },
  timeline: { type: "string", default: "design/explore-hook-motion/timeline-v5.json" },
} });
if (!values.source || !ffmpeg) throw new Error("Pass --source with the uncaptioned v4 montage.");
const source = path.resolve(values.source);
const output = path.resolve(values.output);
if (source === output) throw new Error("The reordered plate must not overwrite its source.");
mkdirSync(path.dirname(output), { recursive: true });
mkdirSync(path.dirname(path.resolve(values.timeline)), { recursive: true });
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Plate preparation failed.");
  return result.stdout;
}
function verify(file) {
  const streams = JSON.parse(run(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file])).streams;
  const video = streams.find((stream) => stream.codec_type === "video");
  if (!video || video.width !== 960 || video.height !== 540 || video.r_frame_rate !== "24/1" || Number(video.nb_frames) !== 404) {
    throw new Error("The montage must be 960x540, 404 frames at 24 fps.");
  }
  return streams;
}
verify(source);
const ranges = [
  { name: "talking-hook-intro", start: 0, end: 96 },
  { name: "demo", start: 259, end: 319 },
  { name: "creator-examples", start: 96, end: 259 },
  { name: "horizontal-and-diagonal-return", start: 319, end: 404 },
];
const filters = ["[0:v]split=4[a][b][c][d]"];
ranges.forEach((range, index) => filters.push(
  `[${"abcd"[index]}]trim=start_frame=${range.start}:end_frame=${range.end},setpts=N/(24*TB)[s${index}]`,
));
filters.push(
  "[s0][s1][s2][s3]concat=n=4:v=1:a=0,setpts=N/(24*TB),setsar=1[ordered]",
  "color=c=black:s=960x540:r=24,format=rgba,geq=r='0':g='0':b='0':a='160*clip((Y-280)/260,0,1)'[shade]",
  "[ordered][shade]overlay=shortest=1:enable='lt(n,156)',format=yuv420p[out]",
);
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", source,
  "-filter_complex_threads", "2", "-filter_complex", filters.join(";"), "-map", "[out]", "-an",
  "-frames:v", "404", "-r", "24", "-c:v", "libx264", "-preset", "fast", "-crf", "17",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", output]);
if (verify(output).some((stream) => stream.codec_type === "audio")) throw new Error("The plate must be silent.");
run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", output, "-f", "null", "-"]);
const previous = JSON.parse(readFileSync("public/explore/covers/create-hook-v4.json", "utf8"));
let cursor = 0;
const stages = ranges.map((range) => {
  const stage = { name: range.name, startFrame: cursor, endFrame: cursor + range.end - range.start,
    frames: range.end - range.start, sourceStartFrame: range.start, sourceEndFrame: range.end };
  cursor = stage.endFrame;
  return stage;
});
writeFileSync(values.timeline, JSON.stringify({
  ...previous, stages,
  demo: { ...previous.demo, startFrame: 96, endFrame: 156 },
  captions: [{ text: "Create a talking hook video", start: 0, end: 4 },
    { text: "Add your own demo", start: 4, end: 6.5 }],
  motion: { ...previous.motion,
    project: "design/explore-hook-motion/Explore Hook Cover — Editorial Motion v5.aep", numericKeys: 30,
    keyword: "2px outline-to-fill reveal; hook fills over 0.5s, demo over 0.4s; 94% to 100% settle",
    supportingText: "staged opening lead; immediate readable demo lead; 0.125-second coordinated exit",
    demonstrationHandoff: "actual demo and its title start together at frame 96, immediately after the opening",
  },
}, null, 2) + "\n");
console.log("Prepared continuous plate: hook 0–4s, real demo 4–6.5s, remaining examples, seamless return.");
