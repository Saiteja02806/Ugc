import assert from "node:assert/strict";
import test from "node:test";
import { assertLinuxSharpTrace } from "./check-automation-sharp-traces.mjs";

test("automation routes require both Linux sharp binding and libvips in the trace", () => {
  const binding = "../../node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64.node";
  const libvips = "../../worker/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.42";
  assert.doesNotThrow(() => assertLinuxSharpTrace([binding, libvips], "fixture"));
  assert.throws(() => assertLinuxSharpTrace([binding], "fixture"), /libvips missing/);
  assert.throws(() => assertLinuxSharpTrace([libvips], "fixture"), /binding missing/);
});
