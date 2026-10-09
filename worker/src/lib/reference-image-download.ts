import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { parseImageReferenceContext } from "./image-reference-context.js";

export const MAX_REFERENCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_REFERENCE_CONTEXT_BYTES = 50 * 1024 * 1024;

/** Bound the whole multi-image request as well as each individual download. */
export async function downloadReferenceImageContext(urls: string[], maxContextBytes = MAX_REFERENCE_CONTEXT_BYTES) {
  const checked = parseImageReferenceContext(urls);
  const images: Awaited<ReturnType<typeof downloadReferenceImageBytes>>[] = [];
  let remaining = maxContextBytes;
  for (const url of checked) {
    if (remaining <= 0) throw new ProviderRequestNotSubmittedError("Selected reference images exceed 50 MB combined. Select fewer or smaller slides.");
    const image = await downloadReferenceImageBytes(url, Math.min(remaining, MAX_REFERENCE_IMAGE_BYTES));
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.contentType)) {
      throw new ProviderRequestNotSubmittedError("Use JPG, PNG or WebP reference images.");
    }
    remaining -= image.buffer.length;
    images.push(image);
  }
  return images;
}

export async function downloadReferenceImageBytes(
  url: string,
  maxBytes = MAX_REFERENCE_IMAGE_BYTES,
) {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image could not be downloaded.",
      { cause: error },
    );
  }

  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image could not be downloaded.",
    );
  }

  const contentType =
    response.headers.get("content-type")?.split(";", 1)[0] ?? "image/png";
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body.cancel();
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image is empty or too large.",
    );
  }

  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ProviderRequestNotSubmittedError(
          "The uploaded reference image is empty or too large.",
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ProviderRequestNotSubmittedError) throw error;
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image could not be downloaded.",
      { cause: error },
    );
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image is empty or too large.",
    );
  }
  return { buffer: Buffer.concat(chunks, totalBytes), contentType };
}
