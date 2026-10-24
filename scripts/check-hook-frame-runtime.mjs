import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { statSync } from "node:fs";

// ffmpeg-static downloads its platform binary during installation. Tracing a
// package path alone cannot establish that the hosted decoder was installed.
const require = createRequire(import.meta.url);
const binary = require("ffmpeg-static");
if (typeof binary !== "string" || !statSync(binary, { throwIfNoEntry: false })?.isFile()) {
  throw new Error("The Hook frame decoder is missing. Install ffmpeg-static with its installation script enabled before building.");
}
const probe = spawnSync(binary, ["-hide_banner", "-version"], {
  encoding: "utf8", windowsHide: true, shell: false, timeout: 10_000,
  maxBuffer: 1024 * 1024,
});
if (probe.error || probe.status !== 0 || !probe.stdout.startsWith("ffmpeg version ")) {
  throw new Error("The installed Hook frame decoder cannot run on this build platform.");
}
console.log(`Hook frame decoder verified on ${process.platform}/${process.arch}.`);
