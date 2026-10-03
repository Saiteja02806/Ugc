"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { characterPreferenceStorageKey, EMPTY_CHARACTER_PREFERENCE, parseCharacterClientPreference,
  type CharacterClientPreference } from "@/lib/characters/client-preference";
import type { CharacterGender } from "@/lib/characters/types";
import { characterRequest } from "./use-character-builder";

type PreferenceResponse = { ok: true; preference: CharacterClientPreference };

export function useCharacterPreference(userId: string | null, enabled: boolean) {
  const client = useQueryClient();
  const localKey = ["character-local-preference", userId] as const;
  const accountKey = ["character-preference", userId] as const;
  function writeLocal(preference: CharacterClientPreference) {
    client.setQueryData(localKey, preference);
    try { localStorage.setItem(characterPreferenceStorageKey(userId), JSON.stringify(preference)); }
    catch { /* The account record still persists when browser storage is unavailable. */ }
  }
  const localQuery = useQuery({
    queryKey: localKey, enabled, staleTime: Infinity,
    queryFn: () => {
      try { return parseCharacterClientPreference(localStorage.getItem(characterPreferenceStorageKey(userId))); }
      catch { return EMPTY_CHARACTER_PREFERENCE; }
    },
  });
  const accountQuery = useQuery({
    queryKey: accountKey, enabled: enabled && Boolean(userId), staleTime: Infinity, retry: 1,
    queryFn: async ({ signal }) => {
      const result = await characterRequest<PreferenceResponse>(userId, "/api/characters/preferences", { signal });
      const current = client.getQueryData<CharacterClientPreference>(localKey) ?? EMPTY_CHARACTER_PREFERENCE;
      // A choice made while this read was in flight takes precedence over its stale response.
      if (result.preference.seen) writeLocal({ seen: true, gender: current.gender ?? result.preference.gender });
      return result;
    },
  });
  const save = useMutation({
    mutationFn: (gender: CharacterGender | null) => characterRequest<PreferenceResponse>(userId, "/api/characters/preferences", {
      method: "POST", body: JSON.stringify(gender ? { gender } : {}),
    }),
    onSuccess: (result) => { client.setQueryData(accountKey, result); },
  });
  const local = localQuery.data ?? EMPTY_CHARACTER_PREFERENCE;
  const preference = {
    seen: local.seen || Boolean(accountQuery.data?.preference.seen),
    gender: local.gender ?? accountQuery.data?.preference.gender ?? null,
  };
  function remember(gender: CharacterGender | null) {
    const current = client.getQueryData<CharacterClientPreference>(localKey) ?? EMPTY_CHARACTER_PREFERENCE;
    const next = { seen: true, gender: gender ?? current.gender };
    writeLocal(next);
    if (userId) save.mutate(next.gender);
  }
  return {
    preference, remember, save,
    ready: enabled && !localQuery.isPending && (!userId || local.seen || !accountQuery.isPending),
  };
}
