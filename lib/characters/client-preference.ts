import { z } from "zod";
import { CharacterGenderSchema } from "./schema.ts";

export const CharacterClientPreferenceSchema = z.strictObject({
  seen: z.boolean(), gender: CharacterGenderSchema.nullable(),
});
export type CharacterClientPreference = z.infer<typeof CharacterClientPreferenceSchema>;
export const EMPTY_CHARACTER_PREFERENCE: CharacterClientPreference = { seen: false, gender: null };

export function characterPreferenceStorageKey(userId: string | null) {
  return `ugc-character-preference:v1:${userId === null ? "guest" : `user:${encodeURIComponent(userId)}`}`;
}

export function parseCharacterClientPreference(value: string | null): CharacterClientPreference {
  try {
    const parsed = CharacterClientPreferenceSchema.safeParse(value ? JSON.parse(value) : null);
    return parsed.success ? parsed.data : EMPTY_CHARACTER_PREFERENCE;
  } catch { return EMPTY_CHARACTER_PREFERENCE; }
}
