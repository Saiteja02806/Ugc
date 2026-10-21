import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// A working executable in the build checkout is not proof that a deployed
// function contains the native package that resolves its executable path.
for (const route of ["hook-starting-frame", "hook-keyframe"]) {
  const trace = join(process.cwd(), ".next/server/app/api/explore", route, "route.js.nft.json");
  const { files } = JSON.parse(await readFile(trace, "utf8"));
  for (const name of ["index.js", "package.json", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"]) {
    const file = files.find(file => file.replaceAll("\\", "/").endsWith(`node_modules/ffmpeg-static/${name}`));
    assert(file, `${route}: native ffmpeg-static ${name} is missing from the function trace.`);
    assert((await stat(resolve(dirname(trace), file))).isFile(), `${route}: traced decoder file is missing.`);
  }
}
console.log("Hook decoder route bundles verified: native module, metadata and executable.");
