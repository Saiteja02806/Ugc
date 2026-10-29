import { assertSourceRelativeHookLength, HOOK_SOURCE_RELATIVE_REMIX_VERSION } from "./hook-remix-source-relative.ts";
import { fitInitialHookText, HOOK_INITIAL_TEXT_LAYOUT_VERSION } from "./hook-initial-text-layout.ts";
import { DEFAULT_FORMAT_TEXT_STYLE, REFERENCE_FORMAT_TEXT_STYLE, formatTextEmojiError, formatTextLayout, parseExploreFormatEdit, type ExploreFormatEdit } from "./explore-format-edit.ts";
import { initialWallText, initialWallHeadingBody, initialWallRegions, type WallTextProfile } from "./wall-initial-text-layout.ts";

export type AutomaticHookTextPlan = {
  version: 1; requestKey: string; model: string; systemPrompt: string; userPrompt: string; promptVersion: number;
  layoutVersion?: typeof HOOK_INITIAL_TEXT_LAYOUT_VERSION;
  textStyleVersion?: 1;
  wallLayout?: WallTextProfile;
  wallHeadingFitVersion?: 1;
  source: { referenceId: string; sourceSha256: string; format: string; status: string; blocks: { text: string; startMs: number | null; endMs: number | null }[] };
  businessProfileId: string; businessProfileVersion: number; businessContext: unknown;
};
export type AutomaticHookTextOutput = { blocks: string[]; heading: string; body: string };
export function validateAutomaticHookText(value: unknown, plan: AutomaticHookTextPlan): AutomaticHookTextOutput {
  const v = value as AutomaticHookTextOutput;
  if (plan.source.format === "wall_text" && plan.wallLayout?.structure === "heading-body-v1") {
    if (!v || Object.keys(v).some(k => !["blocks", "heading", "body"].includes(k)) || !Array.isArray(v.blocks) || v.blocks.length !== 0 ||
        typeof v.heading !== "string" || typeof v.body !== "string" || !v.heading.trim() || !v.body.trim() || v.heading.includes("\n") ||
        v.heading.length > 180 || v.body.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v.heading + v.body) ||
        v.heading.length + v.body.length > Math.max(80, Math.ceil(plan.source.blocks.reduce((n, b) => n + b.text.length, 0) * 1.3)) ||
        formatTextEmojiError(v.heading) || formatTextEmojiError(v.body)) throw new Error("The automatic Wall heading and body need review.");
    return { blocks: [], heading: v.heading.trim(), body: v.body.trim() };
  }
  if (!v || Object.keys(v).some(k => !["blocks", "heading", "body"].includes(k)) || v.heading !== "" || v.body !== "" || !Array.isArray(v.blocks) ||
    v.blocks.length !== plan.source.blocks.length || v.blocks.length < 1 || v.blocks.length > 20 || v.blocks.some(b => typeof b !== "string" || !b.trim() || b.trim().length > (plan.source.format === "wall_text" ? 6000 : 600) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(b))) throw new Error("The automatic text does not match the reviewed reference.");
  const blocks = v.blocks.map(b => b.trim());
  if (blocks.join("").length > Math.max(80, Math.ceil(plan.source.blocks.reduce((sum,b) => sum+b.text.length,0)*1.3))) throw new Error("The automatic text is too long for this reference.");
  if (plan.source.format === "hook" && plan.promptVersion >= HOOK_SOURCE_RELATIVE_REMIX_VERSION) assertSourceRelativeHookLength(blocks, plan.source, plan.businessContext);
  if (blocks.some(b => formatTextEmojiError(b))) throw new Error("The automatic text contains an unsupported symbol.");
  return { blocks, heading: "", body: "" };
}
/** Uses the same layout as browser previews and final renders. Never truncates copy. */
export function automaticHookEdit(output: AutomaticHookTextOutput, plan: AutomaticHookTextPlan, durationSeconds: number, ratio: string): ExploreFormatEdit {
  if (plan.source.format === "wall_text") {
    const checked = validateAutomaticHookText(output, plan), durationMs = Math.floor(durationSeconds * 1000);
    if (!plan.wallLayout || plan.wallLayout.referenceId !== plan.source.referenceId || plan.wallLayout.sourceSha256 !== plan.source.sourceSha256 || ratio !== "9:16") throw new Error("Review the Wall reference's layout before using this video.");
    if (plan.wallHeadingFitVersion !== undefined && plan.wallHeadingFitVersion !== 1) throw new Error("This Wall heading layout version is not supported.");
    const overlays = plan.wallLayout.structure === "heading-body-v1" ? initialWallHeadingBody(checked.heading, checked.body, plan.wallLayout, durationMs, plan.wallHeadingFitVersion) : plan.wallLayout.regions ? initialWallRegions(checked.blocks[0], plan.wallLayout, durationMs) : [initialWallText(checked.blocks[0], plan.wallLayout, durationMs)];
    return parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: durationMs, originalVolume: 1, musicVolume: .2, text: null,
      textOverlays: overlays });
  }
  if (plan.source.format !== "hook") throw new Error("Choose a supported automatic text format.");
  if (plan.textStyleVersion !== undefined && plan.textStyleVersion !== 1) throw new Error("This saved text style is not supported.");
  if (plan.layoutVersion !== undefined && plan.layoutVersion !== HOOK_INITIAL_TEXT_LAYOUT_VERSION) throw new Error("This saved Hook text layout version is not supported.");
  const checked = validateAutomaticHookText(output, plan), duration = Math.floor(durationSeconds * 1000);
  const width=1080, height=ratio === "16:9" ? 608 : 1920;
  const sourceDuration=Math.max(1,...plan.source.blocks.map(b=>b.endMs ?? 1));
  const overlays=checked.blocks.map((value,i)=>{
    const source=plan.source.blocks[i];
    const startMs=checked.blocks.length===1 ? 0 : Math.min(duration-1,Math.round((source.startMs ?? 0)/sourceDuration*duration));
    const endMs=checked.blocks.length===1 ? duration : Math.min(duration,Math.max(startMs+1,Math.round((source.endMs ?? sourceDuration)/sourceDuration*duration)));
    const text={value,width:.84,y:.18,fontSize:48,...(plan.textStyleVersion === 1 ? REFERENCE_FORMAT_TEXT_STYLE : DEFAULT_FORMAT_TEXT_STYLE),startMs,endMs};
    if (plan.layoutVersion === HOOK_INITIAL_TEXT_LAYOUT_VERSION) return fitInitialHookText(text, width, height);
    while(text.fontSize>24 && (!formatTextLayout(text,width,height).fits || text.y*height+formatTextLayout(text,width,height).lines.length*formatTextLayout(text,width,height).lineHeight>height*.72)) text.fontSize-=2;
    const layout=formatTextLayout(text,width,height);
    if(!layout.fits || text.y*height+layout.lines.length*layout.lineHeight>height*.72) throw new Error("Review the automatic text's fit before using this video.");
    return text;
  });
  return parseExploreFormatEdit({version:1,format:"hook",trimStartMs:0,trimEndMs:duration,originalVolume:1,musicVolume:.2,text:null,textOverlays:overlays});
}

export type AutomaticHookTextDependencies = {
  claim: () => Promise<{ claimed: boolean; status: string; output?: unknown }>;
  read: () => Promise<{ status: string; output?: unknown } | null>;
  generate: () => Promise<unknown>;
  complete: (output: AutomaticHookTextOutput) => Promise<void>;
  fail: () => Promise<void>;
  wait: () => Promise<void>;
};
/** A durable claim precedes the one provider call; retries only read the receipt. */
export async function runAutomaticHookText(plan: AutomaticHookTextPlan, deps: AutomaticHookTextDependencies) {
  const claim=await deps.claim();
  if(claim.claimed) {
    let output: AutomaticHookTextOutput;
    try { output=validateAutomaticHookText(await deps.generate(),plan); }
    catch { await deps.fail(); return null; }
    // An uncertain persistence response must not turn a completed receipt into failed.
    await deps.complete(output); return output;
  }
  let receipt: { status: string; output?: unknown } | null=claim;
  for(let i=0;i<35 && receipt?.status==="pending";i++) { await deps.wait(); receipt=await deps.read(); }
  return receipt?.status==="completed" ? validateAutomaticHookText(receipt.output,plan) : null;
}
