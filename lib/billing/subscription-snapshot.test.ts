import assert from "node:assert/strict";
import test from "node:test";

import {
  readSubscriptionSnapshot,
  writeSubscriptionSnapshot,
} from "./subscription-snapshot.ts";

const STORAGE_KEY = "vidmake.billing.plan-snapshot.v1";

const snapshot = {
  accessSource: "dodo",
  billingInterval: "monthly",
  isActive: true,
  isDodoManaged: true,
  planKey: "growth",
  status: "active",
  trial: { status: "expired" },
} as const;

type FixedStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const store = new Map<string, string>();
const storage: FixedStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => {
    store.set(key, value);
  },
};

type StorageLike = { localStorage?: FixedStorage };

function setStorage(value: StorageLike | undefined): void {
  (globalThis as { window?: unknown }).window = value;
}

function hideStorage(): void {
  setStorage(undefined);
}

test.afterEach(hideStorage);

test("reads nothing before a browser window exists", () => {
  hideStorage();
  assert.equal(readSubscriptionSnapshot("owner"), null);
  assert.equal(writeSubscriptionSnapshot("owner", snapshot), undefined);
});

test("writes and reads the plan snapshot for the owning user", () => {
  hideStorage();
  setStorage({ localStorage: storage });
  writeSubscriptionSnapshot("stub-user", snapshot);
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ownerId: "owner",
      storedAt: Date.now(),
      subscription: snapshot,
    }),
  );
  assert.deepEqual(readSubscriptionSnapshot("owner"), snapshot);
  assert.equal(readSubscriptionSnapshot("other-owner"), null);
});

test("writes and re-reads the exact saved snapshot for the same owner", () => {
  setStorage({ localStorage: storage });
  store.clear();
  writeSubscriptionSnapshot("owner", snapshot);
  assert.deepEqual(readSubscriptionSnapshot("owner"), snapshot);
});

test("ignores cached snapshots that are older than 24 hours", () => {
  setStorage({ localStorage: storage });
  store.clear();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ownerId: "owner",
      storedAt: Date.now() - 25 * 60 * 60 * 1_000,
      subscription: snapshot,
    }),
  );
  assert.equal(readSubscriptionSnapshot("owner"), null);
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ownerId: "owner",
      storedAt: Date.now() - 23 * 60 * 60 * 1_000,
      subscription: snapshot,
    }),
  );
  assert.ok(readSubscriptionSnapshot("owner"));
});

test("ignores a cache entry that drifted outside the saved plan fields", () => {
  setStorage({ localStorage: storage });
  store.clear();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ownerId: "owner",
      storedAt: Date.now(),
      subscription: { ...snapshot, isActive: "yes" } as unknown,
    }),
  );
  assert.equal(readSubscriptionSnapshot("owner"), null);
});

test("ignores unparsable cache content", () => {
  setStorage({ localStorage: storage });
  store.clear();
  storage.setItem(STORAGE_KEY, "not-json");
  assert.equal(readSubscriptionSnapshot("owner"), null);
});
