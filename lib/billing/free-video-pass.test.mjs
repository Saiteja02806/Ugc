import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test, { mock } from "node:test";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const local = (file) => pathToFileURL(path.resolve(file)).href;
process.env.SUPABASE_URL = "https://free-video-pass-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role-key";

registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === "next/server" ? "next/server.js" : specifier,
      context,
    );
  },
});

let currentUid = "user-alpha";
class FirebaseAuthRequestError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

mock.module(local("lib/firebase/server-auth.ts"), {
  namedExports: {
    FirebaseAuthRequestError,
    requireFirebaseUser: async () => ({ uid: currentUid }),
  },
});

const paidMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260910105839_add_complimentary_plan_grants.sql",
    import.meta.url,
  ),
  "utf8",
);
const freeCreditsMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20261003110411_one_time_free_generation_credits.sql",
    import.meta.url,
  ),
  "utf8",
);
const freeVideoPassMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20261107120000_add_free_video_pass_links.sql",
    import.meta.url,
  ),
  "utf8",
);

const paidFunction = (name) =>
  paidMigration.match(
    new RegExp(
      `create or replace function public\\.${name} \\([\\s\\S]*?\\$function\\$;`,
      "iu",
    ),
  )?.[0];
const triggerFunction = paidMigration.match(
  /create or replace function public\.settle_billing_from_background_job\(\)[\s\S]*?\$function\$;/iu,
)?.[0];

async function createDbFixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table billing_webhook_events(webhook_id text primary key,event_type text,event_timestamp timestamptz,payload jsonb,status text default 'pending',processed_at timestamptz,error_message text);
    create table billing_customers(user_id text primary key,dodo_customer_id text,email text,updated_at timestamptz);
    create table billing_subscriptions(dodo_subscription_id text primary key,user_id text,dodo_customer_id text,product_id text,plan_key text,billing_interval text,status text,current_period_start timestamptz,current_period_end timestamptz,cancel_at_period_end boolean,cancelled_at timestamptz,last_event_at timestamptz,last_webhook_id text,metadata jsonb,updated_at timestamptz);
    create table user_subscription_plans(user_id text,plan_key text,is_active boolean,source text,updated_at timestamptz);
    create table billing_credit_balances(user_id text primary key,dodo_subscription_id text,plan_key text,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,updated_at timestamptz);
    create table complimentary_plan_grants(id uuid primary key default gen_random_uuid(),user_id text,plan_key text,revoked_at timestamptz,expires_at timestamptz,granted_at timestamptz default now());
    create table complimentary_plan_credit_balances(grant_id uuid primary key,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,updated_at timestamptz);
    create table background_jobs(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,status text default 'queued',completed_at timestamptz);
    create table billing_credit_reservations(id uuid primary key default gen_random_uuid(),user_id text,idempotency_key text,job_type text,amount int check(amount>0),credit_period_start timestamptz,complimentary_plan_grant_id uuid,status text default 'reserved',background_job_id uuid,settled_at timestamptz,updated_at timestamptz default now(),unique(user_id,idempotency_key));
    create table billing_usage_outbox(event_id text primary key,user_id text,dodo_customer_id text,background_job_id uuid,generation_kind text,credit_cost int,occurred_at timestamptz);
    grant select,insert,update on billing_credit_reservations,billing_subscriptions,complimentary_plan_grants to service_role;
  `);
  await db.exec(paidFunction("reserve_billing_credits"));
  await db.exec(paidFunction("settle_billing_credit_reservation"));
  await db.exec(triggerFunction);
  await db.exec(freeCreditsMigration);
  await db.exec(freeVideoPassMigration);
  await db.exec(
    "create trigger settle_billing after update on background_jobs for each row execute function settle_billing_from_background_job()",
  );
  return db;
}

const { GET: redirectFreeVideoCodeRoute } = await import(
  local("app/freevideo/[code]/route.ts")
);
const { GET: redirectFreeVideoQueryRoute } = await import(
  local("app/freevideo/route.ts")
);
const { GET: getSubscriptionRoute } = await import(
  local("app/api/billing/subscription/route.ts")
);
const {
  claimFreeVideoPassLink,
  createFreeVideoPassLinks,
  FREE_VIDEO_PASS_COOKIE_NAME,
  FreeVideoPassError,
  getUserFreeVideoPass,
  inspectFreeVideoPassCode,
  reserveFreeVideoPassCredits,
} = await import(local("lib/billing/free-video-pass.ts"));
const { reserveBillingCredits } = await import(
  local("lib/billing/subscription-db.ts")
);

test("clicking vidmake.io/freevideo/<code> or /freevideo?code=<code> redirects directly to /explore with no intermediate landing page and sets the pass cookie", async () => {
  const code = "fv_DirectExploreLink01";

  const pathResponse = await redirectFreeVideoCodeRoute(
    new Request(`https://vidmake.io/freevideo/${code}`),
    { params: Promise.resolve({ code }) },
  );
  assert.equal(pathResponse.status, 307);
  assert.equal(pathResponse.headers.get("location"), "https://vidmake.io/explore");
  const setCookieHeader = pathResponse.headers.get("set-cookie") ?? "";
  assert.match(setCookieHeader, new RegExp(`${FREE_VIDEO_PASS_COOKIE_NAME}=${code}`));

  const queryResponse = await redirectFreeVideoQueryRoute(
    new Request(`https://vidmake.io/freevideo?code=${code}`),
  );
  assert.equal(queryResponse.status, 307);
  assert.equal(queryResponse.headers.get("location"), "https://vidmake.io/explore");
  assert.match(
    queryResponse.headers.get("set-cookie") ?? "",
    new RegExp(`${FREE_VIDEO_PASS_COOKIE_NAME}=${code}`),
  );
});

