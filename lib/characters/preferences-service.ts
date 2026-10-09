import { z } from "zod";

import { CharacterGenderSchema } from "./schema.ts";

export const CharacterPreferenceRequestSchema = z.strictObject({
  gender: CharacterGenderSchema.optional(),
});
export type CharacterPreferenceRequest = z.infer<typeof CharacterPreferenceRequestSchema>;
export type CharacterPreference = { seen: boolean; gender: "male" | "female" | null };
export type CharacterPreferenceRow = {
  user_id: string;
  gender: "male" | "female" | null;
  seen_at: string;
};

export type CharacterPreferenceStore = {
  get(userId: string): Promise<CharacterPreferenceRow | null>;
  markSeen(userId: string): Promise<void>;
  saveGender(userId: string, gender: "male" | "female"): Promise<void>;
};

export class CharacterPreferenceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CharacterPreferenceError";
    this.status = status;
  }
}

function assertUserId(userId: string) {
  if (!userId.trim() || userId.length > 128) {
    throw new CharacterPreferenceError("Your signed-in account could not be verified.", 401);
  }
}

function publicPreference(row: CharacterPreferenceRow | null, userId: string): CharacterPreference {
  if (!row) return { seen: false, gender: null };
  if (row.user_id !== userId || !row.seen_at ||
      (row.gender !== null && !CharacterGenderSchema.safeParse(row.gender).success)) {
    throw new CharacterPreferenceError("Your character preference could not be loaded. Try again.", 503);
  }
  return { seen: true, gender: row.gender };
}

export function createCharacterPreferenceService(store: CharacterPreferenceStore) {
  return {
    async get(userId: string): Promise<CharacterPreference> {
      assertUserId(userId);
      return publicPreference(await store.get(userId), userId);
    },
    async save(userId: string, body: unknown): Promise<CharacterPreference> {
      assertUserId(userId);
      const parsed = CharacterPreferenceRequestSchema.safeParse(body);
      if (!parsed.success) throw new CharacterPreferenceError("Choose male or female, or skip this choice.", 400);
      if (parsed.data.gender) await store.saveGender(userId, parsed.data.gender);
      else await store.markSeen(userId);
      const saved = await store.get(userId);
      if (!saved) throw new CharacterPreferenceError("Your character preference could not be saved. Try again.", 503);
      return publicPreference(saved, userId);
    },
  };
}
