// Enrollment only: persisted drafts must remain executable when rollout stops.
export function isBackgroundOnboardingEnabled(userId: string, env: Record<string, string | undefined> = process.env) {
  if (env.BUSINESS_ONBOARDING_BACKGROUND_ENABLED === "false") return false;
  if (env.BUSINESS_ONBOARDING_BACKGROUND_ENABLED === "true") return true;
  return (env.BUSINESS_ONBOARDING_BACKGROUND_USER_IDS ?? "")
    .split(",").some(id => id.trim() === userId && id.trim().length > 0);
}
