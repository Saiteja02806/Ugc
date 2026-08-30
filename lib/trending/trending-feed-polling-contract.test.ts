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
  assert.match(
    workspace,
    /if \(\(data\.feed\?\.pendingSlotCount \?\? 0\) > 0\)[\s\S]*scheduleFeedRefresh/,
  );
  assert.match(workspace, /if \(attemptCount <= 10\) return 10_000/);
  assert.match(workspace, /return 60_000/);
});

test("shows generation progress instead of caught-up while daily slots remain pending", () => {
  assert.match(
    workspace,
    /setTrendingFeedProgress\(nextFeedProgress\)/,
  );
  assert.match(
    workspace,
    /pendingSlotCount=\{trendingFeedProgress\?\.pendingSlotCount \?\? 0\}/,
  );
  assert.match(
    workspace,
    /items\.length === 0 && \(preparing \|\| pendingSlotCount > 0\)[\s\S]*TrendingPreparingEmptyState/,
  );
  assert.match(
    workspace,
    /\) : pendingSlotCount > 0 \? \([\s\S]*TrendingPreparingEmptyState[\s\S]*TrendingReadyEmptyState/,
  );
  assert.match(workspace, /<EmptyTitle>Generating for you<\/EmptyTitle>/);
  assert.match(
    workspace,
    /remainingCount > 0[\s\S]*TrendingIncompleteEmptyState/,
  );
  assert.match(
    workspace,
    /remainingCount: Math\.max\(current\.remainingCount - 1, 0\)/,
  );
  assert.match(
    workspace,
    /data\.feed\.remainingCount - pendingLocalDecisionCount/,
  );
});
