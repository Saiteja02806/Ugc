const DEFAULT_RUNWAY_DAILY_CREDIT_LIMIT = 100;

const RUNWAY_VIDEO_CREDITS_PER_SECOND = {
  aleph2: 28,
  gen4_turbo: 5,
  "veo3.1_fast": 10,
} as const;

const RUNWAY_HOOK_VIDEO_DURATION_SECONDS = 4;

type RunwayVideoModel = keyof typeof RUNWAY_VIDEO_CREDITS_PER_SECOND;

export function estimateRunwaySeedanceCredits(
  resolution: "480p" | "720p",
  durationSeconds: number,
  referenceVideoDurationSeconds = 0,
) {
  // Seedance 2.5: output 20/30 credits/sec, input video 10/15, minimum 80.
  const outputRate = resolution === "480p" ? 20 : 30;
  const inputRate = resolution === "480p" ? 10 : 15;
  return Math.max(80, outputRate * durationSeconds + inputRate * Math.ceil(referenceVideoDurationSeconds));
}

type RunwayUsageReader = {
  retrieve(): PromiseLike<{
    usage: {
      models: Record<string, { dailyGenerations: number } | undefined>;
    };
  }>;
  retrieveUsage(input: {
    beforeDate: string;
    startDate: string;
  }): PromiseLike<{
    results: Array<{
      usedCredits: Array<{ amount: number }>;
    }>;
  }>;
};

export function estimateRunwayVideoCredits(
  model: RunwayVideoModel,
  durationSeconds: number,
) {
  return RUNWAY_VIDEO_CREDITS_PER_SECOND[model] * durationSeconds;
}

export function resolveRunwayDailyCreditLimit(
  configuredLimit = process.env.RUNWAY_DAILY_CREDIT_LIMIT,
) {
  if (!configuredLimit?.trim()) {
    return DEFAULT_RUNWAY_DAILY_CREDIT_LIMIT;
  }

  const limit = Number(configuredLimit);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("RUNWAY_DAILY_CREDIT_LIMIT must be a positive integer.");
  }

  return limit;
}

export function getRunwayUtcCreditWindow(now = new Date()) {
  const startDate = now.toISOString().slice(0, 10);
  const before = new Date(`${startDate}T00:00:00.000Z`);
  before.setUTCDate(before.getUTCDate() + 1);

  return {
    beforeDate: before.toISOString().slice(0, 10),
    startDate,
  };
}

export async function assertRunwayDailyCreditBudget(
  usageReader: RunwayUsageReader,
  estimatedCredits: number,
  options: {
    configuredLimit?: string;
    now?: Date;
  } = {},
) {
  const limit = resolveRunwayDailyCreditLimit(options.configuredLimit);
  const window = getRunwayUtcCreditWindow(options.now);
  const [organization, usage] = await Promise.all([
    usageReader.retrieve(),
    usageReader.retrieveUsage(window),
  ]);
  const reportedCredits = Math.max(
    0,
    usage.results.reduce(
      (total, result) =>
        total +
        result.usedCredits.reduce((subtotal, item) => subtotal + item.amount, 0),
      0,
    ),
  );
  const hookCreditsFromDailyGenerations = (
    Object.keys(RUNWAY_VIDEO_CREDITS_PER_SECOND) as RunwayVideoModel[]
  ).reduce((total, model) => {
    const dailyGenerations = Math.max(
      0,
      organization.usage.models[model]?.dailyGenerations ?? 0,
    );

    return (
      total +
      dailyGenerations *
        estimateRunwayVideoCredits(model, RUNWAY_HOOK_VIDEO_DURATION_SECONDS)
    );
  }, 0);
  // Seedance counters do not include duration/quality; use its minimum as a
  // lag fallback, with detailed usage remaining authoritative when larger.
  const estimatedCreditsFromDailyGenerations = hookCreditsFromDailyGenerations +
    Math.max(0, organization.usage.models.seedance2_5?.dailyGenerations ?? 0) * 80;
  const usedCredits = Math.max(
    reportedCredits,
    estimatedCreditsFromDailyGenerations,
  );

  if (usedCredits + estimatedCredits > limit) {
    throw new Error(
      `Runway daily credit limit reached (${limit} credits per UTC day).`,
    );
  }

  return {
    estimatedCredits,
    estimatedCreditsFromDailyGenerations,
    limit,
    reportedCredits,
    remainingCreditsAfterGeneration:
      limit - usedCredits - estimatedCredits,
    usedCredits,
    window,
  };
}
