type TrendingScreenIdentity = {
  email?: string | null;
  emailVerified?: boolean | null;
};

/** Temporary screen rollout only. Does not grant billing or generation access. */
export function canViewTrendingScreen(identity: TrendingScreenIdentity | null | undefined) {
  return identity?.emailVerified === true &&
    identity.email?.trim().toLowerCase() === "vtu19403@veltech.edu.in";
}
