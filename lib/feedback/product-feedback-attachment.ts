import "server-only";

import { randomUUID } from "node:crypto";

import sharp from "sharp";

import {
  getStorageObject,
  headStorageObject,
} from "@/lib/storage/storage";

import type { ProductFeedbackAttachment } from "@/lib/feedback/product-feedback-types";

export const PRODUCT_FEEDBACK_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const PRODUCT_FEEDBACK_ATTACHMENT_UPLOAD_EXPIRES_SECONDS = 10 * 60;

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const PRODUCT_FEEDBACK_ATTACHMENT_CONTENT_TYPES = Array.from(
  IMAGE_EXTENSIONS.keys(),
);

export class ProductFeedbackAttachmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProductFeedbackAttachmentError";
  }
}

export type ProductFeedbackAttachmentUploadTarget = {
  attachmentId: string;
  contentType: string;
  fileName: string;
  fileSize: number;
  storageKey: string;
};

export function createProductFeedbackAttachmentUploadTarget(input: {
  contentType: string;
  fileName: string;
  fileSize: number;
  userId: string;
}) {
  const contentType = input.contentType.trim().toLowerCase();
  const extension = IMAGE_EXTENSIONS.get(contentType);
  const fileName = input.fileName.trim();

  if (!extension) {
    throw new ProductFeedbackAttachmentError(
      "Attach a JPG, PNG, or WebP image.",
      400,
    );
  }
  if (!fileName || fileName.length > 255 || /[/\\\0]/u.test(fileName)) {
    throw new ProductFeedbackAttachmentError(
      "Choose an image file without folder paths.",
      400,
    );
  }
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0) {
    throw new ProductFeedbackAttachmentError(
      "The attached image is empty or invalid.",
      400,
    );
  }
  if (input.fileSize > PRODUCT_FEEDBACK_ATTACHMENT_MAX_BYTES) {
    throw new ProductFeedbackAttachmentError(
      "The attached image is too large. Maximum size is 10 MB.",
      413,
    );
  }

  const attachmentId = randomUUID();
  const cleanUserId = cleanPathPart(input.userId);

  return {
    attachmentId,
    contentType,
    fileName,
    fileSize: input.fileSize,
    storageKey:
      `product-feedback/${cleanUserId}/` + `${attachmentId}${extension}`,
  } satisfies ProductFeedbackAttachmentUploadTarget;
}

export async function inspectProductFeedbackAttachment(input: {
  expectedContentType: string;
  expectedFileSize: number;
  storageKey: string;
}): Promise<ProductFeedbackAttachment> {
  const object = await headStorageObject({ key: input.storageKey });
  const contentType = object.ContentType?.split(";", 1)[0]?.trim().toLowerCase();
  const sizeBytes = object.ContentLength ?? 0;

  if (!contentType || !PRODUCT_FEEDBACK_ATTACHMENT_CONTENT_TYPES.includes(contentType)) {
    throw new ProductFeedbackAttachmentError(
      "The attached file is not a JPG, PNG, or WebP image.",
      422,
    );
  }
  if (contentType !== input.expectedContentType) {
    throw new ProductFeedbackAttachmentError(
      "The attached image type changed during upload. Attach it again and retry.",
      422,
    );
  }
  if (sizeBytes <= 0 || sizeBytes > PRODUCT_FEEDBACK_ATTACHMENT_MAX_BYTES) {
    throw new ProductFeedbackAttachmentError(
      "The attached image is empty or exceeds the 10 MB limit.",
      sizeBytes > PRODUCT_FEEDBACK_ATTACHMENT_MAX_BYTES ? 413 : 422,
    );
  }
  if (sizeBytes !== input.expectedFileSize) {
    throw new ProductFeedbackAttachmentError(
      "The attached image changed during upload. Attach it again and retry.",
      422,
    );
  }

  const downloaded = await getStorageObject({ key: input.storageKey });
  if (!downloaded.Body) {
    throw new ProductFeedbackAttachmentError(
      "The attached image could not be read.",
      422,
    );
  }

  const buffer = Buffer.from(
    await new Response(downloaded.Body.transformToWebStream()).arrayBuffer(),
  );
  const metadata = await sharp(buffer, { limitInputPixels: 50_000_000 }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    throw new ProductFeedbackAttachmentError(
      "The attached file does not contain a readable image.",
      422,
    );
  }

  return {
    fileName: "",
    height,
    mimeType: contentType,
    sizeBytes,
    width,
  };
}

function cleanPathPart(value: string) {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]/gu, "-")
      .replace(/-+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 96) || "user"
  );
}
