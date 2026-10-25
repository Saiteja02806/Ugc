/** Release publication must prepare ordinary frames before activating its catalogue. */
export async function preparePublishedHookFrames(items) {
  const { hasCuratedHookFrame } = await import("../worker/src/lib/hook-curated-frames.ts");
  const { createHookSourceFrameService } = await import("../lib/explore/hook-source-frame.ts");
  const { createStoredHookFrames } = await import("../lib/explore/hook-source-frame-store.ts");
  const ordinary = items.filter(item => !hasCuratedHookFrame(item.id));
  const extract = createHookSourceFrameService({ items: () => ordinary });
  const store = createStoredHookFrames();
  for (const item of ordinary) {
    const frame = await store.prepare(item.videoSha256, () => extract(item.id));
    console.log(JSON.stringify({ preparedStartingFrame: item.id, frameSha256: frame.frameSha256 }));
  }
}