test("single-use link claim RPC enforces one user per link, one pass per user, and job settlement updates pass status cleanly", async () => {
  const db = await createDbFixture();
  try {
    await db.query(
      `insert into public.free_video_pass_links (code, created_by_user_id)
       values ('fv_SingleUseCode001', 'admin-1'), ('fv_SingleUseCode002', 'admin-1')`,
    );

    const claimed = (
      await db.query(
        "select * from public.claim_free_video_pass_link('fv_SingleUseCode001', 'user-1')",
      )
    ).rows[0];
    assert.equal(claimed.claimed_by_user_id, "user-1");
    assert.equal(claimed.pass_status, "available");

    // Idempotent re-claim by the same user succeeds
    const reclaimed = (
      await db.query(
        "select * from public.claim_free_video_pass_link('fv_SingleUseCode001', 'user-1')",
      )
    ).rows[0];
    assert.equal(reclaimed.id, claimed.id);

    // Another user cannot claim the same single-use link
    await assert.rejects(
      db.query(
        "select * from public.claim_free_video_pass_link('fv_SingleUseCode001', 'user-2')",
      ),
      /free_video_pass_already_claimed/u,
    );

    // The same user cannot claim a second single-use link
    await assert.rejects(
      db.query(
        "select * from public.claim_free_video_pass_link('fv_SingleUseCode002', 'user-1')",
      ),
      /free_video_pass_user_already_has_pass/u,
    );

    // Simulate a reserved Hook video that fails first -> pass returns to 'available'
    await db.query(
      "select public.ensure_free_generation_credit_balance('user-1')",
    );
    await db.query(
      `update public.free_generation_credit_balances
       set credit_limit = 5, reserved_credits = 5
       where user_id = 'user-1'`,
    );
    await db.query(
      `update public.free_video_pass_links
       set pass_status = 'reserved', reserved_format = 'hook', reserved_generation_key = 'hook-gen-1', reserved_units = 1
       where code = 'fv_SingleUseCode001'`,
    );
    await db.query(
      `insert into public.billing_credit_reservations (user_id, idempotency_key, job_type, amount, status, uses_free_generation_credits)
       values ('user-1', 'hook-gen-1', 'generate_hook_video', 5, 'reserved', true)`,
    );
    await db.query(
      `insert into public.background_jobs (user_id, idempotency_key, job_type, status)
       values ('user-1', 'hook-gen-1', 'generate_hook_video', 'queued')`,
    );
    await db.query(
      "update public.background_jobs set status = 'failed' where idempotency_key = 'hook-gen-1'",
    );

    const afterFail = (
      await db.query(
        "select * from public.free_video_pass_links where code = 'fv_SingleUseCode001'",
      )
    ).rows[0];
    assert.equal(afterFail.pass_status, "available");
    assert.equal(afterFail.reserved_format, null);
    assert.equal(afterFail.reserved_generation_key, null);

    // Now reserve and complete a Hook video -> pass becomes 'used' and outbox stays empty
    await db.query(
      `update public.free_generation_credit_balances
       set credit_limit = 5, reserved_credits = 5
       where user_id = 'user-1'`,
    );
    await db.query(
      `update public.free_video_pass_links
       set pass_status = 'reserved', reserved_format = 'hook', reserved_generation_key = 'hook-gen-2', reserved_units = 1
       where code = 'fv_SingleUseCode001'`,
    );
    await db.query(
      `insert into public.billing_credit_reservations (user_id, idempotency_key, job_type, amount, status, uses_free_generation_credits)
       values ('user-1', 'hook-gen-2', 'generate_hook_video', 5, 'reserved', true)`,
    );
    await db.query(
      `insert into public.background_jobs (user_id, idempotency_key, job_type, status)
       values ('user-1', 'hook-gen-2', 'generate_hook_video', 'queued')`,
    );
    await db.query(
      "update public.background_jobs set status = 'completed' where idempotency_key = 'hook-gen-2'",
    );

    const afterComplete = (
      await db.query(
        "select * from public.free_video_pass_links where code = 'fv_SingleUseCode001'",
      )
    ).rows[0];
    assert.equal(afterComplete.pass_status, "used");
    assert.equal(afterComplete.completed_units, 1);
    assert.ok(afterComplete.used_at);
    assert.equal(
      (await db.query("select count(*)::int count from public.billing_usage_outbox"))
        .rows[0].count,
      0,
    );
  } finally {
    await db.close();
  }
});

