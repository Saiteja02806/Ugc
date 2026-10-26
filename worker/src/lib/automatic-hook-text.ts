import { DEFAULT_FORMAT_TEXT_STYLE, formatTextEmojiError, formatTextLayout, parseExploreFormatEdit, type ExploreFormatEdit } from "./explore-format-edit.ts";

export type AutomaticHookTextPlan = {
  version: 1; requestKey: string; model: string; systemPrompt: string; userPrompt: string; promptVersion: number;
  source: { referenceId: string; sourceSha256: string; format: string; status: string; blocks: { text: string; startMs: number | null; endMs: number | null }[] };
  businessProfileId: string; businessProfileVersion: number; businessContext: unknown;
};
export type AutomaticHookTextOutput = { blocks: string[]; heading: string; body: string };
export function validateAutomaticHookText(value: unknown, plan: AutomaticHookTextPlan): AutomaticHookTextOutput {
  const v = value as AutomaticHookTextOutput;
  if (!v || Object.keys(v).some(k => !["blocks", "heading", "body"].includes(k)) || v.heading !== "" || v.body !== "" || !Array.isArray(v.blocks) ||
    v.blocks.length !== plan.source.blocks.length || v.blocks.length < 1 || v.blocks.length > 20 || v.blocks.some(b => typeof b !== "string" || !b.trim() || b.trim().length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(b))) throw new Error("The automatic text does not match the reviewed reference.");
  const blocks = v.blocks.map(b => b.trim());
  if (blocks.join("").length > Math.max(80, Math.ceil(plan.source.blocks.reduce((sum,b) => sum+b.text.length,0)*1.3))) throw new Error("The automatic text is too long for this reference.");
  if (blocks.some(b => formatTextEmojiError(b))) throw new Error("The automatic text contains an unsupported symbol.");
  return { blocks, heading: "", body: "" };
}
/** Uses the same layout as browser previews and final renders. Never truncates copy. */
export function automaticHookEdit(output: AutomaticHookTextOutput, plan: AutomaticHookTextPlan, durationSeconds: number, ratio: string): ExploreFormatEdit {
  const checked = validateAutomaticHookText(output, plan), duration = Math.floor(durationSeconds * 1000);
  const width=1080, height=ratio === "16:9" ? 608 : 1920;
  const sourceDuration=Math.max(1,...plan.source.blocks.map(b=>b.endMs ?? 1));
  const overlays=checked.blocks.map((value,i)=>{
    const source=plan.source.blocks[i];
    const startMs=checked.blocks.length===1 ? 0 : Math.min(duration-1,Math.round((source.startMs ?? 0)/sourceDuration*duration));
    const endMs=checked.blocks.length===1 ? duration : Math.min(duration,Math.max(startMs+1,Math.round((source.endMs ?? sourceDuration)/sourceDuration*duration)));
    const text={value,width:.84,y:.18,fontSize:48,...DEFAULT_FORMAT_TEXT_STYLE,startMs,endMs};
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
