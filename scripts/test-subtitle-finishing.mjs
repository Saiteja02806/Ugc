// Offline feature regression suite. No uploads, deployment, or paid providers.
import { mkdir, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const temporary = resolve(".tmp/subtitle-test-tmp");
await mkdir(temporary, {recursive:true});
const env = {...process.env, TEMP:temporary, TMP:temporary, TMPDIR:temporary};
async function run(args) {
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, {env,stdio:"inherit",windowsHide:true});
    child.on("error", reject); child.on("close", done);
  });
  if (code !== 0) process.exit(code ?? 1);
}
await run(["node_modules/typescript/bin/tsc", "--noEmit"]);
await run(["node_modules/typescript/bin/tsc", "-p", "worker/tsconfig.json"]);
const workerTests = (await readdir("worker/dist/subtitles")).filter(file => file.endsWith(".test.js")).map(file => `worker/dist/subtitles/${file}`);
await run(["--import", "./scripts/subtitle-test-loader.mjs", "--experimental-transform-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--test", "--test-concurrency=1",
  ...workerTests,
  ...["explore-video-composition", "explore-video-finishing", "explore-finishing-job", "explore-finishing-storage", "explore-finishing-receipts-db", "explore-media-upload", "workflow-composition-panel", "workflow-default-music", "workflow-finishing-api", "workflow-finishing-store", "workflow-finishing-ui", "subtitle-previews", "subtitle-preview-player"].map(name => `scripts/${name}.test.mjs`),
]);
