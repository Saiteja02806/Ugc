export const WALL_TEXT_INSTAGRAM_TEMPLATE_SHARE = 1 / 3;

export type WallTextSelectableSource<TInstagram, TUgcpilot> =
  | { kind: "instagram_reel"; value: TInstagram }
  | { kind: "ugcpilot"; value: TUgcpilot };

export function selectWallTextGenerationSources<TInstagram, TUgcpilot>(params: {
  instagramTemplates: readonly TInstagram[];
  requestedCount: number;
  ugcpilotCandidates: readonly TUgcpilot[];
}): Array<WallTextSelectableSource<TInstagram, TUgcpilot>> {
  const requestedCount = Math.min(
    Math.max(Math.trunc(params.requestedCount), 0),
    50,
  );
  if (requestedCount === 0) return [];

  const desiredInstagramCount = Math.floor(
    requestedCount * WALL_TEXT_INSTAGRAM_TEMPLATE_SHARE,
  );
  let instagramCount = Math.min(
    desiredInstagramCount,
    params.instagramTemplates.length,
  );
  let ugcpilotCount = Math.min(
    requestedCount - instagramCount,
    params.ugcpilotCandidates.length,
  );

  let remaining = requestedCount - instagramCount - ugcpilotCount;
  if (remaining > 0) {
    const additionalInstagram = Math.min(
      remaining,
      params.instagramTemplates.length - instagramCount,
    );
    instagramCount += additionalInstagram;
    remaining -= additionalInstagram;
  }
  if (remaining > 0) {
    ugcpilotCount += Math.min(
      remaining,
      params.ugcpilotCandidates.length - ugcpilotCount,
    );
  }

  const instagram = params.instagramTemplates.slice(0, instagramCount);
  const ugcpilot = params.ugcpilotCandidates.slice(0, ugcpilotCount);
  const selected: Array<WallTextSelectableSource<TInstagram, TUgcpilot>> = [];
  let instagramIndex = 0;
  let ugcpilotIndex = 0;

  while (
    instagramIndex < instagram.length ||
    ugcpilotIndex < ugcpilot.length
  ) {
    const slot = selected.length;
    const instagramSlot = (slot + 1) % 3 === 0;

    if (instagramSlot && instagramIndex < instagram.length) {
      selected.push({
        kind: "instagram_reel",
        value: instagram[instagramIndex++]!,
      });
    } else if (ugcpilotIndex < ugcpilot.length) {
      selected.push({ kind: "ugcpilot", value: ugcpilot[ugcpilotIndex++]! });
    } else if (instagramIndex < instagram.length) {
      selected.push({
        kind: "instagram_reel",
        value: instagram[instagramIndex++]!,
      });
    }
  }

  return selected;
}

/**
 * Freshness takes priority over the normal source mix. After every fresh
 * source has been considered, the same mix fills any remaining slots from
 * recycled sources.
 */
export function selectFreshThenRecycledWallTextGenerationSources<
  TInstagram,
  TUgcpilot,
>(params: {
  freshInstagramTemplates: readonly TInstagram[];
  freshUgcpilotCandidates: readonly TUgcpilot[];
  recycledInstagramTemplates: readonly TInstagram[];
  recycledUgcpilotCandidates: readonly TUgcpilot[];
  requestedCount: number;
}) {
  const requestedCount = Math.min(
    Math.max(Math.trunc(params.requestedCount), 0),
    50,
  );
  const fresh = selectWallTextGenerationSources({
    instagramTemplates: params.freshInstagramTemplates,
    requestedCount,
    ugcpilotCandidates: params.freshUgcpilotCandidates,
  });
  const remaining = requestedCount - fresh.length;

  if (remaining <= 0) return fresh;

  return [
    ...fresh,
    ...selectWallTextGenerationSources({
      instagramTemplates: params.recycledInstagramTemplates,
      requestedCount: remaining,
      ugcpilotCandidates: params.recycledUgcpilotCandidates,
    }),
  ];
}
