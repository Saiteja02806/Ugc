/** Release publication must prepare every public frame zero before catalogue activation. */
export async function preparePublishedHookFrames(items) {
  const { preparePublishedSourceFrames } = await import("./prepare-published-source-frames.mjs");
  for (const frame of await preparePublishedSourceFrames(items.filter(item => !item.id.startsWith("creator-account-")))) {
    console.log(JSON.stringify({ preparedStartingFrame: frame.referenceId, frameSha256: frame.frameSha256 }));
  }
}
