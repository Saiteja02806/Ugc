import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-PEWJZ44H9Q";
const analytics = await import("./site-analytics.ts");
let storage, scripts, cookieWrites;
beforeEach(() => {
  storage = new Map(); scripts = []; cookieWrites = [];
  globalThis.window = {
    location: { hostname: "getugcpilot.com", pathname: "/", protocol: "https:" },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) },
    dispatchEvent() {},
  };
  globalThis.document = {
    referrer: "https://www.google.com/search?q=private@example.com",
    createElement: () => ({}), head: { appendChild: script => scripts.push(script) },
    get cookie() { return "_ga=123; _ga_PEWJZ44H9Q=456; ugc-session=secret; theme=dark"; },
    set cookie(value) { cookieWrites.push(value); },
  };
});
afterEach(() => { delete globalThis.window; delete globalThis.document; });
const events = name => (window.dataLayer ?? []).filter(row => row[0] === "event" && row[1] === name);

test("no script or events before consent or after rejection", () => {
  analytics.updateAnalyticsPage("/"); analytics.trackAccountCreated("Email", "private-uid");
  analytics.setAnalyticsConsent("denied"); analytics.updateAnalyticsPage("/pricing");
  assert.equal(scripts.length, 0); assert.equal(events("page_view").length, 0);
  assert.equal(events("sign_up").length, 0);
});
test("acceptance loads one tag and deduplicates hydration while measuring new public navigation", () => {
  analytics.setAnalyticsConsent("granted");
  analytics.updateAnalyticsPage("/"); analytics.updateAnalyticsPage("/"); analytics.updateAnalyticsPage("/pricing");
  assert.equal(scripts.length, 1); assert.equal(scripts[0].referrerPolicy, "origin");
  assert.equal(events("page_view").length, 2);
  assert.equal(window.dataLayer.find(row => row[0] === "config")[2].send_page_view, false);
  assert.equal(window.dataLayer.find(row => row[0] === "config")[2].allow_google_signals, false);
});
test("workspace, OAuth, email actions, and unexpected URLs never become page views or raw metadata", () => {
  analytics.setAnalyticsConsent("granted");
  for (const path of ["/dashboard/private-uid", "/oauth/authorize", "/__/auth/action", "/verify-email", "/?email=private@example.com#secret"]) {
    analytics.updateAnalyticsPage(path);
    assert.equal(analytics.safePageParameters(path).page_location, "https://getugcpilot.com/account");
  }
  assert.equal(events("page_view").length, 0);
  assert.doesNotMatch(JSON.stringify(window.dataLayer), /private-uid|private@example|secret|oauth|verify-email/);
  assert.equal(analytics.safePageParameters("/", "https://private.example/path?token=secret#email").page_referrer,"https://private.example");
  assert.equal(analytics.safePageParameters("/", "javascript:alert(1)").page_referrer,"");
});
test("signup sends only a method and safe page metadata, once per created account", () => {
  analytics.setAnalyticsConsent("granted");
  window.location.pathname = "/oauth/authorize";
  analytics.trackAccountCreated("Google", "private-uid"); analytics.trackAccountCreated("Google", "private-uid");
  assert.equal(events("sign_up").length, 1);
  assert.equal(events("sign_up")[0][2].method, "Google");
  assert.equal(events("sign_up")[0][2].page_location, "https://getugcpilot.com/sign-in");
  assert.doesNotMatch(JSON.stringify(window.dataLayer), /private-uid|oauth/);
});
test("revocation disables collection and expires only GA cookies, and reacceptance resumes", () => {
  analytics.setAnalyticsConsent("granted"); analytics.updateAnalyticsPage("/");
  analytics.setAnalyticsConsent("denied"); analytics.updateAnalyticsPage("/pricing");
  assert.equal(window["ga-disable-G-PEWJZ44H9Q"], true);
  assert.equal(events("page_view").length, 1);
  assert.ok(cookieWrites.length > 0);
  assert.ok(cookieWrites.every(value => value.startsWith("_ga=") || value.startsWith("_ga_")));
  analytics.setAnalyticsConsent("granted"); analytics.updateAnalyticsPage("/pricing");
  assert.equal(events("page_view").length, 2); assert.equal(scripts.length, 1);
});
test("consent withdrawn in another tab disables the already loaded tag", () => {
  analytics.setAnalyticsConsent("granted"); analytics.updateAnalyticsPage("/");
  storage.set(analytics.ANALYTICS_CONSENT_KEY,"denied"); analytics.updateAnalyticsPage("/");
  assert.equal(window["ga-disable-G-PEWJZ44H9Q"],true);
});
test("blocked storage, server execution and preview hosts fail closed; signup measurement never throws", () => {
  window.localStorage.getItem = () => { throw new Error("blocked"); };
  assert.equal(analytics.readAnalyticsConsent(),null); analytics.updateAnalyticsPage("/");
  assert.doesNotThrow(() => analytics.trackAccountCreated("Email","id"));
  window.location.hostname = "preview.vercel.app"; assert.equal(analytics.analyticsEnabled(),false);
  delete globalThis.window; assert.equal(analytics.analyticsEnabled(),false);
  assert.doesNotThrow(() => analytics.trackAccountCreated("Email","id"));
});
