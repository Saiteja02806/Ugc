import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createFormatTextSvg, formatTextLayout, formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "./explore-format-edit.js";
import { runMediaCommand, type SubtitleTools } from "../subtitles/media.js";

/** Shared by standalone edits and composition. User text remains in local
 * files rather than being interpolated into an FFmpeg filter graph. */
export async function prepareExploreFormatEditFilter(input: { width: number; height: number; durationMs: number; editing: ExploreFormatEdit; workDir: string; tools: SubtitleTools; sourceVideo?: string; sourceAudio?: string; firstImageInputIndex?: number }) {
  const edit = parseExploreFormatEdit(input.editing);
  if (edit.trimEndMs > input.durationMs + 50) throw new Error("The trim range extends beyond this video.");
  const durationMs = edit.trimEndMs - edit.trimStartMs;
  const videoFilters = [`trim=start=${edit.trimStartMs / 1000}:end=${edit.trimEndMs / 1000}`, "setpts=PTS-STARTPTS"];
  const overlays = formatTextOverlays(edit);
  const captionImages: string[] = [];
  const textLayers: { filter: string; inputIndex?: number }[] = [];
  if (overlays.some(text => text.preset !== "snapchat-classic")) await copyFile(join(input.tools.fontsDir, "arial-bold.ttf"), join(input.workDir, "format-font.ttf"));
  for (const [overlayIndex, text] of overlays.entries()) {
    const layout = formatTextLayout(text, input.width, input.height);
    if (!layout.fits) throw new Error("Your text does not fit. Reduce its size or move it higher.");
    if (text.preset === "snapchat-classic") {
      const file = `format-caption-${overlayIndex}.png`;
      await sharp(Buffer.from(createFormatTextSvg(text, input.width, input.height))).png().toFile(join(input.workDir, file));
      captionImages.push(file);
      textLayers.push({ inputIndex: (input.firstImageInputIndex ?? 1) + captionImages.length - 1, filter: `overlay=x=0:y=0:shortest=1:enable='gte(t,${text.startMs / 1000})*lt(t,${text.endMs / 1000})'` });
      continue;
    }
    const lineFilters: string[] = [];
    for (const [index, line] of layout.lines.entries()) {
      if (!line) continue;
      const file = `format-text-${overlayIndex}-${index}.txt`;
      await writeFile(join(input.workDir, file), line, { flag: "wx" });
      // User text is read from a file; none is interpolated into the filter graph.
      lineFilters.push(`drawtext=fontfile=format-font.ttf:textfile=${file}:expansion=none:fontsize=${layout.fontSize}:fontcolor=${text.color}:borderw=${Math.max(1, input.width / 540)}:bordercolor=black@0.8:x=(w-text_w)/2:y=${layout.y + index * layout.lineHeight}:enable='gte(t,${text.startMs / 1000})*lt(t,${text.endMs / 1000})'`);
    }
    if (lineFilters.length) textLayers.push({ filter: lineFilters.join(",") });
  }
  let filter = `[${input.sourceVideo ?? "0:v"}]${videoFilters.join(",")}[${textLayers.length ? "base" : "v"}]`;
  // Keep the same overlay order as the browser preview, including mixed presets.
  for (const [i, layer] of textLayers.entries()) {
    const imageInput = layer.inputIndex === undefined ? "" : `[${layer.inputIndex}:v]`;
    filter += `;[${i === 0 ? "base" : `text${i - 1}`}]${imageInput}${layer.filter}[${i === textLayers.length - 1 ? "v" : `text${i}`}]`;
  }
  filter += `;[${input.sourceAudio ?? "0:a"}]atrim=start=${edit.trimStartMs / 1000}:end=${edit.trimEndMs / 1000},asetpts=PTS-STARTPTS[a]`;
  return { filter, captionImages, durationMs };
}

export async function renderExploreFormatEdit(input: { sourcePath: string; width: number; height: number; durationMs: number; editing: ExploreFormatEdit; workDir: string; tools: SubtitleTools; signal?: AbortSignal }) {
  const { filter, captionImages, durationMs } = await prepareExploreFormatEditFilter(input);
  await writeFile(join(input.workDir, "format-edit.filter"), filter, { flag: "wx" });
  const outputPath = join(input.workDir, "format-edited.mp4");
  await runMediaCommand(input.tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-protocol_whitelist", "file,pipe", "-i", input.sourcePath,
    ...captionImages.flatMap(file => ["-loop", "1", "-framerate", "30", "-i", file]),
    "-filter_complex_script", "format-edit.filter", "-map", "[v]", "-map", "[a]", "-t", String(durationMs / 1000), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", outputPath], { cwd: input.workDir, signal: input.signal });
  return { outputPath, durationMs };
}
