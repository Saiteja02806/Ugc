export type AIStudioAccessState = "checking" | "error" | "locked" | "pro";

export function getAIStudioAccessMessage(state: AIStudioAccessState) {
  switch (state) {
    case "checking":
      return "Checking generation access…";
    case "error":
      return "Generation access could not be verified. Refresh to try again.";
    case "locked":
      return "Generation requires an active Starter or Growth plan.";
    case "pro":
      return null;
  }
}
