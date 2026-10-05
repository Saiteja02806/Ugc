/** Local layout validation only; these are not provider capability limits. */
export function validateAppScreenFile(file: { type: string; size: number }):
  { kind: "image" | "video"; error: null } | { kind: null; error: string } {
  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
  if (!kind) return { kind: null, error: "Choose an app screenshot or screen recording." };
  const maxMB = kind === "image" ? 20 : 250;
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxMB * 1024 * 1024) {
    return { kind: null, error: `Choose ${kind === "image" ? "a screenshot" : "a screen recording"} smaller than ${maxMB} MB.` };
  }
  return { kind, error: null };
}
