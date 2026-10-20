import "server-only";

// Keep callers on the same resilient snapshot/refresh service as the UI routes.
export { refreshAnalyticsSnapshot as readOrRefreshSocialAnalytics } from "./snapshot-service";
