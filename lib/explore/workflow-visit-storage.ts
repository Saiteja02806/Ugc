/** Compatibility storage for id-less previews. Connected Talking Head work uses
 * explicit draft IDs and entry intent; elapsed time is never user intent. */
const PREFIX = "ugc-explore:visit:v1:";
type VisitStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function workflowVisitStorage(storage: VisitStorage, now: () => number = Date.now): VisitStorage {
  return {
    getItem(key) {
      const raw = storage.getItem(PREFIX + key);
      if (!raw) return null;
      try {
        const saved = JSON.parse(raw);
        return saved.version === 1 && Number.isFinite(saved.savedAt) && typeof saved.value === "string"
          ? saved.value : null;
      } catch { return null; }
    },
    setItem(key, value) { storage.setItem(PREFIX + key, JSON.stringify({ version: 1, savedAt: now(), value })); },
    removeItem(key) { storage.removeItem(PREFIX + key); },
  };
}