test("Explore auto-claim via cookie and format reservations allow 1 Hook, Wall-of-Text, or Complete Slideshow while rejecting Talking Head and regular unpaid users", async () => {
  // In-memory Supabase REST/RPC mock for lib/billing/free-video-pass.ts & subscription-db.ts
  const links = new Map();
  const balances = new Map();
  const reservations = new Map();

  const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Content-Range": "*/0",
      },
    });

  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const method = (init?.method ?? input.method ?? "GET").toUpperCase();
    const rawBody = init?.body ? JSON.parse(String(init.body)) : null;
    const pathPart = url.pathname.split("/").pop();
    const reqHeaders = new Headers(init?.headers ?? input?.headers);
    const wantsSingleObject = (reqHeaders.get("accept") ?? "").includes(
      "application/vnd.pgrst.object+json",
    );

    if (pathPart === "ensure_free_generation_credit_balance") {
      const userId = rawBody?.p_user_id ?? "unknown";
      if (!balances.has(userId)) {
        balances.set(userId, {
          user_id: userId,
          credit_limit: 0,
          used_credits: 0,
          reserved_credits: 0,
          granted_at: new Date().toISOString(),
        });
      }
      const b = balances.get(userId);
      return jsonResponse({
        granted: b.credit_limit,
        remaining: Math.max(b.credit_limit - b.used_credits - b.reserved_credits, 0),
        reserved: b.reserved_credits,
        used: b.used_credits,
      });
    }

    if (pathPart === "claim_free_video_pass_link") {
      const code = rawBody?.p_code;
      const userId = rawBody?.p_user_id;
      const row = links.get(code);
      if (!row) {
        return jsonResponse({ message: "free_video_pass_not_found" }, 400);
      }
      if (row.claimed_by_user_id && row.claimed_by_user_id !== userId) {
        return jsonResponse({ message: "free_video_pass_already_claimed" }, 400);
      }
      for (const other of links.values()) {
        if (other.claimed_by_user_id === userId && other.code !== code) {
          return jsonResponse(
            { message: "free_video_pass_user_already_has_pass" },
            400,
          );
        }
      }
      row.claimed_by_user_id = userId;
      row.claimed_at = new Date().toISOString();
      row.pass_status = "available";
      return jsonResponse(row);
    }

    if (pathPart === "reserve_billing_credits") {
      return jsonResponse({ message: "insufficient_billing_credits" }, 400);
    }

    if (pathPart === "free_video_pass_links") {
      if (method === "POST") {
        const items = Array.isArray(rawBody) ? rawBody : [rawBody];
        const created = items.map((item, idx) => {
          const row = {
            id: `link-${links.size + idx + 1}`,
            code: item.code,
            label: item.label ?? null,
            created_by_user_id: item.created_by_user_id,
            claimed_by_user_id: null,
            claimed_at: null,
            pass_status: item.pass_status ?? "unclaimed",
            reserved_format: null,
            reserved_generation_key: null,
            reserved_units: 0,
            completed_units: 0,
            keyframe_attempts_used: 0,
            expires_at: item.expires_at ?? null,
            used_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          links.set(row.code, row);
          return row;
        });
        return jsonResponse(created, 201);
      }

      if (method === "GET") {
        const codeEq = url.searchParams.get("code")?.replace(/^eq\./u, "");
        const claimedByEq = url.searchParams
          .get("claimed_by_user_id")
          ?.replace(/^eq\./u, "");
        const idEq = url.searchParams.get("id")?.replace(/^eq\./u, "");
        let matched = [...links.values()];
        if (codeEq) matched = matched.filter((r) => r.code === codeEq);
        if (claimedByEq) {
          matched = matched.filter((r) => r.claimed_by_user_id === claimedByEq);
        }
        if (idEq) matched = matched.filter((r) => r.id === idEq);
        if (wantsSingleObject) {
          return jsonResponse(matched[0] ?? null);
        }
        return jsonResponse(matched);
      }

      if (method === "PATCH") {
        const idEq = url.searchParams.get("id")?.replace(/^eq\./u, "");
        const statusEq = url.searchParams
          .get("pass_status")
          ?.replace(/^eq\./u, "");
        const row = [...links.values()].find((r) => r.id === idEq);
        if (!row || (statusEq && row.pass_status !== statusEq)) {
          return jsonResponse(null);
        }
        Object.assign(row, rawBody);
        return jsonResponse(row);
      }
    }

    if (pathPart === "free_generation_credit_balances") {
      const userId = url.searchParams.get("user_id")?.replace(/^eq\./u, "");
      if (method === "GET") {
        return jsonResponse(balances.get(userId) ?? null);
      }
      if (method === "PATCH") {
        const current = balances.get(userId);
        Object.assign(current, rawBody);
        return jsonResponse(current);
      }
    }

    if (pathPart === "billing_credit_reservations") {
      if (method === "GET") {
        const userId = url.searchParams.get("user_id")?.replace(/^eq\./u, "");
        const keyEq = url.searchParams
          .get("idempotency_key")
          ?.replace(/^eq\./u, "");
        const keyLike = url.searchParams
          .get("idempotency_key")
          ?.replace(/^like\./u, "")
          ?.replace(/%$/u, "");
        if (keyEq) {
          return jsonResponse(reservations.get(`${userId}:${keyEq}`) ?? null);
        }
        const matched = [...reservations.values()].filter(
          (r) =>
            r.user_id === userId &&
            (!keyLike || r.idempotency_key.startsWith(keyLike)),
        );
        return jsonResponse(matched);
      }
      if (method === "POST") {
        const item = Array.isArray(rawBody) ? rawBody[0] : rawBody;
        const record = {
          id: `res-${reservations.size + 1}`,
          ...item,
        };
        reservations.set(`${item.user_id}:${item.idempotency_key}`, record);
        return jsonResponse(record, 201);
      }
    }

    if (pathPart === "subscription_entitlements") {
      return jsonResponse([
        { plan_key: "free", daily_trending_limit: 20 },
        { plan_key: "pro", daily_trending_limit: 20 },
      ]);
    }

    if (method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "Content-Range": "*/0" },
      });
    }

    return jsonResponse(url.pathname.includes("/rpc/") ? null : []);
  };

  // 1. Admin creates two unique single-use links
  const createdLinks = await createFreeVideoPassLinks({
    count: 2,
    createdByUserId: "admin-owner",
    label: "Creator outreach",
  });
  assert.equal(createdLinks.length, 2);
  const [link1, link2] = createdLinks;
  assert.equal(link1.url, `https://vidmake.io/freevideo/${link1.code}`);

  // 2. Regular unpaid user (without a link) cannot generate anything for free
  await assert.rejects(
    reserveBillingCredits({
      amount: 5,
      freeVideoPassContext: {
        format: "hook",
        generationKey: "unclaimed-hook",
        kind: "generation",
      },
      idempotencyKey: "unclaimed-hook",
      jobType: "generate_hook_video",
      userId: "regular-visitor",
    }),
    (err) => err.status === 402,
  );

  // 3. User Alpha clicks link1 -> redirected to /explore with cookie -> GET /api/billing/subscription claims it automatically
  currentUid = "user-alpha";
  const subRes = await getSubscriptionRoute(
    new Request("https://vidmake.io/api/billing/subscription", {
      headers: {
        cookie: `${FREE_VIDEO_PASS_COOKIE_NAME}=${link1.code}`,
      },
    }),
  );
  assert.equal(subRes.status, 200);
  const subPayload = await subRes.json();
  assert.equal(subPayload.subscription.freeVideoPass.available, true);
  assert.equal(subPayload.subscription.freeVideoPass.status, "available");
  assert.deepEqual(subPayload.subscription.freeVideoPass.allowedFormats, [
    "hook",
    "wall_text",
    "slideshow",
  ]);
  // Cookie is cleared after auto-claim
  assert.match(subRes.headers.get("set-cookie") ?? "", /Max-Age=0/iu);

  // 4. Talking Head is strictly rejected even with an available pass
  await assert.rejects(
    reserveFreeVideoPassCredits({
      amount: 5,
      context: {
        format: "talking_head",
        generationKey: "talking-head-attempt",
        kind: "generation",
      },
      idempotencyKey: "talking-head-attempt",
      jobType: "generate_hook_video",
      userId: "user-alpha",
    }),
    (err) =>
      err instanceof FreeVideoPassError &&
      err.status === 402 &&
      err.code === "free_video_pass_format_excluded",
  );

  // 5. User Alpha can prepare a starting frame and then generate 1 Hook video
  const keyframeRes = await reserveBillingCredits({
    amount: 1,
    freeVideoPassContext: {
      format: "hook",
      generationKey: "alpha-keyframe-1",
      kind: "starting_frame",
    },
    idempotencyKey: "alpha-keyframe-1",
    jobType: "generate_image",
    userId: "user-alpha",
  });
  assert.equal(keyframeRes.status, "reserved");

  const hookVideoRes = await reserveBillingCredits({
    amount: 5,
    freeVideoPassContext: {
      format: "hook",
      generationKey: "alpha-hook-video-1",
      kind: "generation",
    },
    idempotencyKey: "alpha-hook-video-1",
    jobType: "generate_hook_video",
    userId: "user-alpha",
  });
  assert.equal(hookVideoRes.status, "reserved");

  // 6. User Alpha cannot generate a second video (Wall-of-Text, Hook, or Slideshow) once the 1 pass is reserved/used
  await assert.rejects(
    reserveBillingCredits({
      amount: 5,
      freeVideoPassContext: {
        format: "wall_text",
        generationKey: "alpha-second-video",
        kind: "generation",
      },
      idempotencyKey: "alpha-second-video",
      jobType: "generate_hook_video",
      userId: "user-alpha",
    }),
    (err) => err.status === 402,
  );

  // 7. User Beta tries to claim link1 (already claimed by Alpha) -> rejected
  await assert.rejects(
    claimFreeVideoPassLink({ code: link1.code, userId: "user-beta" }),
    (err) => err instanceof FreeVideoPassError && err.status === 409,
  );

  // 8. User Beta claims link2 and generates 1 complete 4-slide Slideshow + V1 face swap
  const betaPass = await claimFreeVideoPassLink({
    code: link2.code,
    userId: "user-beta",
  });
  assert.equal(betaPass.available, true);

  for (let slideIndex = 1; slideIndex <= 4; slideIndex += 1) {
    const slideReservation = await reserveBillingCredits({
      amount: 1,
      freeVideoPassContext: {
        format: "slideshow",
        generationKey: "beta-slideshow-batch",
        kind: "generation",
        totalUnits: 4,
      },
      idempotencyKey: `beta-slideshow-batch:${slideIndex}`,
      jobType: "generate_image",
      userId: "user-beta",
    });
    assert.equal(slideReservation.status, "reserved");
  }

  const faceSwapReservation = await reserveBillingCredits({
    amount: 1,
    freeVideoPassContext: {
      format: "slideshow",
      generationKey: "beta-slideshow-batch",
      kind: "slideshow_face_swap",
    },
    idempotencyKey: "beta-slideshow-batch:faceswap:0",
    jobType: "generate_image",
    userId: "user-beta",
  });
  assert.equal(faceSwapReservation.status, "reserved");

  // Attempting a second slideshow batch with a different generationKey is rejected with 402
  await assert.rejects(
    reserveBillingCredits({
      amount: 1,
      freeVideoPassContext: {
        format: "slideshow",
        generationKey: "beta-second-slideshow",
        kind: "generation",
        totalUnits: 3,
      },
      idempotencyKey: "beta-second-slideshow:1",
      jobType: "generate_image",
      userId: "user-beta",
    }),
    (err) => err.status === 402,
  );

  const inspection = await inspectFreeVideoPassCode(link2.code, "user-beta");
  assert.equal(inspection.state, "claimed_by_viewer");
  assert.equal((await getUserFreeVideoPass("user-beta"))?.status, "reserved");
});
