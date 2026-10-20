import { SlideshowPromptInputSchema, validateSlideshowPromptOutput, type SlideshowPromptInput } from "./slideshow-prompt-plan";

export class PromptImprovementError extends Error {
  constructor(message: string, readonly outcome?: "failed" | "pending") { super(message); }
}
/** Save identity before POST; even an interrupted response reuses the same paid request. */
export async function requestSlideshowPromptRewrite({ owner, input, token, storage, locks, send, newAttempt = false }: {
  owner: string; input: SlideshowPromptInput; token: string; storage: Pick<Storage, "getItem" | "setItem">;
  locks: Pick<LockManager, "request">; send: typeof fetch; newAttempt?: boolean;
}) {
  const storageKey = `ugc-explore:prompt-improvements:v2:${encodeURIComponent(owner)}`;
  const snapshot = JSON.stringify(SlideshowPromptInputSchema.parse(input));
  return locks.request(storageKey, async () => {
    const raw = storage.getItem(storageKey);
    if (raw && raw.length > 500000) throw new Error("The saved improvement requests are too large to verify. Your original instructions can still be used.");
    const entries: { snapshot: string; key: string }[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries) || entries.some(entry => typeof entry.snapshot !== "string" || !/^[0-9a-f-]{36}$/i.test(entry.key))) throw new Error("Could not verify earlier improvement requests. Your original instructions can still be used.");
    const prior = entries.find(entry => entry.snapshot === snapshot);
    const key = !newAttempt && prior ? prior.key : crypto.randomUUID();
    storage.setItem(storageKey, JSON.stringify([{ snapshot, key }, ...entries.filter(entry => entry.snapshot !== snapshot)].slice(0, 20)));
    const response = await send("/api/explore/slideshows/improve-prompt", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": key }, body: snapshot });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) throw new PromptImprovementError(typeof result?.message === "string" ? result.message : "Could not improve the instructions. Your original text is unchanged.", result?.outcome);
    try { return validateSlideshowPromptOutput(result.output); }
    catch { throw new Error("The rewrite could not be verified. Your text is unchanged."); }
  });
}
