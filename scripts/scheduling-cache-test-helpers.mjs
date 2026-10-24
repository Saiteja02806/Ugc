import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";
import * as keys from "../lib/scheduling/account-data-query-cache.ts";
import * as connectionRevision from "../lib/social/connection-revision.ts";
import * as connectionEvents from "../lib/social/connection-cache-events.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

// Exercise the real account cache and loaders; only authentication/HTTP are isolated.
export function createScheduleCacheFixture(owner, fetch = async () => { throw new Error("Unexpected cache HTTP request"); }, options = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../lib/scheduling/account-data-query.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, fetch, Error, Date,
    require(name) {
      if (name === "./account-data-query-cache") return keys;
      if (name === "../social/connection-revision") return connectionRevision;
      if (name === "../social/connection-cache-events") return connectionEvents;
      if (name === "../http/read-deadline") return { withReadDeadline: (read, signal) => withReadDeadline(read, signal, options.timeoutMs ?? 20_000) };
      assert.equal(name, "../firebase/auth");
      return { getCurrentUserIdToken: options.getToken ?? (async expectedOwner => { assert.equal(expectedOwner, owner); return "fixture-owner-token"; }) };
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData(keys.getAccountSchedulesQueryKey(owner), { schedules: [], minimumScheduleLeadMinutes: 5 });
  queryClient.setQueryData(keys.getAccountSchedulesQueryKey("foreign-owner"), { schedules: [{ id: "foreign-post" }] });
  return { queryClient, api: exports, key: keys.getAccountSchedulesQueryKey(owner),
    data: () => queryClient.getQueryData(keys.getAccountSchedulesQueryKey(owner)),
    foreign: () => queryClient.getQueryData(keys.getAccountSchedulesQueryKey("foreign-owner")),
  };
}
