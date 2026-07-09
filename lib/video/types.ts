export const hookVideoProviders = ["veo", "runway"] as const;
export const hookVideoEmotions = [
  "surprised",
  "excited",
  "curious",
  "skeptical",
  "confident",
] as const;
export const hookVideoCameraStyles = [
  "iphone_selfie",
  "tiktok_ugc",
  "home_office",
  "desk_setup",
] as const;

export type HookVideoProvider = (typeof hookVideoProviders)[number];
export type HookVideoEmotion = (typeof hookVideoEmotions)[number];
export type HookVideoCameraStyle = (typeof hookVideoCameraStyles)[number];
export type VideoProvider = HookVideoProvider | "heygen";

export type GenerateHookVideoPayload = {
  videoId: string;
  userId: string;
  projectId: string;
  provider?: HookVideoProvider;
  avatarImageUrl?: string;
  productName?: string;
  productDescription?: string;
  hookIdea: string;
  emotion: HookVideoEmotion;
  cameraStyle: HookVideoCameraStyle;
};

export type GenerateTalkingAvatarVideoPayload = {
  videoId: string;
  userId: string;
  projectId: string;
  avatarImageUrl?: string;
  avatarId?: string;
  voiceId?: string;
  script: string;
};

export type GeneratedVideoTaskOutput = {
  ok: true;
  videoId: string;
  provider: VideoProvider;
  key: string;
  url: string;
};
