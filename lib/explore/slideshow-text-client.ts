import { slideTextSvg, type SlideTextDesign } from "./slideshow-text";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type SlideImageInput = { referenceId: string; slideId: string; mediaAssetId: string | null; ownerId: string | null; preview: boolean };

export function createSlideTextSvg(design: SlideTextDesign, width: number, height: number) {
  const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot edit slide images.");
  return slideTextSvg(design, width, height, (text, font) => { context.font = font; return context.measureText(text).width; });
}
export async function renderSlideText(source: string, design: SlideTextDesign, input?: SlideImageInput): Promise<File> {
  let imageSource = source, ownedBlobUrl: string | null = null;
  if (input && !source.startsWith("blob:")) {
    const token = input.preview ? null : await getCurrentUserIdToken(input.ownerId ?? undefined);
    if (!input.preview && (!input.ownerId || !token)) throw new Error("Sign in to export your slide images.");
    const params = new URLSearchParams({ referenceId: input.referenceId, slideId: input.slideId });
    if (input.mediaAssetId) params.set("mediaAssetId", input.mediaAssetId);
    if (input.preview) params.set("preview", "1");
    const response = await fetch(`/api/explore/slideshows/image?${params}`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!response.ok) throw new Error("Could not load this slide for export. Your changes are preserved.");
    ownedBlobUrl = URL.createObjectURL(await response.blob()); imageSource = ownedBlobUrl;
  }
  try {
  const image = new Image(); image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not load this slide for export. Your changes are preserved.")); image.src = imageSource; });
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale), height = Math.round(image.naturalHeight * scale);
  const svg = createSlideTextSvg(design, width, height);
  const overlay = svg ? new Image() : null;
  if (overlay) await new Promise<void>((resolve, reject) => { overlay.onload = () => resolve(); overlay.onerror = () => reject(new Error("Could not render the slide text.")); overlay.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d"); if (!context) throw new Error("This browser cannot export edited slides.");
  context.drawImage(image, 0, 0, width, height); if (overlay) context.drawImage(overlay, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => { try { canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not export your slide.")), "image/png"); } catch { reject(new Error("The slide cannot be exported from this source. Upload its image to edit it.")); } });
  return new File([blob], "edited-slide.png", { type: "image/png" });
  } finally { if (ownedBlobUrl) URL.revokeObjectURL(ownedBlobUrl); }
}
