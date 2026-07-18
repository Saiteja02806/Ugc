export type SocialSchedulerProviderName = "aws" | "gcp";

export function getSocialSchedulerProviderName(
  env: Record<string, string | undefined> = process.env,
): SocialSchedulerProviderName {
  const rawValue =
    env.SOCIAL_SCHEDULER_PROVIDER?.trim() ||
    env.UGC_SOCIAL_SCHEDULER_PROVIDER?.trim() ||
    "aws";
  const normalizedValue = rawValue.toLowerCase();

  if (normalizedValue === "aws" || normalizedValue === "eventbridge") {
    return "aws";
  }

  if (
    normalizedValue === "gcp" ||
    normalizedValue === "google" ||
    normalizedValue === "cloud-tasks" ||
    normalizedValue === "cloud_tasks"
  ) {
    return "gcp";
  }

  throw new Error(
    `Invalid SOCIAL_SCHEDULER_PROVIDER: ${rawValue}. Expected aws or gcp.`,
  );
}
