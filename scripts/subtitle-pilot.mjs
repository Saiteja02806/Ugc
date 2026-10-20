/** Run with node --env-file=.env.local scripts/subtitle-pilot.mjs */
import { startSubtitlePilot } from "./subtitle-pilot/server.mjs";
import { checkPilotRuntime } from "./subtitle-pilot/pipeline.mjs";
import { SubtitleError } from "../worker/dist/subtitles/contracts.js";
try {
  const port = Number(process.env.SUBTITLE_PILOT_PORT ?? 8780);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new SubtitleError("INVALID_PORT", "SUBTITLE_PILOT_PORT must be between 1024 and 65535.");
  const runtime = { python: process.env.SUBTITLE_PYTHON, modelDir: process.env.SUBTITLE_MODEL_DIR };
  await checkPilotRuntime(runtime);
  const pilot = await startSubtitlePilot({ port, ...runtime });
  console.log(`Subtitle pilot: ${pilot.origin}`);
  console.log("Local English / 30-second pilot. Existing application features are disconnected.");
  process.once("SIGINT", () => { void pilot.close(); });
  process.once("SIGTERM", () => { void pilot.close(); });
} catch (error) {
  console.error(error instanceof SubtitleError ? `${error.code}: ${error.message}` : "The subtitle pilot could not start. Check the build, runtime and port.");
  process.exitCode = 1;
}
