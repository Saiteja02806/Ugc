import { slideshowImageFit } from "./slideshow-image-fit";

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
    context.save(); context.filter = "blur(24px)"; context.globalAlpha = .75;
    const background = fit.background; context.drawImage(image, background.x, background.y, background.width, background.height); context.restore();
    const foreground = fit.foreground; context.drawImage(image, foreground.x, foreground.y, foreground.width, foreground.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not prepare this slideshow image. Please try again.")), "image/png"));
    if (blob.size > 25 * 1024 * 1024) throw new Error("This slideshow image is too large. Choose a smaller image.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-4x5.png`, { type: "image/png", lastModified: file.lastModified });
  } finally { image.close(); }
}
