import { readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
import { SubtitleError } from "./contracts.js";
import { runMediaCommand, type SubtitleTools } from "./media.js";

export type MeasuredInk = { left: number; top: number; width: number; height: number };
type Probe = { width: number; height: number; header: string; body: string; selectedFont: RegExp };
type Pending = { probe: Probe; resolve: (ink: MeasuredInk) => void; reject: (error: unknown) => void };
const BATCH_SIZE = 16;

/** One static libass event per frame. Batch only identical canvases/headers so
 * font sizing, stroke, clipping and ink thresholds match the single-frame probe.
 * The cache and files belong to this render, never another user's transcript. */
export function createBatchedInkMeasurer<Request>({ tools, workDir, signal, prefix, describe, key, fontError, emptyError }: {
  tools: SubtitleTools; workDir: string; signal?: AbortSignal; prefix: string;
  describe: (request: Request) => Probe; key: (request: Request) => string;
  fontError: string; emptyError: string;
}) {
  const cache = new Map<string, Promise<MeasuredInk>>();
  const pending: Pending[] = [];
  const renderId = randomUUID();
  let running = false, scheduled = false, batchNumber = 0;
  let failure: { error: unknown } | undefined;
  const measure = (request: Request): Promise<MeasuredInk> => {
    const cacheKey = key(request);
    let result = cache.get(cacheKey);
    if (!result) {
      result = new Promise<MeasuredInk>((resolve, reject) => {
        try { if (failure) throw failure.error; signal?.throwIfAborted(); pending.push({ probe: describe(request), resolve, reject }); }
        catch (error) { reject(error); }
      });
      cache.set(cacheKey, result);
      schedule();
    }
    return result;
  };
  return Object.assign(measure, { preload: async (requests: Request[]) => {
    const settled = await Promise.allSettled(requests.map(measure));
    for (const result of settled) if (result.status === "rejected") throw result.reason;
  } });

  function schedule() {
    if (running || scheduled || !pending.length) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; void flush(); });
  }
  async function flush() {
    running = true;
    try {
      while (pending.length) {
        const first = pending[0].probe, batch: Pending[] = [];
        for (let i = 0; i < pending.length && batch.length < BATCH_SIZE;) {
          const candidate = pending[i].probe;
          if (candidate.width === first.width && candidate.height === first.height && candidate.header === first.header) batch.push(...pending.splice(i, 1));
          else i++;
        }
        try {
          const bounds = await rasterize(batch, batchNumber++);
          batch.forEach((entry, i) => entry.resolve(bounds[i]));
        } catch (error) {
          failure = { error };
          [...batch, ...pending.splice(0)].forEach(entry => entry.reject(error));
        }
      }
    } finally { running = false; schedule(); }
  }
  async function rasterize(batch: Pending[], number: number) {
    signal?.throwIfAborted();
    const { width, height, header } = batch[0].probe;
    const name = `${prefix}-${renderId}-batch-${number}`, assPath = join(workDir, `${name}.ass`);
    const frames = batch.map((_, i) => join(workDir, `${name}-${String(i + 1).padStart(2, "0")}.png`));
    const second = (value: number) => `0:00:${String(value).padStart(2, "0")}.00`;
    let written = false;
    try {
      await writeFile(assPath, header + batch.map(({ probe }, i) =>
        `Dialogue: 0,${second(i)},${second(i + 1)},Caption,,0,0,0,,${probe.body}\n`).join(""), { flag: "wx" });
      written = true;
      const rendered = await runMediaCommand(tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "verbose", "-n", "-protocol_whitelist", "file,pipe",
        "-f", "lavfi", "-i", `color=c=black:s=${width}x${height}:r=1`, "-vf", `ass=${name}.ass:fontsdir=fonts`,
        "-frames:v", String(batch.length), "-threads", "1", `${name}-%02d.png`], { cwd: workDir, signal, timeoutMs: 15000 });
      if (/Glyph.*not found|fontselect: failed/iu.test(rendered.stderr) || batch.some(({ probe }) => !probe.selectedFont.test(rendered.stderr)))
        throw new SubtitleError("FONT_UNAVAILABLE", fontError);
      const bounds: MeasuredInk[] = [];
      // Decode one bounded frame at a time rather than retaining an entire atlas.
      for (const frame of frames) {
        signal?.throwIfAborted();
        const { data, info } = await sharp(await readFile(frame)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        if (info.width !== width || info.height !== height) throw new SubtitleError("MEDIA_PROCESSING_FAILED", "Text measurement did not preserve its canvas.");
        let left = width, right = -1, top = height, bottom = -1;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * info.channels] > 32) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right < 0) throw new SubtitleError("FONT_UNAVAILABLE", emptyError);
        bounds.push({ left: left - 64, top: top - 64, width: right >= width - 3 ? width * 2 : right - left + 1, height: bottom - top + 1 });
      }
      return bounds;
    } finally { if (written) await Promise.allSettled([assPath, ...frames].map(path => unlink(path))); }
  }
}
