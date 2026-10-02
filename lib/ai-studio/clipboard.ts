export class AIStudioClipboardError extends Error {}

export async function copyAIStudioPrompt(prompt: string) {
  if (!navigator.clipboard?.writeText) {
    throw new AIStudioClipboardError("Your browser cannot copy text here. Select and copy the prompt manually.");
  }
  await navigator.clipboard.writeText(prompt);
}

export async function copyAIStudioImage(url: string) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new AIStudioClipboardError("Your browser cannot copy images here. Use Download instead.");
  }
  // Construct and write the item during the click so browsers retain user
  // activation while the image is fetched and converted to clipboard PNG.
  const image = fetchImageAsPng(url);
  void image.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
}

async function fetchImageAsPng(url: string) {
  const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Image could not be loaded.");
  const blob = await response.blob();
  if (blob.type === "image/png") return blob;
  if (!blob.type.startsWith("image/")) throw new Error("The response is not an image.");

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image conversion is unavailable.");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => png ? resolve(png) : reject(new Error("Image conversion failed.")), "image/png");
    });
  } finally {
    bitmap.close();
  }
}

export function getAIStudioClipboardError(error: unknown, kind: "image" | "prompt") {
  if (error instanceof AIStudioClipboardError) return error.message;
  if (error instanceof Error && error.name === "NotAllowedError") {
    return "Clipboard access was blocked. Allow it in your browser, then try again.";
  }
  return kind === "image"
    ? "Couldn't copy the image. Try again or use Download."
    : "Couldn't copy the prompt. Try again or select the text manually.";
}
