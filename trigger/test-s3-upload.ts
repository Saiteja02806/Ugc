import { logger, task } from "@trigger.dev/sdk";

import { uploadBufferToS3 } from "@/lib/storage/s3";

export const testS3UploadTask = task({
  id: "test-s3-upload",
  run: async () => {
    logger.info("Starting Trigger.dev S3 upload test");

    const key = `health-check/trigger-${crypto.randomUUID()}.txt`;

    const result = await uploadBufferToS3({
      key,
      buffer: Buffer.from("Hello from Trigger.dev, S3, and CloudFront"),
      contentType: "text/plain",
      cacheControl: "no-cache",
    });

    logger.info("Trigger.dev S3 upload test completed", {
      key: result.key,
      url: result.url,
    });

    return {
      ok: true,
      key: result.key,
      url: result.url,
    };
  },
});
