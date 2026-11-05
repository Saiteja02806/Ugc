export const localStartingFramePath = "/local-starting-frame";
export const localStartingFramePort = 4317;
export const localStartingFrameMode = "local-starting-frame-v1";
export const localAppJobTypes = [
  "generate_image", "generate_hook_video", "generate_avatar",
  "render_demo_video", "render_edit_video", "render_schedule_combination", "publish_social_post",
] as const;

export function isLocalAppJobType(type: string): type is typeof localAppJobTypes[number] {
  return localAppJobTypes.some(candidate => candidate === type);
}

export function localStartingFrameConfig(env: Record<string, string | undefined>) {
  const appMode = env.LOCAL_APP_WORKER === "true";
  if (!appMode && env.LOCAL_STARTING_FRAME_WORKER !== "true") return null;
  const database = new URL(env.SUPABASE_URL ?? "");
  const secret = env.LOCAL_STARTING_FRAME_WORKER_SECRET?.trim();
  if (env.NODE_ENV !== "development" || env.K_SERVICE || env.VERCEL ||
      database.origin !== "http://127.0.0.1:54321" || database.href !== database.origin + "/" ||
      (env.NEXT_PUBLIC_SUPABASE_URL && new URL(env.NEXT_PUBLIC_SUPABASE_URL).href !== database.href) ||
      !secret || !/^[a-f0-9]{64}$/.test(secret)) {
    throw new Error("Local starting-frame mode requires development, local Supabase and a 64-character hex secret.");
  }
  const ownerId = env.LOCAL_APP_WORKER_OWNER_ID?.trim();
  if (appMode && (!ownerId || !/^[a-zA-Z0-9_-]{1,128}$/.test(ownerId))) {
    throw new Error("Local app worker mode requires the tester's Firebase UID.");
  }
  if (appMode && (env.APP_BASE_URL !== "https://localhost:3000" ||
      env.UGC_INTERNAL_APP_URL !== "https://localhost:3000" ||
      env.DODO_PAYMENTS_ENVIRONMENT === "live_mode")) {
    throw new Error("Local app worker mode requires localhost callback URLs and test billing.");
  }
  return { secret, ownerId: appMode ? ownerId : undefined,
    publish: appMode && env.LOCAL_APP_WORKER_PUBLISH === "true" };
}

export function localScheduleName(targetId: string) {
  return `local-publish-${targetId}`;
}
