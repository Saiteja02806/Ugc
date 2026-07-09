import type { HookVideoCameraStyle } from "@/lib/video/types";

type BuildUgcVideoPromptInput = {
  productName?: string;
  productDescription?: string;
  hookIdea: string;
  emotion: string;
  cameraStyle: HookVideoCameraStyle | string;
};

const cameraStyleLabels: Record<HookVideoCameraStyle, string> = {
  iphone_selfie: "iPhone selfie video",
  tiktok_ugc: "TikTok-style UGC video",
  home_office: "modern home office creator video",
  desk_setup: "creator desk setup product demo video",
};

function getCameraStyleLabel(cameraStyle: HookVideoCameraStyle | string) {
  return (
    cameraStyleLabels[cameraStyle as HookVideoCameraStyle] ??
    cameraStyle.replace(/_/g, " ")
  );
}

export function buildUgcVideoPrompt(input: BuildUgcVideoPromptInput) {
  return `
Create a realistic vertical 9:16 UGC-style short video for a social media ad.

Scene:
A real-looking creator records a natural selfie-style video in a modern indoor setting.

Emotion:
The creator should look ${input.emotion}, with realistic facial expression, natural eye movement, believable micro-expressions, and human-like timing.

Hook idea:
${input.hookIdea}

Product context:
${input.productName ?? "A useful digital product or app"}
${input.productDescription ?? ""}

Camera style:
${getCameraStyleLabel(input.cameraStyle)}, handheld smartphone feel, natural slight camera movement, realistic indoor lighting.

Motion:
The creator reacts naturally, leans slightly toward the camera, changes facial expression subtly, and feels like a real TikTok or Instagram creator.

Important:
No text overlays.
No captions.
No logos.
No watermarks.
No distorted face.
No extra people.
No fake glossy AI look.
No robotic expression.
No unnatural mouth movement unless dialogue is explicitly requested.
The video should feel like real UGC footage, not a cinematic movie trailer.
`.trim();
}
