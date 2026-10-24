import catalog from './hook-curated-frames.json' with { type: 'json' };

/** Shared by preview, paid admission and worker. Never accepts client frame URLs.
 * Keep these approved bindings immutable: saved v3 jobs depend on them. Future
 * selections need retained historical bindings, not an in-place rewrite. */
export function getCuratedHookFrame(referenceId: string, sourceSha256: string) {
  const entry = catalog.frames.find(row => row.referenceId === referenceId);
  if (!entry || entry.sourceSha256 !== sourceSha256) return undefined;
  return entry;
}
export function hasCuratedHookFrame(referenceId: string) { return catalog.frames.some(row => row.referenceId === referenceId); }
export function matchesCuratedHookFrame(referenceId: string, sourceSha256: string, frame: {index: number; timeSeconds: number; sha256: string; width: number; height: number}) {
  const expected = getCuratedHookFrame(referenceId, sourceSha256);
  return Boolean(expected && (['index', 'timeSeconds', 'sha256', 'width', 'height'] as const).every(key => expected[key] === frame[key]));
}
