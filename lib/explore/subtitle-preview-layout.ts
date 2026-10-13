import { getSubtitleLayout, groupSubtitleWords } from "../../worker/src/subtitles/captions.ts";
import { groupNaturalSubtitleWords } from "../../worker/src/subtitles/phrases.ts";
import { groupSerifBoxPhrases, SERIF_BOX_FAMILY, serifBoxAnchor } from "../../worker/src/subtitles/serif-box-policy.ts";
import { planEditorialPages, EDITORIAL_FAMILY, type EditorialBlock, type EditorialFont } from "../../worker/src/subtitles/editorial.ts";
import { subtitlePlacementGeometry, type SubtitleCue } from "../../worker/src/subtitles/contracts.ts";
import { correctSubtitleTranscript } from "../../worker/src/subtitles/corrections.ts";
import type { SequenceCaptions } from "../../components/explore/workflow-caption-overlay";

export type PreviewWord = { index: number; x: number; y: number; width: number };
export type PreviewPage = { cue: SubtitleCue; size: number; words: PreviewWord[]; boxes: { x: number; y: number; width: number; height: number }[]; editorial?: EditorialBlock[] };
export type CaptionPreviewLayout = { pages: PreviewPage[]; font: string; bold: boolean; size: number };
const fontLoads = new Map<string, Promise<number>>();

/** libass sizes fonts by their ascender/descender span, CSS by units per em. */
async function loadFont(family: string, file: string, descriptors: FontFaceDescriptors = {}) {
  let pending = fontLoads.get(file);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(file);
      if (!response.ok) throw new Error("The subtitle preview font could not load. Reopen caption review to try again.");
      const bytes = await response.arrayBuffer(), view = new DataView(bytes);
      let units = 1000, ascent = 1000, descent = 0;
      for (let i = 0; i < view.getUint16(4); i++) {
        const start = 12 + i * 16, tag = String.fromCharCode(...new Uint8Array(bytes, start, 4)), offset = view.getUint32(start + 8);
        if (tag === "head") units = view.getUint16(offset + 18);
        if (tag === "hhea") { ascent = view.getInt16(offset + 4); descent = view.getInt16(offset + 6); }
      }
      const face = await new FontFace(family, bytes, descriptors).load();
      document.fonts.add(face);
      return units / (ascent - descent);
    })();
    fontLoads.set(file, pending);
    void pending.catch(() => fontLoads.delete(file));
  }
  return pending;
}

export async function buildCaptionPreviewLayout(captions: SequenceCaptions, width: number, height: number): Promise<CaptionPreviewLayout> {
  const layout = getSubtitleLayout(width, height, captions.style);
  const context = document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("The caption preview could not load in this browser.");
  const serif = captions.style === "serif-box", editorial = captions.style === "editorial";
  let ratio = 1, font = "Arial";
  const editorialRatios: Partial<Record<EditorialFont, number>> = {};
  if (serif) { font = SERIF_BOX_FAMILY; ratio = await loadFont(font, "/subtitle-fonts/serif/InstrumentSerif-Regular.ttf"); }
  if (editorial) {
    font = EDITORIAL_FAMILY;
    const values = await Promise.all([
      loadFont(font, "/subtitle-fonts/editorial/editorial-500i.ttf", { weight: "500", style: "italic" }),
      loadFont(font, "/subtitle-fonts/editorial/editorial-900i.ttf", { weight: "900", style: "italic" }),
      loadFont(font, "/subtitle-fonts/editorial/editorial-500.ttf", { weight: "500", style: "normal" }),
    ]);
    [editorialRatios.lead, editorialRatios.hero, editorialRatios.support] = values;
  }
  function setFont(size: number, role?: EditorialFont) {
    context!.font = role ? `${role === "support" ? "normal" : "italic"} ${role === "hero" ? 900 : 500} ${size * (editorialRatios[role] ?? 1)}px "${font}"`
      : `${layout.bold ? "bold " : ""}${size * ratio}px "${font}"`;
  }
  setFont(layout.fontSize, editorial ? "lead" : undefined);
  const measure = async (text: string) => {
    const ink = context.measureText(text);
    return serif || editorial ? ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight : ink.width;
  };
  const transcript = correctSubtitleTranscript(captions.transcript, captions.corrections);
  const cues = serif ? await groupSerifBoxPhrases(transcript.words, layout, measure)
    : editorial ? await groupNaturalSubtitleWords(transcript.words, layout, measure)
    : ["word-pop", "karaoke", "marker-highlight"].includes(captions.style) ? await groupSubtitleWords(transcript.words, layout, measure)
    : await groupNaturalSubtitleWords(transcript.words, layout, measure);
  if (editorial) {
    const pages = await planEditorialPages(cues, layout, captions.placement, async (text, size, role) => {
      setFont(size, role); const ink = context.measureText(text);
      const ascent = ink.actualBoundingBoxAscent, descent = ink.actualBoundingBoxDescent;
      // A top-origin ink model lets the shared planner position the same blocks.
      return { left: -ink.actualBoundingBoxLeft, top: 0, width: ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight, height: ascent + descent };
    });
    return { font, bold: false, size: layout.fontSize, pages: pages.map(page => ({ cue: page.cue, size: layout.fontSize, words: [], boxes: [], editorial: page.blocks.map(block => ({ ...block, size: block.size * (editorialRatios[block.font] ?? 1) })) })) };
  }
  const rawPages = captions.style === "word-pop" ? transcript.words.map((word, i) => ({ startMs: word.startMs, endMs: Math.min(word.endMs, transcript.words[i + 1]?.startMs ?? word.endMs), words: [word], lines: [[0]] })) : cues;
  const pages: PreviewPage[] = rawPages.map(cue => {
    let size = layout.fontSize * (captions.style === "word-pop" ? 2.2 : 1);
    setFont(size);
    if (["word-pop", "karaoke", "marker-highlight"].includes(captions.style)) {
      const fits = () => Math.max(...cue.lines.map(line => context.measureText(line.map(index => cue.words[index].text).join(" ")).width))
        + (captions.style === "word-pop" ? 6 : Math.max(3, Math.round(size * .18)) * 2) <= width * .82;
      while (!fits()) {
        size = Math.floor(size * .9);
        if (size < 16) throw new Error("This caption cannot fit the preview safe area.");
        setFont(size);
      }
    }
    const anchor = height * (serif ? serifBoxAnchor(captions.placement) : subtitlePlacementGeometry(captions.placement).anchor);
    const words: PreviewWord[] = [], boxes: PreviewPage["boxes"] = [];
    cue.lines.forEach((line, row) => {
      const sentence = line.map(i => cue.words[i].text).join(" "), lineWidth = context.measureText(sentence).width;
      const y = anchor + (row - (cue.lines.length - 1) / 2) * size * 1.15;
      line.forEach((index, part) => {
        const prefix = line.slice(0, part).map(i => cue.words[i].text).join(" ");
        words.push({ index, x: (width - lineWidth) / 2 + context.measureText(prefix ? `${prefix} ` : "").width, y, width: context.measureText(cue.words[index].text).width });
      });
      const padding = serif ? Math.max(4, Math.round(size * .25)) : Math.max(1, Math.round(size * .065)) * 3;
      boxes.push({ x: (width - lineWidth) / 2 - padding, y: y - size * .7, width: lineWidth + padding * 2, height: size * 1.4 });
    });
    return { cue, size: size * ratio, words, boxes };
  });
  return { pages, font, bold: layout.bold, size: layout.fontSize };
}
