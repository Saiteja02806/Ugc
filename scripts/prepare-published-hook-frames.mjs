/** Release publication must prepare ordinary frames before activating its catalogue. */
export async function preparePublishedHookFrames(items) {
  const { hasCuratedHookFrame } = await import("../worker/src/lib/hook-curated-frames.ts");
  const { createHookSourceFrameService } = await import("../lib/explore/hook-source-frame.ts");
  const { createStoredHookFrames } = await import("../lib/explore/hook-source-frame-store.ts");
  const { getHookFullRecreationPilot } = await import("../worker/src/lib/hook-full-recreation-pilot.ts");
  const ordinary = items.filter(item => !hasCuratedHookFrame(item.id) || getHookFullRecreationPilot(item.id, item.videoSha256));
  const extract = createHookSourceFrameService({ items: () => ordinary, useCuratedFrame: false });
  const store = createStoredHookFrames();
  for (const item of ordinary) {
    const frame = await store.prepare(item.videoSha256, () => extract(item.id));
    console.log(JSON.stringify({ preparedStartingFrame: item.id, frameSha256: frame.frameSha256 }));
  }
}
