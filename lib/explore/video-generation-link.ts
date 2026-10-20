import type { AIStudioVideoModel } from "../ai-studio/generation-settings";

export function getExploreVideoGenerationLink(input: {
  id: string;
  type: "hook" | "wall_text";
  sourceUrl: string;
  model: AIStudioVideoModel;
}) {
  const params = new URLSearchParams({
    mode: "videos", model: input.model, exploreRecreate: "1",
    refId: input.id, refType: input.type, sourceUrl: input.sourceUrl,
  });
  return `/ai-studio?${params.toString()}`;
}
