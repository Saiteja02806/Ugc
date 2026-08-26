import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../../components/trending/trending-workspace.tsx", import.meta.url),
  "utf8",
);

test("retries a timed out or transient Trending feed request without relying on a reload", () => {
  assert.match(workspace, /const TRENDING_FEED_REQUEST_TIMEOUT_MS = 20_000/);
  assert.match(
    workspace,
    /const requestTimeout = window\.setTimeout\([\s\S]*?requestController\.abort\(\)[\s\S]*?TRENDING_FEED_REQUEST_TIMEOUT_MS/,
  );
  assert.match(
    workspace,
    /controller\.signal\.addEventListener\("abort", abortRequest, \{ once: true \}\)[\s\S]*?window\.clearTimeout\(requestTimeout\)[\s\S]*?controller\.signal\.removeEventListener\("abort", abortRequest\)/,
  );
  assert.match(
    workspace,
    /error instanceof TrendingFeedRequestError[\s\S]*?: error instanceof TypeError/,
  );
  assert.match(
    workspace,
    /if \(retryable\) \{[\s\S]*?scheduleFeedRefresh\([\s\S]*?getSmartPreparingPollInterval/,
  );
});
