import { z } from "zod";
const scriptText = z.string().max(6000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u);
export const TalkingHeadScriptRequestSchema = z.object({ requestKey: z.uuid(), referenceId: z.string().regex(/^talking-[a-z0-9-]{1,80}$/), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), transcriptSha256: z.string().regex(/^[a-f0-9]{64}$/), selectionSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), businessProfileVersion: z.number().int().nonnegative(), script: scriptText.trim().min(1), reviewed: z.literal(true) }).strict();
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const videoPrompt = z.object({ version: z.literal(1), text: z.string().max(24000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u), script: scriptText, sceneDirections: scriptText, selectionSha256: fingerprint, durationSeconds: z.number().int().positive(), businessProfileVersion: z.number().int().nonnegative().optional(), requestKey: z.uuid().optional() }).strict();
const pendingPrompt = z.object({ requestKey: z.uuid(), sceneDirections: scriptText.min(1), selectionSha256: fingerprint, hookEndMs: z.number().int().positive() }).strict();
const draft = z.object({ version: z.literal(1), script: scriptText.nullable(), reviewed: z.boolean(), reviewedSelectionSha256: fingerprint.optional(), pending: TalkingHeadScriptRequestSchema.nullable(), pendingPrompt: pendingPrompt.optional(), videoPrompt: videoPrompt.optional(), earlierPrompt: videoPrompt.optional() }).strict();
export function readTalkingHeadScriptDraft(raw: string | null, referenceId: string, sourceSha256: string) {
  if (raw === null) return null;
  if (!raw || raw.length > 256000) throw Error("Saved script draft is invalid.");
  const value = draft.parse(JSON.parse(raw));
  if (value.pending && (value.pending.referenceId !== referenceId || value.pending.sourceSha256 !== sourceSha256)) throw Error("Saved script request belongs to another source.");
  if (value.pendingPrompt && (!value.pending || value.pendingPrompt.requestKey !== value.pending.requestKey || value.pendingPrompt.selectionSha256 !== value.pending.selectionSha256)) throw Error("Saved prompt context does not match its script request.");
  return value;
}
