export type AudioGenerationAccess = "allowed" | "upgrade_required" | "unavailable";

export const AUDIO_UPGRADE_MESSAGE = "Audio generation is available on Starter and Growth. You can browse the library and listen to voice samples on Free.";

export function hasAudioGenerationSubscription(subscription: { isActive: boolean; planKey: string }): boolean {
  return subscription.isActive === true && (subscription.planKey === "starter" || subscription.planKey === "growth");
}
