import { slideshowImageFit } from "./slideshow-image-fit";

/** Background blur is baked at a small size first, then stretched. Keeping this
 * narrow keeps the decorative backdrop cheap for every non-4:5 upload. */
const SLIDESHOW_SCRATCH_WIDTH = 200;

/** Ask for WebP first (photographic sources stay small on the wire) and fall
 * back to JPEG, then PNG, for browsers that cannot encode it. */
async function slideshowCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const request = (type: string, quality?: number) => new Promise<Blob | null>(resolve => {
    try { canvas.toBlob(value => resolve(value), type, quality); } catch { resolve(null); }
  });
  const webp = await request("image/webp", .9);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await request("image/jpeg", .92);
  if (jpeg?.type === "image/jpeg") return jpeg;
  const png = await request("image/png");
  return png;
}

export function slideshowUploadExtension(type: string) {
  return type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "png";
}

/** Only slideshow slide uploads use this conversion. No AI/provider call. */
export async function fitSlideshowUpload(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 25 * 1024 * 1024) throw new Error("Choose JPG, PNG or WebP images, up to 25 MB each.");
  let image: ImageBitmap;
  try { image = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Could not read this image. Choose a valid JPG, PNG or WebP image."); }
  try {
    const fit = slideshowImageFit(image.width, image.height);
    if (fit.alreadyFits) return file;
    const canvas = document.createElement("canvas"); canvas.width = fit.width; canvas.height = fit.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("This browser cannot prepare slideshow images.");
    context.fillStyle = "#111314"; context.fillRect(0, 0, fit.width, fit.height);
    // The blurred backdrop is decorative. Blur a small copy at the scaled
    // radius and stretch it, instead of filtering the full-resolution photo.
    const scale = SLIDESHOW_SCRATCH_WIDTH / fit.width;
    const scratch = document.createElement("canvas"); scratch.width = SLIDESHOW_SCRATCH_WIDTH; scratch.height = Math.max(1, Math.round(scratch.width * fit.height / fit.width));
    const scratchContext = scratch.getContext("2d"); if (!scratchContext) throw new Error("This browser cannot prepare slideshow images.");
    const background = fit.background;
    scratchContext.filter = `blur(${(24 * scale).toFixed(2)}px)`;
    scratchContext.drawImage(image, background.x * scale, background.y * scale, background.width * scale, background.height * scale);
    scratchContext.filter = "none";
    context.globalAlpha = .75;
    context.drawImage(scratch, background.x, background.y, background.width, background.height);
    context.globalAlpha = 1;
    const foreground = fit.foreground; context.drawImage(image, foreground.x, foreground.y, foreground.width, foreground.height);
    const blob = await slideshowCanvasBlob(canvas);
    if (!blob) throw new Error("Could not prepare this slideshow image. Please try again.");
    if (blob.size > 25 * 1024 * 1024) throw new Error("This slideshow image is too large. Choose a smaller image.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-4x5.${slideshowUploadExtension(blob.type)}`, { type: blob.type, lastModified: file.lastModified });
  } finally { image.close(); }
}
