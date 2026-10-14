import publicPaths from "../marketing/public-page-paths.json" with { type: "json" };

export const ANALYTICS_CONSENT_KEY = "ugc-pilot.analytics-consent.v1";
export const ANALYTICS_CONSENT_EVENT = "ugc-pilot:analytics-consent";
export type AnalyticsConsent = "granted" | "denied";
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
const origin = "https://getugcpilot.com";
const publicPages = new Set([...publicPaths, "/sign-in", "/connect-ai", "/cookies", "/privacy", "/terms"]);
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  ugcPilotAnalytics?: { configured: boolean; lastPage: string | null; signups: Set<string> };
  [key: `ga-disable-${string}`]: boolean | undefined;
};

export function analyticsEnabled() {
  return typeof window !== "undefined" && /^G-[A-Z0-9]+$/.test(measurementId) &&
    ["getugcpilot.com", "www.getugcpilot.com"].includes(window.location.hostname);
}

export function readAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch { return null; }
}

export function isPublicAnalyticsPage(pathname: string) {
  return publicPages.has(pathname);
}

// Use a fixed account label for private/OAuth routes. Never send their actual
// path, query, hash, document title, Firebase UID, email, or business context.
export function safePageParameters(pathname: string, referrer = "") {
  const safePath = isPublicAnalyticsPage(pathname) ? pathname : "/account";
  let safeReferrer = "";
  try {
    const url = new URL(referrer);
    if (url.protocol === "https:" || url.protocol === "http:") safeReferrer = url.origin;
  } catch { /* Direct visit. */ }
  return {
    page_location: `${origin}${safePath}`,
    page_title: safePath === "/" ? "UGC Pilot" : `UGC Pilot ${safePath}`,
    page_referrer: safeReferrer,
  };
}

function browser() { return window as unknown as AnalyticsWindow; }

export function setAnalyticsConsent(value: AnalyticsConsent) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value); } catch {
    // Fail closed if the browser cannot remember the visitor's choice.
    return;
  }
  const target = browser();
  target[`ga-disable-${measurementId}`] = value !== "granted";
  if (value === "denied") {
    target.gtag?.("consent", "update", { analytics_storage: "denied" });
    if (target.ugcPilotAnalytics) target.ugcPilotAnalytics.lastPage = null;
    // Delete only Analytics cookies; leave authentication and preferences alone.
    for (const part of document.cookie.split(";")) {
      const name = part.trim().split("=")[0];
      if (name !== "_ga" && !name.startsWith("_ga_")) continue;
      for (const domain of ["", "; domain=getugcpilot.com", "; domain=.getugcpilot.com", `; domain=${window.location.hostname}`]) {
        document.cookie = `${name}=; max-age=0; path=/${domain}; SameSite=Lax; Secure`;
      }
    }
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

export function updateAnalyticsPage(pathname: string) {
  if (!analyticsEnabled()) return;
  const target = browser();
  if (readAnalyticsConsent() !== "granted") {
    target[`ga-disable-${measurementId}`] = true;
    target.gtag?.("consent", "update", { analytics_storage: "denied" });
    if (target.ugcPilotAnalytics) target.ugcPilotAnalytics.lastPage = null;
    return;
  }
  target[`ga-disable-${measurementId}`] = false;
  const state = target.ugcPilotAnalytics ??= { configured: false, lastPage: null, signups: new Set() };
  const parameters = safePageParameters(pathname, document.referrer);
  target.dataLayer ??= [];
  // Google's loader consumes the standard gtag arguments-object command queue.
  // eslint-disable-next-line prefer-rest-params -- Preserve Google's documented gtag queue format.
  target.gtag ??= function () { target.dataLayer!.push(arguments); };
  // Global values apply to automatic engagement events as well as our events.
  target.gtag("set", parameters);
  target.gtag("consent", state.configured ? "update" : "default", {
    analytics_storage: "granted", ad_storage: "denied",
    ad_user_data: "denied", ad_personalization: "denied",
  });
  if (!state.configured) {
    target.gtag("js", new Date());
    target.gtag("config", measurementId, {
      send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    state.configured = true;
    const script = document.createElement("script");
    script.id = "ugc-pilot-google-analytics";
    script.async = true;
    script.referrerPolicy = "origin";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }
  if (isPublicAnalyticsPage(pathname) && state.lastPage !== pathname) {
    target.gtag("event", "page_view", { ...parameters, send_to: measurementId });
  }
  state.lastPage = pathname;
}

export function trackAccountCreated(method: "Google" | "Email", accountId: string) {
  // Measurement must never turn successful authentication into an error.
  try {
    if (!analyticsEnabled() || readAnalyticsConsent() !== "granted") return;
    updateAnalyticsPage(window.location.pathname);
    const target = browser();
    const state = target.ugcPilotAnalytics!;
    if (state.signups.has(accountId)) return;
    state.signups.add(accountId); // In-memory deduplication only; never transmitted.
    target.gtag!("event", "sign_up", {
      method, ...safePageParameters("/sign-in", document.referrer), send_to: measurementId,
    });
  } catch { /* Analytics is optional; auth continues normally. */ }
}
