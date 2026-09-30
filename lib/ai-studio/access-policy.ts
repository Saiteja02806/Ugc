export type AIStudioAccessState = "checking" | "error" | "locked" | "pro";

export function getAIStudioAccessMessage(state: AIStudioAccessState, subscriptionStatus?: string) {
  switch (state) {
    case "checking":
      return "Checking generation access…";
    case "error":
      return "Generation access could not be verified. Refresh to try again.";
    case "locked":
      if (subscriptionStatus === "on_hold") {
        return "Your subscription is on hold. Update billing to resume generation.";
      }
      if (subscriptionStatus === "paused") {
        return "Your subscription is paused. Resume it in billing to generate.";
      }
      return "Generation requires an active Starter or Growth plan.";
    case "pro":
      return null;
  }
}
