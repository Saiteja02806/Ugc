// Source-versus-layout PNG evidence only. No video or provider generation.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import catalog from '../lib/explore/reference-text-catalog.json' with { type: 'json' };
import { wallTextProfile, initialWallText, initialWallRegions, initialWallHeadingBody } from '../worker/dist/lib/wall-initial-text-layout.js';
import { createOutlinedFormatTextSvg } from '../worker/dist/lib/explore-text-outlines.js';
const base = path.resolve('outputs/wall-layout-batch-20261028');
const out = path.join(base, 'complete-review'); fs.mkdirSync(out, { recursive: true });
const inventory = JSON.parse(fs.readFileSync(path.join(base, 'all-source-review-inventory.json')));
const excluded = new Set(['06', '08', '09', '21', '28', '59'].map(n => 'explore-wall-text-' + n));
const manifest = [];
for (const item of inventory.filter(item => !excluded.has(item.id))) {
  const profile = wallTextProfile(item.id, item.sha256);
  const source = catalog.items.find(row => row.referenceId === item.id);
  const suffix = item.id.split('-').at(-1);
  const candidates = [path.resolve('outputs/wall-review-agent-a/temporal/wall' + suffix + '/frames/frame_000001.jpg'), path.join(base, 'audit-' + item.id, 'frames/frame_000001.jpg'), path.join(base, 'nonnumbered-full-samples', item.id, 'frames/frame_000001.jpg'), path.join(base, 'paired-full-samples', item.id, 'frames/frame_000001.jpg'), path.join(base, 'wall' + suffix + '-frames/frames/frame_000001.jpg')];
  let opening = candidates.find(file => fs.existsSync(file));
  if (!opening && fs.existsSync(item.path)) {
    opening = path.join(out, item.id + '-opening.png');
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', item.path, '-frames:v', '1', opening], { windowsHide: true });
  }
  if (!opening) { manifest.push({ id: item.id, error: 'Opening PNG not found', candidates }); continue; }
  const words = source.blocks[0].text, duration = Math.round(item.duration * 1000);
  const [heading, ...body] = words.split('\n');
  const layers = profile.regions ? initialWallRegions(words, profile, duration) : profile.structure ? initialWallHeadingBody(heading, body.join('\n').trim(), profile, duration, 1) : [initialWallText(words, profile, duration)];
  const overlays = await Promise.all(layers.map(async text => ({ input: Buffer.from(await createOutlinedFormatTextSvg(text, 1080, 1920, path.resolve('worker/src/assets/fonts'))) })));
  const full = await sharp({ create: { width: 1080, height: 1920, channels: 4, background: '#292b31' } }).composite(overlays).png().toBuffer();
  const rendered = await sharp(full).resize(270, 480).png().toBuffer();
  const original = await sharp(opening).resize(270, 480).png().toBuffer();
  const file = path.join(out, item.id + '.png');
  await sharp({ create: { width: 540, height: 505, channels: 4, background: '#151515' } }).composite([{ input: original, left: 0, top: 25 }, { input: rendered, left: 270, top: 25 }, { input: Buffer.from(`<svg width="540" height="25"><text x="6" y="17" fill="white" font-size="12">${item.id} | source / local layout</text></svg>`), top: 0, left: 0 }]).png().toFile(file);
  manifest.push({ id: item.id, sourceSha256: item.sha256, opening, comparison: file, layers: layers.length, durationMs: duration });
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
for (let i = 0; i < manifest.length; i += 6) {
  const batch = manifest.slice(i, i + 6).filter(row => row.comparison);
  await sharp({ create: { width: 1620, height: 1010, channels: 4, background: '#151515' } }).composite(batch.map((row, n) => ({ input: row.comparison, left: (n % 3) * 540, top: Math.floor(n / 3) * 505 }))).png().toFile(path.join(out, `sheet-${String(i / 6 + 1).padStart(2, '0')}.png`));
}
console.log(JSON.stringify({ rendered: manifest.filter(row => row.comparison).length, missing: manifest.filter(row => row.error).map(row => row.id) }));
