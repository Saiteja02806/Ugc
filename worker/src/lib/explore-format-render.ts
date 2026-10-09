import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatTextLayout, formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "./explore-format-edit.js";
import { runMediaCommand, type SubtitleTools } from "../subtitles/media.js";

export async function renderExploreFormatEdit(input: { sourcePath: string; width: number; height: number; durationMs: number; editing: ExploreFormatEdit; workDir: string; tools: SubtitleTools; signal?: AbortSignal }) {
  const edit = parseExploreFormatEdit(input.editing);
  if (edit.trimEndMs > input.durationMs + 50) throw new Error("The trim range extends beyond this video.");
  const durationMs = edit.trimEndMs - edit.trimStartMs;
  const videoFilters = [`trim=start=${edit.trimStartMs / 1000}:end=${edit.trimEndMs / 1000}`, "setpts=PTS-STARTPTS"];
  const overlays = formatTextOverlays(edit);
  if (overlays.length) await copyFile(join(input.tools.fontsDir, "arial-bold.ttf"), join(input.workDir, "format-font.ttf"));
  for (const [overlayIndex, text] of overlays.entries()) {
    const layout = formatTextLayout(text, input.width, input.height);
    if (!layout.fits) throw new Error("Your text does not fit. Reduce its size or move it higher.");
    for (const [index, line] of layout.lines.entries()) {
      if (!line) continue;
      const file = `format-text-${overlayIndex}-${index}.txt`;
      await writeFile(join(input.workDir, file), line, { flag: "wx" });
      // User text is read from a file; none is interpolated into the filter graph.
      videoFilters.push(`drawtext=fontfile=format-font.ttf:textfile=${file}:expansion=none:fontsize=${layout.fontSize}:fontcolor=${text.color}:borderw=${Math.max(1, input.width / 540)}:bordercolor=black@0.8:x=(w-text_w)/2:y=${layout.y + index * layout.lineHeight}:enable='gte(t,${text.startMs / 1000})*lt(t,${text.endMs / 1000})'`);
    }
  }
  const filter = `[0:v]${videoFilters.join(",")}[v];[0:a]atrim=start=${edit.trimStartMs / 1000}:end=${edit.trimEndMs / 1000},asetpts=PTS-STARTPTS[a]`;
  await writeFile(join(input.workDir, "format-edit.filter"), filter, { flag: "wx" });
  const outputPath = join(input.workDir, "format-edited.mp4");
  await runMediaCommand(input.tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-protocol_whitelist", "file,pipe", "-i", input.sourcePath,
    "-filter_complex_script", "format-edit.filter", "-map", "[v]", "-map", "[a]", "-t", String(durationMs / 1000), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", outputPath], { cwd: input.workDir, signal: input.signal });
  return { outputPath, durationMs };
}
