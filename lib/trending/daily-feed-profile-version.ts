export type DailyFeedProfileIdentity = {
  businessProfileId: string;
  businessProfileVersion: number;
};

export type ActiveProfileIdentity = {
  id: string;
  profileVersion: number;
};

/** A daily pack continues to use the business profile version it reserved. */
export function isDailyFeedPinnedToHistoricalProfile(
  feed: DailyFeedProfileIdentity,
  profile: ActiveProfileIdentity,
) {
  return (
    feed.businessProfileId === profile.id &&
    feed.businessProfileVersion !== profile.profileVersion
  );
}

/**
 * Creates a read-only profile view for existing daily assignments. Only the
 * version changes; writers never receive this view because a historical daily
 * pack is never prepared after a context activation.
 */
export function getProfilePinnedToDailyFeed<
  T extends ActiveProfileIdentity,
>(profile: T, feed: DailyFeedProfileIdentity): T {
  return isDailyFeedPinnedToHistoricalProfile(feed, profile)
    ? { ...profile, profileVersion: feed.businessProfileVersion }
    : profile;
}
