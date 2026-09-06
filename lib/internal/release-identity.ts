const GIT_COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;

export type AppReleaseIdentity = {
  gitCommit: string | null;
  source: "UGC_APP_GIT_COMMIT" | "VERCEL_GIT_COMMIT_SHA" | null;
};

/**
 * Returns a safe, server-side release identifier for deployment diagnostics.
 * An explicit value wins so non-Vercel deploys and release tooling can use the
 * same identity as the Cloud Run worker. Invalid values deliberately do not
 * look like a verified commit.
 */
export function getAppReleaseIdentity(
  env: Record<string, string | undefined> = process.env,
): AppReleaseIdentity {
  for (const source of [
    "UGC_APP_GIT_COMMIT",
    "VERCEL_GIT_COMMIT_SHA",
  ] as const) {
    const gitCommit = normalizeGitCommit(env[source]);

    if (gitCommit) {
      return { gitCommit, source };
    }
  }

  return { gitCommit: null, source: null };
}

export function normalizeGitCommit(value: string | undefined | null) {
  const normalized = value?.trim().toLowerCase() || "";

  return GIT_COMMIT_PATTERN.test(normalized) ? normalized : null;
}
