import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

let userId = "verified-owner";
let authError;
let databaseError;
let foreignRead;
let rows;
let requests;
class FirebaseAuthRequestError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError,
  requireFirebaseUser: async () => {
    if (authError) throw authError;
    return { uid: userId };
  },
} });

process.env.SUPABASE_URL = "https://character-preferences-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role-key";
const { GET, POST } = await import("../../app/api/characters/preferences/route.ts");
const getRequest = () => new Request("https://www.getugcpilot.com/api/characters/preferences?userId=foreign-owner");
const postRequest = (body) => new Request("https://www.getugcpilot.com/api/characters/preferences", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
const readPreference = async () => (await (await GET(getRequest())).json()).preference;
const writePreference = async (body) => (await (await POST(postRequest(body))).json()).preference;

beforeEach(() => {
  userId = "verified-owner"; authError = databaseError = foreignRead = undefined; rows = new Map(); requests = [];
  mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.pathname, "/rest/v1/character_preferences");
    const method = options?.method ?? "GET";
    const headers = new Headers(options?.headers);
    requests.push({ method, url, headers, body: options?.body ? JSON.parse(options.body) : null });
    if (databaseError) return Response.json({ message: databaseError, code: "42P01" }, { status: 400 });
    if (method === "GET") {
      assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
      assert.equal(url.searchParams.get("select"), "user_id,gender,seen_at");
      return Response.json(foreignRead ?? rows.get(userId) ?? null);
    }
    assert.equal(method, "POST");
    assert.equal(url.searchParams.get("on_conflict"), "user_id");
    const body = JSON.parse(options.body);
    assert.equal(body.user_id, userId);
    assert.deepEqual(Object.keys(body).sort(), body.gender ? ["gender", "user_id"] : ["user_id"]);
    assert.ok(headers.get("Prefer").includes(body.gender ? "resolution=merge-duplicates" : "resolution=ignore-duplicates"));
    const previous = rows.get(userId);
    if (!previous) rows.set(userId, { user_id: userId, gender: body.gender ?? null, seen_at: "2026-10-02T12:00:00.000Z" });
    else if (body.gender) rows.set(userId, { ...previous, gender: body.gender });
    return new Response(null, { status: 201 });
  });
});
afterEach(() => { mock.restoreAll(); });

test("GET is unseen for a new owner; skip marks seen without choosing a gender", async () => {
  assert.deepEqual(await readPreference(), { seen: false, gender: null });
  assert.deepEqual(await writePreference({}), { seen: true, gender: null });
  assert.deepEqual(await readPreference(), { seen: true, gender: null });
  assert.equal(rows.size, 1);
});

test("explicit gender saves survive delayed or repeated skips and preserve initial seen timestamp", async () => {
  assert.deepEqual(await writePreference({ gender: "female" }), { seen: true, gender: "female" });
  const firstSeen = rows.get(userId).seen_at;
  assert.deepEqual(await writePreference({}), { seen: true, gender: "female" });
  assert.deepEqual(await writePreference({}), { seen: true, gender: "female" });
  assert.deepEqual(await writePreference({ gender: "male" }), { seen: true, gender: "male" });
  assert.equal(rows.size, 1);
  assert.equal(rows.get(userId).seen_at, firstSeen);
});

test("owner is derived from verified Firebase identity and query/body owner spoofing is rejected", async () => {
  await writePreference({ gender: "female" });
  userId = "another-owner";
  assert.deepEqual(await readPreference(), { seen: false, gender: null });
  await writePreference({ gender: "male" });
  userId = "verified-owner";
  assert.deepEqual(await readPreference(), { seen: true, gender: "female" });
  const before = requests.length;
  assert.equal((await POST(postRequest({ userId: "another-owner", gender: "male" }))).status, 400);
  assert.equal(requests.length, before);
  assert.equal(rows.get("another-owner").gender, "male");
});

test("POST rejects malformed/extra fields before database access", async () => {
  for (const body of [null, [], "female", { gender: null }, { gender: "other" }, { seen: true }, { gender: "female", user_id: "foreign-owner" }]) {
    assert.equal((await POST(postRequest(body))).status, 400);
  }
  const malformed = new Request("https://www.getugcpilot.com/api/characters/preferences", { method: "POST", body: "{" });
  assert.equal((await POST(malformed)).status, 400);
  assert.equal((await POST(postRequest({ gender: "x".repeat(1_001) }))).status, 400);
  assert.equal(requests.length, 0);
});

test("authentication and email verification happen before reads or writes", async () => {
  for (const status of [401, 403]) {
    authError = new FirebaseAuthRequestError("Sign in and verify your email.", status);
    assert.equal((await GET(getRequest())).status, status);
    assert.equal((await POST(postRequest({ gender: "female" }))).status, status);
  }
  assert.equal(requests.length, 0);
});

test("responses expose only seen/gender and prevent cached account data", async () => {
  const response = await POST(postRequest({ gender: "female" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true, preference: { seen: true, gender: "female" } });
  const get = await GET(getRequest());
  assert.equal(get.headers.get("Cache-Control"), "no-store");
  assert.ok(!(await get.text()).includes("seen_at"));
});

test("foreign database rows fail closed instead of leaking another owner's preference", async () => {
  foreignRead = { user_id: "foreign-owner", gender: "male", seen_at: "2026-10-02T12:00:00.000Z" };
  const response = await GET(getRequest());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});

test("database faults remain recoverable and keep internal SQL details private", async () => {
  databaseError = "private SQL relation/credential diagnostic";
  const log = mock.method(console, "error", () => {});
  const response = await POST(postRequest({ gender: "female" }));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("SQL"));
  assert.ok(!JSON.stringify(log.mock.calls.map((call) => call.arguments)).includes("credential"));
});
