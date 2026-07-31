const DEFAULT_RUNWAY_DAILY_CREDIT_LIMIT = 100;

const RUNWAY_VIDEO_CREDITS_PER_SECOND = {
  gen4_turbo: 5,
  "veo3.1_fast": 10,
} as const;

type RunwayVideoModel = keyof typeof RUNWAY_VIDEO_CREDITS_PER_SECOND;

type RunwayUsageReader = {
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
  const usage = await usageReader.retrieveUsage(window);
  const usedCredits = Math.max(
    0,
    usage.results.reduce(
      (total, result) =>
        total +
        result.usedCredits.reduce((subtotal, item) => subtotal + item.amount, 0),
      0,
    ),
  );

  if (usedCredits + estimatedCredits > limit) {
    throw new Error(
      `Runway daily credit limit reached (${limit} credits per UTC day).`,
    );
  }

  return {
    estimatedCredits,
    limit,
    remainingCreditsAfterGeneration:
      limit - usedCredits - estimatedCredits,
    usedCredits,
    window,
  };
}
