import { escapeAssText, type SubtitleLayout } from "./captions.js";
import { SubtitleError, subtitlePlacementGeometry, type SubtitleCue, type SubtitlePlacement } from "./contracts.js";

export const EDITORIAL_FAMILY = "UGCPilot Editorial Study";
export const EDITORIAL_RENDER_VERSION = "editorial-v1";
export type EditorialFont = "lead" | "hero" | "support";
export type InkBounds = { left: number; top: number; width: number; height: number };
export type MeasureEditorial = (text: string, size: number, font: EditorialFont) => Promise<InkBounds>;
export type EditorialBlock = { indices: number[]; font: EditorialFont; size: number; x: number; y: number; ink: InkBounds };
export type EditorialPage = { cue: SubtitleCue; keywordIndex: number; blocks: EditorialBlock[] };
const ordinary = new Set("a an the if you're you your my our and but or is are was were be been of for to in on at with this that these those it its too much very up out do did can will".split(" "));

/** Predictable typography policy, not an inference about emotion or voice stress. */
export function selectEditorialKeyword(cue: SubtitleCue): number {
  let best = 0, score = -Infinity;
  cue.words.forEach((word, i) => {
    const clean = word.text.replace(/[^a-z']/giu, "");
    const candidate = clean.length + (/[a-z][A-Z]|[A-Z]{2}/u.test(clean) ? 8 : 0) - (ordinary.has(clean.toLowerCase()) ? 30 : 0);
    if (candidate > score) { score = candidate; best = i; }
  });
  return best;
}

export function editorialHeader(layout: Pick<SubtitleLayout, "width" | "height">) {
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${layout.width}\nPlayResY: ${layout.height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,${EDITORIAL_FAMILY},64,&H00F4F8FC,&H00F4F8FC,&H60251D17,&H80251D17,0,0,0,0,100,100,0,0,1,0.6,1,7,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
}
export const editorialFontTags = (font: EditorialFont) => `\\b${font === "hero" ? 900 : 500}\\i${font === "support" ? 0 : 1}`;
const label = (cue: SubtitleCue, indices: number[]) => indices.map(i => escapeAssText(cue.words[i].text)).join(" ");

export async function planEditorialPages(cues: SubtitleCue[], layout: SubtitleLayout, placement: SubtitlePlacement, measure: MeasureEditorial): Promise<EditorialPage[]> {
  const scale = Math.min(layout.width / 720, layout.height / 1280);
  const margin = Math.round(layout.width * .1), maxWidth = layout.width - margin * 2;
  const geometry = subtitlePlacementGeometry(placement);
  const regionTop = layout.height * geometry.editorialTop;
  const regionBottom = layout.height * geometry.editorialBottom;
  const pages: EditorialPage[] = [];
  for (const cue of cues) {
    const keywordIndex = selectEditorialKeyword(cue);
    let accepted: EditorialBlock[] | undefined;
    for (const reduction of [1, .85, .72, .6]) {
      const gap = Math.max(6, Math.round(14 * scale * reduction));
      const small = Math.max(16, Math.round(64 * scale * reduction));
      const tailSize = Math.max(16, Math.round(56 * scale * reduction));
      let heroSize = Math.max(24, Math.round(250 * scale * reduction));
      let hero = await measure(label(cue, [keywordIndex]), heroSize, "hero");
      while (hero.width > maxWidth && heroSize > small) {
        heroSize = Math.max(small, Math.floor(heroSize * .9));
        hero = await measure(label(cue, [keywordIndex]), heroSize, "hero");
      }
      if (hero.width > maxWidth) continue;
      const blocks: EditorialBlock[] = [];
      let y = 0, fits = true;
      async function rows(indices: number[], font: EditorialFont, size: number) {
        const lines: number[][] = [];
        for (const i of indices) {
          const last = lines.at(-1);
          if (last && (await measure(label(cue, [...last, i]), size, font)).width <= maxWidth) last.push(i);
          else lines.push([i]);
        }
        if (lines.length > 2) { fits = false; return; }
        for (const line of lines) {
          const ink = await measure(label(cue, line), size, font);
          if (ink.width > maxWidth) { fits = false; return; }
          blocks.push({ indices: line, font, size, x: margin - ink.left, y: y - ink.top, ink });
          y += ink.height + gap;
        }
      }
      await rows(cue.words.slice(0, keywordIndex).map((_, i) => i), "lead", small);
      const heroY = y;
      blocks.push({ indices: [keywordIndex], font: "hero", size: heroSize, x: margin - hero.left, y: heroY - hero.top, ink: hero });
      const after = cue.words.slice(keywordIndex + 1).map((_, i) => keywordIndex + i + 1);
      const tail = await Promise.all(after.map(i => measure(label(cue, [i]), tailSize, "support")));
      if (after.length && after.length <= 2 && hero.width + gap + Math.max(...tail.map(b => b.width)) <= maxWidth) {
        after.forEach((index, i) => blocks.push({ indices: [index], font: "support", size: tailSize,
          x: margin + hero.width + gap - tail[i].left, y: heroY + i * (tailSize * .7 + gap / 2) - tail[i].top, ink: tail[i] }));
        y += Math.max(hero.height, ...tail.map((ink, i) => i * (tailSize * .7 + gap / 2) + ink.height));
      } else { y += hero.height + gap; await rows(after, "support", tailSize); y -= gap; }
      // Painted bounds include actual italic overhang. Leave extra space for outline/shadow.
      const minY = Math.min(...blocks.map(b => b.y + b.ink.top));
      const maxY = Math.max(...blocks.map(b => b.y + b.ink.top + b.ink.height));
      if (!fits || maxY - minY + 8 > regionBottom - regionTop) continue;
      const offset = (regionTop + regionBottom - (maxY - minY)) / 2 - minY;
      blocks.forEach(b => { b.y += offset; });
      accepted = blocks; break;
    }
    if (!accepted) throw new SubtitleError("EDITORIAL_LAYOUT_UNSUPPORTED", "This phrase cannot fit the Editorial style. Choose another style; your transcript will be reused.");
    pages.push({ cue, keywordIndex, blocks: accepted });
  }
  return pages;
}

const assTime = (ms: number) => {
  const cs = Math.floor(ms / 10);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
/** Phrase context stays in fixed blocks. Only colour and the bounded keyword scale change. */
export function serializeEditorialAss(pages: EditorialPage[], layout: SubtitleLayout) {
  const events: string[] = [];
  for (const { cue, keywordIndex, blocks } of pages) {
    const hero = cue.words[keywordIndex];
    const popDuration = Math.max(1, Math.min(100, hero.endMs - hero.startMs, cue.endMs - hero.startMs));
    const boundaries = [...new Set([cue.startMs, cue.endMs, hero.startMs + popDuration,
      ...cue.words.flatMap(w => [w.startMs, Math.min(w.endMs, cue.endMs)])])].filter(t => t >= cue.startMs && t <= cue.endMs).sort((a, b) => a - b);
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i], end = boundaries[i + 1];
      if (Math.floor(end / 10) <= Math.floor(start / 10)) continue;
      for (const block of blocks) {
        let animation = "";
        if (block.font === "hero") {
          const elapsed = Math.max(0, Math.min(popDuration, start - hero.startMs));
          const scale = 94 + 6 * elapsed / popDuration;
          animation = `\\fscx${scale.toFixed(2)}\\fscy${scale.toFixed(2)}`;
          if (start >= hero.startMs && elapsed < popDuration) {
            const duration = Math.min(end - start, popDuration - elapsed);
            const target = (94 + 6 * (elapsed + duration) / popDuration).toFixed(2);
            animation += `\\t(0,${duration},\\fscx${target}\\fscy${target})`;
          }
        }
        const text = block.indices.map(index => {
          const w = cue.words[index], active = w.startMs <= start && start < w.endMs;
          return `{\\c&H00${active ? "E8D085" : "F4F8FC"}&}${escapeAssText(w.text)}`;
        }).join(" ");
        const tags = `\\an7\\pos(${Math.round(block.x)},${Math.round(block.y)})\\fs${block.size}${editorialFontTags(block.font)}${animation}`;
        events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,0,,{${tags}}${text}`);
      }
    }
  }
  return editorialHeader(layout) + events.join("\n") + "\n";
}
