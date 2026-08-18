import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import { ensureTrendingDailyFeed } from "@/lib/trending/daily-feed";
import { prepareTrendingHookIdeas } from "@/lib/trending/trending-hook-feed";
import { enqueueTrendingWallTextJob } from "@/lib/trending/wall-text-jobs";

type TrendingPrebuildFormat = "carousel" | "hook_video" | "wall_text";

export async function prebuildTrendingAfterOnboarding(params: {
  includeHookVideos: boolean;
  profile: BusinessProfileRecord;
  timezone: string;
}) {
  const tasks: Array<{
    format: TrendingPrebuildFormat;
    run: () => Promise<unknown>;
  }> = [
    {
      format: "carousel",
      run: () =>
        ensureTrendingDailyFeed({
          markItemsShown: false,
          profile: params.profile,
          timezone: params.timezone,
          userId: params.profile.userId,
        }),
    },
    {
      format: "wall_text",
      run: () =>
        enqueueTrendingWallTextJob({
          businessProfileId: params.profile.id,
          businessProfileVersion: params.profile.profileVersion,
          userId: params.profile.userId,
        }),
    },
  ];

  if (params.includeHookVideos) {
    tasks.push({
      format: "hook_video",
      run: () => prepareTrendingHookIdeas(params.profile),
    });
  }

  const results = await Promise.allSettled(tasks.map((task) => task.run()));

  return results.map((result, index) => ({
    format: tasks[index].format,
    status: result.status === "fulfilled" ? ("scheduled" as const) : ("failed" as const),
  }));
}
