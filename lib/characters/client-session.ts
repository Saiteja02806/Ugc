import { z } from "zod";
import { CharacterGenerateRequestSchema } from "./schema.ts";

export const CharacterClientSessionSchema = z.strictObject({
  version: z.literal(1),
  pendingRequest: CharacterGenerateRequestSchema.nullable(),
  jobs: z.array(z.strictObject({ jobId: z.uuid(), generationId: z.string().min(1) })).max(3),
  selectedCharacterId: z.uuid().nullable(),
});
export type CharacterClientSession = z.infer<typeof CharacterClientSessionSchema>;
export const EMPTY_CHARACTER_SESSION: CharacterClientSession = {
  version: 1, pendingRequest: null, jobs: [], selectedCharacterId: null,
};

export function parseCharacterClientSession(value: string | null): CharacterClientSession {
  try {
    const parsed = CharacterClientSessionSchema.safeParse(value ? JSON.parse(value) : null);
    return parsed.success ? parsed.data : EMPTY_CHARACTER_SESSION;
  } catch { return EMPTY_CHARACTER_SESSION; }
}

export function characterSessionStorageKey(userId: string) {
  return `ugc-character-session:v1:${encodeURIComponent(userId)}`;
}
