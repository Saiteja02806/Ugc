import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Forward public browser configuration only. Never copy an environment file or
// spread arbitrary source-checkout secrets into an isolated verification build.
const allow = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"];
const env = { ...process.env, EXPLORE_GENERATION_ENABLED: "false", EXPLORE_FINISHING_ENABLED: "false", EXPLORE_FINISHING_SUBTITLES_ENABLED: "false", EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED: "false", AUDIO_GENERATION_ENABLED: "false" };
if (process.argv[2]) {
  const source = readFileSync(resolve(process.argv[2]), "utf8");
  for (const key of allow) {
    const match = source.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
    if (match) env[key] = match[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}
if (allow.some(key => !env[key])) throw new Error("Supply the existing public Firebase build configuration. No server credentials are needed.");
const result = spawnSync(process.execPath, [resolve("node_modules/next/dist/bin/next"), "build"], { env, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
