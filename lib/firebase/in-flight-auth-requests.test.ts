import assert from "node:assert/strict";
import test from "node:test";

import { createInFlightAuthRequestCoalescer } from "./in-flight-auth-requests.ts";

test("shares an overlapping authentication request for the same token", async () => {
  const run = createInFlightAuthRequestCoalescer<string>();
  let finishRequest: ((value: string) => void) | undefined;
  let requestCount = 0;

  const firstRequest = run("project-a:token-a", () => {
    requestCount += 1;

    return new Promise<string>((resolve) => {
      finishRequest = resolve;
    });
  });
  const secondRequest = run("project-a:token-a", async () => {
    requestCount += 1;
    return "unexpected second result";
  });

  await Promise.resolve();

  assert.equal(requestCount, 1);
  assert.strictEqual(secondRequest, firstRequest);

  assert.ok(finishRequest);
  finishRequest("verified user");

  assert.deepEqual(await Promise.all([firstRequest, secondRequest]), [
    "verified user",
    "verified user",
  ]);
});

test("does not share authentication requests across tokens or projects", async () => {
  const run = createInFlightAuthRequestCoalescer<string>();
  let requestCount = 0;

  const values = await Promise.all([
    run("project-a:token-a", async () => {
      requestCount += 1;
      return "user a";
    }),
    run("project-a:token-b", async () => {
      requestCount += 1;
      return "user b";
    }),
    run("project-b:token-a", async () => {
      requestCount += 1;
      return "user c";
    }),
  ]);

  assert.equal(requestCount, 3);
  assert.deepEqual(values, ["user a", "user b", "user c"]);
});

test("does not cache a completed authentication result", async () => {
  const run = createInFlightAuthRequestCoalescer<number>();
  let requestCount = 0;

  const firstResult = await run("project-a:token-a", async () => {
    requestCount += 1;
    return requestCount;
  });
  const secondResult = await run("project-a:token-a", async () => {
    requestCount += 1;
    return requestCount;
  });

  assert.equal(firstResult, 1);
  assert.equal(secondResult, 2);
  assert.equal(requestCount, 2);
});

test("does not cache a failed authentication request", async () => {
  const run = createInFlightAuthRequestCoalescer<string>();
  let requestCount = 0;

  await assert.rejects(
    run("project-a:token-a", async () => {
      requestCount += 1;
      throw new Error("invalid session");
    }),
    /invalid session/,
  );

  const result = await run("project-a:token-a", async () => {
    requestCount += 1;
    return "verified user";
  });

  assert.equal(result, "verified user");
  assert.equal(requestCount, 2);
});
