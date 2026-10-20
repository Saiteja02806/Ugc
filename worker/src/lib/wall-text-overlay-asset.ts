import { createHash } from "node:crypto";
import sharp from "sharp";
import type { WallTextRenderContent, WallTextNormalizedBox, WallTextSafeArea } from "./wall-text-render-spec.js";

/** Bump when typography, rasterization, or layout rules change. */
export const WALL_TEXT_OVERLAY_ASSET_VERSION = "wall-text-png-v1";
const MAX_PNG_BYTES = 8 * 1024 * 1024;

export type WallTextOverlayAsset = {
  version: typeof WALL_TEXT_OVERLAY_ASSET_VERSION;
  inputHash: string;
  sha256: string;
  width: 1080;
  height: 1920;
  png: Buffer;
};

export type WallTextOverlayReference = Omit<WallTextOverlayAsset, "png"> & { key: string; contentHash: string };

export function parseWallTextOverlayReference(value: unknown, userId: string): WallTextOverlayReference | undefined {
  if (value === undefined || value === null) return undefined;
  const asset = value as WallTextOverlayReference;
  const owner = createHash("sha256").update(userId).digest("hex");
  if (asset.version !== WALL_TEXT_OVERLAY_ASSET_VERSION || asset.width !== 1080 || asset.height !== 1920 ||
      !/^[a-f0-9]{64}$/.test(asset.contentHash) || !/^[a-f0-9]{64}$/.test(asset.inputHash) || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      asset.key !== `wall-text-overlays/${owner}/${asset.inputHash}/${asset.sha256}.png`) {
    throw new Error("Invalid or cross-owner Wall-text image reference.");
  }
  return { version: asset.version, width: 1080, height: 1920,
    inputHash: asset.inputHash, sha256: asset.sha256, key: asset.key, contentHash: asset.contentHash };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function wallTextOverlayInputHash(input: unknown): string {
  return createHash("sha256")
    .update(WALL_TEXT_OVERLAY_ASSET_VERSION).update("\n").update(canonical(input))
    .digest("hex");
}

/** Only renderer fields survive job parsing. Product metadata is not typography. */
export function wallTextOverlayContentHash(input: {
  text: WallTextRenderContent; textBox: WallTextNormalizedBox;
  safeArea: WallTextSafeArea; placement: string; textColor: string;
}): string {
  const layout = input.text.finalLayout;
  return wallTextOverlayInputHash({
    text: {
      fullText: input.text.fullText.trim(),
      segments: input.text.segments.map(segment => ({ role: segment.role, lines: segment.lines.map(line => line.trim()) })),
      ...(layout ? { finalLayout: { version: layout.version, fontFamily: layout.fontFamily,
        fontWeight: layout.fontWeight, fontSizePx: layout.fontSizePx,
        lineHeightPx: Math.round(layout.fontSizePx * 1.1 * 100) / 100,
        textBox: layout.textBox,
        blocks: layout.blocks.map(block => ({ role: block.role, lines: block.lines.map(line => line.trim()) })),
      } } : { renderFontSize: input.text.renderFontSize }),
    },
    textBox: input.textBox, safeArea: input.safeArea, placement: input.placement,
    textColor: input.textColor.toLowerCase(),
  });
}

export function wallTextOverlayPngHash(png: Buffer): string {
  return createHash("sha256").update(png).digest("hex");
}

export function packageWallTextOverlay(png: Buffer, inputHash: string): WallTextOverlayAsset {
  return {
    version: WALL_TEXT_OVERLAY_ASSET_VERSION, inputHash,
    sha256: wallTextOverlayPngHash(png), width: 1080, height: 1920, png,
  };
}

/** Fail closed: an edit or corrupt asset must never export different text. */
export async function validateWallTextOverlayAsset(
  asset: WallTextOverlayAsset,
  expectedInputHash: string,
): Promise<Buffer> {
  if (asset.version !== WALL_TEXT_OVERLAY_ASSET_VERSION ||
      asset.inputHash !== expectedInputHash || !/^[a-f0-9]{64}$/.test(expectedInputHash)) {
    throw new Error("Wall-text overlay is stale or uses an unsupported version.");
  }
  if (!Buffer.isBuffer(asset.png) || asset.png.length > MAX_PNG_BYTES ||
      wallTextOverlayPngHash(asset.png) !== asset.sha256) {
    throw new Error("Wall-text overlay bytes failed integrity validation.");
  }
  const decoder = sharp(asset.png, { limitInputPixels: 1080 * 1920 });
  const metadata = await decoder.metadata();
  if (metadata.format !== "png" || metadata.width !== 1080 || metadata.height !== 1920 ||
      asset.width !== 1080 || asset.height !== 1920 || !metadata.hasAlpha ||
      (metadata.pages ?? 1) !== 1) {
    throw new Error("Wall-text overlay must be one transparent 1080 x 1920 PNG.");
  }
  const { data, info } = await decoder.raw().toBuffer({ resolveWithObject: true });
  let visible = false;
  let transparent = false;
  for (let i = info.channels - 1; i < data.length; i += info.channels) {
    visible ||= data[i] > 0;
    transparent ||= data[i] === 0;
  }
  if (!visible || !transparent) throw new Error("Wall-text overlay is empty or opaque.");
  return asset.png;
}
