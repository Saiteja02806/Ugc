import { ffmpeg, syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

const carouselReplenishmentEnv = syncEnvVars(({ env, environment }) => {
  if (environment !== "prod") {
    return;
  }

  const secret =
    env.UGC_INTERNAL_CAROUSEL_SECRET ??
    process.env.UGC_INTERNAL_CAROUSEL_SECRET ??
    "";
  const appBaseUrl =
    env.APP_BASE_URL ??
    process.env.APP_BASE_URL ??
    "https://www.getugcpilot.com";

  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "UGC_INTERNAL_CAROUSEL_SECRET must be at least 32 bytes for production Trigger deployment.",
    );
  }

  return {
    APP_BASE_URL: appBaseUrl,
    UGC_INTERNAL_CAROUSEL_SECRET: secret,
  };
}, { override: true });

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_lbevwiewxpvtivwryiym",
  runtime: "node",
  dirs: ["./trigger"],
  maxDuration: 900,
  enableConsoleLogging: true,
  build: {
    extensions: [ffmpeg({ version: "7" }), carouselReplenishmentEnv],
  },
});
