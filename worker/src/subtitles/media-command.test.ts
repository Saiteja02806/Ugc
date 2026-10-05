import assert from "node:assert/strict";
import test from "node:test";
import { runMediaCommand } from "./media.js";

test("media commands can use a caller-supplied environment without changing the worker environment", async () => {
  const key = "UGC_SUBTITLE_COMMAND_TEST_VALUE";
  const previous = process.env[key];
  try {
    process.env[key] = "worker-value";
    const result = await runMediaCommand(process.execPath,
      ["-e", `process.stdout.write(process.env.${key} ?? '')`],
      { env: { ...process.env, [key]: "isolated-value" } });
    assert.equal(result.stdout, "isolated-value");
    assert.equal(process.env[key], "worker-value");
    const inherited = await runMediaCommand(process.execPath,
      ["-e", `process.stdout.write(process.env.${key} ?? '')`]);
    assert.equal(inherited.stdout, "worker-value");
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

test("media command arguments remain literal and are not interpreted by a shell", async () => {
  const argument = "literal & echo unwanted | <input>";
  const result = await runMediaCommand(process.execPath,
    ["-e", "process.stdout.write(process.argv[1])", argument]);
  assert.equal(result.stdout, argument);
});

test("cancelled media commands reject before spawning a subprocess", async () => {
  const controller = new AbortController();
  controller.abort(new Error("cancelled-before-spawn"));
  await assert.rejects(runMediaCommand(process.execPath,
    ["-e", "throw new Error('must-not-run')"], { signal: controller.signal }),
    /cancelled-before-spawn/);
});
