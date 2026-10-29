import { REFERENCE_FORMAT_TEXT_STYLE, formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import { validateRemixDraft, type ReferenceText, type RemixOutput } from "./reference-text.ts";
import { hookRemixResult, repairHookRemixEdit } from "./hook-remix-source.ts";
import { fitInitialHookText } from "../../worker/src/lib/hook-initial-text-layout.ts";
import { initialWallText, initialWallRegions, initialWallHeadingBody, wallTextProfile } from "../../worker/src/lib/wall-initial-text-layout.ts";

/** Applying copy retains existing style; reference timing scales to the trimmed clip. */
export function applyVideoTextRemix(edit: ExploreFormatEdit, output: RemixOutput, source: ReferenceText, dimensions = { width: 1080, height: 1920 }): ExploreFormatEdit {
  validateRemixDraft(output, source);
  if (source.format !== edit.format) throw new Error("Choose a reference from this workflow.");
  edit = repairHookRemixEdit(edit, source.referenceId);
  ({ output, source } = hookRemixResult(output, source));
  const duration = edit.trimEndMs - edit.trimStartMs;
  const sourceDuration = Math.max(1, ...source.blocks.map(b => b.endMs ?? 1));
  const previous = formatTextOverlays(edit);
  const regionProfile = edit.format === "wall_text" ? wallTextProfile(source.referenceId, source.sourceSha256) : null;
  if (regionProfile?.structure === "heading-body-v1" && output.blocks.length === 0) {
    if (previous.length === 2) return parseExploreFormatEdit({ ...edit, text: null, textOverlays: previous.map((style, index) => ({ ...style, value: index === 0 ? output.heading : output.body })) });
    // A deliberately saved single-region layout keeps its geometry and exact new copy.
    if (previous.length === 1) return parseExploreFormatEdit({ ...edit, text: null, textOverlays: [{ ...previous[0], value: `${output.heading}\n\n${output.body}` }] });
    if (previous.length > 0) throw new Error("Review the Wall heading and body layout before applying it.");
    if (dimensions.width / dimensions.height < .54 || dimensions.width / dimensions.height > .59) throw new Error("Review Wall text placement for this aspect ratio.");
    return parseExploreFormatEdit({ ...edit, text: null, textOverlays: initialWallHeadingBody(output.heading, output.body, regionProfile, duration, 1) });
  }
  // Compatibility only: frozen block-based receipts and saved drafts keep their old meaning.
  if (regionProfile?.structure === "heading-body-v1" && output.blocks.length === 1 && (previous.length === 0 || previous.length === 2)) {
    const [heading, ...paragraphs] = output.blocks[0].split(/\n\s*\n/u);
    const body = paragraphs.join("\n\n");
    if (!body.trim()) throw new Error("Review the Wall heading and body before applying it.");
    if (previous.length === 2) return parseExploreFormatEdit({ ...edit, text: null, textOverlays: previous.map((style, index) => ({ ...style, value: index === 0 ? heading : body })) });
    if (dimensions.width / dimensions.height < .54 || dimensions.width / dimensions.height > .59) throw new Error("Review Wall text placement for this aspect ratio.");
    return parseExploreFormatEdit({ ...edit, text: null, textOverlays: initialWallHeadingBody(heading, body, regionProfile, duration, 1) });
  }
  if (regionProfile?.regions && previous.length > 1 && output.blocks.length === 1) {
    const paragraphs = output.blocks[0].split(/\n\s*\n/u);
    if (previous.length !== regionProfile.regions.length || paragraphs.length !== regionProfile.regions.reduce((sum, region) => sum + region.paragraphs, 0)) throw new Error("Review the Wall text's separate regions before applying it.");
    let offset = 0;
    return parseExploreFormatEdit({ ...edit, text: null, textOverlays: previous.map((style, index) => {
      const count = regionProfile.regions![index].paragraphs;
      const value = paragraphs.slice(offset, offset + count).join("\n\n"); offset += count;
      return { ...style, value };
    }) });
  }
  // The measured layout is an initial suggestion only. Existing styles and
  // multi-region sources continue to follow their established editor path.
  const wallProfile = !previous.length && edit.format === "wall_text" && output.blocks.length === 1
    ? wallTextProfile(source.referenceId, source.sourceSha256) : null;
  if (wallProfile && !wallProfile.structure) {
    if (wallProfile.regions) {
      if (dimensions.width / dimensions.height < .54 || dimensions.width / dimensions.height > .59) throw new Error("Review Wall text placement for this aspect ratio.");
      return parseExploreFormatEdit({ ...edit, text: null, textOverlays: initialWallRegions(output.blocks[0], wallProfile, duration) });
    }
    const text = initialWallText(output.blocks[0], wallProfile, duration, dimensions.width, dimensions.height);
    // A source caption may begin after the first frame. Preserve the existing
    // proportional timing rule instead of making it visible from time zero.
    text.startMs = Math.min(duration - 1, Math.round((source.blocks[0].startMs ?? 0) / sourceDuration * duration));
    return parseExploreFormatEdit({ ...edit, text: null, textOverlays: [text] });
  }
  return parseExploreFormatEdit({ ...edit, text: null, textOverlays: output.blocks.map((value, i) => {
    const block = source.blocks[i];
    const startMs = Math.min(duration - 1, Math.round((block.startMs ?? 0) / sourceDuration * duration));
    const endMs = Math.min(duration, Math.max(startMs + 1, Math.round((block.endMs ?? sourceDuration) / sourceDuration * duration)));
    const style = previous[i] ?? { ...(previous[0] ?? { width: .84, y: .18, fontSize: edit.format === "wall_text" ? 36 : 48, ...REFERENCE_FORMAT_TEXT_STYLE }), startMs, endMs };
    const next = { ...style, value };
    return !previous.length && edit.format === "hook" ? fitInitialHookText(next, dimensions.width, dimensions.height) : next;
  }) });
}
