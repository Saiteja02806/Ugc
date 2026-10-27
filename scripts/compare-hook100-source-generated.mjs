// Local forensic comparison only. No inference, retiming of originals or app changes.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const threeSecond = process.argv[2] === '--three-second';
if (process.argv.length > 2 && !threeSecond || process.argv.length > 3) throw Error('Unsupported comparison selection.');
const folder = resolve('outputs/hook100-full-recreation-trial-2026-10-26/caption-v2', threeSecond ? 'motion-3s-v1' : '.');
const duration = threeSecond ? 3 : 4;
const sourceScale = threeSecond ? 3 / (112 / 30) : 1;
const out = join(folder, 'source-comparison');
await mkdir(out, { recursive: true });
const receipt = JSON.parse(await readFile(join(folder, 'trial-receipt.json'), 'utf8'));
const source = receipt.sourceFile, generated = receipt.videoFile;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(await readFile(source)) !== receipt.sourceSha256 || hash(await readFile(generated)) !== receipt.videoSha256) throw Error('Source/output bytes changed.');
const run = args => execFileSync(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true, maxBuffer: 64 * 1024 ** 2 });
const probe = file => JSON.parse(execFileSync(ffprobe.path, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { windowsHide: true, encoding: 'utf8' }));
const svg = (width, height, texts) => Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#171717"/>${texts.map(t => `<text x="${t.x}" y="${t.y}" font-family="Arial" font-size="${t.size ?? 24}" fill="${t.color ?? '#ffffff'}">${t.text}</text>`).join('')}</svg>`);
const header = join(out, 'comparison-header.png'), footer = join(out, 'comparison-footer.png');
await sharp(svg(1080, 70, [{ x: 18, y: 32, text: 'ORIGINAL SOURCE', size: 24 }, { x: 558, y: 32, text: 'GENERATED VIDEO', size: 24 },
  { x: 18, y: 57, text: threeSecond ? 'Full source at 1.244x speed for 3 s mapping' : '3.733 s - original timing', size: 17 }, { x: 558, y: 57, text: `${duration.toFixed(3)} s - actual generated timing`, size: 17 }])).png().toFile(header);
await sharp(svg(1080, 30, [{ x: 14, y: 21, text: threeSecond ? 'Left: entire 3.733 s source compressed to 3 s for action comparison. Right unchanged. Both muted.' : 'Same elapsed clock. Left ends at 3.733 s; its final frame is held for comparison only. Both muted.', size: 17 }])).png().toFile(footer);
const video = join(out, threeSecond ? 'source-vs-generated-retimed-3s.mp4' : 'source-vs-generated-same-clock.mp4');
run(['-y', '-i', source, '-i', generated, '-loop', '1', '-i', header, '-loop', '1', '-i', footer,
  '-filter_complex', `[0:v]setpts=${sourceScale}*(PTS-STARTPTS),fps=24,scale=540:960:flags=lanczos,tpad=stop_mode=clone:stop_duration=0.3,trim=duration=${duration}[left];[1:v]setpts=PTS-STARTPTS,fps=24,scale=540:960:flags=lanczos,trim=duration=${duration}[right];[left][right]hstack=inputs=2,pad=1080:1060:0:70:color=0x171717[stack];[stack][2:v]overlay=0:0[headed];[headed][3:v]overlay=0:1030[out]`,
  '-map', '[out]', '-an', '-t', String(duration), '-r', '24', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video]);
const sourceFrames = resolve('.tmp/middle-frame-audit-20261025-native/public', receipt.referenceId, 'frames');
const generatedFrames = join(folder, 'video-frames/frames');
const moments = threeSecond ? [0, .5, .75, 1.3, 1.55, 2, 2.4, 71 / 24] : [0, .75, 1.25, 1.9, 2.333333, 2.9, 3.708333, 3.75];
const pairs = [];
for (let page = 0; page < 2; page++) {
  const tiles = [];
  for (let p = 0; p < 4; p++) {
    const target = moments[page * 4 + p];
    const indices = [Math.min(111, Math.round(target / sourceScale * 30)), Math.min(duration * 24 - 1, Math.round(target * 24))];
    const x = p % 2 * 540, y = Math.floor(p / 2) * 520;
    for (let side = 0; side < 2; side++) {
      const index = indices[side], fps = side ? 24 : 30;
      const image = await sharp(join(side ? generatedFrames : sourceFrames, `frame_${String(index + 1).padStart(6, '0')}.jpg`)).resize(270, 480, { fit: 'contain', background: '#111111' }).toBuffer();
      const label = `${side ? 'Generated' : target >= 3.733333 ? 'Source ended / held' : 'Source'} ${ (index / fps).toFixed(3) }s`;
      tiles.push({ input: image, left: x + side * 270, top: y });
      tiles.push({ input: await sharp(svg(270, 40, [{ x: 9, y: 26, text: label, size: 17 }])).png().toBuffer(), left: x + side * 270, top: y + 480 });
    }
    pairs.push({ requestedElapsedTimeSeconds: target, sourceFrameIndex: indices[0], sourceFrameElapsedSeconds: indices[0] / 30,
      generatedFrameIndex: indices[1], generatedFrameElapsedSeconds: indices[1] / 24, sourceEnded: target >= 3.733333 });
  }
  await sharp({ create: { width: 1080, height: 1040, channels: 3, background: '#171717' } }).composite(tiles).png().toFile(join(out, `paired-moments-${page + 1}.png`));
}
const output = probe(video);
await writeFile(join(out, 'comparison-preview.png'), run(['-i', video, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1']));
const summary = { source, sourceSha256: receipt.sourceSha256, sourceProbe: probe(source), generated, generatedSha256: receipt.videoSha256,
  generatedProbe: probe(generated), comparison: video, comparisonDurationSeconds: Number(output.format.duration), comparisonFps: 24,
  comparisonHasAudio: output.streams.some(s => s.codec_type === 'audio'), pairs,
  displayNote: threeSecond ? 'Source playback compressed from 3.733333 to 3 seconds (1.244x) in this comparison derivative only. Generated video is unretimed; originals unchanged.' : 'Both clocks start at first decoded picture. Source is resampled to 24 fps only in this derivative; no action is accelerated. Last source picture held after 3.733 s to expose the 4-second output tail. Originals unchanged.' };
await writeFile(join(out, 'comparison-manifest.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ comparison: video, duration: summary.comparisonDurationSeconds, dimensions: output.streams[0].width + 'x' + output.streams[0].height,
  sourceVideoFrames: probe(source).streams.find(s => s.codec_type === 'video').nb_frames, generatedVideoFrames: probe(generated).streams[0].nb_frames, paidRequests: 0 }));
