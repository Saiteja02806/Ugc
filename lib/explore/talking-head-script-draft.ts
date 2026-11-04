import { z } from "zod";
const scriptText = z.string().max(6000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u);
export const TalkingHeadScriptRequestSchema = z.object({ requestKey: z.uuid(), referenceId: z.string().regex(/^talking-[a-z0-9-]{1,80}$/), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), transcriptSha256: z.string().regex(/^[a-f0-9]{64}$/), businessProfileVersion: z.number().int().nonnegative(), script: scriptText.trim().min(1), reviewed: z.literal(true) }).strict();
const draft = z.object({ version: z.literal(1), script: scriptText.nullable(), reviewed: z.boolean(), pending: TalkingHeadScriptRequestSchema.nullable() }).strict();
export function readTalkingHeadScriptDraft(raw: string | null, referenceId: string, sourceSha256: string) {
  if (raw === null) return null;
  if (!raw || raw.length > 40000) throw Error("Saved script draft is invalid.");
  const value = draft.parse(JSON.parse(raw));
  if (value.pending && (value.pending.referenceId !== referenceId || value.pending.sourceSha256 !== sourceSha256)) throw Error("Saved script request belongs to another source.");
  return value;
}
