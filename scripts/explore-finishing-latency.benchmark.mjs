import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { mock } from "node:test";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

// Isolated 720p, realistic-duration render simulation. No network, provider,
// upload, database or publishing. Run after the worker build with:
// node --experimental-test-module-mocks scripts/explore-finishing-latency.benchmark.mjs
const media = await import("../worker/dist/subtitles/media.js");
const commands=[];
mock.module("../worker/dist/subtitles/media.js", { namedExports:{...media,runMediaCommand:async (...args) => {
  const started=performance.now();
  try { return await media.runMediaCommand(...args); }
  finally { commands.push({encode:args[0] === ffmpeg,ms:Math.round(performance.now()-started),output:args[1].at(-1)?.split(/[\\/]/).at(-1)}); }
}} });
const {finishExploreVideo}=await import("../worker/dist/lib/explore-video-finishing.js");
await mkdir(resolve(".tmp"),{recursive:true});
const dir=await mkdtemp(join(resolve(".tmp"),"explore-latency-benchmark-"));
const tools={ffmpeg,ffprobe:ffprobe.path,fontsDir:resolve("worker/src/assets/fonts")};
const make = (name,seconds) => {
  const path=join(dir,`${name}.mp4`);
  execFileSync(ffmpeg,["-v","error","-n","-f","lavfi","-i",`testsrc2=size=720x1280:rate=30:duration=${seconds}`,"-f","lavfi","-i",`sine=frequency=440:duration=${seconds}`,"-c:v","libx264","-preset","veryfast","-crf","18","-pix_fmt","yuv420p","-c:a","aac",path],{windowsHide:true});
  return path;
};
const sourcePath=make("hook",3),demoPath=make("demo",18);
const reports=[];
for (const [name,options] of [
  ["hook without edit pass",{}],
  ["hook with text edit pass",{editing:{version:1,format:"hook",trimStartMs:0,trimEndMs:3000,originalVolume:1,musicVolume:.2,text:{value:"Hook message",width:.8,y:.1,fontSize:48,color:"#ffffff",startMs:0,endMs:3000}}}],
  ["hook and demo combined",{demoPath}],
]) {
  commands.length=0; const started=performance.now();
  const result=await finishExploreVideo({sourcePath,...options,workDir:join(dir,String(reports.length)),tools});
  reports.push({scenario:name,elapsedMs:Math.round(performance.now()-started),outputDurationMs:result.durationMs,encodes:commands.filter(command => command.encode),probes:commands.filter(command => !command.encode).length});
}
console.log(JSON.stringify({fixture:"720x1280/30fps, 3-second hook and 18-second demo; local CPU only",reports},null,2));
