import type { AIStudioReferenceKind } from "./reference-media-upload.ts";

export const REFERENCE_FILE_ACCEPT = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/quicktime,video/webm",
  audio: "audio/mpeg,audio/wav,audio/x-wav",
} as const;

export function getReferenceFileKind(type: string): AIStudioReferenceKind | null {
  for (const kind of ["image", "video", "audio"] as const) {
    if (REFERENCE_FILE_ACCEPT[kind].split(",").includes(type)) return kind;
  }
  return null;
}

export function validateReferenceFileBatch(
  types: string[],
  existingKinds: AIStudioReferenceKind[],
  allowedKinds: AIStudioReferenceKind[],
  maxFiles: number,
) {
  const kinds = types.map(getReferenceFileKind);
  if (kinds.some((kind) => !kind)) return "Use JPG, PNG, WebP, MP4, MOV, WebM, MP3, or WAV files.";
  if (kinds.some((kind) => !allowedKinds.includes(kind!))) {
    return allowedKinds.length === 1
      ? "This mode accepts image references. Select Seedance 2.5 to add video or audio."
      : "This model does not accept that reference type.";
  }
  if (existingKinds.length + kinds.length > maxFiles) return `You can attach up to ${maxFiles} reference files in UGC Pilot.`;
  if ([...existingKinds, ...kinds].filter((kind) => kind === "video").length > 1) return "Attach one reference video. Remove the current video to replace it.";
  return null;
}
