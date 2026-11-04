import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { assertLinuxSharpTrace, verifyIsolatedSharpTrace } from "./check-automation-sharp-traces.mjs";

const require = createRequire(import.meta.url);

test("automation routes require both Linux sharp binding and libvips in the trace", () => {
  const binding = "../../node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64.node";
  const libvips = "../../worker/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.42";
  assert.doesNotThrow(() => assertLinuxSharpTrace([binding, libvips], "fixture"));
  assert.throws(() => assertLinuxSharpTrace([binding], "fixture"), /libvips missing/);
  assert.throws(() => assertLinuxSharpTrace([libvips], "fixture"), /binding missing/);
});

test("isolated Sharp gate uses traced dependencies and rejects checkout-only native packages", async () => {
  const { nodeFileTrace } = require("next/dist/compiled/@vercel/nft");
  const root = process.cwd();
  const { fileList } = await nodeFileTrace([require.resolve("sharp")], { base: root });
  const trace = resolve(".tmp/automation-sharp-runtime/route.js.nft.json");
  await mkdir(dirname(trace), { recursive: true });
  const files = [...fileList].map(file => relative(dirname(trace), resolve(file)));
  await writeFile(trace, JSON.stringify({ files }));
  await verifyIsolatedSharpTrace(trace);
  const nativePackages = /node_modules\/@img\/sharp-/;
  const withoutNative = files.filter(file => !nativePackages.test(file.replaceAll("\\", "/")));
  assert.ok(withoutNative.length < files.length);
  await writeFile(trace, JSON.stringify({ files: withoutNative }));
  await assert.rejects(verifyIsolatedSharpTrace(trace), /isolated Sharp runtime failed/);
});
