import { z } from "zod";
import { CharacterGenerateRequestSchema } from "./schema.ts";
import { MAX_CHARACTER_REFERENCES } from "./image-models.ts";

export const CHARACTER_SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1_000;

export const CharacterClientSessionSchema = z.strictObject({
  version: z.literal(1),
  pendingRequest: CharacterGenerateRequestSchema.nullable(),
  jobs: z.array(z.strictObject({ jobId: z.uuid(), generationId: z.string().min(1) })),
  selectedCharacterId: z.uuid().nullable(),
  selectedCharacterIds: z.array(z.uuid()).max(MAX_CHARACTER_REFERENCES).refine((ids) => new Set(ids).size === ids.length).default([]),
  lastActivityAt: z.number().int().nonnegative().nullable().default(null),
  sessionEpoch: z.number().int().nonnegative().default(0),
});
export type CharacterClientSession = z.infer<typeof CharacterClientSessionSchema>;
export const EMPTY_CHARACTER_SESSION: CharacterClientSession = {
  version: 1, pendingRequest: null, jobs: [], selectedCharacterId: null, selectedCharacterIds: [], lastActivityAt: null, sessionEpoch: 0,
};

export function appendCharacterSessionJobs(
  current: CharacterClientSession["jobs"], incoming: CharacterClientSession["jobs"],
) {
  const seen = new Set(current.map((job) => job.jobId));
  return [...current, ...incoming.filter((job) => {
    if (seen.has(job.jobId)) return false;
    seen.add(job.jobId);
    return true;
  })];
}

export function isCharacterSessionIdle(session: CharacterClientSession, now: number, jobsSettled: boolean) {
  return jobsSettled && !session.pendingRequest && session.lastActivityAt !== null
    && now - session.lastActivityAt >= CHARACTER_SESSION_IDLE_TIMEOUT_MS;
}

export function parseCharacterClientSession(value: string | null): CharacterClientSession {
  try {
    const stored = value ? JSON.parse(value) : null;
    // Drop the removed assisted action without losing finished images or a saved identity.
    if (stored?.pendingRequest?.mode === "assisted") stored.pendingRequest = null;
    const parsed = CharacterClientSessionSchema.safeParse(stored);
    return parsed.success ? parsed.data : EMPTY_CHARACTER_SESSION;
  } catch { return EMPTY_CHARACTER_SESSION; }
}

export function characterSessionStorageKey(userId: string) {
  return `ugc-character-session:v1:${encodeURIComponent(userId)}`;
}
